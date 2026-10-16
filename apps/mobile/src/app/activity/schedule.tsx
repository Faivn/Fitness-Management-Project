import { router, Stack, useLocalSearchParams } from 'expo-router';
import { appToday } from '@/lib/today';
import { useState } from 'react';
import { View } from 'react-native';
import { isLocalDate, isLocalTime, type ActivityType, type ScheduleConflict } from '@mova/shared';
import { Banner, Button, NumberField, Row, Screen, Segmented, TextField } from '@/components';
import { ConflictList } from '@/components/domain';
import { useProfile, useScheduleActivity } from '@/hooks/api';
import { ApiError, errorMessage, newIdempotencyKey } from '@/lib/api';
import { ACTIVITY_LABELS } from '@/lib/format';

/** WF-12: schedule a run or other activity; it appears in Schedule and Overview. */
export default function ScheduleActivity() {
  const params = useLocalSearchParams<{ date?: string }>();
  const profile = useProfile();
  const today = appToday(profile.data?.timezone ?? 'UTC');
  const create = useScheduleActivity();
  const [type, setType] = useState<ActivityType>('running');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(params.date ?? today);
  const [time, setTime] = useState('');
  const [minutes, setMinutes] = useState<number | undefined>();
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [key, setKey] = useState(newIdempotencyKey);

  const dateError = !isLocalDate(date) || date < today ? 'Pick today or a later date (YYYY-MM-DD).' : undefined;
  const timeError = time && !isLocalTime(time) ? 'Use HH:MM.' : undefined;
  const reset = () => {
    setConflicts(null);
    setKey(newIdempotencyKey());
  };

  function submit() {
    create.mutate(
      {
        activityType: type,
        title: title.trim() || ACTIVITY_LABELS[type]!,
        plannedDate: date,
        plannedTime: time || undefined,
        durationMinutes: minutes,
        acceptConflicts: !!conflicts?.length,
        idempotencyKey: key,
      },
      {
        onSuccess: (s) => router.replace(`/session/${s.id}`),
        onError: (e) => {
          if (e instanceof ApiError && e.code === 'schedule_conflict') setConflicts((e.details as { conflicts: ScheduleConflict[] }).conflicts);
        },
      },
    );
  }

  return (
    <Screen footer={<Button label={conflicts?.length ? 'Schedule anyway' : 'Schedule'} fullWidth disabled={!!dateError || !!timeError} loading={create.isPending} onPress={submit} />}>
      <Stack.Screen options={{ title: 'Schedule activity' }} />
      <Segmented
        label="Activity"
        options={(['running', 'walking', 'cycling', 'swimming', 'mobility', 'strength', 'other'] as ActivityType[]).map((t) => ({ value: t, label: ACTIVITY_LABELS[t]! }))}
        value={type}
        onChange={(t) => { setType(t); reset(); }}
      />
      <TextField label="Title" placeholder={type === 'running' ? 'e.g. Easy 5 km' : ACTIVITY_LABELS[type]} value={title} onChangeText={setTitle} />
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <TextField label="Date" value={date} onChangeText={(v) => { setDate(v); reset(); }} error={dateError} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Time (optional)" placeholder="HH:MM" value={time} onChangeText={(v) => { setTime(v); reset(); }} error={timeError} />
        </View>
      </Row>
      <NumberField label="Planned duration" unit="min" allowDecimal={false} value={minutes} onChange={(v) => { setMinutes(v); reset(); }} />
      {conflicts ? <ConflictList conflicts={conflicts} /> : null}
      {create.isError && !(create.error instanceof ApiError && create.error.code === 'schedule_conflict') ? <Banner tone="error">{errorMessage(create.error)}</Banner> : null}
    </Screen>
  );
}
