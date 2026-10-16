import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Banner, Button, Screen, Text } from '@/components';
import { LoadingState } from '@/components/States';
import { useCompleteOnboarding, useProfile } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isConfigured, missingConfig } from '@/lib/config';
import { deviceTimeZone } from '@/lib/format';
import { WELCOME_SEEN_KEY } from '@/lib/onboarding';

/** Entry gate: configuration → welcome (first run) → sign in → workspace. */
export default function Index() {
  const { session, loading } = useAuth();
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);
  const profile = useProfile(!!session);
  const complete = useCompleteOnboarding();
  const needsOnboarding = !!profile.data && !profile.data.onboardingCompletedAt;

  // The user already saw the welcome screen before signing in: finish onboarding without showing it again.
  useEffect(() => {
    if (needsOnboarding && welcomeSeen && complete.isIdle) complete.mutate(deviceTimeZone());
  }, [needsOnboarding, welcomeSeen, complete]);

  useEffect(() => {
    AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then((v) => setWelcomeSeen(v === '1'))
      .catch(() => setWelcomeSeen(false));
  }, []);

  if (!isConfigured) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Text variant="title">Mova isn't configured yet</Text>
        <Banner tone="warning" title="Missing environment variables">
          {`Set ${missingConfig.join(', ')} in apps/mobile/.env (see .env.example), then restart the app.`}
        </Banner>
      </Screen>
    );
  }
  if (loading || welcomeSeen === null) return <LoadingState label="Opening your workspace…" />;
  if (!session) return <Redirect href={welcomeSeen ? '/sign-in' : '/welcome'} />;
  if (profile.isPending) return <LoadingState label="Opening your workspace…" />;
  if (profile.isError) {
    // WF-01: initialisation failure presents a clear retry path.
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Banner tone="error" title="We couldn't open your workspace">
          {errorMessage(profile.error)}
        </Banner>
        <Button label="Try again" onPress={() => profile.refetch()} />
      </Screen>
    );
  }
  if (needsOnboarding) {
    if (!welcomeSeen) return <Redirect href="/welcome" />;
    if (complete.isError) {
      return (
        <Screen edges={['top', 'left', 'right']}>
          <Banner tone="error" title="We couldn't finish setting up">
            {errorMessage(complete.error)}
          </Banner>
          <Button label="Try again" onPress={() => complete.mutate(deviceTimeZone())} />
        </Screen>
      );
    }
    return <LoadingState label="Setting up your workspace…" />;
  }
  return <Redirect href="/(tabs)" />;
}
