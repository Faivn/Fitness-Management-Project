import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ChoiceCard, IconButton, TextAction, Text, TextField } from '@/components';
import { FieldToneContext } from '@/components/fieldTone';
import { Mascot, type MascotMood } from '@/components/Mascot';
import { STEPS, useOnboarding, type OnboardingStep } from '@/lib/onboarding';
import { colors, radii, spacing } from '@/theme/tokens';

const POSE: Record<OnboardingStep, MascotMood> = { name: 'welcome', experience: 'focus', routine: 'planning' };

/**
 * First-run onboarding, one question per screen: name, fitness-app experience,
 * then (only for people who have used one) their routine. Everything else is
 * gathered later, in context, by Mova Companion.
 */
export default function Onboarding() {
  const { state, update } = useOnboarding();
  const step = state.step;
  const index = STEPS.indexOf(step);
  const [name, setName] = useState(state.name);
  const [usedApp, setUsedApp] = useState<boolean | null>(state.usedApp);
  const [hasRoutine, setHasRoutine] = useState<boolean | null>(state.hasRoutine);

  // Each step eases in, unless the person prefers reduced motion.
  const enter = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live || reduce) return;
      enter.setValue(0);
      Animated.timing(enter, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
    });
    return () => {
      live = false;
    };
  }, [step, enter]);

  const first = name.trim();

  function finish(next: Partial<typeof state>, then?: () => void) {
    update({ ...next, completed: true });
    router.replace('/(tabs)');
    if (then) setTimeout(then, 60);
  }

  function onContinue() {
    if (step === 'name') {
      update({ name: first, step: 'experience' });
    } else if (step === 'experience') {
      if (usedApp === false) finish({ usedApp: false, hasRoutine: null });
      else if (usedApp === true) update({ usedApp: true, step: 'routine' });
    } else if (hasRoutine === true) {
      update({ hasRoutine: true });
      router.push('/routine/quick');
    } else if (hasRoutine === false) {
      finish({ hasRoutine: false }, () => router.push('/companion?intent=routine'));
    }
  }

  const canContinue = step === 'name' ? first.length > 0 : step === 'experience' ? usedApp !== null : hasRoutine !== null;

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1 }}>
      <FieldToneContext.Provider value="white">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.frame}>
            <View style={styles.top}>
              <View style={{ width: 44 }}>
                {index > 0 ? (
                  <IconButton icon="chevron-left" label="Back" variant="solid" onPress={() => update({ step: STEPS[index - 1]! })} />
                ) : null}
              </View>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}
                accessibilityValue={{ min: 1, max: STEPS.length, now: index + 1 }}
                style={styles.progress}
              >
                {STEPS.map((s, i) => (
                  <View key={s} style={[styles.segment, i <= index && styles.segmentOn]} />
                ))}
              </View>
              <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }], gap: spacing.lg }} accessibilityLiveRegion="polite">
                <View style={{ alignItems: 'center' }}>
                  <Mascot mood={POSE[step]} size={132} animated={false} />
                </View>

                {step === 'name' ? (
                  <>
                    <View style={styles.copy}>
                      <Text variant="small" color="inkTertiary" align="center" style={styles.eyebrow}>
                        WELCOME TO MOVA
                      </Text>
                      <Text variant="display" align="center" accessibilityRole="header" style={styles.headline}>
                        Hi! What should I call you?
                      </Text>
                    </View>
                    <TextField
                      label="Your name"
                      hideLabel
                      value={name}
                      onChangeText={setName}
                      placeholder="Your name"
                      autoFocus
                      autoCapitalize="words"
                      autoComplete="given-name"
                      textContentType="givenName"
                      returnKeyType="next"
                      maxLength={40}
                      onSubmitEditing={() => first && onContinue()}
                      style={styles.nameInput}
                    />
                  </>
                ) : null}

                {step === 'experience' ? (
                  <>
                    <View style={styles.copy}>
                      <Text variant="small" color="inkTertiary" align="center" style={styles.eyebrow}>
                        {first ? `NICE TO MEET YOU, ${first.toUpperCase()}` : 'NICE TO MEET YOU'}
                      </Text>
                      <Text variant="display" align="center" accessibilityRole="header" style={styles.headline}>
                        Have you used a fitness app before?
                      </Text>
                    </View>
                    <View accessibilityRole="radiogroup" accessibilityLabel="Have you used a fitness app before?" style={styles.cards}>
                      <ChoiceCard title="Yes, I have" hint="I've tracked workouts or routines before." selected={usedApp === true} onPress={() => setUsedApp(true)} />
                      <ChoiceCard title="No, I'm new to this" hint="Take me straight to Mova." selected={usedApp === false} onPress={() => setUsedApp(false)} />
                    </View>
                  </>
                ) : null}

                {step === 'routine' ? (
                  <>
                    <View style={styles.copy}>
                      <Text variant="small" color="inkTertiary" align="center" style={styles.eyebrow}>
                        ONE MORE QUESTION
                      </Text>
                      <Text variant="display" align="center" accessibilityRole="header" style={styles.headline}>
                        Do you have a workout routine you follow?
                      </Text>
                    </View>
                    <View accessibilityRole="radiogroup" accessibilityLabel="Do you have a workout routine you currently follow?" style={styles.cards}>
                      <ChoiceCard title="Yes, I have a routine" hint="Add your exercises, sets and reps." selected={hasRoutine === true} onPress={() => setHasRoutine(true)} />
                      <ChoiceCard title="No, create with Mova" hint="Build one together with Mova Companion." selected={hasRoutine === false} onPress={() => setHasRoutine(false)} />
                    </View>
                  </>
                ) : null}
              </Animated.View>
            </ScrollView>

            <View style={styles.footer}>
              <Button label="Continue" fullWidth disabled={!canContinue} onPress={onContinue} />
              {step === 'name' ? (
                <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                  <TextAction label="Skip for now" onPress={() => update({ name: '', step: 'experience' })} />
                </View>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </FieldToneContext.Provider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, paddingHorizontal: spacing.base, paddingTop: spacing.sm, minHeight: 56 },
  progress: { flex: 1, flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 4, borderRadius: radii.pill, backgroundColor: colors.blush },
  segmentOn: { backgroundColor: colors.rose },
  body: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  copy: { gap: spacing.sm },
  eyebrow: { letterSpacing: 1.2 },
  headline: { fontSize: 30, lineHeight: 38 },
  cards: { gap: spacing.md },
  nameInput: { minHeight: 60, fontSize: 20, textAlign: 'center', borderRadius: radii.xl },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.base, gap: spacing.sm, alignItems: 'stretch' },
});
