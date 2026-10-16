import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { routinePlanSchema, todayIn, type RoutinePlan, type ScheduleConflict } from '@mova/shared';
import { Banner, Button, LoadingState, NumberField, Row, Screen, Section, Text, TextField, ToggleRow } from '@/components';
import { ConflictList } from '@/components/domain';
import { cleanPlan, emptyPlan, RoutineEditor } from '@/components/RoutineEditor';
import { useCreateRoutine, useProfile, useRoutine, useSaveRoutineVersion } from '@/hooks/api';
import { ApiError, errorMessage, newIdempotencyKey } from '@/lib/api';
import { useDraft } from '@/lib/drafts';
import { serverFieldErrors, validate } from '@/lib/validation';

/**
 * WF-04 manual routine create/edit. Editing saves a new version; completed
 * history keeps the targets it had. Saving a template and scheduling
 * sessions are separate choices.
 */
export default function EditRoutine() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useRoutine(id);
  const profile = useProfile();
  const create = useCreateRoutine();
  const save = useSaveRoutineVersion();
  const draft = useDraft<RoutinePlan>(`routine-editor-${id ?? 'new'}`, emptyPlan());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activate, setActivate] = useState(false);
  const [rescheduleFuture, setRescheduleFuture] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const today = todayIn(profile.data?.timezone ?? 'UTC');
  const [startDate, setStartDate] = useState(today);
  const [weeks, setWeeks] = useState<number | undefined>(4);
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [key, setKey] = useState(newIdempotencyKey);
  const [loaded, setLoaded] = useState(!id);

  // Start from the current version when editing (unless a newer local draft exists).
  useEffect(() => {
    if (id && existing.data && draft.restored && !loaded) {
      if (!draft.value.title) draft.setValue(existing.data.plan);
      setLoaded(true);
    }
  }, [id, existing.data, draft, loaded]);

  if (id && (existing.isPending || !loaded)) return <LoadingState />;
  const isActive = existing.data?.status === 'active';
  const willSchedule = id ? rescheduleFuture || (activate && !isActive) : activate;

  function onSave(acceptConflicts = false) {
    const v = validate(routinePlanSchema, cleanPlan(draft.value));
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    const schedule = willSchedule ? { startDate, weeks: weeks ?? 4 } : undefined;
    const onError = (e: Error) => {
      if (e instanceof ApiError && e.code === 'schedule_conflict') setConflicts((e.details as { conflicts: ScheduleConflict[] }).conflicts);
      setErrors(serverFieldErrors(e, 'plan.'));
    };
    const onSuccess = (r: { routine: { id: string } }) => {
      void draft.clear();
      router.replace(`/routine/${r.routine.id}`);
    };
    if (id) {
      save.mutate({ id, plan: v.data, changeReason: changeReason || undefined, rescheduleFuture, activate, schedule, acceptConflicts, idempotencyKey: key }, { onSuccess, onError });
    } else {
      create.mutate({ plan: v.data, activate, schedule, acceptConflicts, idempotencyKey: key }, { onSuccess, onError });
    }
  }

  const busy = create.isPending || save.isPending;
  const error = create.error ?? save.error;

  return (
    <Screen
      footer={
        <>
          {conflicts?.length ? <Button label="Save anyway — keep both" fullWidth loading={busy} onPress={() => onSave(true)} /> : null}
          <Button label={id ? 'Save new version' : activate ? 'Save and schedule' : 'Save as draft'} fullWidth loading={busy} onPress={() => onSave(false)} />
        </>
      }
    >
      <Stack.Screen options={{ title: id ? 'Edit routine' : 'New routine' }} />
      {id ? (
        <Banner tone="info" title="Your history is safe">
          Saving creates version {(existing.data?.currentVersion ?? 0) + 1}. Completed workouts keep the targets they were done with.
        </Banner>
      ) : null}
      <RoutineEditor plan={draft.value} onChange={(p) => { draft.setValue(p); setConflicts(null); setKey(newIdempotencyKey()); }} errors={errors} weightUnit={profile.data?.weightUnit ?? 'kg'} />

      <Section title="Scheduling">
        {id ? (
          <>
            <TextField label="What changed? (optional)" value={changeReason} onChangeText={setChangeReason} />
            {isActive ? (
              <ToggleRow
                label="Update future sessions"
                description="Replace upcoming planned sessions with this version. Past and completed sessions are not changed."
                value={rescheduleFuture}
                onChange={setRescheduleFuture}
              />
            ) : (
              <ToggleRow label="Activate and schedule" description="Create planned sessions from this routine." value={activate} onChange={setActivate} />
            )}
          </>
        ) : (
          <ToggleRow
            label="Schedule sessions now"
            description="Off saves the routine as a template only. You can schedule it later."
            value={activate}
            onChange={setActivate}
          />
        )}
        {willSchedule ? (
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <TextField label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" error={errors['schedule.startDate']} />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField label="Weeks" allowDecimal={false} value={weeks} onChange={setWeeks} helper="1–12" />
            </View>
          </Row>
        ) : null}
      </Section>
      {conflicts ? <ConflictList conflicts={conflicts} /> : null}
      {error && !(error instanceof ApiError && error.code === 'schedule_conflict') ? <Banner tone="error">{errorMessage(error)}</Banner> : null}
      {Object.keys(errors).length ? (
        <Text variant="small" color="negative">
          Some fields need attention — see the highlighted messages above.
        </Text>
      ) : null}
    </Screen>
  );
}
