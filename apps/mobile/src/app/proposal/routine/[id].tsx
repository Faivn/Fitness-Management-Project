import { router, useLocalSearchParams } from 'expo-router';
import { appToday } from '@/lib/today';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { routinePlanSchema, type RoutinePlan, type ScheduleConflict } from '@mova/shared';
import { Banner, Button, Card, Divider, ErrorState, IconButton, LoadingState, NumberField, Row, Screen, Section, SheetPage, Text, TextField } from '@/components';
import { ClashPrompt } from '@/components/domain';
import { cleanPlan, RoutineEditor } from '@/components/RoutineEditor';
import {
  useApproveRoutineProposal,
  useEditRoutineProposal,
  useProfile,
  useRejectProposal,
  useReplaceClashingRoutines,
  useReviseRoutineProposal,
  useRoutineProposal,
} from '@/hooks/api';
import { ApiError, errorMessage, newIdempotencyKey } from '@/lib/api';
import { ACTIVITY_LABELS, DAY_NAMES, DAY_SHORT } from '@/lib/format';
import { validate } from '@/lib/validation';
import { spacing } from '@/theme/tokens';

/**
 * WF-03 review: inspect, edit directly or refine by chat, see conflicts, then
 * approve the exact version shown. Applying is a separate, explicit step.
 */
function RoutineProposalBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const proposal = useRoutineProposal(id);
  const profile = useProfile();
  const edit = useEditRoutineProposal();
  const revise = useReviseRoutineProposal();
  const replace = useReplaceClashingRoutines();
  const approve = useApproveRoutineProposal();
  const reject = useRejectProposal('routine-proposals');

  const today = appToday(profile.data?.timezone ?? 'UTC');
  // One training day at a time is edited: `editing` is the whole plan, `editingDay` is the day being changed.
  const [editing, setEditing] = useState<RoutinePlan | null>(null);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
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
    edit.mutate({ id, version: p.version, plan: v.data }, { onSuccess: () => {
      setEditing(null);
      setEditingDay(null);
    } });
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
            <Button label="Approve and schedule" fullWidth loading={approve.isPending} onPress={() => doApprove(false)} />
            <Button label="Reject" variant="ghost" fullWidth loading={reject.isPending} onPress={() => reject.mutate(id, { onSuccess: () => router.back() })} />
          </>
        ) : undefined
      }
    >
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

      {p.plan && !editing ? <PlanSummary plan={p.plan} editable={draft} onEditDay={(i) => { setEditing(structuredClone(p.plan!)); setEditingDay(i); }} /> : null}

      {editing ? (
        <>
          <RoutineEditor plan={editing} only={editingDay ?? undefined} onChange={setEditing} errors={errors} weightUnit={profile.data?.weightUnit ?? 'kg'} />
          {edit.isError ? <Banner tone="error">{errorMessage(edit.error)}</Banner> : null}
          <Row>
            <Button label="Save" loading={edit.isPending} onPress={saveEdits} />
            <Button label="Cancel" variant="ghost" onPress={() => { setEditing(null); setEditingDay(null); }} />
          </Row>
        </>
      ) : null}

      {draft && !editing ? (
        <>
          <Divider />
          {asking ? (
            <Section title="Ask for a change">
              <TextField label="What should change?" placeholder="e.g. Move the run to Saturday and add a core exercise" value={instruction} onChangeText={setInstruction} multiline />
              {revise.isError ? <Banner tone="error">{errorMessage(revise.error)}</Banner> : null}
              <Row>
                <Button
                  label="Send"
                  loading={revise.isPending}
                  disabled={!instruction.trim()}
                  onPress={() => revise.mutate({ id, version: p.version, instruction }, { onSuccess: () => { setInstruction(''); setAsking(false); } })}
                />
                <Button label="Cancel" variant="ghost" onPress={() => { setAsking(false); setInstruction(''); }} />
              </Row>
            </Section>
          ) : (
            <Button label="Ask for a change" variant="secondary" onPress={() => setAsking(true)} />
          )}

          <Divider />

          {p.plan ? (
            <Section title="When should it start?">
              <Row style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <TextField label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
                </View>
                <View style={{ flex: 1 }}>
                  <NumberField label="Weeks" allowDecimal={false} value={weeks} onChange={setWeeks} placeholder="1–12" />
                </View>
              </Row>
              {conflicts && conflicts.length > 0 ? (
                <ClashPrompt conflicts={conflicts} busy={approve.isPending || replace.isPending} onKeep={() => doApprove(true)} onReplace={() => replace.mutate(conflicts, { onSuccess: () => doApprove(true) })} />
              ) : null}
              {approve.isError && !(approve.error instanceof ApiError && approve.error.code === 'schedule_conflict') ? (
                <Banner tone="error">{errorMessage(approve.error)}</Banner>
              ) : null}
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

/** One summary card with three plain points, then one card per training day, each with its own edit icon. */
export default function RoutineProposalReview() {
  return (
    <SheetPage title="Review routine">
      <RoutineProposalBody />
    </SheetPage>
  );
}

function PlanSummary({ plan, editable, onEditDay }: { plan: RoutinePlan; editable: boolean; onEditDay: (i: number) => void }) {
  const days = [...new Set(plan.sessions.map((s) => s.dayOfWeek))].sort((a, b) => a - b);
  const mins = plan.sessions.map((s) => s.durationMinutes).filter((m): m is number => !!m);
  const types = [...new Set(plan.sessions.map((s) => ACTIVITY_LABELS[s.activityType]))];
  const points = [
    `${days.length} ${days.length === 1 ? 'day' : 'days'} a week: ${days.map((d) => DAY_SHORT[d]).join(', ')}`,
    mins.length ? `About ${Math.round(mins.reduce((a, b) => a + b, 0) / mins.length)} min a session` : `${plan.sessions.length} ${plan.sessions.length === 1 ? 'session' : 'sessions'}`,
    `Focus: ${types.join(', ')}`,
  ];
  return (
    <View style={{ gap: spacing.md }}>
      <Card style={{ gap: spacing.sm }}>
        <Text variant="title">{plan.title}</Text>
        {points.map((t) => (
          <Text key={t} variant="small" color="inkSecondary">
            • {t}
          </Text>
        ))}
      </Card>
      {plan.sessions.map((s, i) => (
        <Card key={i}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text variant="caption" color="inkTertiary" style={{ flex: 1 }}>
              {DAY_NAMES[s.dayOfWeek]}
              {s.durationMinutes ? ` · ${s.durationMinutes} min` : ''} · {ACTIVITY_LABELS[s.activityType]}
            </Text>
            {editable ? <IconButton icon="edit" label={`Edit ${DAY_NAMES[s.dayOfWeek]}`} variant="plain" size={32} onPress={() => onEditDay(i)} /> : null}
          </Row>
          <Text variant="heading">{s.title}</Text>
          {s.exercises.map((e, k) => (
            <Text key={k} variant="small">
              {e.name} · {e.targetSets} × {e.repsMin && e.repsMax ? `${e.repsMin}–${e.repsMax}` : (e.repsMin ?? e.repsMax ?? '?')}
            </Text>
          ))}
        </Card>
      ))}
      {plan.warnings.length ? (
        <Banner tone="warning" title="Please review">
          {plan.warnings.map((a) => `• ${a}`).join('\n')}
        </Banner>
      ) : null}
    </View>
  );
}
