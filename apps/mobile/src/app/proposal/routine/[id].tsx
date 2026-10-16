import { router, Stack, useLocalSearchParams } from 'expo-router';
import { appToday } from '@/lib/today';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { routinePlanSchema, type RoutinePlan, type ScheduleConflict } from '@mova/shared';
import { Banner, Button, Card, ErrorState, LoadingState, NumberField, Row, Screen, Section, Text, TextField } from '@/components';
import { AIDisclaimer, ConflictList, ProposalBanner } from '@/components/domain';
import { cleanPlan, RoutineEditor } from '@/components/RoutineEditor';
import {
  useApproveRoutineProposal,
  useCheckProposalConflicts,
  useEditRoutineProposal,
  useProfile,
  useRejectProposal,
  useReviseRoutineProposal,
  useRoutineProposal,
} from '@/hooks/api';
import { ApiError, errorMessage, newIdempotencyKey } from '@/lib/api';
import { ACTIVITY_LABELS, DAY_NAMES } from '@/lib/format';
import { validate } from '@/lib/validation';
import { spacing } from '@/theme/tokens';

/**
 * WF-03 review: inspect, edit directly or refine by chat, see conflicts, then
 * approve the exact version shown. Applying is a separate, explicit step.
 */
export default function RoutineProposalReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const proposal = useRoutineProposal(id);
  const profile = useProfile();
  const edit = useEditRoutineProposal();
  const revise = useReviseRoutineProposal();
  const check = useCheckProposalConflicts();
  const approve = useApproveRoutineProposal();
  const reject = useRejectProposal('routine-proposals');

  const today = appToday(profile.data?.timezone ?? 'UTC');
  const [editing, setEditing] = useState<RoutinePlan | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [instruction, setInstruction] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [weeks, setWeeks] = useState<number | undefined>(4);
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [approveKey, setApproveKey] = useState(newIdempotencyKey);

  useEffect(() => setStartDate(today), [today]);
  // Any change to the proposal invalidates a previous conflict check and approval attempt.
  useEffect(() => {
    setConflicts(null);
    setApproveKey(newIdempotencyKey());
  }, [proposal.data?.version, startDate, weeks]);

  if (proposal.isPending) return <LoadingState />;
  if (proposal.isError)
    return (
      <Screen>
        <ErrorState message={errorMessage(proposal.error)} onRetry={() => proposal.refetch()} />
      </Screen>
    );
  const p = proposal.data;
  const draft = p.status === 'draft';
  const schedule = { startDate, weeks: weeks ?? 4 };

  function saveEdits() {
    if (!editing) return;
    const v = validate(routinePlanSchema, cleanPlan(editing));
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    edit.mutate({ id, version: p.version, plan: v.data }, { onSuccess: () => setEditing(null) });
  }

  function doApprove(acceptConflicts: boolean) {
    approve.mutate(
      { id, version: p.version, schedule, acceptConflicts, idempotencyKey: approveKey },
      {
        onSuccess: (r) => router.replace(`/routine/${r.routine.id}`),
        onError: (e) => {
          if (e instanceof ApiError && e.code === 'schedule_conflict') setConflicts((e.details as { conflicts: ScheduleConflict[] }).conflicts);
        },
      },
    );
  }

  return (
    <Screen
      footer={
        draft && !editing && p.plan ? (
          <>
            {conflicts && conflicts.length > 0 ? (
              <Button label="Approve anyway — keep both" fullWidth loading={approve.isPending} onPress={() => doApprove(true)} />
            ) : (
              <Button label="Approve and schedule" fullWidth loading={approve.isPending} onPress={() => doApprove(false)} />
            )}
            <Button label="Reject proposal" variant="ghost" fullWidth loading={reject.isPending} onPress={() => reject.mutate(id, { onSuccess: () => router.back() })} />
          </>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: 'Review routine' }} />
      <ProposalBanner version={p.version} status={p.status} />
      {p.mode !== 'new' ? <Banner tone="info" title={p.mode === 'replace' ? 'Replaces an existing routine' : 'Adjusts an existing routine'}>Completed workouts and their logs stay exactly as they are. Only future planned sessions change.</Banner> : null}

      {p.clarifyingQuestions.length > 0 ? (
        <Card tone="brand">
          <Text variant="label">A few questions first</Text>
          {p.clarifyingQuestions.map((q) => (
            <Text key={q} variant="small">
              • {q}
            </Text>
          ))}
        </Card>
      ) : null}

      {p.plan && !editing ? <PlanSummary plan={p.plan} /> : null}

      {editing ? (
        <>
          <RoutineEditor plan={editing} onChange={setEditing} errors={errors} weightUnit={profile.data?.weightUnit ?? 'kg'} />
          {edit.isError ? <Banner tone="error">{errorMessage(edit.error)}</Banner> : null}
          <Row>
            <Button label="Save changes" loading={edit.isPending} onPress={saveEdits} />
            <Button label="Discard edits" variant="ghost" onPress={() => setEditing(null)} />
          </Row>
        </>
      ) : null}

      {draft && !editing ? (
        <>
          {p.plan ? <Button label="Edit details" variant="secondary" onPress={() => setEditing(structuredClone(p.plan!))} /> : null}
          <Section title={p.plan ? 'Ask for changes' : 'Answer or add detail'}>
            <TextField label="Instruction" placeholder="e.g. Move the run to Saturday and add a core exercise" value={instruction} onChangeText={setInstruction} multiline />
            {revise.isError ? <Banner tone="error">{errorMessage(revise.error)}</Banner> : null}
            <Button
              label="Update proposal"
              variant="secondary"
              loading={revise.isPending}
              disabled={!instruction.trim()}
              onPress={() => revise.mutate({ id, version: p.version, instruction }, { onSuccess: () => setInstruction('') })}
            />
            <Text variant="caption" color="inkTertiary">
              Fields you edited by hand are kept unless your instruction changes them.
            </Text>
          </Section>

          {p.plan ? (
            <Section title="When should it start?">
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <TextField label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
                </View>
                <View style={{ flex: 1 }}>
                  <NumberField label="Weeks to schedule" allowDecimal={false} value={weeks} onChange={setWeeks} helper="1–12 weeks" />
                </View>
              </Row>
              <Button
                label="Check my schedule"
                size="sm"
                variant="secondary"
                loading={check.isPending}
                onPress={() => check.mutate({ id, schedule }, { onSuccess: (r) => setConflicts(r.conflicts) })}
              />
              {check.isError ? <Banner tone="error">{errorMessage(check.error)}</Banner> : null}
              {conflicts && conflicts.length === 0 ? <Banner tone="success" title="No conflicts">These sessions fit around your existing plans.</Banner> : null}
              {conflicts ? <ConflictList conflicts={conflicts} /> : null}
              {approve.isError && !(approve.error instanceof ApiError && approve.error.code === 'schedule_conflict') ? (
                <Banner tone="error">{errorMessage(approve.error)}</Banner>
              ) : null}
            </Section>
          ) : null}
        </>
      ) : null}
      <AIDisclaimer />
    </Screen>
  );
}

