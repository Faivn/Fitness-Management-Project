import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Button, Card, ErrorState, LoadingState, Screen, Text } from '@/components';
import { useReview } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';

export default function ReviewDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const review = useReview(id);
  if (review.isPending) return <LoadingState />;
  if (review.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(review.error)} onRetry={() => review.refetch()} />
      </Screen>
    );
  const r = review.data;
  const c = r.stats.counts;
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Monthly review' }} />
      <Text variant="caption" color="inkTertiary">
        {formatDate(r.periodStart, true)} – {formatDate(r.periodEnd, true)} · version {r.version}
      </Text>
      <Text variant="body">{r.summaryText}</Text>
      <Card tone="subtle">
        <Text variant="small">
          Planned {c.planned} · completed {c.completed} · moved {c.rescheduled} · missed {c.missed} · cancelled {c.cancelled} · spontaneous{' '}
          {c.spontaneous + c.historicalEntries} · not recorded {c.notRecorded}
        </Text>
      </Card>
      {r.reflection ? (
        <Card>
          <Text variant="label">Your reflection</Text>
          <Text variant="body">{r.reflection}</Text>
        </Card>
      ) : null}
      <Button label="Update this review" variant="secondary" onPress={() => router.push(`/review/new?start=${r.periodStart}&end=${r.periodEnd}`)} />
      <Button label="Plan next period with AI" variant="brand" onPress={() => router.push(`/routine/ai?reviewId=${r.id}`)} />
    </Screen>
  );
}
