import { FieldToneContext } from './fieldTone';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ActivityType, PlannedExercise, PlannedSession, RoutinePlan, WeightUnit } from '@mova/shared';
import { ACTIVITY_LABELS, DAY_SHORT } from '@/lib/format';
import { colors, radii, spacing } from '@/theme/tokens';
import { Button } from './Button';
import { Chip, NumberField, Segmented, TextField } from './Form';
import { Card, Row } from './Layout';
import { Icon } from './Status';
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

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
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
              <Button
                label="Remove day"
                size="sm"
                variant="ghost"
                disabled={plan.sessions.length === 1}
                onPress={() => onChange({ ...plan, sessions: plan.sessions.filter((_, j) => j !== i) })}
              />
            </Row>
          ) : null}
          <TextField label="Session name" value={s.title} onChangeText={(title) => setSession(i, { ...s, title })} error={errors[`sessions.${i}.title`]} />
          <View style={{ gap: spacing.xs }}>
            <Text variant="label" style={{ fontWeight: '500' }}>Day</Text>
            <Row style={{ flexWrap: 'wrap' }}>
              {DAY_SHORT.map((d, dow) => (
                <Chip key={d} label={d} selected={s.dayOfWeek === dow} onPress={() => setSession(i, { ...s, dayOfWeek: dow })} />
              ))}
            </Row>
          </View>
          <Segmented
            label="Type"
            options={TYPES.map((t) => ({ value: t, label: ACTIVITY_LABELS[t]! }))}
            value={s.activityType}
            onChange={(activityType) => setSession(i, { ...s, activityType })}
          />
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Start time (optional)"
                placeholder="HH:MM"
                value={s.startTime ?? ''}
                onChangeText={(t) => setSession(i, { ...s, startTime: t.trim() === '' ? undefined : t.trim() })}
                error={errors[`sessions.${i}.startTime`]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField
                label="Duration"
                unit="min"
                allowDecimal={false}
                placeholder="Optional"
                value={s.durationMinutes}
                onChange={(durationMinutes) => setSession(i, { ...s, durationMinutes })}
                error={errors[`sessions.${i}.durationMinutes`]}
              />
            </View>
          </Row>

          {s.activityType === 'strength' || s.exercises.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="label" style={{ fontWeight: '500' }}>Exercises</Text>
              {errors[`sessions.${i}.exercises`] ? (
                <Text variant="caption" color="negative">
                  {errors[`sessions.${i}.exercises`]}
                </Text>
              ) : null}
              {s.exercises.map((e, k) => (
                <ExerciseRow
                  key={k}
                  exercise={e}
                  index={k}
                  count={s.exercises.length}
                  errors={errors}
                  path={`sessions.${i}.exercises.${k}`}
                  onChange={(ex) => setSession(i, { ...s, exercises: s.exercises.map((x, j) => (j === k ? ex : x)) })}
                  onRemove={() => setSession(i, { ...s, exercises: s.exercises.filter((_, j) => j !== k) })}
                  onMove={(dir) => setSession(i, { ...s, exercises: move(s.exercises, k, k + dir) })}
                />
              ))}
              <Button label="Add exercise" size="sm" variant="secondary" onPress={() => setSession(i, { ...s, exercises: [...s.exercises, emptyExercise(weightUnit)] })} />
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
  index,
  count,
  errors,
  path,
  onChange,
  onRemove,
  onMove,
}: {
  exercise: PlannedExercise;
  index: number;
  count: number;
  errors: Record<string, string>;
  path: string;
  onChange: (e: PlannedExercise) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <FieldToneContext.Provider value="white">
    <View style={styles.exercise}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="caption" color="inkTertiary">
          Exercise {index + 1}
        </Text>
        <Row>
          <IconButton label="Move up" icon="arrow-up" disabled={index === 0} onPress={() => onMove(-1)} />
          <IconButton label="Move down" icon="arrow-down" disabled={index === count - 1} onPress={() => onMove(1)} />
          <IconButton label="Remove exercise" icon="trash" onPress={onRemove} />
        </Row>
      </Row>
      <TextField label="Name" value={e.name} onChangeText={(name) => onChange({ ...e, name })} error={errors[`${path}.name`]} />
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
      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <NumberField
            label="Target weight"
            placeholder="Optional"
            value={e.targetWeight}
            onChange={(targetWeight) => onChange({ ...e, targetWeight })}
            error={errors[`${path}.weightUnit`]}
          />
        </View>
        <Segmented
          options={[
            { value: 'kg', label: 'kg' },
            { value: 'lb', label: 'lb' },
          ]}
          value={e.weightUnit ?? 'kg'}
          onChange={(weightUnit) => onChange({ ...e, weightUnit })}
        />
      </Row>
      <NumberField label="Rest" unit="seconds" allowDecimal={false} placeholder="Optional" value={e.restSeconds} onChange={(restSeconds) => onChange({ ...e, restSeconds })} />
    </View>
    </FieldToneContext.Provider>
  );
}

function IconButton({ label, icon, onPress, disabled }: { label: string; icon: React.ComponentProps<typeof Icon>['name']; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={8} style={{ opacity: disabled ? 0.3 : 1, padding: 4 }}>
      <Icon name={icon} size={20} />
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
  exercise: { gap: spacing.md, padding: spacing.base, borderRadius: radii.lg, backgroundColor: colors.cream },
});
