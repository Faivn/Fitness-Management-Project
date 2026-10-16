import { router, Stack } from 'expo-router';
import { EmptyState, ErrorState, LoadingState, PressableCard, Screen, Section, Text } from '@/components';
import { useExercises, usePersonalRecords } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';

/** WF-09: exercise history and personal records across all routines. */
export default function Records() {
  const exercises = useExercises();
  const records = usePersonalRecords();
  if (exercises.isPending) return <LoadingState />;
  if (exercises.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(exercises.error)} onRetry={() => exercises.refetch()} />
      </Screen>
    );
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Exercise history' }} />
      {exercises.data.length === 0 ? (
        <EmptyState mood="checklist" title="No logged exercises yet" body="Log a workout and your history and records will build up here." />
      ) : (
        <Section title="Exercises">
          {exercises.data.map((e) => {
            const heaviest = records.data?.find((r) => r.exerciseKey === e.exerciseKey && r.type === 'heaviest_weight');
            return (
              <PressableCard key={e.exerciseKey} accessibilityLabel={`History for ${e.exerciseName}`} onPress={() => router.push(`/exercise?name=${encodeURIComponent(e.exerciseName)}`)}>
                <Text variant="bodyStrong">{e.exerciseName}</Text>
                <Text variant="small" color="inkSecondary">
                  Last {formatDate(e.lastDate)} · {e.sets} sets logged
                  {heaviest ? ` · best ${heaviest.value} ${heaviest.unit}` : ''}
                </Text>
              </PressableCard>
            );
          })}
        </Section>
      )}
    </Screen>
  );
}
