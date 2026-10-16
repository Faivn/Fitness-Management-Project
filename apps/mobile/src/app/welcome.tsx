import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, Mascot, Text } from '@/components';
import { useCompleteOnboarding } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { sampleMode } from '@/lib/config';
import { deviceTimeZone } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';
import { WELCOME_SEEN_KEY } from '@/lib/onboarding';

/**
 * WF-01 lightweight onboarding: one screen, no questionnaire. Fitness details
 * are gathered later, in conversation, only when needed.
 */
export default function Welcome() {
  const { startWorkspace } = useAuth();
  const complete = useCompleteOnboarding();
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // WF-01 step 4–5: "Get started" enters the workspace directly — no
  // questionnaire and no sign-in step.
  async function getStarted() {
    setStartError(null);
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1').catch(() => undefined);
    if (sampleMode) {
      router.replace('/(tabs)');
      return;
    }
    setStarting(true);
    try {
      await startWorkspace();
      complete.mutate(deviceTimeZone(), { onSuccess: () => router.replace('/(tabs)') });
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setStarting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <Mascot mood="welcome" size={180} />
        <Text variant="display" align="center">
          Mova
        </Text>
        <Text variant="heading" color="inkSecondary" align="center">
          Your fitness, moving with you.
        </Text>
        <Text variant="body" color="inkSecondary" align="center" style={{ maxWidth: 360 }}>
          Plan workouts, log what you actually did, move sessions when life happens, organise meals and review your month — in
          one place, with an AI companion that only saves what you approve.
        </Text>
      </View>
      <View style={styles.footer}>
        <Text variant="small" color="inkTertiary" align="center">
          Your plans and activity history belong to your workspace. You can change or ignore any suggestion.
        </Text>
        {startError ? <Banner tone="error" title="We couldn't open your workspace">{`${startError} Try again.`}</Banner> : null}
        {complete.isError ? <Banner tone="error" title="We couldn't open your workspace">{`${errorMessage(complete.error)} Try again.`}</Banner> : null}
        <Button label="Get started" variant="primary" fullWidth loading={starting || complete.isPending} onPress={getStarted} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.brandWash },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  footer: { padding: spacing.lg, gap: spacing.md },
});
