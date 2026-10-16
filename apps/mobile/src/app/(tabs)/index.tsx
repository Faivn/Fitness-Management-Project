import { router } from 'expo-router';
import { View } from 'react-native';
import { fastingStatus, formatVolume, hydrationProgress } from '@mova/shared';
import { Banner, Button, Card, EmptyState, ErrorState, LoadingState, Row, Screen, Section, Text } from '@/components';
import { AIEntryBar, MascotNote, MealSlotCard, SessionCard } from '@/components/domain';
import { useOverview, useProfile } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
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
    <Screen refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" color="inkTertiary">
          {formatDate(o.localDate, true).toUpperCase()}
        </Text>
        <Text variant="title">Today</Text>
      </View>

      <AIEntryBar />

      {o.needsAttention.length > 0 ? (
        <Section title="Needs an update">
          <Text variant="small" color="inkSecondary">
            These planned sessions have passed without an outcome. Log them, move them or mark them missed — no pressure.
          </Text>
          {o.needsAttention.map((s) => (
            <SessionCard key={s.id} session={s} showDate />
          ))}
        </Section>
      ) : null}

      <Section title="Workouts & activities" action={<Button label="Log activity" size="sm" variant="secondary" onPress={() => router.push('/activity/log')} />}>
        {active.length > 0 ? (
          active.map((s) => <SessionCard key={s.id} session={s} />)
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
        <Section title="Meal timetable" action={<Button label="Plan" size="sm" variant="ghost" onPress={() => router.push(`/meal/${o.mealPlanId}`)} />}>
          <Text variant="caption" color="inkTertiary">
            Planned meals — not a food log.
          </Text>
          {o.meals.map((m) => (
            <MealSlotCard key={m.id} entry={m} />
          ))}
        </Section>
      ) : null}

      {o.hydration ? (
        <Section title="Hydration">
          <HydrationCard totalMl={o.hydration.totalMl} target={o.hydration.target} unit={volumeUnit} />
        </Section>
      ) : null}

      {o.fasting ? (
        <Section title="Fasting">
          <FastingCard fasting={o.fasting} timezone={o.timezone} />
        </Section>
      ) : null}
    </Screen>
  );
}

function ProgressBar({ fraction, label }: { fraction: number; label: string }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
      style={{ height: 10, borderRadius: radii.pill, backgroundColor: colors.surfaceSubtle, overflow: 'hidden' }}
    >
      <View style={{ width: `${Math.round(fraction * 100)}%`, height: '100%', backgroundColor: colors.brand }} />
    </View>
  );
}

function HydrationCard({ totalMl, target, unit }: { totalMl: number; target: { dailyTarget: number; unit: 'ml' | 'l' | 'fl_oz' } | null; unit: 'ml' | 'l' | 'fl_oz' }) {
  const p = target ? hydrationProgress(totalMl, target.dailyTarget, target.unit) : null;
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="bodyStrong">{formatVolume(totalMl, unit)}</Text>
        <Text variant="small" color="inkTertiary">
          {p ? `of ${formatVolume(p.targetMl, unit)}` : 'No daily goal set'}
        </Text>
      </Row>
      {p ? <ProgressBar fraction={p.fraction} label="Water intake toward today's goal" /> : null}
      <Button label="Add water" size="sm" variant="secondary" onPress={() => router.push('/hydration')} />
    </Card>
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
  return (
    <Card>
      {status.state === 'fasting' ? (
        <>
          <Text variant="bodyStrong">{status.basis === 'manual' ? 'Fast in progress' : 'In your fasting window'}</Text>
          <ProgressBar fraction={status.fraction} label="Fasting window progress" />
          <Text variant="small" color="inkTertiary">
            Until {new Date(status.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </>
      ) : (
        <Text variant="bodyStrong">
          Not fasting
          {status.nextFastStartsAt ? ` · next window ${new Date(status.nextFastStartsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
        </Text>
      )}
      <Button label="Open fasting" size="sm" variant="secondary" onPress={() => router.push('/fasting')} />
    </Card>
  );
}
