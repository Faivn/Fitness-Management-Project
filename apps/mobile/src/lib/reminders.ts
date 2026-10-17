import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { zonedToUtc, type WorkoutSession } from '@mova/shared';
import { api } from './api';

/**
 * WF-11 reminders, delivered on-device as local notifications. The server
 * keeps one reminder record per session/channel (no duplicates), and a
 * reminder is never treated as proof that a workout happened.
 */

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

/** Schedule (or move) the reminder for a planned, timed session. */
export async function syncSessionReminder(session: WorkoutSession, leadMinutes: number): Promise<void> {
  if (Platform.OS === 'web' || !session.plannedDate || !session.plannedTime || session.status !== 'scheduled') return;
  const start = zonedToUtc(session.plannedDate, session.plannedTime, session.plannedTimezone ?? 'UTC');
  const at = new Date(start.getTime() - leadMinutes * 60_000);
  if (at <= new Date()) return;
  const identifier = `session-${session.id}`;
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title: session.title, body: `Planned at ${session.plannedTime}. Open Mova to start or move it.`, data: { sessionId: session.id } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
  await api('POST', 'reminders', {
    linkedEntityType: 'workout_session',
    linkedEntityId: session.id,
    scheduledAt: at.toISOString(),
    channel: 'local',
    enabled: true,
  }).catch(() => undefined);
}

export async function cancelSessionReminder(sessionId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(`session-${sessionId}`).catch(() => undefined);
}
