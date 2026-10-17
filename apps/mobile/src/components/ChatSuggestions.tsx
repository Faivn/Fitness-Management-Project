import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { GoalDraft, ScheduleConflict } from '@mova/shared';
import { useApproveMealPlan, useApproveRoutineProposal, useCreateGoal, useGoalProposal, useMealProposal, useProfile, useReplaceClashingRoutines, useRoutineProposal } from '@/hooks/api';
import { ApiError, newIdempotencyKey } from '@/lib/api';
import { DAY_SHORT } from '@/lib/format';
import { appToday } from '@/lib/today';
import { colors, radii, spacing } from '@/theme/tokens';
import { ClashPrompt } from './domain';
import { useReducedMotion } from './motion';
import { RuneIcon } from './RuneIcon';
import { Text } from './Text';

/** Reveals a reply a few characters at a time, like it is being typed. Shows it all at once under reduced motion. */
export function StreamedText({ text, enabled, onDone, color }: { text: string; enabled: boolean; onDone?: () => void; color?: 'ink' | 'onInk' }) {
  const reduce = useReducedMotion();
  const instant = !enabled || reduce;
  const [n, setN] = useState(instant ? text.length : 0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (instant) {
      setN(text.length);
      done.current?.();
      return;
    }
    let shown = 0;
    const t = setInterval(() => {
      shown = Math.min(text.length, shown + 3);
      setN(shown);
      if (shown >= text.length) {
        clearInterval(t);
        done.current?.();
      }
    }, 20);
    return () => clearInterval(t);
  }, [text, instant]);
  return (
    <Text variant="body" color={color}>
      {text.slice(0, n)}
    </Text>
  );
}

/** A small "Suggestions" pill above the composer with a soft shimmer sweeping across it. */
export function ShimmerPill({ open, onPress }: { open: boolean; onPress: () => void }) {
  const reduce = useReducedMotion();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }));
    loop.start();
    return () => loop.stop();
  }, [reduce, x]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Suggestions"
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && { opacity: 0.85 }]}
    >
      <RuneIcon name="sparkles" size={16} color="lilac" />
      <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '500' }} color="lilac">
        Suggestions
      </Text>
      {reduce ? null : (
        <Animated.View
          pointerEvents="none"
          style={[styles.shine, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-90, 130] }) }, { skewX: '-20deg' }] }]}
        />
      )}
    </Pressable>
  );
}

/** Small boxes of ready-made things to ask. Choosing one sends it. */
export function SuggestionChips({ items, onPick }: { items: string[]; onPick: (text: string) => void }) {
  return (
    <View style={styles.chips}>
      {items.map((t) => (
        <Pressable key={t} accessibilityRole="button" accessibilityLabel={t} onPress={() => onPick(t)} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.8 }]}>
          <Text style={{ fontSize: 13, lineHeight: 18 }}>{t}</Text>
        </Pressable>
      ))}
    </View>
  );
}

type Phase = 'idle' | 'saving' | 'saved';

