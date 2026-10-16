import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Mascot, Text } from '@/components';
import { useAuth } from '@/lib/auth';
import { sampleMode } from '@/lib/config';
import { colors, spacing } from '@/theme/tokens';
import { WELCOME_SEEN_KEY } from '@/lib/onboarding';

/**
 * WF-01 lightweight onboarding: one screen, no questionnaire. Fitness details
 * are gathered later, in conversation, only when needed.
 */
export default function Welcome() {
  const { session } = useAuth();

  // WF-01 step 4: "Get started" → create an account or sign in (kept separate
  // from fitness profiling), then the workspace.
  async function getStarted() {
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1').catch(() => undefined);
    if (sampleMode) router.replace('/(tabs)');
    else if (session) router.replace('/');
    else router.replace('/sign-in?mode=sign-up');
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
        <Button label="Get started" variant="primary" fullWidth onPress={getStarted} />
        {!sampleMode ? (
          <Button
            label="I already have an account"
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
