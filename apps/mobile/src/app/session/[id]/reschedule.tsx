import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { addDays, isLocalDate, isLocalTime, todayIn, type ScheduleConflict } from '@mova/shared';
import { Banner, Button, Card, Chip, ErrorState, LoadingState, Row, Screen, Text, TextField } from '@/components';
import { ConflictList } from '@/components/domain';
import { useProfile, useReschedule, useSession } from '@/hooks/api';
import { ApiError, errorMessage, newIdempotencyKey } from '@/lib/api';
import { formatDate } from '@/lib/format';

/**
 * WF-07 reschedule sheet (research: Tiimo's descriptive confirm button,
 * Urban Company's optional reason). Moving is never completion, and the
 * original date stays in history.
 */
export default function Reschedule() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession(id);
  const profile = useProfile();
  const reschedule = useReschedule();
  const today = todayIn(profile.data?.timezone ?? 'UTC');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [conflicts, setConflicts] = useState<ScheduleConflict[] | null>(null);
  const [key, setKey] = useState(newIdempotencyKey);
  const quick = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(today, i)), [today]);

  if (session.isPending) return <LoadingState />;
  if (session.isError) return <ErrorState message={errorMessage(session.error)} onRetry={() => session.refetch()} />;
  const s = session.data;
  const timeValue = time || s.plannedTime || '';
  const dateError = date && (!isLocalDate(date) || date < today) ? 'Pick today or a later date (YYYY-MM-DD).' : undefined;
  const timeError = timeValue && !isLocalTime(timeValue) ? 'Use HH:MM, e.g. 18:30.' : undefined;

  function submit(acceptConflicts: boolean) {
    reschedule.mutate(
      { id, newDate: date, newTime: timeValue || undefined, reason: reason.trim() || undefined, acceptConflicts, idempotencyKey: key },
      {
        onSuccess: () => router.back(),
        onError: (e) => {
          if (e instanceof ApiError && e.code === 'schedule_conflict') setConflicts((e.details as { conflicts: ScheduleConflict[] }).conflicts);
        },
      },
    );
  }

  return (
    <Screen
      footer={
        <Button
          label={date && !dateError ? `Move to ${formatDate(date)}${timeValue ? ` at ${timeValue}` : ''}${conflicts?.length ? ' anyway' : ''}` : 'Pick a new day'}
          fullWidth
          disabled={!date || !!dateError || !!timeError}
          loading={reschedule.isPending}
          onPress={() => submit(!!conflicts?.length)}
        />
      }
    >
      <Card tone="subtle">
        <Text variant="bodyStrong">{s.title}</Text>
        <Text variant="small" color="inkSecondary">
          Currently {formatDate(s.plannedDate)}
          {s.plannedTime ? ` at ${s.plannedTime}` : ''}
          {s.originalPlannedDate !== s.plannedDate ? ` · originally ${formatDate(s.originalPlannedDate)}` : ''}
        </Text>
      </Card>
      <Text variant="label">New day</Text>
      <Row style={{ flexWrap: 'wrap' }}>
        {quick.map((d) => (
          <Chip key={d} label={formatDate(d)} selected={d === date} onPress={() => { setDate(d); setConflicts(null); setKey(newIdempotencyKey()); }} />
        ))}
      </Row>
      <TextField label="Or enter a date" placeholder="YYYY-MM-DD" value={date} onChangeText={(d) => { setDate(d); setConflicts(null); setKey(newIdempotencyKey()); }} error={dateError} />
      <TextField label="Time (optional)" placeholder={s.plannedTime ?? 'HH:MM'} value={time} onChangeText={(t) => { setTime(t); setConflicts(null); setKey(newIdempotencyKey()); }} error={timeError} />
      <TextField label="Reason (optional)" placeholder="e.g. Work trip" value={reason} onChangeText={setReason} />
      <Text variant="caption" color="inkTertiary">
        Exercises and targets stay the same. The original date is kept in this session's history.
      </Text>
      {conflicts ? <ConflictList conflicts={conflicts} /> : null}
      {reschedule.isError && !(reschedule.error instanceof ApiError && reschedule.error.code === 'schedule_conflict') ? (
        <Banner tone="error">{errorMessage(reschedule.error)}</Banner>
      ) : null}
    </Screen>
  );
}