/** One suggestion: a thin outlined row with a radio on the right. Selecting the radio accepts it. */
function AcceptRow({ title, detail, phase, onAccept, onSkip }: { title: string; detail?: string; phase: Phase; onAccept: () => void; onSkip?: () => void }) {
  const saved = phase === 'saved';
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '500' }}>{title}</Text>
        {detail ? (
          <Text variant="caption" color="inkTertiary" numberOfLines={3}>
            {detail}
          </Text>
        ) : null}
        {saved ? (
          <Text variant="caption" color="inkTertiary">
            Saved
          </Text>
        ) : null}
      </View>
      {!saved && onSkip ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Skip ${title}`} onPress={onSkip} hitSlop={8} disabled={phase === 'saving'}>
          <Text variant="caption" color="inkTertiary">
            Skip
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: saved, busy: phase === 'saving' }}
        accessibilityLabel={`Accept ${title}`}
        disabled={phase !== 'idle'}
        onPress={onAccept}
        hitSlop={10}
        style={[styles.radio, saved && styles.radioOn]}
      >
        {saved ? <RuneIcon name="check" size={14} color="onInk" /> : phase === 'saving' ? <View style={styles.radioBusy} /> : null}
      </Pressable>
    </View>
  );
}

/** A routine the assistant drafted: ticking it saves and schedules it, so it shows up under Workouts. */
export function RoutineSuggestion({ id }: { id: string }) {
  const proposal = useRoutineProposal(id);
  const approve = useApproveRoutineProposal();
  const replace = useReplaceClashingRoutines();
  const profile = useProfile();
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [key] = useState(newIdempotencyKey);
  const p = proposal.data;
  if (!p) return null;
  if (!p.plan) {
    return p.clarifyingQuestions[0] ? (
      <Text variant="small" color="inkSecondary">
        {p.clarifyingQuestions[0]}
      </Text>
    ) : null;
  }
  const plan = p.plan;
  const phase: Phase = p.status === 'applied' || approve.isSuccess ? 'saved' : approve.isPending || replace.isPending ? 'saving' : 'idle';
  const accept = (acceptConflicts: boolean) =>
    approve.mutate(
      { id, version: p.version, schedule: { startDate: appToday(profile.data?.timezone ?? 'UTC'), weeks: 4 }, acceptConflicts, idempotencyKey: key },
      {
        onSuccess: () => setConflicts(null),
        onError: (e) => {
          if (e instanceof ApiError && e.code === 'schedule_conflict') setConflicts((e.details as { conflicts: ScheduleConflict[] }).conflicts);
        },
      },
    );
  return (
    <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
      <AcceptRow
        title={plan.title}
        detail={plan.sessions.map((s) => `${DAY_SHORT[s.dayOfWeek]} ${s.title}`).join(' · ')}
        phase={phase}
        onAccept={() => accept(false)}
      />
      {conflicts && phase !== 'saved' ? (
        <ClashPrompt conflicts={conflicts} busy={phase === 'saving'} onKeep={() => accept(true)} onReplace={() => replace.mutate(conflicts, { onSuccess: () => accept(true) })} />
      ) : null}
    </View>
  );
}

/** A meal plan the assistant drafted: ticking it saves it, so it fills the Meal plan page. */
export function MealSuggestion({ id }: { id: string }) {
  const proposal = useMealProposal(id);
  const approve = useApproveMealPlan();
  const [key] = useState(newIdempotencyKey);
  const p = proposal.data;
  if (!p) return null;
  if (!p.plan) {
    return p.clarifyingQuestions[0] ? (
      <Text variant="small" color="inkSecondary">
        {p.clarifyingQuestions[0]}
      </Text>
    ) : null;
  }
  const phase: Phase = p.status === 'applied' || approve.isSuccess ? 'saved' : approve.isPending ? 'saving' : 'idle';
  const days = new Set(p.plan.entries.map((e) => e.date)).size;
  return (
    <AcceptRow
      title={p.plan.title || 'Meal plan'}
      detail={`${days} ${days === 1 ? 'day' : 'days'} · ${p.plan.entries.length} meals`}
      phase={phase}
      onAccept={() => approve.mutate({ id, version: p.version, idempotencyKey: key })}
    />
  );
}

/** Suggested goals, one at a time: tick to save it, or skip, then the next appears. */
export function GoalSuggestions({ id }: { id: string }) {
  const proposal = useGoalProposal(id);
  const create = useCreateGoal();
  const [handled, setHandled] = useState<Record<number, 'saved' | 'skipped'>>({});
  const [keys] = useState(() => Array.from({ length: 8 }, () => newIdempotencyKey()));
  const goals: GoalDraft[] = proposal.data?.goals ?? [];
  if (!goals.length) return null;
  const current = goals.findIndex((_, i) => !handled[i]);
  const saved = goals.filter((_, i) => handled[i] === 'saved');
  return (
    <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
      {saved.map((g) => (
        <AcceptRow key={g.title} title={g.title} phase="saved" onAccept={() => undefined} />
      ))}
      {current >= 0 ? (
        <AcceptRow
          key={current}
          title={goals[current]!.title}
          phase={create.isPending ? 'saving' : 'idle'}
          onAccept={() => create.mutate({ ...goals[current]!, idempotencyKey: keys[current] ?? newIdempotencyKey() }, { onSuccess: () => setHandled((h) => ({ ...h, [current]: 'saved' })) })}
          onSkip={() => setHandled((h) => ({ ...h, [current]: 'skipped' }))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.lilacWash, overflow: 'hidden' },
  shine: { position: 'absolute', top: 0, bottom: 0, width: 36, backgroundColor: 'rgba(255, 255, 255, 0.65)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center' },
  radioOn: { backgroundColor: colors.rose, borderColor: colors.rose },
  radioBusy: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.rose },
});
