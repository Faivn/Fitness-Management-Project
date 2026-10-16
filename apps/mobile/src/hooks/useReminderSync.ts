import { useEffect } from 'react';
import { Platform } from 'react-native';
import { addDays, todayIn } from '@mova/shared';
import { cancelSessionReminder, syncSessionReminder } from '@/lib/reminders';
import { useProfile, useSessions } from './api';

/**
 * Keep on-device reminders in line with the persisted schedule: moved sessions
 * get their reminder moved; missed/cancelled/completed ones lose theirs.
 */
export function useReminderSync() {
  const profile = useProfile();
  const tz = profile.data?.timezone ?? 'UTC';
  const today = todayIn(tz);
  const sessions = useSessions(today, addDays(today, 14));
  const enabled = profile.data?.workoutRemindersEnabled ?? false;
  const lead = profile.data?.workoutReminderLeadMinutes ?? 30;

  useEffect(() => {
    if (Platform.OS === 'web' || !sessions.data) return;
    for (const s of sessions.data) {
      if (enabled && s.status === 'scheduled') void syncSessionReminder(s, lead);
      else void cancelSessionReminder(s.id);
    }
  }, [sessions.data, enabled, lead]);
}
