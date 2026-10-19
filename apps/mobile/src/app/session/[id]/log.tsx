import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { exerciseKey, type SetLogInput, type WeightUnit, type WorkoutSessionDetail } from '@mova/shared';
import { Banner, Button, Card, ErrorState, LoadingState, Row, Screen, Segmented, SheetPage, Text, TextField } from '@/components';
import { Icon } from '@/components/Status';
import { useFinishSession, useProfile, useSaveSets, useSession } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';
import { useDraft } from '@/lib/drafts';
import { formatDate } from '@/lib/format';
import { colors, fonts, radii, spacing, TOUCH_TARGET } from '@/theme/tokens';

/**
 * WF-06 workout logging (research: Hevy table with a PREVIOUS column).
 * Actual values are stored separately from targets, saved as each set is
 * confirmed, and also kept as a local draft so nothing is lost on restart.
 */
interface SetRow {
  clientId: string;
  exerciseName: string;
  sessionExerciseId?: string;
  setNumber: number;
  reps?: number;
  weight?: number;
  status: 'pending' | 'completed' | 'skipped';
  saved: boolean;
}

function initialRows(s: WorkoutSessionDetail): SetRow[] {
  const logged = new Map(s.setLogs.map((l) => [`${l.exerciseName}|${l.setNumber}`, l]));
  const rows: SetRow[] = [];
  for (const e of s.exercises) {
    for (let n = 1; n <= e.targetSets; n++) {
      const l = logged.get(`${e.displayName}|${n}`);
      rows.push({
        clientId: l?.clientId ?? newIdempotencyKey(),
        exerciseName: e.displayName,
        sessionExerciseId: e.id,
        setNumber: n,
        reps: l?.actualReps ?? undefined,
        weight: l?.actualWeight ?? undefined,
        status: l ? (l.status === 'skipped' ? 'skipped' : 'completed') : 'pending',
        saved: !!l,
      });
    }
  }
  // Extra sets logged beyond the targets.
  for (const l of s.setLogs) {
    if (!rows.some((r) => r.exerciseName === l.exerciseName && r.setNumber === l.setNumber)) {
      rows.push({ clientId: l.clientId, exerciseName: l.exerciseName, setNumber: l.setNumber, reps: l.actualReps ?? undefined, weight: l.actualWeight ?? undefined, status: l.status === 'skipped' ? 'skipped' : 'completed', saved: true });
    }
  }
  return rows;
}

function LogWorkoutBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession(id);
  const profile = useProfile();
  const save = useSaveSets();
  const finish = useFinishSession();
  const draft = useDraft<{ rows: SetRow[]; unit: WeightUnit; notes: string } | null>(`log-${id}`, null);
  const [finishKey] = useState(newIdempotencyKey);
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current || !session.data || !draft.restored) return;
    seeded.current = true;
    if (!draft.value) draft.setValue({ rows: initialRows(session.data), unit: profile.data?.weightUnit ?? 'kg', notes: '' });
  }, [session.data, draft, profile.data]);

  const pendingUnsaved = useMemo(() => draft.value?.rows.filter((r) => r.status !== 'pending' && !r.saved) ?? [], [draft.value]);

  if (session.isPending || !draft.value) return <LoadingState label="Preparing your workout…" />;
  if (session.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(session.error)} onRetry={() => session.refetch()} />
      </Screen>
    );
  const s = session.data;
  const state = draft.value;
  const unit = state.unit;

  function update(clientId: string, patch: Partial<SetRow>) {
    draft.setValue((d) => (d ? { ...d, rows: d.rows.map((r) => (r.clientId === clientId ? { ...r, ...patch } : r)) } : d));
  }

  function toLog(r: SetRow): SetLogInput {
    return {
      clientId: r.clientId,
      sessionExerciseId: r.sessionExerciseId,
      exerciseName: r.exerciseName,
      setNumber: r.setNumber,
      actualReps: r.reps,
      actualWeight: r.weight,
      weightUnit: r.weight !== undefined ? unit : undefined,
      status: r.status === 'skipped' ? 'skipped' : 'completed',
    } as SetLogInput;
  }

  function confirmSet(r: SetRow, status: 'completed' | 'skipped') {
    const next = { ...r, status, saved: false };
    update(r.clientId, { status, saved: false });
    save.mutate({ id, logs: [toLog(next)] }, { onSuccess: () => update(r.clientId, { saved: true }) });
  }

  function retryUnsaved() {
    if (!pendingUnsaved.length) return;
    save.mutate(
      { id, logs: pendingUnsaved.map(toLog) },
      { onSuccess: () => pendingUnsaved.forEach((r) => update(r.clientId, { saved: true })) },
    );
  }

  function addSet(exerciseName: string, sessionExerciseId?: string) {
    const max = Math.max(0, ...state.rows.filter((r) => r.exerciseName === exerciseName).map((r) => r.setNumber));
    draft.setValue({ ...state, rows: [...state.rows, { clientId: newIdempotencyKey(), exerciseName, sessionExerciseId, setNumber: max + 1, status: 'pending', saved: false }] });
  }

  function onFinish(outcome: 'completed' | 'incomplete') {
    finish.mutate(
      { id, outcome, notes: state.notes || undefined, idempotencyKey: finishKey },
      {
        onSuccess: () => {
          void draft.clear();
          router.replace(`/session/${id}`);
        },
      },
    );
  }

  const exercises = [...new Map(state.rows.map((r) => [r.exerciseName, r.sessionExerciseId])).entries()];
  const anyDone = state.rows.some((r) => r.status === 'completed');

  return (
    <Screen
      footer={
        <>
          {finish.isError ? <Banner tone="error">{errorMessage(finish.error)}</Banner> : null}
          <Row>
            <View style={{ flex: 1 }}>
              <Button label="Finish workout" fullWidth disabled={!anyDone || pendingUnsaved.length > 0} loading={finish.isPending} onPress={() => onFinish('completed')} />
            </View>
            <Button label="Stop here" variant="secondary" loading={finish.isPending} onPress={() => onFinish('incomplete')} />
          </Row>
        </>
      }
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="small" color="inkSecondary">
          Planned {formatDate(s.plannedDate)} · enter what you actually did
        </Text>
        <Segmented
          options={[
            { value: 'kg', label: 'kg' },
            { value: 'lb', label: 'lb' },
          ]}
          value={unit}
          onChange={(u) => draft.setValue({ ...state, unit: u })}
        />
      </Row>

      {pendingUnsaved.length ? (
        <Banner tone="warning" title={`${pendingUnsaved.length} set(s) not saved yet`}>
          <Text variant="small" color="inkSecondary">
            They're kept on this device. {save.isError ? errorMessage(save.error) : ''}
          </Text>
          <Button label="Save now" size="sm" variant="secondary" loading={save.isPending} onPress={retryUnsaved} />
        </Banner>
      ) : null}

      {exercises.map(([name, exId]) => {
        const target = s.exercises.find((e) => e.displayName === name);
        const prev = s.previousPerformance[exerciseKey({ exerciseId: null, exerciseName: name })];
        return (
          <Card key={name}>
            <Pressable accessibilityRole="link" onPress={() => router.push(`/exercise?name=${encodeURIComponent(name)}`)}>
              <Text variant="heading">{name}</Text>
            </Pressable>
            {target ? (
              <Text variant="caption" color="inkTertiary">
                Target {target.targetSets} × {target.targetRepsMin && target.targetRepsMax ? `${target.targetRepsMin}–${target.targetRepsMax}` : (target.targetRepsMin ?? target.targetRepsMax ?? '?')}
                {target.targetWeight ? ` @ ${target.targetWeight} ${target.weightUnit}` : ''}
                {target.restSeconds ? ` · rest ${target.restSeconds}s` : ''}
              </Text>
            ) : null}
            <Text variant="caption" color="inkTertiary">
              {prev ? `Previous (${formatDate(prev.date)})` : 'No previous record for this exercise'}
            </Text>
            <View style={styles.headerRow}>
              <Text variant="caption" color="inkTertiary" style={styles.cSet}>SET</Text>
              <Text variant="caption" color="inkTertiary" style={styles.cPrev}>PREVIOUS</Text>
              <Text variant="caption" color="inkTertiary" style={styles.cNum}>{unit.toUpperCase()}</Text>
              <Text variant="caption" color="inkTertiary" style={styles.cNum}>REPS</Text>
              <View style={styles.cAct} />
            </View>
            {state.rows
              .filter((r) => r.exerciseName === name)
              .map((r) => {
                const p = prev?.sets.find((x) => x.setNumber === r.setNumber);
                const done = r.status !== 'pending';
                return (
                  <View key={r.clientId} style={[styles.row, r.status === 'completed' && styles.rowDone, r.status === 'skipped' && styles.rowSkipped]}>
                    <Text variant="bodyStrong" style={styles.cSet}>
                      {r.setNumber}
                    </Text>
                    <Text variant="small" color="inkTertiary" style={styles.cPrev}>
                      {p ? `${p.actualWeight ?? '–'}${p.weightUnit ? ` ${p.weightUnit}` : ''} × ${p.actualReps ?? '–'}` : '—'}
                    </Text>
                    <NumCell label={`Set ${r.setNumber} weight`} value={r.weight} editable={!done} onChange={(weight) => update(r.clientId, { weight })} />
                    <NumCell label={`Set ${r.setNumber} reps`} value={r.reps} integer editable={!done} onChange={(reps) => update(r.clientId, { reps })} />
                    <View style={[styles.cAct, { flexDirection: 'row', gap: 4 }]}>
                      {done ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Edit set ${r.setNumber}`} onPress={() => update(r.clientId, { status: 'pending', saved: true })} hitSlop={6}>
                          <Icon name={r.status === 'skipped' ? 'skip-forward' : r.saved ? 'circle-check' : 'cloud-upload'} color={r.status === 'skipped' ? 'inkTertiary' : 'positive'} size={24} />
                        </Pressable>
                      ) : (
                        <>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Complete set ${r.setNumber}`} onPress={() => confirmSet(r, 'completed')} hitSlop={6}>
                            <Icon name="circle-check" size={24} />
                          </Pressable>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Skip set ${r.setNumber}`} onPress={() => confirmSet(r, 'skipped')} hitSlop={6}>
                            <Icon name="skip-forward" size={24} color="inkTertiary" />
                          </Pressable>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            <Button label="Add set" size="sm" variant="ghost" onPress={() => addSet(name, exId)} />
          </Card>
        );
      })}
      <TextField label="Notes (optional)" value={state.notes} onChangeText={(notes) => draft.setValue({ ...state, notes })} multiline />
      <Text variant="caption" color="inkTertiary">
        "Finish" records the actual completion time. "Stop here" keeps the session as incomplete — it won't count as completed.
      </Text>
    </Screen>
  );
}

function NumCell({ label, value, onChange, integer, editable }: { label: string; value?: number; onChange: (v: number | undefined) => void; integer?: boolean; editable: boolean }) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => setText(value === undefined ? '' : String(value)), [value]);
  return (
    <TextInput
      accessibilityLabel={label}
      editable={editable}
      value={text}
      placeholder="–"
      placeholderTextColor={colors.inkDisabled}
      keyboardType={integer ? 'number-pad' : 'decimal-pad'}
      onChangeText={(t) => {
        const c = t.replace(',', '.');
        setText(c);
        const n = Number(c);
        onChange(c.trim() === '' || !Number.isFinite(n) ? undefined : n);
      }}
      style={[styles.cNum, styles.input, !editable && { backgroundColor: 'transparent' }]}
    />
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs, minHeight: TOUCH_TARGET, borderRadius: radii.sm },
  rowDone: { backgroundColor: colors.positiveWash },
  rowSkipped: { backgroundColor: colors.surfaceSubtle },
  cSet: { width: 32 },
  // flexBasis/minWidth 0 so inputs shrink to fit narrow screens (web inputs have an intrinsic width).
  cPrev: { flex: 1.4, flexBasis: 0, minWidth: 0 },
  cNum: { flex: 1, flexBasis: 0, minWidth: 0, width: 0, textAlign: 'center' },
  cAct: { width: 60, alignItems: 'flex-end' },
  input: { minHeight: 36, borderRadius: radii.md, backgroundColor: colors.cream, color: colors.ink, fontSize: 16, fontFamily: fonts.regular },
});

/** Logging opens as a bottom sheet like the rest of the app, so the floating nav bar can never sit under its Finish button. */
export default function LogWorkout() {
  return (
    <SheetPage title="Log workout">
      <LogWorkoutBody />
    </SheetPage>
  );
}