function PlanSummary({ plan }: { plan: RoutinePlan }) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="title">{plan.title}</Text>
      {plan.purpose ? (
        <Text variant="body" color="inkSecondary">
          {plan.purpose}
        </Text>
      ) : null}
      {plan.sessions.map((s, i) => (
        <Card key={i}>
          <Text variant="caption" color="inkTertiary">
            {DAY_NAMES[s.dayOfWeek]}
            {s.startTime ? ` · ${s.startTime}` : ''}
            {s.durationMinutes ? ` · ${s.durationMinutes} min` : ''} · {ACTIVITY_LABELS[s.activityType]}
          </Text>
          <Text variant="heading">{s.title}</Text>
          {s.focus ? (
            <Text variant="small" color="inkSecondary">
              {s.focus}
            </Text>
          ) : null}
          {s.exercises.map((e, k) => (
            <Text key={k} variant="small">
              {k + 1}. {e.name} — {e.targetSets} × {e.repsMin && e.repsMax ? `${e.repsMin}–${e.repsMax}` : (e.repsMin ?? e.repsMax ?? '?')}
              {e.targetWeight ? ` @ ${e.targetWeight} ${e.weightUnit}` : ''}
              {e.restSeconds ? ` · rest ${e.restSeconds}s` : ''}
            </Text>
          ))}
        </Card>
      ))}
      {plan.progressionGuidance ? (
        <Card tone="subtle">
          <Text variant="label">Progression</Text>
          <Text variant="small">{plan.progressionGuidance}</Text>
        </Card>
      ) : null}
      {plan.assumptions.length ? (
        <Banner tone="info" title="Assumptions to check">
          {plan.assumptions.map((a) => `• ${a}`).join('\n')}
        </Banner>
      ) : null}
      {plan.warnings.length ? (
        <Banner tone="warning" title="Please review">
          {plan.warnings.map((a) => `• ${a}`).join('\n')}
        </Banner>
      ) : null}
    </View>
  );
}
