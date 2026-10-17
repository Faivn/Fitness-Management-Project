import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { dayOfWeek } from '@mova/shared';
import { Banner, Button, IconButton, NumberField, Screen, SheetPage, Text, TextField } from '@/components';
import { useCreateRoutine, useProfile } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';
import { useOnboarding } from '@/lib/onboarding';
import { appToday } from '@/lib/today';
import { colors, spacing } from '@/theme/tokens';

type Row = { id: number; name: string; sets: number | undefined; reps: number | undefined };
let nextId = 1;
const blank = (): Row => ({ id: nextId++, name: '', sets: 3, reps: 10 });

/**
 * First-run routine entry: just exercises, sets and reps. No workout names,
 * weights or schedules to fill in. Saved as the person's routine.
 */
function QuickRoutine() {
  const profile = useProfile();
  const create = useCreateRoutine();
  const { update } = useOnboarding();
  const [rows, setRows] = useState<Row[]>(() => [blank()]);
  const [key] = useState(newIdempotencyKey);
  const valid = rows.filter((r) => r.name.trim() && r.sets && r.sets >= 1 && r.reps && r.reps >= 1);
  const set = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  function save() {
    const today = appToday(profile.data?.timezone ?? 'UTC');
    create.mutate(
      {
        plan: {
          title: 'My routine',
          goalIds: [],
          assumptions: [],
          warnings: [],
          sessions: [
            {
              title: 'Workout',
              activityType: 'strength',
              dayOfWeek: dayOfWeek(today),
              exercises: valid.map((r) => ({ name: r.name.trim(), targetSets: r.sets!, repsMin: r.reps!, repsMax: r.reps! })),
            },
          ],
        },
        activate: true,
        schedule: { startDate: today, weeks: 4 },
        idempotencyKey: key,
      },
      {
        onSuccess: () => {
          update({ hasRoutine: true, completed: true });
          // Leave the sheet and onboarding behind: the person lands on the Overview.
          if (router.canDismiss()) router.dismissAll();
          router.replace('/(tabs)');
        },
      },
    );
  }

  return (
    <Screen
      footer={
        <>
          {create.isError ? <Banner tone="error">{errorMessage(create.error)}</Banner> : null}
          <Button label="Save routine" fullWidth disabled={valid.length === 0} loading={create.isPending} onPress={save} />
        </>
      }
    >
      <Text variant="body" color="inkSecondary">
        Add what you do in a workout. You can change anything later.
      </Text>
      {rows.map((r, i) => (
        <View key={r.id} style={{ gap: spacing.md, paddingBottom: spacing.base, borderBottomWidth: 1, borderBottomColor: colors.hairline }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField label={`Exercise ${i + 1}`} value={r.name} onChangeText={(name) => set(r.id, { name })} placeholder="e.g. Squats" autoCapitalize="sentences" maxLength={120} />
            </View>
            {rows.length > 1 ? <IconButton icon="trash" label={`Remove exercise ${i + 1}`} variant="solid" size={44} onPress={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} /> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <NumberField label="Sets" allowDecimal={false} value={r.sets} onChange={(sets) => set(r.id, { sets })} placeholder="3" />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField label="Reps" allowDecimal={false} value={r.reps} onChange={(reps) => set(r.id, { reps })} placeholder="10" />
            </View>
          </View>
        </View>
      ))}
      <Button label="Add exercise" variant="secondary" icon={undefined} onPress={() => setRows((rs) => [...rs, blank()])} />
    </Screen>
  );
}

export default function QuickRoutineSheet() {
  return (
    <SheetPage title="Your routine">
      <QuickRoutine />
    </SheetPage>
  );
}
