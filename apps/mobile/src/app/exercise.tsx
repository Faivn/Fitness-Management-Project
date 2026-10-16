import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Card, EmptyState, ErrorState, LoadingState, PressableCard, Row, Screen, Section, Text } from '@/components';
import { useExerciseHistory } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { RecordRow } from '@/components/RecordRow';

/** WF-09: one exercise's history and records. Past entries are read-only here. */
export default function ExerciseHistoryScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const history = useExerciseHistory(name);
  if (history.isPending) return <LoadingState />;
  if (history.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(history.error)} onRetry={() => history.refetch()} />
      </Screen>
    );
  const h = history.data;
  return (
    <Screen>
      <Stack.Screen options={{ title: h.exerciseName }} />
      {h.entries.length === 0 ? (
        <EmptyState mood="thinking" title="No history yet" body="Logged sets for this exercise will appear here." />
      ) : (
        <>
          <Section title="Personal records">
            {h.records.map((r) => (
              <RecordRow key={`${r.exerciseKey}-${r.type}`} record={r} />
            ))}
            <Text variant="caption" color="inkTertiary">
              Records are calculated from your logged sets (method {h.records[0]?.method ?? 'pr-v1'}). Only exact exercise names are grouped together.
            </Text>
          </Section>
          <Section title="Sessions">
            {h.entries.map((e) => (
              <PressableCard key={e.sessionId} accessibilityLabel={`Session on ${e.date}`} onPress={() => router.push(`/session/${e.sessionId}`)}>
                <Text variant="label">{formatDate(e.date, true)}</Text>
                <Row style={{ flexWrap: 'wrap' }}>
                  {e.sets.map((s) => (
                    <Card key={s.id} tone="subtle" style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
                      <Text variant="small">
                        {s.status === 'skipped' ? 'skipped' : `${s.actualWeight !== null ? `${s.actualWeight} ${s.weightUnit} × ` : ''}${s.actualReps ?? '?'}`}
                      </Text>
                    </Card>
                  ))}
                </Row>
              </PressableCard>
            ))}
          </Section>
        </>
      )}
    </Screen>
  );
}
