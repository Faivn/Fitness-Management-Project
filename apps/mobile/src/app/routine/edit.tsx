import { router, Stack, useLocalSearchParams } from 'expo-router';
import { appToday } from '@/lib/today';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { routinePlanSchema, type RoutinePlan, type ScheduleConflict } from '@mova/shared';
import { Banner, Button, Divider, LoadingState, SheetPage, NumberField, Row, Screen, Section, Text, TextField, ToggleRow } from '@/components';
import { ClashPrompt } from '@/components/domain';
import { cleanPlan, emptyPlan, RoutineEditor } from '@/components/RoutineEditor';
import { useCreateRoutine, useProfile, useReplaceClashingRoutines, useRoutine, useSaveRoutineVersion } from '@/hooks/api';
import { ApiError, errorMessage, newIdempotencyKey } from '@/lib/api';
import { useDraft } from '@/lib/drafts';
import { serverFieldErrors, validate } from '@/lib/validation';

/**
 * WF-04 manual routine create/edit. Editing saves a new version; completed
 * history keeps the targets it had. Saving a template and scheduling
 * sessions are separate choices.
 */
function EditRoutineBody() {
  const { id, day } = useLocalSearchParams<{ id?: string; day?: string }>();
  const only = day !== undefined && day !== '' && Number.isInteger(Number(day)) ? Number(day) : undefined;
  const existing = useRoutine(id);
  const profile = useProfile();
  const create = useCreateRoutine();
  const save = useSaveRoutineVersion();
  const replace = useReplaceClashingRoutines();
  const draft = useDraft<RoutinePlan>(`routine-editor-${id ?? 'new'}`, emptyPlan());
  const [errors, setErrors] = useState<Record<string, string>>({});
  // A new routine is active as soon as it is saved; an existing draft stays a draft until activated.
  const [activate, setActivate] = useState(!id);
  const [rescheduleFuture, setRescheduleFuture] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const today = appToday(profile.data?.timezone ?? 'UTC');
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
  // Editing a single day of an active routine updates its upcoming sessions too.
  const futureToo = rescheduleFuture || (only !== undefined && isActive);
  const willSchedule = id ? futureToo || (activate && !isActive) : activate;

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
      save.mutate({ id, plan: v.data, changeReason: changeReason || undefined, rescheduleFuture: futureToo, activate, schedule, acceptConflicts, idempotencyKey: key }, { onSuccess, onError });
    } else {
      create.mutate({ plan: v.data, activate, schedule, acceptConflicts, idempotencyKey: key }, { onSuccess, onError });
    }
  }

  const busy = create.isPending || save.isPending;
  const error = create.error ?? save.error ?? replace.error;

  return (
    <Screen
      footer={<Button label={id ? (only !== undefined ? 'Save' : 'Save new version') : 'Save routine'} fullWidth loading={busy} onPress={() => onSave(false)} />}
    >
      <Stack.Screen options={{ title: only !== undefined ? 'Edit training day' : id ? 'Edit routine' : 'New routine' }} />
      {id && only === undefined ? (
        <Banner tone="info" title="Your history is safe">
          Saving creates version {(existing.data?.currentVersion ?? 0) + 1}. Completed workouts keep the targets they were done with.
        </Banner>
      ) : null}
      <RoutineEditor only={only} plan={draft.value} onChange={(p) => { draft.setValue(p); setConflicts(null); setKey(newIdempotencyKey()); }} errors={errors} weightUnit={profile.data?.weightUnit ?? 'kg'} />

      {only === undefined ? (
      <>
      <Divider />
      <Section title="Scheduling">
        {id ? (
          <>
            <TextField label="What changed? (optional)" value={changeReason} onChangeText={setChangeReason} />
            {isActive ? (
              <ToggleRow
                label="Update future sessions"
                description="Replace upcoming sessions. Past sessions stay."
                value={rescheduleFuture}
                onChange={setRescheduleFuture}
              />
            ) : (
              <ToggleRow label="Activate and schedule" description="Create planned sessions from this routine." value={activate} onChange={setActivate} />
            )}
          </>
        ) : null}
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
      </>
      ) : null}
      {conflicts ? (
        <ClashPrompt
          conflicts={conflicts}
          busy={busy || replace.isPending}
          onKeep={() => onSave(true)}
          onReplace={() => replace.mutate(conflicts, { onSuccess: () => onSave(true) })}
        />
      ) : null}
      {error && !(error instanceof ApiError && error.code === 'schedule_conflict') ? <Banner tone="error">{errorMessage(error)}</Banner> : null}
      {Object.keys(errors).length ? (
        <Text variant="small" color="negative">
          Fix the highlighted fields.
        </Text>
      ) : null}
    </Screen>
  );
}

export default function EditRoutine() {
  const { id, day } = useLocalSearchParams<{ id?: string; day?: string }>();
  const only = day !== undefined && day !== '' && Number.isInteger(Number(day));
  return (
    <SheetPage title={only ? 'Edit training day' : id ? 'Edit routine' : 'New routine'}>
      <EditRoutineBody />
    </SheetPage>
  );
}
