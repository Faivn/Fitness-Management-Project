import type { MealEntry, ShoppingItem } from '../schemas/mealPlan.js';
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
