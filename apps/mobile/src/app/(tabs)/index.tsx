import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { fastingStatus, formatVolume, hydrationProgress } from '@mova/shared';
import { Banner, Button, Card, Divider, EmptyState, ErrorState, ExpandableCard, IconTile, LoadingState, PressableCard, Row, RuneIcon, Screen, Section, StatusBadge, Text, TextAction, TileRow, tileKindFor } from '@/components';
import { dayPart } from '@/lib/greeting';
import { MascotNote } from '@/components/domain';
import { useOverview, useProfile } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { ACTIVITY_LABELS, formatDate, formatTimeRange } from '@/lib/format';
import { useOnboarding } from '@/lib/onboarding';
import { colors, radii, spacing } from '@/theme/tokens';

/**
 * WF-05 daily overview: today's plan from persisted records. Rest days are
 * valid plans; past-due sessions stay visible; disabled modules are hidden.
 */
export default function Overview() {
  const overview = useOverview();
  const [part, setPart] = useState(dayPart());
  // Keep the greeting in step with the clock while the screen stays open.
  useEffect(() => {
    const t = setInterval(() => setPart(dayPart()), 60_000);
    return () => clearInterval(t);
  }, []);
  const profile = useProfile();
  const onboarding = useOnboarding();

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
    >
      <View style={{ gap: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.md }}>
        <Text variant="caption" color="inkTertiary" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          {formatDate(o.localDate, true)}
        </Text>
        <Text variant="display">
          {`Good ${part}${onboarding.state.name ? `, ${onboarding.state.name}` : ''}`}
        </Text>
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

      <Section>
        {active.length > 0 && active.every((s) => s.status === 'completed') ? (
          <MascotNote mood="celebration">Today's workout is done. Well done.</MascotNote>
        ) : null}
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
                <RuneIcon name="arrow-up-right" size={20} />
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
            title="No routine yet"
            action={{ label: 'New routine', onPress: () => router.push('/routine/edit') }}
          />
        )}
      </Section>

      {o.meals.length > 0 ? (
        <ExpandableCard title="On the Menu" summary={mealCountLabel(o.meals.length)}>
          {o.meals.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <Divider /> : null}
              <TileRow medium eyebrow={m.slot.toUpperCase() + (m.isSmoothie ? ' · SMOOTHIE' : '')} title={m.mealName} />
            </View>
          ))}
          <View style={{ alignItems: 'flex-start', paddingTop: spacing.sm }}>
          <Button label="Open meal plan" variant="secondary" size="sm" onPress={() => router.push(`/meal/${o.mealPlanId}`)} />
          </View>
        </ExpandableCard>
      ) : !o.mealPlanId ? (
        <Card>
          <Text variant="heading">On the Menu</Text>
          <Text variant="small" color="inkSecondary">
            No meal plan yet. Mova can plan your meals with you.
          </Text>
          <View style={{ alignItems: 'flex-start' }}>
            <Button label="Plan my meals" variant="secondary" size="sm" onPress={() => router.push('/companion?intent=meal')} />
          </View>
        </Card>
      ) : null}

      {o.fasting ? (
        <FastingCard fasting={o.fasting} timezone={o.timezone} />
      ) : (
        <Card>
          <Text variant="heading">Fasting</Text>
          <Text variant="small" color="inkSecondary">
            Not set up. Turn it on whenever you want an eating window.
          </Text>
          <View style={{ alignItems: 'flex-start' }}>
            <Button label="Set up fasting" variant="secondary" size="sm" onPress={() => router.push('/fasting')} />
          </View>
        </Card>
      )}
    </Screen>
  );
}

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** "Four meals" — the number of meals planned for the day, in words up to ten. */
function mealCountLabel(n: number): string {
  return `${COUNT_WORDS[n] ?? n} ${n === 1 ? 'meal' : 'meals'}`;
}

/** Circular progress: a track ring with a graphite arc, value in the centre. */
function ProgressRing({ fraction, size = 96, label, children }: { fraction: number; size?: number; label: string; children: React.ReactNode }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, fraction));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(f * 100) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.blush} strokeWidth={stroke} fill="none" />
        {f > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.rose}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${c * f} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

function FastingCard({ fasting, timezone }: { fasting: NonNullable<ReturnType<typeof useOverview>['data']>['fasting']; timezone: string }) {
  if (!fasting) return null;
  const status = fastingStatus(fasting.schedule, fasting.activeFast, new Date(), timezone);
  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const hours = (ms: number) => `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
  const on = status.state === 'fasting';
  const fraction = on ? status.fraction : 0;
  const total = on ? new Date(status.endsAt).getTime() - new Date(status.startedAt).getTime() : 0;
  return (
    <PressableCard accessibilityLabel={on ? 'Fasting, in progress. Set fasting time' : 'Fasting, not fasting. Set fasting time'} onPress={() => router.push('/fasting')}>
      <Row style={{ gap: spacing.lg }}>
        <ProgressRing fraction={fraction} label={on ? 'Fasting progress toward your target' : 'Not fasting'}>
          <Text variant="label">{on ? `${Math.round(fraction * 100)}%` : '—'}</Text>
        </ProgressRing>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="label">Fasting</Text>
          {on ? (
            <>
              <Text variant="small">
                {hours(total * fraction)} of {hours(total)}
              </Text>
              <Text variant="small" color="inkSecondary">
                Ends at {time(status.endsAt)}
              </Text>
            </>
          ) : (
            <>
              <Text variant="small">Not fasting</Text>
              <Text variant="small" color="inkSecondary">
                {status.nextFastStartsAt ? `Next window starts at ${time(status.nextFastStartsAt)}` : 'No window planned'}
              </Text>
            </>
          )}
        </View>
      </Row>
    </PressableCard>
  );
}
