import { router } from 'expo-router';
import { View } from 'react-native';
import { Banner, Button, Card, ErrorState, LoadingState, Screen, SheetPage, Text, TileRow, tileKindFor } from '@/components';
import { useOverview } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { formatDate, formatTimeRange } from '@/lib/format';
import { spacing } from '@/theme/tokens';

/**
 * "Let's catch up": the workouts still waiting for an update, with the next steps
 * for each. Built only from the person's real data; opening it changes nothing.
 */
function CatchUp() {
  const overview = useOverview();
  if (overview.isPending) return <LoadingState />;
  if (overview.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(overview.error)} onRetry={() => overview.refetch()} />
      </Screen>
    );
  const tasks = overview.data.needsAttention;
  return (
    <Screen>
      <Text variant="body" color="inkSecondary">
        No pressure. Pick one to log what you did, move it to a day that suits you, or mark it as missed.
      </Text>
      {tasks.length === 0 ? (
        <Banner tone="success" title="All caught up">
          Nothing is waiting for an update right now.
        </Banner>
      ) : (
        tasks.map((s) => (
          <Card key={s.id}>
            <TileRow
              kind={tileKindFor(s.activityType)}
              title={s.title}
              subtitle={`${formatDate(s.plannedDate)}${s.plannedTime ? ` · ${formatTimeRange(s.plannedTime, s.plannedDurationMinutes)}` : ''}`}
              onPress={() => router.push(`/session/${s.id}`)}
              accessibilityLabel={`${s.title}, planned ${formatDate(s.plannedDate)}. Open to update it`}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Button label="Update it" size="sm" variant="secondary" onPress={() => router.push(`/session/${s.id}`)} />
              <Button label="Move to another day" size="sm" variant="secondary" onPress={() => router.push(`/session/${s.id}/reschedule`)} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

export default function CatchUpSheet() {
  return (
    <SheetPage title="Let's catch up">
      <CatchUp />
    </SheetPage>
  );
}
