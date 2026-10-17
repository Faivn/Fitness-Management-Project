import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { fastingStatus, type WorkoutSession } from '@mova/shared';
import { ErrorState, LoadingState, OverviewStatusSection, PressableCard, Row, RuneIcon, Screen, Text } from '@/components';
import { useOverview, useSession } from '@/hooks/api';
import { errorMessage } from '@/lib/api';
import { ACTIVITY_LABELS, formatTimeRange } from '@/lib/format';
import { overviewStatus } from '@/lib/overviewStatus';
import { colors, radii, spacing } from '@/theme/tokens';
import type { RuneIconName } from '@/components/RuneIcon';

/**
 * WF-05 daily overview: today's plan from persisted records. The headline status,
 * Training, Nutrition and Fasting all come from the person's real data; anything
 * not set up shows an honest empty state instead of an invented plan.
 */
export default function Overview() {
  const overview = useOverview();
  if (overview.isPending) return <LoadingState label="Loading today…" />;
  if (overview.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(overview.error)} onRetry={() => overview.refetch()} />
      </Screen>
    );

  const o = overview.data;
  const active = o.sessions.filter((s) => s.status !== 'cancelled');
  const status = overviewStatus(o);

  return (
    <Screen refreshing={overview.isRefetching} onRefresh={() => overview.refetch()}>
      <OverviewStatusSection status={status} onCatchUp={() => router.push('/catchup')} />

      <View style={styles.pair}>
      <View style={styles.half}>
      {active.length > 0 ? (
        <TrainingCard session={active[0]} />
      ) : o.isRestDay ? (
        <InfoCard icon="dumbbell-fill" tone="training" label="Training" title="Rest day" detail="Recovery is part of the plan." />
      ) : o.hasActiveRoutine ? (
        <InfoCard icon="dumbbell-fill" tone="training" label="Training" title="Nothing scheduled today" detail="Your routine has no workout for today." />
      ) : (
        <InfoCard icon="dumbbell-fill" tone="training" label="Training" title="No routine yet" detail="Create one" onPress={() => router.push('/routine/edit')} />
      )}
      </View>

      <View style={styles.half}>
      <InfoCard
        icon="utensils-fill" tone="nutrition"
        label="Nutrition"
        title="On the Menu"
        detail={!o.mealPlanId ? 'No meal plan yet.' : o.meals.length === 0 ? 'No meals planned today.' : `${mealCountLabel(o.meals.length)} planned`}
        onPress={() => router.navigate('/meals')}
        accessibilityHint="Opens your meal plan"
      />
      </View>
      </View>

      {o.fasting ? (
        <FastingCard fasting={o.fasting} timezone={o.timezone} />
      ) : (
        <PressableCard accessibilityLabel="Fasting, not set up. Opens fasting" onPress={() => router.push('/fasting')}>
          <Text variant="eyebrow" color="inkTertiary">Fasting</Text>
          <Text variant="small" color="inkSecondary">
            Not set up. Turn it on whenever you want an eating window.
          </Text>
        </PressableCard>
      )}
    </Screen>
  );
}

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** "Four meals": the number of meals planned for the day, in words up to ten. */
function mealCountLabel(n: number): string {
  return `${COUNT_WORDS[n] ?? n} ${n === 1 ? 'meal' : 'meals'}`;
}

const TONES = {
  training: { bg: colors.tealWash, fg: 'teal' },
  nutrition: { bg: colors.apricotWash, fg: 'apricot' },
} as const;

/** A filled icon on a soft tinted tile: teal for Training, apricot for Nutrition. */
function CardIcon({ name, tone }: { name: RuneIconName; tone: keyof typeof TONES }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 40, height: 40, borderRadius: radii.lg, backgroundColor: TONES[tone].bg, alignItems: 'center', justifyContent: 'center' }}>
      <RuneIcon name={name} size={24} color={TONES[tone].fg} />
    </View>
  );
}

/** Icon, category label, title and one detail line; the whole card is the tap target when it has an action. */
function InfoCard({
  icon,
  tone,
  label,
  title,
  detail,
  onPress,
  accessibilityHint,
}: {
  icon: RuneIconName;
  tone: keyof typeof TONES;
  label: string;
  title: string;
  detail: string;
  onPress?: () => void;
  accessibilityHint?: string;
}) {
  const body = (
    <View style={{ gap: spacing.md, flex: 1 }}>
      <Row style={{ gap: spacing.sm }}>
        <CardIcon name={icon} tone={tone} />
        <Text variant="eyebrow" color="inkTertiary" style={{ flex: 1 }}>
          {label}
        </Text>
      </Row>
      <View style={{ gap: 2 }}>
        <Text variant="heading">{title}</Text>
        <Text variant="small" color="inkSecondary" style={{ marginTop: spacing.xs }}>
          {detail}
        </Text>
      </View>
    </View>
  );
  if (!onPress) return <View style={[cardBox, { flex: 1 }]}>{body}</View>;
  return (
    <PressableCard fill accessibilityLabel={`${label}. ${title}. ${detail}`} accessibilityHint={accessibilityHint} onPress={onPress}>
      {body}
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  half: { flex: 1, flexBasis: 0, minWidth: 0 },
});

const cardBox = { backgroundColor: colors.canvas, borderRadius: radii.xl, padding: spacing.card } as const;

/** Today's workout: filled dumbbell, "Training", the workout's title and how many exercises are planned. Opens the workout panel. */
function TrainingCard({ session: s }: { session: WorkoutSession }) {
  const detail = useSession(s.id);
  const n = detail.data?.exercises.length ?? 0;
  const info =
    n > 0 ? `${n} ${n === 1 ? 'exercise' : 'exercises'} planned` : formatTimeRange(s.plannedTime, s.plannedDurationMinutes) ?? ACTIVITY_LABELS[s.activityType] ?? 'Planned';
  return <InfoCard icon="dumbbell-fill" tone="training" label="Training" title={s.title} detail={info} onPress={() => router.push(`/session/${s.id}`)} accessibilityHint="Opens today's workout" />;
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
  const elapsed = on ? `${hours(total * fraction)} of ${hours(total)}` : 'Not fasting';
  const sub = on ? `Ends at ${time(status.endsAt)}` : status.nextFastStartsAt ? `Next window starts at ${time(status.nextFastStartsAt)}` : 'No window planned';
  return (
    <PressableCard accessibilityLabel={`Fasting. ${elapsed}. ${sub}. Opens fasting`} onPress={() => router.push('/fasting')}>
      <Text variant="eyebrow" color="inkTertiary">
        Fasting
      </Text>
      <Row style={{ justifyContent: 'space-between', gap: spacing.lg }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="heading">{elapsed}</Text>
          <Text variant="small" color="inkSecondary">
            {sub}
          </Text>
        </View>
        <ProgressRing fraction={fraction} label={on ? 'Fasting progress toward your target' : 'Not fasting'}>
          <Text variant="label">{on ? `${Math.round(fraction * 100)}%` : '—'}</Text>
        </ProgressRing>
      </Row>
    </PressableCard>
  );
}
