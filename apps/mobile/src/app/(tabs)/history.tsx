import { router } from 'expo-router';
import { appToday } from '@/lib/today';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { type SummaryItem } from '@mova/shared';
import { Button, Card, DateRangeHeader, EmptyState, ErrorState, FAB_CLEARANCE, FloatingChatButton, LoadingState, PressableCard, Row, Screen, Section, StatusBadge, Text } from '@/components';
import { useHistory, useProfile, useReviews } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { ACTIVITY_LABELS, formatDate, formatMonth, monthBounds } from '@/lib/format';
import { colors, radii, spacing } from '@/theme/tokens';

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
  const [filter, setFilter] = useState<Filter | null>(null);
  const reviews = useReviews();

  function shift(months: number) {
    const [y, m] = anchor.split('-').map(Number) as [number, number];
    const d = new Date(Date.UTC(y, m - 1 + months, 1));
    setAnchor(d.toISOString().slice(0, 10));
    setFilter(null);
  }

  const c = history.data?.summary.counts;
  const shown = (history.data?.summary.items ?? []).filter((i) => (filter ? FILTERS.find((f) => f.key === filter)!.match(i, start, end) : true));
  return (
    <Screen refreshing={history.isRefetching} onRefresh={() => Promise.all([history.refetch(), reviews.refetch()])} overlay={<FloatingChatButton />} endInset={FAB_CLEARANCE}>
      <DateRangeHeader unit="month" label={formatMonth(start)} onPrevious={() => shift(-1)} onNext={() => shift(1)} />

      {history.isPending ? <LoadingState /> : null}
      {history.isError ? <ErrorState message={errorMessage(history.error)} onRetry={() => history.refetch()} /> : null}

      {c ? (
        <View style={styles.grid}>
          {FILTERS.filter((f) => f.key !== 'not_recorded' || c.notRecorded).map((f) => (
            <Stat
              key={f.key}
              label={f.label}
              value={f.count(c)}
              selected={filter === f.key}
              onPress={() => setFilter(filter === f.key ? null : f.key)}
            />
          ))}
        </View>
      ) : null}

      {history.data ? (
        <Section title={filter ? `${FILTERS.find((f) => f.key === filter)!.label} · ${shown.length}` : 'Activity'} action={filter ? <Button label="Show all" size="sm" variant="ghost" onPress={() => setFilter(null)} /> : undefined}>
          {history.data.summary.isEmpty || (filter && shown.length === 0) ? (
            <EmptyState mood="calm" title={filter ? 'Nothing in this group' : 'No records this month'} body={filter ? 'No sessions match this filter this month.' : 'Nothing was planned or logged in this period.'} />
          ) : (
            shown.map((i) => <HistoryRow key={i.sessionId} item={i} />)
          )}
        </Section>
      ) : null}

      <Section title="Saved reviews" action={<Button label="New review" size="sm" variant="ghost" onPress={() => router.push(`/review/new?start=${start}&end=${end}`)} />}>
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
      <Button label="Exercise history" variant="ghost" onPress={() => router.push('/records')} />
    </Screen>
  );
}

type Filter = 'planned' | 'completed' | 'moved' | 'missed' | 'spontaneous' | 'not_recorded';
type Counts = NonNullable<ReturnType<typeof useHistory>['data']>['summary']['counts'];

/** Each summary card doubles as a filter for the list beneath it. */
const FILTERS: Array<{ key: Filter; label: string; count: (c: Counts) => number; match: (i: SummaryItem, start: string, end: string) => boolean }> = [
  { key: 'planned', label: 'Planned', count: (c) => c.planned, match: (i, a, b) => i.originalPlannedDate !== null && i.originalPlannedDate >= a && i.originalPlannedDate <= b },
  { key: 'completed', label: 'Completed', count: (c) => c.completed, match: (i) => i.outcome === 'completed' || i.outcome === 'spontaneous' || i.outcome === 'historical_entry' },
  { key: 'moved', label: 'Moved', count: (c) => c.rescheduled, match: (i) => i.wasRescheduled },
  { key: 'missed', label: 'Missed', count: (c) => c.missed, match: (i) => i.outcome === 'missed' },
  { key: 'spontaneous', label: 'Spontaneous', count: (c) => c.spontaneous + c.historicalEntries, match: (i) => i.outcome === 'spontaneous' || i.outcome === 'historical_entry' },
  { key: 'not_recorded', label: 'Not recorded', count: (c) => c.notRecorded, match: (i) => i.outcome === 'not_recorded' },
];

function Stat({ label, value, selected, onPress }: { label: string; value: number; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}: ${value}. ${selected ? 'Showing below. Tap to show all.' : 'Tap to list them below.'}`}
      onPress={onPress}
      style={[styles.stat, selected && styles.statSelected]}
    >
      <Text variant="title" color={selected ? 'onInk' : 'ink'}>
        {value}
      </Text>
      <Text variant="caption" color={selected ? 'onInk' : 'inkTertiary'}>
        {label}
      </Text>
    </Pressable>
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

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statSelected: { backgroundColor: colors.ink },
  stat: { flexGrow: 1, flexBasis: '30%', minWidth: 96, backgroundColor: colors.canvas, borderRadius: radii.sm, padding: spacing.base, gap: 2 },
});
