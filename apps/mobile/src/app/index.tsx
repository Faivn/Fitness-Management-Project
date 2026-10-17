import { Redirect } from 'expo-router';
import { Banner, Button, Screen } from '@/components';
import { LoadingState } from '@/components/States';
import { useProfile } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { copy } from '@/lib/copy';
import { useOnboarding } from '@/lib/onboarding';

/** Entry gate (no accounts): first-run onboarding once, then straight into the workspace. */
export default function Index() {
  const profile = useProfile();
  const onboarding = useOnboarding();
  if (profile.isError) {
    return (
      <Screen edges={['top', 'left', 'right']}>
        <Banner tone="error" title="Couldn't open Mova">
          {errorMessage(profile.error)}
        </Banner>
        <Button label={copy.actions.retry} onPress={() => profile.refetch()} />
      </Screen>
    );
  }
  if (profile.isPending || !onboarding.ready) return <LoadingState label="Opening…" />;
  if (!onboarding.state.completed) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
