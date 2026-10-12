// Units, validation, and analytics helper.
// Re-exports functions from dedicated modules while preserving full backwards compatibility.

import {
  UNITS,
  toMm,
  fromMm,
  areaInUnit,
  formatLeftoverArea,
  computeLayoutStats,
} from './analyticsCalculator.js';
import { validateLayout as independentValidateLayout } from './layoutValidator.js';

export {
  UNITS,
  toMm,
  fromMm,
  areaInUnit,
  formatLeftoverArea,
};

export function formatMm(valueMm, unit = 'mm', digits = 0) {
  const v = fromMm(valueMm, unit);
  const d = unit === 'mm' ? 0 : unit === 'cm' ? 1 : 2;
  return `${Number(v.toFixed(d))} ${UNITS[unit]?.label || unit}`;
}

export function areaMm2(w, h) {
  const nw = Number(w);
  const nh = Number(h);
  if (!Number.isFinite(nw) || !Number.isFinite(nh)) return 0;
  return nw * nh;
}

/**
 * Validate a layout: bounds, margin, kerf spacing, and overlap.
 * Uses independent layoutValidator.
 */
export function validateLayout(layout, sheet, kerf = 0, margin = 0) {
  return independentValidateLayout(layout, sheet, { kerf, margin });
}

/**
 * Compute analytics from a validated layout.
 * Delegates to computeLayoutStats to guarantee numerical precision and prevent NaN bugs.
 */
export function computeStats(layout, sheet, pieces, pricePerSheet, options = {}) {
  return computeLayoutStats(layout, sheet, pieces, pricePerSheet, options);
}

export function clampNumber(v, min, max) {
  if (v === '' || v === null || v === undefined || isNaN(v)) return min;
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
