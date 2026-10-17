import type { MealEntry, ShoppingItem } from '../schemas/mealPlan.js';
import { addDays, dayOfWeek } from './dates.js';
import { roundForDisplay } from './units.js';

export interface ConsolidatedItem extends ShoppingItem {
  /** Indexes into the plan's entries array that use this ingredient. */
  sourceEntryIndexes: number[];
}

/** Light singularisation so "Tomatoes" and "tomato" consolidate. */
function singular(word: string): string {
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function key(name: string, unit: string | undefined): string {
  const n = singular(name.trim().toLowerCase().replace(/\s+/g, ' '));
  return `${n}|${(unit ?? '').trim().toLowerCase()}`;
}

/**
 * WF-10: build a consolidated shopping list from planned meals so an
 * ingredient used in several meals appears once. Quantities are summed only
 * when every use has a known quantity in the same unit; otherwise the
 * quantity is left unknown rather than guessed (avoids false precision).
 */
export function consolidateShoppingList(
  entries: MealEntry[],
  categoryHints: ReadonlyMap<string, string> = new Map(),
): ConsolidatedItem[] {
  const map = new Map<string, ConsolidatedItem & { unknownQty: boolean }>();
  entries.forEach((entry, index) => {
    for (const ing of entry.ingredients) {
      const k = key(ing.name, ing.unit);
      const cur = map.get(k);
      if (!cur) {
        map.set(k, {
          name: ing.name.trim(),
          quantity: ing.quantity,
          unit: ing.unit,
          category: categoryHints.get(ing.name.trim().toLowerCase()),
          sourceEntryIndexes: [index],
          unknownQty: ing.quantity === undefined,
        });
        continue;
      }
      if (!cur.sourceEntryIndexes.includes(index)) cur.sourceEntryIndexes.push(index);
      if (ing.quantity === undefined) cur.unknownQty = true;
      else if (!cur.unknownQty) cur.quantity = (cur.quantity ?? 0) + ing.quantity;
    }
  });

  return [...map.values()]
    .map(({ unknownQty, ...item }) => ({
      ...item,
      quantity: unknownQty || item.quantity === undefined ? undefined : roundForDisplay(item.quantity, 1),
    }))
    .sort((a, b) => (a.category ?? 'zz').localeCompare(b.category ?? 'zz') || a.name.localeCompare(b.name));
}

/** Group entries by date then slot order for timetable display. */
export function groupMealsByDay<T extends { date: string; sortOrder: number }>(entries: T[]): Array<[string, T[]]> {
  const byDay = new Map<string, T[]>();
  for (const e of entries) {
    const list = byDay.get(e.date) ?? [];
    list.push(e);
    byDay.set(e.date, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, list]) => [d, list.sort((x, y) => x.sortOrder - y.sortOrder)]);
}

/**
 * Present a dated plan as a recurring Monday–Sunday week. Entries are stored
 * with dates, so when a weekday occurs more than once the earliest date wins.
 * Returns only weekdays that have meals; index 0 = Monday … 6 = Sunday.
 */
export function groupMealsByWeekday<T extends { date: string; sortOrder: number }>(entries: T[]): Array<[number, T[]]> {
  const earliest = new Map<number, string>();
  for (const e of entries) {
    const wd = (dayOfWeek(e.date) + 6) % 7;
    const cur = earliest.get(wd);
    if (cur === undefined || e.date < cur) earliest.set(wd, e.date);
  }
  const byWeekday = new Map<number, T[]>();
  for (const e of entries) {
    const wd = (dayOfWeek(e.date) + 6) % 7;
    if (earliest.get(wd) !== e.date) continue;
    byWeekday.set(wd, [...(byWeekday.get(wd) ?? []), e]);
  }
  return [...byWeekday.entries()].sort(([a], [b]) => a - b).map(([wd, list]) => [wd, list.sort((x, y) => x.sortOrder - y.sortOrder)]);
}

interface CompletablePlan<E extends { date: string; slot: string; sortOrder: number }> {
  startDate: string;
  endDate: string;
  slots: string[];
  entries: E[];
}

/** Which (date, slot) cells of the requested range the plan has no meal for. */
export function missingMealCells<E extends { date: string; slot: string; sortOrder: number }>(plan: CompletablePlan<E>, start: string, days: number): Array<{ date: string; slot: string }> {
  const have = new Set(plan.entries.map((e) => `${e.date}|${e.slot}`));
  const out: Array<{ date: string; slot: string }> = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    for (const slot of plan.slots) if (!have.has(`${date}|${slot}`)) out.push({ date, slot });
  }
  return out;
}

/**
 * Make sure every requested day has a meal for every slot. A model that stops early (or runs out of room)
 * leaves the last days empty; those cells are filled with the most recent meal planned for the same slot,
 * so no day of the week is ever blank.
 */
export function completeMealPlan<E extends { date: string; slot: string; sortOrder: number }, P extends CompletablePlan<E>>(plan: P, start: string, days: number): P {
  const end = addDays(start, days - 1);
  const inRange = plan.entries.filter((e) => e.date >= start && e.date <= end);
  const firstBySlot = new Map<string, E>();
  for (const e of [...inRange].sort((a, b) => a.date.localeCompare(b.date))) if (!firstBySlot.has(e.slot)) firstBySlot.set(e.slot, e);
  const lastBySlot = new Map<string, E>();
  const entries: E[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const have = inRange.filter((e) => e.date === date);
    for (const e of have) {
      lastBySlot.set(e.slot, e);
      entries.push(e);
    }
    plan.slots.forEach((slot, order) => {
      if (have.some((e) => e.slot === slot)) return;
      const template = lastBySlot.get(slot) ?? firstBySlot.get(slot);
      if (template) entries.push({ ...template, date, sortOrder: template.sortOrder ?? order });
    });
  }
  return { ...plan, startDate: start, endDate: end, entries };
}

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
