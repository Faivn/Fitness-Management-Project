import { FieldToneContext } from './fieldTone';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ActivityType, PlannedExercise, PlannedSession, RoutinePlan, WeightUnit } from '@mova/shared';
import { ACTIVITY_LABELS, DAY_NAMES } from '@/lib/format';
import { colors, radii, spacing, TOUCH_TARGET } from '@/theme/tokens';
import { Button } from './Button';
import { NumberField, Select, TextField } from './Form';
import { Card, Row } from './Layout';
import { RuneIcon } from './RuneIcon';
import { Text } from './Text';

/**
 * Editor for the shared routine model. Manual routines (WF-04) and AI
 * proposals (WF-03 step 6) use this same component and the same schema.
 */

const TYPES: ActivityType[] = ['strength', 'running', 'walking', 'cycling', 'swimming', 'mobility', 'other'];

export function emptyExercise(unit: WeightUnit): PlannedExercise {
  return { name: '', targetSets: 3, repsMin: 8, repsMax: 12, weightUnit: unit } as PlannedExercise;
}

export function emptySession(day = 1): PlannedSession {
  return { title: '', activityType: 'strength', dayOfWeek: day, exercises: [] } as unknown as PlannedSession;
}

export function emptyPlan(): RoutinePlan {
  return { title: '', goalIds: [], sessions: [emptySession(1)], assumptions: [], warnings: [] } as unknown as RoutinePlan;
}

export function RoutineEditor({
  plan,
  onChange,
  errors,
  weightUnit,
  only,
}: {
  plan: RoutinePlan;
  onChange: (p: RoutinePlan) => void;
  errors: Record<string, string>;
  weightUnit: WeightUnit;
  /** Edit just this training day: hides routine-level fields and day add/remove. */
  only?: number;
}) {
  const setSession = (i: number, s: PlannedSession) => onChange({ ...plan, sessions: plan.sessions.map((x, j) => (j === i ? s : x)) });

  return (
    <View style={{ gap: spacing.xl }}>
      {only === undefined ? (
        <>
          <TextField label="Routine name" value={plan.title} onChangeText={(title) => onChange({ ...plan, title })} error={errors.title} />
          <TextField
            label="Purpose (optional)"
            value={plan.purpose ?? ''}
            onChangeText={(purpose) => onChange({ ...plan, purpose })}
            multiline
          />
        </>
      ) : null}

      {plan.sessions.map((s, i) => only !== undefined && i !== only ? null : (
        <Card key={i}>
          {only === undefined ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="label">Training day {i + 1}</Text>
              <IconButton
                label="Remove day"
                icon="minus"
                disabled={plan.sessions.length === 1}
                onPress={() => onChange({ ...plan, sessions: plan.sessions.filter((_, j) => j !== i) })}
              />
            </Row>
          ) : null}
          <TextField label="Session name" value={s.title} onChangeText={(title) => setSession(i, { ...s, title })} error={errors[`sessions.${i}.title`]} />
          <Row style={{ alignItems: 'flex-start', zIndex: 10 }}>
            <View style={{ flex: 1 }}>
              <Select label="Day" value={String(s.dayOfWeek)} options={DAY_NAMES.map((d, dow) => ({ value: String(dow), label: d }))} onChange={(v) => setSession(i, { ...s, dayOfWeek: Number(v) })} />
            </View>
            <View style={{ flex: 1 }}>
              <Select label="Type" value={s.activityType} options={TYPES.map((t) => ({ value: t, label: ACTIVITY_LABELS[t]! }))} onChange={(activityType) => setSession(i, { ...s, activityType })} />
            </View>
          </Row>

          {s.activityType === 'strength' || s.exercises.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              {errors[`sessions.${i}.exercises`] ? (
                <Text variant="caption" color="negative">
                  {errors[`sessions.${i}.exercises`]}
                </Text>
              ) : null}
              {s.exercises.map((e, k) => (
                <ExerciseRow
                  key={k}
                  exercise={e}
                  errors={errors}
                  path={`sessions.${i}.exercises.${k}`}
                  onChange={(ex) => setSession(i, { ...s, exercises: s.exercises.map((x, j) => (j === k ? ex : x)) })}
                  onRemove={() => setSession(i, { ...s, exercises: s.exercises.filter((_, j) => j !== k) })}
                />
              ))}
              <IconButton label="Add exercise" icon="plus" onPress={() => setSession(i, { ...s, exercises: [...s.exercises, emptyExercise(weightUnit)] })} />
            </View>
          ) : null}
        </Card>
      ))}

      {only === undefined ? (
      <Button
        label="Add training day"
        variant="secondary"
        onPress={() => onChange({ ...plan, sessions: [...plan.sessions, emptySession((plan.sessions.at(-1)?.dayOfWeek ?? 0) + 2 > 6 ? 0 : (plan.sessions.at(-1)?.dayOfWeek ?? 0) + 2)] })}
      />
      ) : null}
    </View>
  );
}

function ExerciseRow({
  exercise: e,
  errors,
  path,
  onChange,
  onRemove,
}: {
  exercise: PlannedExercise;
  errors: Record<string, string>;
  path: string;
  onChange: (e: PlannedExercise) => void;
  onRemove: () => void;
}) {
  return (
    <FieldToneContext.Provider value="white">
    <View style={styles.exercise}>
      <Row style={{ alignItems: 'flex-end', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField label="Name" value={e.name} onChangeText={(name) => onChange({ ...e, name })} error={errors[`${path}.name`]} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove exercise"
          onPress={onRemove}
          style={({ pressed }) => [styles.remove, pressed && { opacity: 0.7 }]}
        >
          <RuneIcon name="minus" size={16} color="roseDeep" />
        </Pressable>
      </Row>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <NumberField label="Sets" allowDecimal={false} value={e.targetSets} onChange={(v) => onChange({ ...e, targetSets: v ?? 0 })} error={errors[`${path}.targetSets`]} />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label="Reps min" allowDecimal={false} placeholder="—" value={e.repsMin} onChange={(repsMin) => onChange({ ...e, repsMin })} />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label="Reps max" allowDecimal={false} placeholder="—" value={e.repsMax} onChange={(repsMax) => onChange({ ...e, repsMax })} error={errors[`${path}.repsMax`]} />
        </View>
      </Row>
    </View>
    </FieldToneContext.Provider>
  );
}

function IconButton({ label, icon, onPress, disabled, square }: { label: string; icon: 'plus' | 'minus'; square?: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={8} style={[{ opacity: disabled ? 0.3 : 1, padding: 6, alignSelf: 'flex-start' }, square && { width: TOUCH_TARGET, height: TOUCH_TARGET, padding: 0, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' }]}>
      <RuneIcon name={icon} size={20} />
    </Pressable>
  );
}

/** Drop empty optional values the user cleared, so validation sees the real input. */
export function cleanPlan(plan: RoutinePlan): RoutinePlan {
  return {
    ...plan,
    purpose: plan.purpose?.trim() ? plan.purpose : undefined,
    sessions: plan.sessions.map((s) => ({
      ...s,
      exercises: s.exercises.map((e) => ({ ...e, weightUnit: e.targetWeight === undefined ? undefined : e.weightUnit })),
    })),
  };
}

const styles = StyleSheet.create({
  // Square, same height as the Name input beside it.
  remove: { width: TOUCH_TARGET, height: TOUCH_TARGET, borderRadius: radii.lg, backgroundColor: colors.roseWash, alignItems: 'center', justifyContent: 'center' },
  exercise: { gap: spacing.md, padding: spacing.base, borderRadius: radii.lg, backgroundColor: colors.cream },
});
