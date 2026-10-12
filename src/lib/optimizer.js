// Unified cutting optimizer interface for CutWise.
// Provides Strategy A (Most Efficient), Strategy B (Fastest), and Baseline (Row/Shelf).

import { optimizeEfficient } from './efficientOptimizer.js';
import { optimizeFastest } from './fastCutOptimizer.js';
import { validateLayout } from './layoutValidator.js';
import { computeLayoutStats, compareLayoutStats, generateSmartRecommendation } from './analyticsCalculator.js';

export { optimizeEfficient } from './efficientOptimizer.js';
export { optimizeFastest } from './fastCutOptimizer.js';
export { validateLayout } from './layoutValidator.js';
export { computeLayoutStats, compareLayoutStats, generateSmartRecommendation } from './analyticsCalculator.js';

const EPS = 1e-4;

function expandInstances(pieces) {
  const instances = [];
  for (const p of pieces) {
    const qty = Math.max(1, Math.round(Number(p.quantity) || 1));
    for (let i = 0; i < qty; i++) {
      instances.push({
        ...p,
        instanceId: `${p.id}#${i + 1}`,
        origW: p.width,
        origH: p.height,
      });
    }
  }
  return instances;
}

function newSheet(index, width, height, margin) {
  return {
    index,
    width,
    height,
    placements: [],
  };
}

/**
 * Baseline row/shelf packing — straightforward sequential packing for before/after comparison.
 */
export function baselineLayout(sheet, pieces, options = {}) {
  const { kerf = 0, margin = 0, maxSheets = Infinity, rotationAllowedGlobal = true } = options;
  const usableW = sheet.width - margin * 2;
  const usableH = sheet.height - margin * 2;

  const instances = expandInstances(pieces);
  // Sort by height descending for standard shelf packing
  instances.sort((a, b) => b.height - a.height);

  const sheets = [newSheet(0, sheet.width, sheet.height, margin)];
  const unplaced = [];
  let curX = margin;
  let curY = margin;
  let rowH = 0;

  const place = (sIdx, inst, x, y, rotated) => {
    sheets[sIdx].placements.push({
      instanceId: inst.instanceId,
      pieceId: inst.id,
      name: inst.name,
      color: inst.color,
      x,
      y,
      w: rotated ? inst.height : inst.width,
      h: rotated ? inst.width : inst.height,
      origW: inst.origW,
      origH: inst.origH,
      rotated,
      rotationAllowed: rotationAllowedGlobal && inst.rotationAllowed !== false,
    });
  };

  const limitSheets = Number.isFinite(maxSheets) ? maxSheets : 100;

  for (const inst of instances) {
    let w = inst.width, h = inst.height, rotated = false;
    if ((w > usableW + EPS || h > usableH + EPS) && rotationAllowedGlobal && inst.rotationAllowed !== false && h <= usableW + EPS && w <= usableH + EPS) { [w,h] = [h,w]; rotated = true; }
    if (limitSheets === 0) { unplaced.push(inst); continue; }
    if (w > usableW + EPS || h > usableH + EPS) {
      unplaced.push(inst);
      continue;
    }

    let sIdx = sheets.length - 1;
    // Try to place in current row
    if (curX + w <= margin + usableW + EPS && curY + Math.max(rowH, h) <= margin + usableH + EPS) {
      place(sIdx, inst, curX, curY, rotated);
      curX += w + kerf;
      rowH = Math.max(rowH, h);
      continue;
    }

    // Start a new row on current sheet
    curX = margin;
    curY += rowH + kerf;
    rowH = h;

    if (curY + h > margin + usableH + EPS) {
      // Need a new sheet
      if (sheets.length < limitSheets) {
        sheets.push(newSheet(sheets.length, sheet.width, sheet.height, margin));
        sIdx = sheets.length - 1;
        curX = margin;
        curY = margin;
        rowH = h;
      } else {
        unplaced.push(inst);
        continue;
      }
    }

    place(sIdx, inst, curX, curY, rotated);
    curX += w + kerf;
  }

  const usedSheets = sheets.filter((s) => s.placements.length > 0);
  return {
    strategy: 'baseline',
    name: 'Baseline',
    tagline: 'Simple Row / Shelf Packing',
    sheets: usedSheets.map((s) => ({
      index: s.index,
      width: s.width,
      height: s.height,
      placements: s.placements,
    })),
    unplaced,
    algorithm: 'Row/Shelf Packing',
    isGuillotine: true,
  };
}

/**
 * Main optimizer entry point. Runs either Most Efficient or Fastest based on mode option.
 */
export function optimizeLayout(sheet, pieces, options = {}) {
  const mode = options.mode || 'most_efficient';
  if (mode === 'fastest') {
    return optimizeFastest(sheet, pieces, options);
  }
  return optimizeEfficient(sheet, pieces, options);
}

/**
 * Runs all three strategies (Baseline, Most Efficient, and Fastest) together
 * and returns validated layouts, stats, comparisons, and smart recommendation.
 */
export function runAllOptimizations(sheet, pieces, options = {}) {
  const { pricePerSheet = 0, kerf = 0, margin = 0, maxSheets = Infinity, rotationAllowedGlobal = true, laborRate = 45 } = options;

  const validatorOpts = {
    kerf,
    margin,
    maxSheets,
    pieces,
    rotationAllowedGlobal,
  };

  // 1. Run algorithms
  const base = baselineLayout(sheet, pieces, options);
  const efficient = optimizeEfficient(sheet, pieces, options);
  const fastest = optimizeFastest(sheet, pieces, options);

  // 2. Validate layouts independently
  const baseValidation = validateLayout(base, sheet, { ...validatorOpts, isFastestMode: false });
  const efficientValidation = validateLayout(efficient, sheet, { ...validatorOpts, isFastestMode: false });
  const fastestValidation = validateLayout(fastest, sheet, { ...validatorOpts, isFastestMode: true });

  // 3. Compute stats
  const baseStats = computeLayoutStats(base, sheet, pieces, pricePerSheet, options);
  const efficientStats = computeLayoutStats(efficient, sheet, pieces, pricePerSheet, options);
  const fastestStats = computeLayoutStats(fastest, sheet, pieces, pricePerSheet, options);

  // 4. Assemble layouts with stats and validation
  const baseFull = { ...base, validation: baseValidation, stats: baseStats };
  const efficientFull = { ...efficient, validation: efficientValidation, stats: efficientStats };
  const fastestFull = { ...fastest, validation: fastestValidation, stats: fastestStats };

  // 5. Comparisons
  const comparisons = {
    baselineVsEfficient: compareLayoutStats(baseStats, efficientStats),
    baselineVsFastest: compareLayoutStats(baseStats, fastestStats),
    efficientVsFastest: compareLayoutStats(efficientStats, fastestStats),
  };

  // 6. Recommendation
  const recommendation = generateSmartRecommendation(efficientStats, fastestStats, laborRate);

  return {
    baseline: baseFull,
    efficient: efficientFull,
    fastest: fastestFull,
    comparisons,
    recommendation,
  };
}
