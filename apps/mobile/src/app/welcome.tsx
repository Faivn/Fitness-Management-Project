import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, Mascot, Text } from '@/components';
import { useAuth } from '@/lib/auth';
import { GUEST_RETENTION_DAYS, sampleMode } from '@/lib/config';
import { colors, spacing } from '@/theme/tokens';
import { WELCOME_SEEN_KEY } from '@/lib/onboarding';

/**
 * WF-01 lightweight onboarding: one screen, no questionnaire. Fitness details
 * are gathered later, in conversation, only when needed.
 */
export default function Welcome() {
  const { session, startGuest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WF-01 step 4: "Get started" → create an account or sign in (kept separate
  // from fitness profiling), then the workspace.
  async function getStarted() {
    setError(null);
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1').catch(() => undefined);
    if (sampleMode) return router.replace('/(tabs)');
    if (!session) {
      // No account needed: a private guest session (Supabase anonymous sign-in).
      setBusy(true);
      try {
        await startGuest();
      } catch (e) {
        setBusy(false);
        return setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      }
      setBusy(false);
    }
    router.replace('/');
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
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Text variant="small" color="inkTertiary" align="center">
          {sampleMode
            ? 'Your plans and activity history belong to your workspace. You can change or ignore any suggestion.'
            : `No account needed. Your demo workspace is private to this browser and kept for ${GUEST_RETENTION_DAYS} days, then deleted. Nothing is shared.`}
        </Text>
        <Button label="Get started" variant="primary" fullWidth loading={busy} onPress={getStarted} />
        {!sampleMode ? (
          <Button
            label="I already have an account — sign in"
            variant="ghost"
            fullWidth
            onPress={() => AsyncStorage.setItem(WELCOME_SEEN_KEY, '1').finally(() => router.replace('/sign-in'))}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.brandWash },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  footer: { padding: spacing.lg, gap: spacing.md },
});
