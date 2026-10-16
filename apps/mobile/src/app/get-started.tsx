import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import type { DistanceUnit, WeightUnit } from '@mova/shared';
import { Banner, Button, Mascot, Row, Screen, Section, Segmented, Text, TextField } from '@/components';
import { useCompleteOnboarding, useCreateGoal, useProfile, useUpdatePreferences } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';
import { deviceTimeZone } from '@/lib/format';
import { spacing } from '@/theme/tokens';

/**
 * WF-01 step 5: a short first-use state, shown once per account after the
 * first sign-in. Everything here is OPTIONAL — "Skip for now" enters the
 * workspace immediately (no mandatory questionnaire). It reuses the same
 * goal and preference endpoints as Settings and Goals.
 */
export default function GetStarted() {
  const profile = useProfile();
  const createGoal = useCreateGoal();
  const updatePrefs = useUpdatePreferences();
  const complete = useCompleteOnboarding();
  const [goal, setGoal] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit | null>(null);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit | null>(null);
  const [equipment, setEquipment] = useState('');
  const [notes, setNotes] = useState('');
  const [goalKey] = useState(newIdempotencyKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const p = profile.data;

  /** Saves only what was filled in, then marks onboarding complete. Input is kept if anything fails. */
  async function finish(next: 'workspace' | 'companion', save: boolean) {
    setError(null);
    setBusy(true);
    try {
      if (save && goal.trim()) {
        await createGoal.mutateAsync({ title: goal.trim(), priority: 'high', isMeasurable: false, idempotencyKey: goalKey });
      }
      const prefs = {
        ...(save && weightUnit ? { weightUnit } : {}),
        ...(save && distanceUnit ? { distanceUnit } : {}),
        ...(save && equipment.trim() ? { equipment: equipment.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
        ...(save && notes.trim() ? { trainingNotes: notes.trim() } : {}),
      };
      if (Object.keys(prefs).length) await updatePrefs.mutateAsync(prefs);
      await complete.mutateAsync(deviceTimeZone());
      router.replace('/(tabs)');
      if (next === 'companion') router.push('/companion');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      edges={['top', 'left', 'right']}
      footer={
        <>
          {error ? <Banner tone="error" title="That didn't save">{`${error} Your answers are still here — try again.`}</Banner> : null}
          <Button label="Save and open my workspace" fullWidth loading={busy} onPress={() => finish('workspace', true)} />
          <Button label="Skip for now" variant="ghost" fullWidth disabled={busy} onPress={() => finish('workspace', false)} />
        </>
      }
    >
      <Stack.Screen options={{ headerShown: false }} />
      <Row style={{ alignItems: 'center' }}>
        <Mascot mood="planning" size={80} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="title">Set up your workspace</Text>
          <Text variant="small" color="inkSecondary">
            Optional — fill in anything that helps, or skip. You can change all of it later in Settings.
          </Text>
        </View>
      </Row>

      <Section title="What would you like to work towards?">
        <TextField label="A goal (optional)" placeholder="e.g. Train four times a week and run 5 km" value={goal} onChangeText={setGoal} />
        <Button label="Talk it through with the AI instead" variant="brand" disabled={busy} onPress={() => finish('companion', true)} />
      </Section>

      <Section title="Preferences">
        <Segmented
          label="Weights"
          options={[
            { value: 'kg', label: 'kg' },
            { value: 'lb', label: 'lb' },
          ]}
          value={weightUnit ?? p?.weightUnit ?? 'kg'}
          onChange={setWeightUnit}
        />
        <Segmented
          label="Distances"
          options={[
            { value: 'km', label: 'km' },
            { value: 'mi', label: 'mi' },
          ]}
          value={distanceUnit ?? p?.distanceUnit ?? 'km'}
          onChange={setDistanceUnit}
        />
        <TextField label="Equipment you can use (optional)" placeholder="e.g. Dumbbells, barbell, resistance bands" value={equipment} onChangeText={setEquipment} />
        <TextField
          label="Anything the AI should know (optional)"
          placeholder="e.g. Old knee injury — avoid deep lunges"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </Section>
    </Screen>
  );
}
