import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiError, errorMessage as apiError, newIdempotencyKey } from '@/lib/api';
import { appToday } from '@/lib/today';
import type { ScheduleConflict } from '@mova/shared';
import { ClashPrompt } from '@/components/domain';
import { Banner, Button, Card, ErrorState, IconButton, LoadingState, Row, Screen, Section, Text } from '@/components';
import { spacing } from '@/theme/tokens';
import { useProfile, useDeactivateRoutine, useReplaceClashingRoutines, useRoutine, useSaveRoutineVersion } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { ACTIVITY_LABELS, DAY_NAMES } from '@/lib/format';

export default function RoutineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routine = useRoutine(id);
  const profile = useProfile();
  const save = useSaveRoutineVersion();
  const replace = useReplaceClashingRoutines();
  const deactivate = useDeactivateRoutine();
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [key] = useState(newIdempotencyKey);
  if (routine.isPending) return <LoadingState />;
  if (routine.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(routine.error)} onRetry={() => routine.refetch()} />
      </Screen>
    );
  const r = routine.data;

  /** Manual activation: schedules the routine from today for four weeks; asks only if it clashes. */
  function activate(acceptConflicts = false) {
    save.mutate(
      {
        id: r.id,
        plan: r.plan,
        rescheduleFuture: false,
        activate: true,
        schedule: { startDate: appToday(profile.data?.timezone ?? 'UTC'), weeks: 4 },
        acceptConflicts,
        idempotencyKey: key,
      },
      {
        onSuccess: () => setConflicts(null),
        onError: (e) => {
          if (e instanceof ApiError && e.code === 'schedule_conflict') setConflicts((e.details as { conflicts: ScheduleConflict[] }).conflicts);
        },
      },
    );
  }
  const clash = save.error instanceof ApiError && save.error.code === 'schedule_conflict';
  return (
    <Screen
      footer={
        r.status === 'active' ? (
          <Button label="Deactivate routine" variant="secondary" fullWidth loading={deactivate.isPending} onPress={() => deactivate.mutate(r.id)} />
        ) : (
          <Button label="Activate routine" fullWidth loading={save.isPending} onPress={() => activate(false)} />
        )
      }
    >
      <Stack.Screen options={{ title: r.title }} />
      <Text variant="caption" color="inkTertiary">
        {r.source === 'ai' ? 'From companion' : 'Manual'} · {r.status === 'active' ? 'Active' : 'Draft'}
      </Text>
      {conflicts ? <ClashPrompt conflicts={conflicts} busy={save.isPending || replace.isPending} onKeep={() => activate(true)} onReplace={() => replace.mutate(conflicts, { onSuccess: () => activate(true) })} /> : null}
      {deactivate.error ? <Banner tone="error">{apiError(deactivate.error)}</Banner> : null}
      {save.error && !clash ? <Banner tone="error">{apiError(save.error)}</Banner> : null}
      <Section title="Weekly plan">
        {r.plan.sessions.map((s, i) => (
          <Card key={i}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text variant="caption" color="inkTertiary">
                  {DAY_NAMES[s.dayOfWeek]}
                  {s.startTime ? ` · ${s.startTime}` : ''} · {ACTIVITY_LABELS[s.activityType]}
                </Text>
                <Text variant="heading">{s.title}</Text>
              </View>
              <IconButton icon="edit" label={`Edit ${s.title}`} variant="plain" size={32} onPress={() => router.push(`/routine/edit?id=${r.id}&day=${i}`)} />
            </Row>
            {s.exercises.map((e, k) => (
              <Text key={k} variant="small">
                {e.name} — {e.targetSets} × {e.repsMin && e.repsMax ? `${e.repsMin}–${e.repsMax}` : (e.repsMin ?? e.repsMax ?? '?')}
                {e.targetWeight ? ` @ ${e.targetWeight} ${e.weightUnit}` : ''}
              </Text>
            ))}
          </Card>
        ))}
      </Section>
    </Screen>
  );
}
