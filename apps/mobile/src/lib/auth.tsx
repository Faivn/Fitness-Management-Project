import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { api } from './api';
import { isConfigured, sampleMode } from './config';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  /** True for a no-account demo session (Supabase anonymous sign-in). */
  isGuest: boolean;
  startGuest(): Promise<void>;
  /** Erases the guest workspace on the server, then ends the session. */
  endGuest(): Promise<void>;
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
  const queryClient = useQueryClient();
  const userId = useRef<string | null>(null);

  useEffect(() => {
    if (!isConfigured || sampleMode) return;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        userId.current = data.session?.user.id ?? null;
        setSession(data.session);
      })
      .finally(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      // Cached server data belongs to one user: never show it to the next person on this device
      // (e.g. after a guest erases their workspace and starts a new demo).
      const next = s?.user.id ?? null;
      if (next !== userId.current) {
        userId.current = next;
        queryClient.clear();
      }
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

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
      isGuest: session?.user.is_anonymous === true,
      async startGuest() {
        const { error } = await supabase.auth.signInAnonymously().catch((e: Error) => ({ error: e }));
        if (error) {
          if (/anonymous/i.test(error.message)) throw new Error("The demo isn't available right now. If you have an account, sign in instead.");
          throw authError(error.message);
        }
      },
      async endGuest() {
        await api('DELETE', 'guest');
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
