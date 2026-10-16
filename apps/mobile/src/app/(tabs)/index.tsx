import { router } from 'expo-router';
import { View } from 'react-native';
import { fastingStatus, formatVolume, hydrationProgress } from '@mova/shared';
import { Banner, Button, Card, EmptyState, ErrorState, ExpandableCard, FAB_CLEARANCE, FloatingChatButton, IconTile, LoadingState, PressableCard, Row, RuneIcon, Screen, Section, StatusBadge, Text, TextAction, TileRow, tileKindFor } from '@/components';
import { MascotNote } from '@/components/domain';
import { useOverview, useProfile } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { ACTIVITY_LABELS, formatDate, formatTimeRange } from '@/lib/format';
import { colors, radii, spacing } from '@/theme/tokens';

/**
 * WF-05 daily overview: today's plan from persisted records. Rest days are
 * valid plans; past-due sessions stay visible; disabled modules are hidden.
 */
export default function Overview() {
  const overview = useOverview();
  const profile = useProfile();

  if (overview.isPending) return <LoadingState label="Loading today…" />;
  if (overview.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(overview.error)} onRetry={() => overview.refetch()} />
      </Screen>
    );

  const o = overview.data;
  const active = o.sessions.filter((s) => s.status !== 'cancelled');
  const volumeUnit = profile.data?.volumeUnit ?? 'ml';

  return (
    <Screen
      refreshing={overview.isRefetching}
      onRefresh={() => overview.refetch()}
      overlay={<FloatingChatButton />}
      endInset={FAB_CLEARANCE}
    >
      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" color="inkTertiary">
          {formatDate(o.localDate).toUpperCase()}
        </Text>
        <Text variant="title">Your day</Text>
      </View>

      {o.needsAttention.length > 0 ? (
        <ExpandableCard
          title="Needs an update"
          summary={`${o.needsAttention.length} ${o.needsAttention.length === 1 ? 'session needs' : 'sessions need'} attention`}
        >
          {o.needsAttention.map((s) => (
            <TileRow
              key={s.id}
              kind={tileKindFor(s.activityType)}
              title={s.title}
              subtitle={formatDate(s.plannedDate)}
              onPress={() => router.push(`/session/${s.id}`)}
              accessibilityLabel={`${s.title}, ${formatDate(s.plannedDate)}, needs an update`}
            />
          ))}
        </ExpandableCard>
      ) : null}

      <Section title="Today's workout" action={<TextAction label="See all" onPress={() => router.push('/workouts')} />}>
        {active.length > 0 ? (
          active.map((s) => (
            <PressableCard key={s.id} accessibilityLabel={`${s.title}, ${s.status}`} onPress={() => router.push(`/session/${s.id}`)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="caption" color="inkTertiary">
                  {ACTIVITY_LABELS[s.activityType]?.toUpperCase()}
                </Text>
                <StatusBadge status={s.plannedDate ? s.status : s.source === 'historical_entry' ? 'historical_entry' : 'spontaneous'} />
              </Row>
              <Text variant="bodyStrong">{s.title}</Text>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Text variant="small" color="inkSecondary">
                  {formatTimeRange(s.plannedTime, s.plannedDurationMinutes) ?? 'Unplanned'}
                </Text>
                <RuneIcon name="arrow-up-right" size={18} />
              </Row>
            </PressableCard>
          ))
        ) : o.isRestDay ? (
          <MascotNote mood="rest">Rest day. Recovery is part of the plan.</MascotNote>
        ) : o.hasActiveRoutine ? (
          <MascotNote mood="calm">Nothing is scheduled today.</MascotNote>
        ) : (
          <EmptyState
            mood="planning"
            title="No plan yet"
            body="Create a routine with the AI companion or build one yourself."
            action={{ label: 'Plan my training', onPress: () => router.push('/routine/ai') }}
          />
        )}
      </Section>

      {o.meals.length > 0 ? (
        <ExpandableCard title="Today's meals" summary={mealCountLabel(o.meals.length)}>
          {o.meals.map((m) => (
            <TileRow key={m.id} kind="meal" eyebrow={m.slot.toUpperCase() + (m.isSmoothie ? ' · SMOOTHIE' : '')} title={m.mealName} />
          ))}
          <TextAction label="Open meal plan" onPress={() => router.push(`/meal/${o.mealPlanId}`)} />
        </ExpandableCard>
      ) : null}

      {o.hydration || o.fasting ? (
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' }}>
          {o.hydration ? (
            <View style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
              <HydrationCard totalMl={o.hydration.totalMl} target={o.hydration.target} unit={volumeUnit} />
            </View>
          ) : null}
          {o.fasting ? (
            <View style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
              <FastingCard fasting={o.fasting} timezone={o.timezone} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** "Four meals" — the number of meals planned for the day, in words up to ten. */
function mealCountLabel(n: number): string {
  return `${COUNT_WORDS[n] ?? n} ${n === 1 ? 'meal' : 'meals'}`;
}

function ProgressBar({ fraction, label }: { fraction: number; label: string }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
      style={{ height: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.surfaceSubtle, overflow: 'hidden' }}
    >
      <View style={{ width: `${Math.round(fraction * 100)}%`, height: '100%', backgroundColor: colors.brand }} />
    </View>
  );
}

function HydrationCard({ totalMl, target, unit }: { totalMl: number; target: { dailyTarget: number; unit: 'ml' | 'l' | 'fl_oz' } | null; unit: 'ml' | 'l' | 'fl_oz' }) {
  const p = target ? hydrationProgress(totalMl, target.dailyTarget, target.unit) : null;
  return (
    <Card style={{ flex: 1 }}>
      <Row>
        <IconTile kind="water" size={32} />
        <Text variant="bodyStrong">Water</Text>
      </Row>
      <StatLine left={formatVolume(totalMl, unit)} right={p ? formatVolume(p.targetMl, unit) : 'No goal set'} />
      {p ? <ProgressBar fraction={p.fraction} label="Water intake toward today's goal" /> : null}
      <TextAction label="Add water" icon="plus" onPress={() => router.push('/hydration')} />
    </Card>
  );
}

/** Current value on the left, target/next on the right — one line, one size, so progress reads left to right. */
function StatLine({ left, right, hint }: { left: string; right: string; hint?: string }) {
  return (
    <Row style={{ justifyContent: 'space-between' }} accessible accessibilityLabel={hint ?? `${left}, ${right}`}>
      <Text variant="label" numberOfLines={1}>
        {left}
      </Text>
      <Text variant="small" color="inkTertiary" numberOfLines={1}>
        {right}
      </Text>
    </Row>
  );
}

function FastingCard({ fasting, timezone }: { fasting: NonNullable<ReturnType<typeof useOverview>['data']>['fasting']; timezone: string }) {
  if (!fasting) return null;
  if (!fasting.schedule && !fasting.activeFast) {
    return (
      <Banner tone="info" title="No fasting schedule yet">
        Set a window if you want one — it's optional.
      </Banner>
    );
  }
  const status = fastingStatus(fasting.schedule, fasting.activeFast, new Date(), timezone);
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <Card style={{ flex: 1 }}>
      <Row>
        <IconTile kind="fasting" size={32} />
        <Text variant="bodyStrong">Fasting</Text>
      </Row>
      {status.state === 'fasting' ? (
        <>
          <StatLine left="In progress" right={`to ${time(status.endsAt)}`} />
          <ProgressBar fraction={status.fraction} label="Fasting window progress" />
        </>
      ) : (
        <StatLine
          left="Not fasting"
          right={status.nextFastStartsAt ? time(status.nextFastStartsAt) : 'No window'}
          hint={status.nextFastStartsAt ? `Not fasting, next window starts ${time(status.nextFastStartsAt)}` : 'Not fasting, no window planned'}
        />
      )}
      <TextAction label="View fasting" onPress={() => router.push('/fasting')} />
    </Card>
  );
}
