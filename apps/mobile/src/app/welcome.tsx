import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, Mascot, Text } from '@/components';
import { useCompleteOnboarding } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { deviceTimeZone } from '@/lib/format';
import { colors, spacing } from '@/theme/tokens';
import { WELCOME_SEEN_KEY } from '@/lib/onboarding';

/**
 * WF-01 lightweight onboarding: one screen, no questionnaire. Fitness details
 * are gathered later, in conversation, only when needed.
 */
export default function Welcome() {
  const { session } = useAuth();
  const complete = useCompleteOnboarding();

  async function getStarted() {
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1').catch(() => undefined);
    if (!session) {
      router.replace('/sign-in');
      return;
    }
    complete.mutate(deviceTimeZone(), { onSuccess: () => router.replace('/(tabs)') });
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
        {complete.isError ? <Banner tone="error">{errorMessage(complete.error)}</Banner> : null}
        <Button label="Get started" variant="primary" fullWidth loading={complete.isPending} onPress={getStarted} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.brandWash },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  footer: { padding: spacing.lg, gap: spacing.md },
});
