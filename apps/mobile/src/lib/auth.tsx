import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isConfigured, sampleMode } from './config';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  /** True when the workspace belongs to an anonymous session (no email linked). */
  isAnonymous: boolean;
  /**
   * WF-01 "Get started": open a private workspace without a sign-in step.
   * Uses a Supabase anonymous session so every visitor gets their own
   * RLS-protected data. No-op in the sample preview.
   */
  startWorkspace(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Plain-language auth errors; network failures never surface as raw browser text. */
function authError(message: string): Error {
  if (/fetch|network|timed? ?out/i.test(message)) return new Error("Couldn't reach the sign-in service. Check your connection and try again.");
  if (/invalid login credentials/i.test(message)) return new Error('That email and password combination is not recognised.');
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
      isAnonymous: Boolean((session?.user as { is_anonymous?: boolean } | undefined)?.is_anonymous),
      async startWorkspace() {
        if (sampleMode) return;
        const { data } = await supabase.auth.getSession();
        if (data.session) return;
        const { error } = await supabase.auth.signInAnonymously().catch((e: Error) => ({ error: e }));
        if (error) throw authError(error.message);
      },
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password }).catch((e: Error) => ({ error: e }));
        if (error) throw authError(error.message);
      },
      async signUp(email, password) {
        const res = await supabase.auth.signUp({ email, password }).catch((e: Error) => ({ data: { session: null }, error: e }));
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
