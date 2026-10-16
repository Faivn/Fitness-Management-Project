import { router } from 'expo-router';
import { appToday } from '@/lib/today';
import { useState } from 'react';
import { View } from 'react-native';
import { type SummaryItem } from '@mova/shared';
import { Button, Card, EmptyState, ErrorState, LoadingState, PressableCard, Row, Screen, Section, StatusBadge, Text } from '@/components';
import { useHistory, useProfile, useReviews } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { ACTIVITY_LABELS, formatDate, formatMonth, monthBounds } from '@/lib/format';
import { spacing } from '@/theme/tokens';

/**
 * History: what was planned, completed, missed, moved or done spontaneously,
 * by month — computed from stored records. Plus saved monthly reviews.
 */
export default function History() {
  const profile = useProfile();
  const today = appToday(profile.data?.timezone ?? 'UTC');
  const [anchor, setAnchor] = useState(today);
  const { start, end } = monthBounds(anchor);
  const history = useHistory(start, end);
  const reviews = useReviews();

  function shift(months: number) {
    const [y, m] = anchor.split('-').map(Number) as [number, number];
    const d = new Date(Date.UTC(y, m - 1 + months, 1));
    setAnchor(d.toISOString().slice(0, 10));
  }

  const c = history.data?.summary.counts;
  return (
    <Screen refreshing={history.isRefetching} onRefresh={() => Promise.all([history.refetch(), reviews.refetch()])}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button label="‹" accessibilityLabel="Previous month" size="sm" variant="ghost" onPress={() => shift(-1)} />
        <Text variant="heading">{formatMonth(start)}</Text>
        <Button label="›" accessibilityLabel="Next month" size="sm" variant="ghost" onPress={() => shift(1)} />
      </Row>

      {history.isPending ? <LoadingState /> : null}
      {history.isError ? <ErrorState message={errorMessage(history.error)} onRetry={() => history.refetch()} /> : null}

      {c ? (
        <Card>
          <Row style={{ flexWrap: 'wrap', gap: spacing.lg }}>
            <Stat label="Planned" value={c.planned} />
            <Stat label="Completed" value={c.completed} />
            <Stat label="Moved" value={c.rescheduled} />
            <Stat label="Missed" value={c.missed} />
            <Stat label="Spontaneous" value={c.spontaneous + c.historicalEntries} />
            {c.notRecorded ? <Stat label="Not recorded" value={c.notRecorded} /> : null}
          </Row>
        </Card>
      ) : null}

      {history.data ? (
        <Section title="Activity" action={<Button label="Monthly review" size="sm" variant="secondary" onPress={() => router.push(`/review/new?start=${start}&end=${end}`)} />}>
          {history.data.summary.isEmpty ? (
            <EmptyState mood="calm" title="No records this month" body="Nothing was planned or logged in this period." />
          ) : (
            history.data.summary.items.map((i) => <HistoryRow key={i.sessionId} item={i} />)
          )}
        </Section>
      ) : null}

      <Section title="Saved reviews">
        {reviews.data?.length ? (
          reviews.data.map((r) => (
            <PressableCard key={r.id} accessibilityLabel={`Review ${r.periodStart} to ${r.periodEnd}`} onPress={() => router.push(`/review/${r.id}`)}>
              <Text variant="bodyStrong">
                {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
              </Text>
              <Text variant="small" color="inkSecondary" numberOfLines={2}>
                {r.summaryText}
              </Text>
            </PressableCard>
          ))
        ) : (
          <Text variant="small" color="inkTertiary">
            No saved reviews yet.
          </Text>
        )}
      </Section>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="title">{value}</Text>
      <Text variant="caption" color="inkTertiary">
        {label}
      </Text>
    </View>
  );
}

function HistoryRow({ item }: { item: SummaryItem }) {
  const date = item.actualDate ?? item.plannedDate ?? item.originalPlannedDate;
  return (
    <PressableCard accessibilityLabel={`${item.title}, ${item.outcome}`} onPress={() => router.push(`/session/${item.sessionId}`)}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="caption" color="inkTertiary">
          {formatDate(date)} · {ACTIVITY_LABELS[item.activityType]}
        </Text>
        <StatusBadge status={item.outcome} />
      </Row>
      <Text variant="bodyStrong">{item.title}</Text>
      {item.wasRescheduled ? (
        <Text variant="small" color="inkSecondary">
          Planned {formatDate(item.originalPlannedDate)} · moved {item.timesMoved}×
        </Text>
      ) : null}
    </PressableCard>
  );
}
