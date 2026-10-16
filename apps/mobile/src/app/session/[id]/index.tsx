import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { canReschedule, type WorkoutSessionDetail } from '@mova/shared';
import { Banner, Button, Card, ErrorState, LoadingState, NumberField, Row, Screen, Section, Segmented, StatusBadge, Text, TextField } from '@/components';
import { ChangeTimeline } from '@/components/domain';
import { useCancelSession, useFinishSession, useMarkMissed, useProfile, useSession, useStartSession } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';
import { ACTIVITY_LABELS, formatDate, formatSeconds, formatTimeRange } from '@/lib/format';
import { spacing } from '@/theme/tokens';

/**
 * Session detail: the plan, what actually happened, and the change history
 * (WF-06, WF-07, WF-12). Opening this screen never changes the session.
 */
export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession(id);
  const start = useStartSession();
  const missed = useMarkMissed();
  const cancel = useCancelSession();
  const [confirm, setConfirm] = useState<'missed' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [key, setKey] = useState(newIdempotencyKey);

  if (session.isPending) return <LoadingState />;
  if (session.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(session.error)} onRetry={() => session.refetch()} />
      </Screen>
    );
  const s = session.data;
  const isStrength = s.activityType === 'strength' || s.exercises.length > 0;
  const actionable = ['scheduled', 'missed', 'in_progress', 'incomplete'].includes(s.status);
  const err = start.error ?? missed.error ?? cancel.error;

  function confirmOutcome() {
    const body = { id: s.id, reason: reason || undefined, idempotencyKey: key };
    const done = { onSuccess: () => { setConfirm(null); setReason(''); setKey(newIdempotencyKey()); } };
    if (confirm === 'missed') missed.mutate(body, done);
    if (confirm === 'cancel') cancel.mutate(body, done);
  }

  return (
    <Screen refreshing={session.isRefetching} onRefresh={() => session.refetch()}>
      <Stack.Screen options={{ title: s.title }} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="caption" color="inkTertiary">
          {ACTIVITY_LABELS[s.activityType]} · {s.source === 'ai' ? 'From AI routine' : s.source === 'manual' ? 'Planned' : s.source === 'spontaneous' ? 'Spontaneous' : 'Added afterwards'}
        </Text>
        <StatusBadge status={s.plannedDate ? s.status : s.source === 'historical_entry' ? 'historical_entry' : 'spontaneous'} />
      </Row>
      <Text variant="title">{s.title}</Text>

      <Card>
        <Text variant="label">Plan</Text>
        {s.plannedDate ? (
          <Text variant="body">
            {formatDate(s.plannedDate, true)}
            {formatTimeRange(s.plannedTime, s.plannedDurationMinutes) ? ` · ${formatTimeRange(s.plannedTime, s.plannedDurationMinutes)}` : ''}
          </Text>
        ) : (
          <Text variant="small" color="inkSecondary">
            Not planned in advance.
          </Text>
        )}
        {s.exercises.map((e) => (
          <Text key={e.id} variant="small" color="inkSecondary">
            {e.displayName} — {e.targetSets} × {e.targetRepsMin && e.targetRepsMax ? `${e.targetRepsMin}–${e.targetRepsMax}` : (e.targetRepsMin ?? e.targetRepsMax ?? '?')}
            {e.targetWeight ? ` @ ${e.targetWeight} ${e.weightUnit}` : ''}
          </Text>
        ))}
      </Card>

      <Card tone={s.actualDate ? 'canvas' : 'subtle'}>
        <Text variant="label">What happened</Text>
        {s.actualDate ? (
          <Text variant="body">
            {[formatDate(s.actualDate, true), formatSeconds(s.actualDurationSeconds), s.actualDistanceValue ? `${s.actualDistanceValue} ${s.actualDistanceUnit}` : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : (
          <Text variant="small" color="inkSecondary">
            {s.status === 'in_progress' ? 'In progress — not completed yet.' : 'Nothing recorded yet.'}
          </Text>
        )}
        {s.setLogs.length ? <SetSummary s={s} /> : null}
        {s.notes ? <Text variant="small">{s.notes}</Text> : null}
      </Card>

      {err ? <Banner tone="error">{errorMessage(err)}</Banner> : null}

      {actionable ? (
        <Section title="Actions">
          {isStrength ? (
            <Button
              label={s.status === 'in_progress' || s.status === 'incomplete' ? 'Continue logging' : 'Start workout'}
              fullWidth
              loading={start.isPending}
              onPress={() =>
                s.status === 'in_progress'
                  ? router.push(`/session/${s.id}/log`)
                  : start.mutate({ id: s.id }, { onSuccess: () => router.push(`/session/${s.id}/log`) })
              }
            />
          ) : (
            <ActivityCompletion session={s} />
          )}
          {canReschedule(s.status) ? (
            <Row style={{ flexWrap: 'wrap' }}>
              <Button label="Move to another day" variant="secondary" onPress={() => router.push(`/session/${s.id}/reschedule`)} />
              {s.status === 'scheduled' ? <Button label="Mark as missed" variant="ghost" onPress={() => setConfirm('missed')} /> : null}
              <Button label="Cancel session" variant="ghost" onPress={() => setConfirm('cancel')} />
            </Row>
          ) : null}
          {confirm ? (
            <Card tone="subtle">
              <Text variant="bodyStrong">{confirm === 'missed' ? 'Mark this session as missed?' : 'Cancel this session?'}</Text>
              <Text variant="small" color="inkSecondary">
                {confirm === 'missed'
                  ? "It stays in your history as missed. You can still move it later — nothing is shifted automatically."
                  : 'It stays in your history as cancelled.'}
              </Text>
              <TextField label="Reason (optional)" value={reason} onChangeText={setReason} />
              <Row>
                <Button label="Confirm" loading={missed.isPending || cancel.isPending} onPress={confirmOutcome} />
                <Button label="Keep it" variant="ghost" onPress={() => setConfirm(null)} />
              </Row>
            </Card>
          ) : null}
        </Section>
      ) : null}

      {s.originalPlannedDate ? (
        <Section title="History">
          <ChangeTimeline changes={s.scheduleChanges} originalDate={s.originalPlannedDate} />
        </Section>
      ) : null}
    </Screen>
  );
}

function SetSummary({ s }: { s: WorkoutSessionDetail }) {
  const byExercise = new Map<string, typeof s.setLogs>();
  for (const l of s.setLogs) byExercise.set(l.exerciseName, [...(byExercise.get(l.exerciseName) ?? []), l]);
  return (
    <View style={{ gap: spacing.xs }}>
      {[...byExercise.entries()].map(([name, logs]) => (
        <Text key={name} variant="small">
          <Text variant="small" style={{ fontWeight: '600' }} onPress={() => router.push(`/exercise?name=${encodeURIComponent(name)}`)}>
            {name}
          </Text>
          {': '}
          {logs
            .map((l) => (l.status === 'skipped' ? 'skipped' : `${l.actualReps ?? '?'}${l.actualWeight !== null ? ` × ${l.actualWeight} ${l.weightUnit}` : ''}`))
            .join(', ')}
        </Text>
      ))}
    </View>
  );
}

/** WF-12: record a run or other activity with only the details the user knows. */
function ActivityCompletion({ session }: { session: WorkoutSessionDetail }) {
  const profile = useProfile();
  const finish = useFinishSession();
  const [minutes, setMinutes] = useState<number | undefined>();
  const [distance, setDistance] = useState<number | undefined>();
  const [unit, setUnit] = useState<'km' | 'mi'>(profile.data?.distanceUnit ?? 'km');
  const [notes, setNotes] = useState('');
  const [key] = useState(newIdempotencyKey);
  return (
    <Card>
      <Text variant="bodyStrong">Record this {ACTIVITY_LABELS[session.activityType]?.toLowerCase()}</Text>
      <Text variant="small" color="inkSecondary">
        Leave anything you don't know empty.
      </Text>
      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <NumberField label="Duration" unit="min" allowDecimal={false} value={minutes} onChange={setMinutes} />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label="Distance" value={distance} onChange={setDistance} />
        </View>
        <Segmented options={[{ value: 'km', label: 'km' }, { value: 'mi', label: 'mi' }]} value={unit} onChange={setUnit} />
      </Row>
      <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} />
      {finish.isError ? <Banner tone="error">{errorMessage(finish.error)}</Banner> : null}
      <Button
        label="Mark as done"
        loading={finish.isPending}
        onPress={() =>
          finish.mutate({
            id: session.id,
            outcome: 'completed',
            durationSeconds: minutes ? minutes * 60 : undefined,
            distanceValue: distance,
            distanceUnit: distance ? unit : undefined,
            notes: notes || undefined,
            idempotencyKey: key,
          })
        }
      />
    </Card>
  );
}
