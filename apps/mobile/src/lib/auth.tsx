import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { isConfigured, sampleMode } from './config';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Plain-language auth errors; network failures never surface as raw browser text. */
function authError(message: string): Error {
  if (/fetch|network|timed? ?out/i.test(message)) return new Error("Couldn't reach the sign-in service. Check your connection and try again.");
  if (/invalid login credentials/i.test(message)) return new Error('That email and password combination is not recognised.');
  if (/email not confirmed/i.test(message)) return new Error('Please confirm your email first — check your inbox for the link, then sign in.');
  if (/already registered/i.test(message)) return new Error('An account with this email already exists. Sign in instead.');
  return new Error(message);
}

/** Sign-in is kept separate from fitness profiling (WF-01). */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isConfigured && !sampleMode);

  useEffect(() => {
    if (!isConfigured || sampleMode) return;
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password }).catch((e: Error) => ({ error: e }));
        if (error) throw authError(error.message);
      },
      async signUp(email, password) {
        // On web, the confirmation email links back to this site.
        const emailRedirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
        const res = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } }).catch((e: Error) => ({ data: { session: null }, error: e }));
        if (res.error) throw authError(res.error.message);
        return { needsConfirmation: !res.data.session };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
