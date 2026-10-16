import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Button, Card, ErrorState, LoadingState, Row, Screen, Section, Text } from '@/components';
import { useRoutine } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { ACTIVITY_LABELS, DAY_NAMES, formatDate } from '@/lib/format';

export default function RoutineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routine = useRoutine(id);
  if (routine.isPending) return <LoadingState />;
  if (routine.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(routine.error)} onRetry={() => routine.refetch()} />
      </Screen>
    );
  const r = routine.data;
  return (
    <Screen>
      <Stack.Screen options={{ title: r.title }} />
      <Text variant="caption" color="inkTertiary">
        {r.source === 'ai' ? 'Created with AI' : 'Built manually'} · version {r.currentVersion} · {r.status === 'active' ? 'Active' : 'Draft'}
      </Text>
      {r.plan.purpose ? <Text variant="body">{r.plan.purpose}</Text> : null}
      <Row style={{ flexWrap: 'wrap' }}>
        <Button label="Edit" variant="secondary" onPress={() => router.push(`/routine/edit?id=${r.id}`)} />
        <Button label="Adjust with AI" variant="brand" onPress={() => router.push(`/routine/ai?routineId=${r.id}`)} />
      </Row>
      <Section title="Weekly plan">
        {r.plan.sessions.map((s, i) => (
          <Card key={i}>
            <Text variant="caption" color="inkTertiary">
              {DAY_NAMES[s.dayOfWeek]}
              {s.startTime ? ` · ${s.startTime}` : ''} · {ACTIVITY_LABELS[s.activityType]}
            </Text>
            <Text variant="heading">{s.title}</Text>
            {s.exercises.map((e, k) => (
              <Text key={k} variant="small">
                {e.name} — {e.targetSets} × {e.repsMin && e.repsMax ? `${e.repsMin}–${e.repsMax}` : (e.repsMin ?? e.repsMax ?? '?')}
                {e.targetWeight ? ` @ ${e.targetWeight} ${e.weightUnit}` : ''}
              </Text>
            ))}
          </Card>
        ))}
      </Section>
      <Section title="Version history">
        {r.versions.map((v) => (
          <Card key={v.id} tone="subtle">
            <Text variant="bodyStrong">Version {v.versionNumber}</Text>
            <Text variant="small" color="inkSecondary">
              {formatDate(v.createdAt.slice(0, 10), true)}
              {v.changeReason ? ` · ${v.changeReason}` : ''}
            </Text>
          </Card>
        ))}
      </Section>
    </Screen>
  );
}
