import { todayIn } from '@mova/shared';
import { SAMPLE_TODAY } from '@/sample/sampleApi';
import { sampleMode } from './config';

/** "Today" in the user's timezone; the snapshot date in the sample preview. */
export function appToday(timeZone: string): string {
  return sampleMode ? SAMPLE_TODAY : todayIn(timeZone);
}
