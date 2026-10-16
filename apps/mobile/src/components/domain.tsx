import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { addDays, describeConflict, type MealPlanEntryDto, type ScheduleChange, type ScheduleConflict, type WorkoutSession } from '@mova/shared';
import { ACTIVITY_LABELS, DAY_SHORT, formatDate, formatSeconds, formatTimeRange } from '@/lib/format';
import { colors, radii, spacing, TOUCH_TARGET } from '@/theme/tokens';
import { Card, PressableCard, Row } from './Layout';
import { Mascot } from './Mascot';
import { Icon, StatusBadge } from './Status';
import { Text } from './Text';

/**
 * Planned/actual session card (research: Runna). The plan and what actually
 * happened are shown as two distinct parts — a plan is never shown as done.
 */
export function SessionCard({ session, showDate }: { session: WorkoutSession; showDate?: boolean }) {
  const planned = session.plannedDate !== null;
  const moved = planned && session.originalPlannedDate !== session.plannedDate;
  const when = formatTimeRange(session.plannedTime, session.plannedDurationMinutes);
  const hasActual = session.actualDate !== null;
  return (
    <PressableCard accessibilityLabel={`${session.title}, ${session.status}`} onPress={() => router.push(`/session/${session.id}`)}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="caption" color="inkTertiary">
          {ACTIVITY_LABELS[session.activityType]}
          {showDate && session.plannedDate ? ` · ${formatDate(session.plannedDate)}` : ''}
          {!planned ? ' · Unplanned' : ''}
        </Text>
        <StatusBadge status={!planned ? (session.source === 'historical_entry' ? 'historical_entry' : 'spontaneous') : session.status} />
      </Row>
      <Text variant="heading">{session.title}</Text>
      {planned ? (
        <Text variant="small" color="inkSecondary">
          Planned{when ? ` · ${when}` : ''}
          {moved ? ` · moved from ${formatDate(session.originalPlannedDate)}` : ''}
        </Text>
      ) : null}
      {hasActual ? (
        <View style={styles.actual}>
          <Text variant="caption" color="positive">
            Recorded
          </Text>
          <Text variant="small">
            {[
              formatDate(session.actualDate),
              formatSeconds(session.actualDurationSeconds),
              session.actualDistanceValue !== null ? `${session.actualDistanceValue} ${session.actualDistanceUnit}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      ) : null}
    </PressableCard>
  );
}

/** Day selector with session markers (research: Runna, Peloton). */
export function WeekStrip({
  start,
  selected,
  onSelect,
  marks,
}: {
  start: string;
  selected: string;
  onSelect: (d: string) => void;
  marks: Record<string, number>;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <View style={styles.week} accessibilityRole="tablist">
      {days.map((d) => {
        const sel = d === selected;
        const [, , dd] = d.split('-');
        const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
        const count = marks[d] ?? 0;
        return (
          <Pressable
            key={d}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={`${formatDate(d)}${count ? `, ${count} planned` : ''}`}
            onPress={() => onSelect(d)}
            style={[styles.day, sel && styles.daySelected]}
          >
            <Text variant="caption" color={sel ? 'onInk' : 'inkTertiary'}>
              {DAY_SHORT[dow]}
            </Text>
            <Text variant="bodyStrong" color={sel ? 'onInk' : 'ink'}>
              {Number(dd)}
            </Text>
            <View style={[styles.dot, { backgroundColor: count ? (sel ? colors.brand : colors.ink) : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** WF-07 history: original date, every move, reason and outcome. */
export function ChangeTimeline({ changes, originalDate }: { changes: ScheduleChange[]; originalDate: string | null }) {
  if (!originalDate) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <TimelineItem icon="flag-outline" title={`Originally planned for ${formatDate(originalDate)}`} />
      {changes.map((c) => (
        <TimelineItem
          key={c.id}
          icon={c.changeType === 'rescheduled' ? 'swap-horizontal' : c.changeType === 'marked_missed' ? 'remove-circle-outline' : 'close-circle-outline'}
          title={
            c.changeType === 'rescheduled'
              ? `Moved from ${formatDate(c.oldDate)}${c.oldTime ? ` ${c.oldTime}` : ''} to ${formatDate(c.newDate)}${c.newTime ? ` ${c.newTime}` : ''}`
              : c.changeType === 'marked_missed'
                ? 'Marked as missed'
                : 'Cancelled'
          }
          detail={[c.reason ? `Reason: ${c.reason}` : null, `Changed ${c.createdAt.slice(0, 10)}`].filter(Boolean).join(' · ')}
        />
      ))}
    </View>
  );
}

function TimelineItem({ icon, title, detail }: { icon: React.ComponentProps<typeof Icon>['name']; title: string; detail?: string }) {
  return (
    <Row style={{ alignItems: 'flex-start' }}>
      <Icon name={icon} size={18} color="inkSecondary" />
      <View style={{ flex: 1 }}>
        <Text variant="small">{title}</Text>
        {detail ? (
          <Text variant="caption" color="inkTertiary">
            {detail}
          </Text>
        ) : null}
      </View>
    </Row>
  );
}

export function ConflictList({ conflicts }: { conflicts: ScheduleConflict[] }) {
  if (!conflicts.length) return null;
  return (
    <View style={[styles.conflicts]} accessibilityRole="alert">
      <Text variant="label" color="warning">
        {conflicts.length === 1 ? '1 scheduling conflict' : `${conflicts.length} scheduling conflicts`}
      </Text>
      {conflicts.map((c, i) => (
        <Text key={i} variant="small" color="inkSecondary">
          • {describeConflict(c)}
        </Text>
      ))}
    </View>
  );
}

/** Labels a proposal so it is never mistaken for a saved plan. */
export function ProposalBanner({ version, status }: { version: number; status: string }) {
  return (
    <View style={styles.proposal}>
      <Icon name="sparkles-outline" size={16} color="info" />
      <Text variant="label" color="info" style={{ flex: 1 }}>
        {status === 'draft' ? 'Proposal — not saved yet' : `Proposal ${status}`}
      </Text>
      <View style={styles.versionChip}>
        <Text variant="caption" color="info">
          v{version}
        </Text>
      </View>
    </View>
  );
}

export function AIDisclaimer() {
  return (
    <Text variant="caption" color="inkTertiary">
      Mova's AI can make mistakes and isn't medical advice. Nothing is saved until you approve it.
    </Text>
  );
}

/** Persistent AI entry point on the overview (research: WHOOP). */
export function AIEntryBar({ prompt = 'Ask Mova anything…' }: { prompt?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open the Mova companion" onPress={() => router.push('/companion')} style={styles.aiBar}>
      <Mascot mood="thinking" size={32} animated={false} />
      <Text variant="body" color="inkTertiary" style={{ flex: 1 }}>
        {prompt}
      </Text>
      <Icon name="arrow-forward" size={18} color="inkSecondary" />
    </Pressable>
  );
}

export function MealSlotCard({ entry }: { entry: MealPlanEntryDto }) {
  return (
    <Card>
      <Text variant="caption" color="brandDeep">
        {entry.slot.toUpperCase()}
        {entry.isSmoothie ? ' · SMOOTHIE' : ''}
      </Text>
      <Text variant="bodyStrong">{entry.mealName}</Text>
      {entry.description ? (
        <Text variant="small" color="inkSecondary">
          {entry.description}
        </Text>
      ) : null}
    </Card>
  );
}

export function MascotNote({ mood, children }: { mood: React.ComponentProps<typeof Mascot>['mood']; children: React.ReactNode }) {
  return (
    <Row style={{ alignItems: 'center' }}>
      <Mascot mood={mood} size={56} animated={false} />
      <View style={styles.bubble}>{typeof children === 'string' ? <Text variant="small">{children}</Text> : children}</View>
    </Row>
  );
}

const styles = StyleSheet.create({
  actual: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline, paddingTop: spacing.sm, gap: 2 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 2, paddingVertical: spacing.sm, width: TOUCH_TARGET, borderRadius: radii.md },
  daySelected: { backgroundColor: colors.ink },
  dot: { width: 6, height: 6, borderRadius: 3 },
  conflicts: { backgroundColor: colors.warningWash, borderRadius: radii.md, padding: spacing.base, gap: spacing.xs },
  proposal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.infoWash,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  versionChip: { paddingHorizontal: spacing.sm, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.info },
  aiBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  bubble: { flex: 1, backgroundColor: colors.brandWash, borderRadius: radii.md, padding: spacing.md },
});
