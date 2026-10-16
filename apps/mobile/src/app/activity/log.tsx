import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { addDays, isLocalDate, isLocalTime, todayIn, type ActivityType, type WorkoutSession } from '@mova/shared';
import { Banner, Button, Card, Chip, NumberField, Row, Screen, Section, Segmented, Text, TextField } from '@/components';
import { useLogActivity, useProfile } from '@/hooks/api';
import { ApiError, errorMessage, newIdempotencyKey } from '@/lib/api';
import { useDraft } from '@/lib/drafts';
import { ACTIVITY_LABELS, formatDate } from '@/lib/format';
import { spacing } from '@/theme/tokens';

interface ExerciseDraft {
  name: string;
  sets: Array<{ reps?: number; weight?: number }>;
}

interface Draft {
  type: ActivityType;
  title: string;
  date: string;
  time: string;
  minutes?: number;
  distance?: number;
  notes: string;
  exercises: ExerciseDraft[];
  key: string;
}

/**
 * WF-08 / WF-12: record an unscheduled or past activity. No fictional plan is
 * created; unknown values stay empty; matching planned sessions are offered
 * for linking instead of duplicating.
 */
export default function LogActivity() {
  const profile = useProfile();
  const today = todayIn(profile.data?.timezone ?? 'UTC');
  const log = useLogActivity();
  const weightUnit = profile.data?.weightUnit ?? 'kg';
  const distanceUnit = profile.data?.distanceUnit ?? 'km';
  const draft = useDraft<Draft>('log-activity', { type: 'running', title: '', date: today, time: '', notes: '', exercises: [], key: newIdempotencyKey() });
  const [candidates, setCandidates] = useState<WorkoutSession[] | null>(null);
  const d = draft.value;
  const set = (patch: Partial<Draft>) => {
    setCandidates(null);
    draft.setValue({ ...d, ...patch });
  };

  const dateError = !isLocalDate(d.date) ? 'Use YYYY-MM-DD.' : d.date > today ? "Activities you're logging can't be in the future." : undefined;
  const timeError = d.time && !isLocalTime(d.time) ? 'Use HH:MM.' : undefined;

  function submit(extra: { plannedSessionId?: string; confirmSeparate?: boolean } = {}) {
    const sets = d.exercises.flatMap((e) =>
      e.name.trim()
        ? e.sets.map((s, i) => ({
            clientId: `${d.key}-${e.name}-${i}`,
            exerciseName: e.name.trim(),
            setNumber: i + 1,
            actualReps: s.reps,
            actualWeight: s.weight,
            weightUnit: s.weight !== undefined ? weightUnit : undefined,
          }))
        : [],
    );
    log.mutate(
      {
        activityType: d.type,
        title: d.title || undefined,
        activityDate: d.date,
        startTime: d.time || undefined,
        durationSeconds: d.minutes ? Math.round(d.minutes * 60) : undefined,
        distanceValue: d.distance,
        distanceUnit: d.distance !== undefined ? distanceUnit : undefined,
        notes: d.notes || undefined,
        sets,
        idempotencyKey: d.key,
        ...extra,
      },
      {
        onSuccess: (r) => {
          void draft.clear();
          router.replace(`/session/${r.session.id}`);
        },
        onError: (e) => {
          if (e instanceof ApiError && e.code === 'possible_duplicate') setCandidates((e.details as { candidates: WorkoutSession[] }).candidates);
        },
      },
    );
  }

  return (
    <Screen footer={<Button label="Save activity" fullWidth disabled={!!dateError || !!timeError} loading={log.isPending} onPress={() => submit()} />}>
      <Stack.Screen options={{ title: 'Log activity' }} />
      <Segmented
        label="Activity"
        options={(['running', 'strength', 'walking', 'cycling', 'swimming', 'mobility', 'other'] as ActivityType[]).map((t) => ({ value: t, label: ACTIVITY_LABELS[t]! }))}
        value={d.type}
        onChange={(type) => set({ type })}
      />
      <TextField label="Title (optional)" value={d.title} onChangeText={(title) => set({ title })} placeholder={d.type === 'running' ? 'e.g. Evening run' : 'e.g. Home workout'} />
      <Text variant="label">When did it happen?</Text>
      <Row style={{ flexWrap: 'wrap' }}>
        {[0, 1, 2].map((n) => {
          const day = addDays(today, -n);
          return <Chip key={day} label={n === 0 ? 'Today' : n === 1 ? 'Yesterday' : formatDate(day)} selected={d.date === day} onPress={() => set({ date: day })} />;
        })}
      </Row>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <TextField label="Date" value={d.date} onChangeText={(date) => set({ date })} error={dateError} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Start time (optional)" placeholder="HH:MM" value={d.time} onChangeText={(time) => set({ time })} error={timeError} />
        </View>
      </Row>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <NumberField label="Duration" unit="min" value={d.minutes} onChange={(minutes) => set({ minutes })} />
        </View>
        {d.type !== 'strength' && d.type !== 'mobility' ? (
          <View style={{ flex: 1 }}>
            <NumberField label="Distance" unit={distanceUnit} value={d.distance} onChange={(distance) => set({ distance })} />
          </View>
        ) : null}
      </Row>
      <Text variant="caption" color="inkTertiary">
        Not sure of something? Leave it empty — unknown details stay unknown.
      </Text>

      {d.type === 'strength' ? (
        <Section title="Exercises (optional)">
          {d.exercises.map((e, i) => (
            <Card key={i}>
              <TextField label="Exercise" value={e.name} onChangeText={(name) => set({ exercises: d.exercises.map((x, j) => (j === i ? { ...x, name } : x)) })} />
              {e.sets.map((s, k) => (
                <Row key={k} style={{ alignItems: 'flex-start' }}>
                  <Text variant="label" style={{ marginTop: 28 }}>
                    {k + 1}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <NumberField
                      label="Weight"
                      unit={weightUnit}
                      value={s.weight}
                      onChange={(weight) => set({ exercises: d.exercises.map((x, j) => (j === i ? { ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, weight } : y)) } : x)) })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <NumberField
                      label="Reps"
                      allowDecimal={false}
                      value={s.reps}
                      onChange={(reps) => set({ exercises: d.exercises.map((x, j) => (j === i ? { ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, reps } : y)) } : x)) })}
                    />
                  </View>
                </Row>
              ))}
              <Row>
                <Button label="Add set" size="sm" variant="ghost" onPress={() => set({ exercises: d.exercises.map((x, j) => (j === i ? { ...x, sets: [...x.sets, {}] } : x)) })} />
                <Button label="Remove exercise" size="sm" variant="ghost" onPress={() => set({ exercises: d.exercises.filter((_, j) => j !== i) })} />
              </Row>
            </Card>
          ))}
          <Button label="Add exercise" size="sm" variant="secondary" onPress={() => set({ exercises: [...d.exercises, { name: '', sets: [{}] }] })} />
        </Section>
      ) : null}

      <TextField label="Notes (optional)" value={d.notes} onChangeText={(notes) => set({ notes })} multiline />

      {candidates ? (
        <Card tone="brand">
          <Text variant="bodyStrong">Was this one of your planned sessions?</Text>
          <Text variant="small" color="inkSecondary">
            Linking records it against the plan instead of creating a duplicate.
          </Text>
          <View style={{ gap: spacing.sm }}>
            {candidates.map((c) => (
              <Button key={c.id} label={`Yes — ${c.title} (${formatDate(c.plannedDate)})`} variant="secondary" loading={log.isPending} onPress={() => submit({ plannedSessionId: c.id })} />
            ))}
            <Button label="No — it was separate" variant="ghost" loading={log.isPending} onPress={() => submit({ confirmSeparate: true })} />
          </View>
        </Card>
      ) : null}
      {log.isError && !(log.error instanceof ApiError && log.error.code === 'possible_duplicate') ? <Banner tone="error">{errorMessage(log.error)}</Banner> : null}
    </Screen>
  );
}
