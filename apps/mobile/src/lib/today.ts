import { todayIn } from '@mova/shared';

/** "Today" in the user's timezone. */
export function appToday(timeZone: string): string {
  return todayIn(timeZone);
}
