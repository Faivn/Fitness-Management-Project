import type { DistanceUnit, VolumeUnit, WeightUnit } from '../enums.js';

const LB_PER_KG = 2.2046226218;
const ML_PER_FL_OZ = 29.5735295625;
const KM_PER_MI = 1.609344;

export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value / LB_PER_KG;
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return to === 'kg' ? value / LB_PER_KG : value * LB_PER_KG;
}

export function toMl(value: number, unit: VolumeUnit): number {
  switch (unit) {
    case 'ml':
      return value;
    case 'l':
      return value * 1000;
    case 'fl_oz':
      return value * ML_PER_FL_OZ;
  }
}

export function fromMl(ml: number, unit: VolumeUnit): number {
  switch (unit) {
    case 'ml':
      return ml;
    case 'l':
      return ml / 1000;
    case 'fl_oz':
      return ml / ML_PER_FL_OZ;
  }
}

export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return value;
  return to === 'km' ? value * KM_PER_MI : value / KM_PER_MI;
}

/** Round for display without inventing precision. */
export function roundForDisplay(value: number, maxDecimals = 1): number {
  const f = 10 ** maxDecimals;
  return Math.round(value * f) / f;
}

export function formatVolume(ml: number, unit: VolumeUnit): string {
  const v = fromMl(ml, unit);
  switch (unit) {
    case 'ml':
      return `${Math.round(v)} ml`;
    case 'l':
      return `${roundForDisplay(v, 2)} L`;
    case 'fl_oz':
      return `${roundForDisplay(v, 1)} fl oz`;
  }
}

export function formatWeight(value: number, unit: WeightUnit): string {
  return `${roundForDisplay(value, 2)} ${unit}`;
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return s > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${m} min`;
  return `${s}s`;
}
