import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Card, ErrorState, IconButton, LoadingState, Row, Screen, Section, Text } from '@/components';
import { spacing } from '@/theme/tokens';
import { useRoutine } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { ACTIVITY_LABELS, DAY_NAMES } from '@/lib/format';

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
        {r.source === 'ai' ? 'From companion' : 'Manual'} · {r.status === 'active' ? 'Active' : 'Draft'}
      </Text>
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
