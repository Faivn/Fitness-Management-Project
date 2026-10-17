export type DayPart = 'morning' | 'afternoon' | 'evening';

/** Time of day from the visitor's local clock: before 12 morning, before 18 afternoon, otherwise evening. */
export function dayPart(date: Date = new Date()): DayPart {
  const h = date.getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}
