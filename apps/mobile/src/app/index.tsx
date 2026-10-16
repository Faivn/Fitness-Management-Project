import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Banner, Button, Screen } from '@/components';
import { LoadingState } from '@/components/States';
import { useCompleteOnboarding, useProfile } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { sampleMode } from '@/lib/config';
import { deviceTimeZone } from '@/lib/format';
import { WELCOME_SEEN_KEY } from '@/lib/onboarding';

/**
 * Entry gate (WF-01): first visit → Welcome; afterwards → the workspace.
 * There is no sign-in step: "Get started" opens a private workspace.
 */
export default function Index() {
  const { session, loading, startWorkspace } = useAuth();
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const live = !sampleMode;
  const profile = useProfile(live && !!session);
  const complete = useCompleteOnboarding();
  const needsOnboarding = live && !!profile.data && !profile.data.onboardingCompletedAt;

  useEffect(() => {
    AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then((v) => setWelcomeSeen(v === '1'))
      .catch(() => setWelcomeSeen(false));
  }, []);

  // A returning visitor whose session was cleared gets a fresh private workspace without a sign-in step.
  useEffect(() => {
    if (live && !loading && !session && welcomeSeen) {
      startWorkspace().catch((e: Error) => setStartError(e.message));
    }
  }, [live, loading, session, welcomeSeen, startWorkspace]);

  useEffect(() => {
    if (needsOnboarding && welcomeSeen && complete.isIdle) complete.mutate(deviceTimeZone());
  }, [needsOnboarding, welcomeSeen, complete]);

  if (welcomeSeen === null || loading) return <LoadingState label="Opening your workspace…" />;
  if (!welcomeSeen) return <Redirect href="/welcome" />;
  if (sampleMode) return <Redirect href="/(tabs)" />;

  const failure = startError ?? (profile.isError ? errorMessage(profile.error) : complete.isError ? errorMessage(complete.error) : null);
  if (failure) {
    // WF-01: an initialisation failure presents a clear retry path.
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Banner tone="error" title="We couldn't open your workspace">
          {failure}
        </Banner>
        <Button
          label="Try again"
          onPress={() => {
            setStartError(null);
            if (!session) startWorkspace().catch((e: Error) => setStartError(e.message));
            else if (profile.isError) void profile.refetch();
            else complete.mutate(deviceTimeZone());
          }}
        />
      </Screen>
    );
  }
  if (!session || profile.isPending || needsOnboarding) return <LoadingState label="Opening your workspace…" />;
  return <Redirect href="/(tabs)" />;
}
