import { router, useLocalSearchParams } from 'expo-router';
import { appToday } from '@/lib/today';
import { useState } from 'react';
import { isLocalDate, type ActivityType } from '@mova/shared';
import { Banner, Button, Screen, Segmented, SheetPage, TextField } from '@/components';
import { useProfile, useScheduleActivity } from '@/hooks/api';
import { errorMessage, newIdempotencyKey } from '@/lib/api';
import { ACTIVITY_LABELS } from '@/lib/format';

/** WF-12: schedule a run or other activity; it appears in Schedule and Overview. */
function ScheduleBody() {
  const params = useLocalSearchParams<{ date?: string }>();
  const profile = useProfile();
  const today = appToday(profile.data?.timezone ?? 'UTC');
  const create = useScheduleActivity();
  const [type, setType] = useState<ActivityType>('running');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(params.date ?? today);
  const [key, setKey] = useState(newIdempotencyKey);

  const dateError = !isLocalDate(date) || date < today ? 'Pick today or a later date (YYYY-MM-DD).' : undefined;
  const reset = () => setKey(newIdempotencyKey());

  function submit() {
    create.mutate(
      {
        activityType: type,
        title: title.trim() || ACTIVITY_LABELS[type]!,
        plannedDate: date,
        // Without a time there is nothing to overlap, so a run on a workout day is fine.
        acceptConflicts: true,
        idempotencyKey: key,
      },
      {
        onSuccess: (s) => router.replace(`/session/${s.id}`),
      },
    );
  }

  return (
    <Screen footer={<Button label="Schedule" fullWidth disabled={!!dateError} loading={create.isPending} onPress={submit} />}>
      <Segmented
        label="Activity"
        options={(['running', 'walking', 'cycling', 'swimming', 'mobility', 'strength', 'other'] as ActivityType[]).map((t) => ({ value: t, label: ACTIVITY_LABELS[t]! }))}
        value={type}
        onChange={(t) => { setType(t); reset(); }}
      />
      <TextField label="Title" placeholder={type === 'running' ? 'e.g. Easy 5 km' : ACTIVITY_LABELS[type]} value={title} onChangeText={setTitle} />
      <TextField label="Date" value={date} onChangeText={(v) => { setDate(v); reset(); }} error={dateError} />
      {create.isError ? <Banner tone="error">{errorMessage(create.error)}</Banner> : null}
    </Screen>
  );
}

export default function ScheduleActivity() {
  return (
    <SheetPage title="Schedule activity">
      <ScheduleBody />
    </SheetPage>
  );
}
