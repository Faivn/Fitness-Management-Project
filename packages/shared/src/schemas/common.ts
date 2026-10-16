import { z } from 'zod';
import { isLocalDate, isLocalTime, isValidTimeZone } from '../rules/dates.js';
import {
  ACTIVITY_TYPES,
  DISTANCE_UNITS,
  GOAL_PRIORITIES,
  VOLUME_UNITS,
  WEIGHT_UNITS,
} from '../enums.js';

export const uuid = z.uuid();
export const localDate = z.string().refine(isLocalDate, 'Expected a date in YYYY-MM-DD format.');
export const localTime = z.string().refine(isLocalTime, 'Expected a time in HH:MM (24h) format.');
export const timeZone = z.string().min(1).refine(isValidTimeZone, 'Unknown timezone.');
export const isoDateTime = z.iso.datetime({ offset: true });

export const weightUnit = z.enum(WEIGHT_UNITS);
export const distanceUnit = z.enum(DISTANCE_UNITS);
export const volumeUnit = z.enum(VOLUME_UNITS);
export const activityType = z.enum(ACTIVITY_TYPES);
export const goalPriority = z.enum(GOAL_PRIORITIES);

/** Short free text from the user. Trimmed; empty strings become undefined. */
export const shortText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? undefined : v))
    .optional();

export const requiredText = (max: number) => z.string().trim().min(1).max(max);

/**
 * Idempotency key for retriable state-changing requests (spec §9 rule 6).
 * Clients generate one per user intent and reuse it on retry.
 */
export const idempotencyKey = z.string().min(8).max(100);

export const dateRange = z
  .object({ start: localDate, end: localDate })
  .refine((r) => r.start <= r.end, { message: 'Range start must be on or before its end.' });
