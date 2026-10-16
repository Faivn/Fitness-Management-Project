import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Banner, Button, Screen } from '@/components';
import { LoadingState } from '@/components/States';
import { useProfile } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { sampleMode } from '@/lib/config';
import { WELCOME_SEEN_KEY } from '@/lib/onboarding';

/**
 * Entry gate:
 *   first visit → Welcome → sign in / create account →
 *   first sign-in → short, optional first-use setup (WF-01 step 5) →
 *   workspace. Returning users go straight to their saved workspace.
 */
export default function Index() {
  const { session, loading } = useAuth();
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);
  const profile = useProfile(!sampleMode && !!session);

  useEffect(() => {
    AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then((v) => setWelcomeSeen(v === '1'))
      .catch(() => setWelcomeSeen(false));
  }, []);

  if (welcomeSeen === null || loading) return <LoadingState label="Opening your workspace…" />;
  if (sampleMode) return <Redirect href={welcomeSeen ? '/(tabs)' : '/welcome'} />;
  if (!session) return <Redirect href={welcomeSeen ? '/sign-in' : '/welcome'} />;

  if (profile.isError) {
    // WF-01: an initialisation failure presents a clear retry path.
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Banner tone="error" title="We couldn't open your workspace">
          {errorMessage(profile.error)}
        </Banner>
        <Button label="Try again" onPress={() => profile.refetch()} />
      </Screen>
    );
  }
  if (profile.isPending) return <LoadingState label="Opening your workspace…" />;
  // Onboarding completion is stored on the server, so it is shown once per account, on any device.
  if (!profile.data.onboardingCompletedAt) return <Redirect href="/get-started" />;
  return <Redirect href="/(tabs)" />;
}
