import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';

/** First-run answers and progress. Stored on this device only; no credentials. */
export const ONBOARDING_KEY = 'mova.onboarding';

export const STEPS = ['name', 'experience', 'routine'] as const;
export type OnboardingStep = (typeof STEPS)[number];

const schema = z.object({
  v: z.literal(1),
  name: z.string().trim().max(40).catch(''),
  step: z.enum(STEPS).catch('name'),
  usedApp: z.boolean().nullable().catch(null),
  hasRoutine: z.boolean().nullable().catch(null),
  completed: z.boolean().catch(false),
});

export type OnboardingState = z.infer<typeof schema>;
export const initialOnboarding: OnboardingState = schema.parse({ v: 1 });

/** Anything missing, corrupt or from another version means "start from the welcome". */
export function parseOnboarding(raw: string | null): OnboardingState {
  if (!raw) return initialOnboarding;
  try {
    const r = schema.safeParse(JSON.parse(raw));
    return r.success ? r.data : initialOnboarding;
  } catch {
    return initialOnboarding;
  }
}

interface OnboardingApi {
  state: OnboardingState;
  ready: boolean;
  update(patch: Partial<OnboardingState>): void;
  reset(): void;
}

const Ctx = createContext<OnboardingApi | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>(initialOnboarding);
  const [ready, setReady] = useState(false);
  const latest = useRef(state);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((raw) => {
        const s = parseOnboarding(raw);
        latest.current = s;
        setState(s);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((next: OnboardingState) => {
    latest.current = next;
    setState(next);
    void AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const api = useMemo<OnboardingApi>(
    () => ({
      state,
      ready,
      update: (patch) => persist({ ...latest.current, ...patch }),
      reset: () => {
        latest.current = initialOnboarding;
        setState(initialOnboarding);
        void AsyncStorage.removeItem(ONBOARDING_KEY).catch(() => undefined);
      },
    }),
    [state, ready, persist],
  );
  return createElement(Ctx.Provider, { value: api }, children);
}

export function useOnboarding(): OnboardingApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return v;
}
