// Centralized analytics, mathematical calculations, and unit conversions.
// Ensures strict numerical validity, fixes NaN bugs, and clearly distinguishes
// percentage points from relative percentage improvements.

import { estimateCutting, productionNumber } from './cuttingProcessModel.js';
import { comparePlans, recommendPlans } from './optimizationComparison.js';

export const UNITS = {
  mm: { label: 'mm', areaLabel: 'mm²', toMm: 1, fromMm: 1, step: 1 },
  cm: { label: 'cm', areaLabel: 'cm²', toMm: 10, fromMm: 0.1, step: 0.5 },
  m:  { label: 'm',  areaLabel: 'm²',  toMm: 1000, fromMm: 0.001, step: 0.01 },
  in: { label: 'in', areaLabel: 'in²', toMm: 25.4, fromMm: 1 / 25.4, step: 0.25 },
  ft: { label: 'ft', areaLabel: 'ft²', toMm: 304.8, fromMm: 1 / 304.8, step: 0.1 },
};

export const toMm = (value, unit = 'mm') => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n * (UNITS[unit]?.toMm ?? 1);
};

export const fromMm = (valueMm, unit = 'mm') => {
  const n = Number(valueMm);
  if (!Number.isFinite(n)) return 0;
  return n * (UNITS[unit]?.fromMm ?? 1);
};

/**
 * Converts area in mm² to target unit's square measurement.
 */
export function areaInUnit(areaMm2, unit = 'cm') {
  if (!Number.isFinite(areaMm2) || areaMm2 < 0) return null;
  switch (unit) {
    case 'mm':
      return areaMm2;
    case 'cm':
      return areaMm2 / 100; // 1 cm² = 100 mm²
    case 'm':
      return areaMm2 / 1_000_000; // 1 m² = 1,000,000 mm²
    case 'in':
      return areaMm2 / (25.4 * 25.4); // 1 in² = 645.16 mm²
    case 'ft':
      return areaMm2 / (304.8 * 304.8); // 1 ft² = 92,903.04 mm²
    default:
      return areaMm2 / 100;
  }
}

/**
 * Formats geometric leftover area with full finite-number validation.
 * Never outputs NaN or Infinity. Returns "Unavailable — Check Dimensions" on invalid inputs.
 */
export function formatLeftoverArea(areaMm2, unit = 'cm') {
  if (!Number.isFinite(areaMm2) || areaMm2 < 0) {
    return 'Unavailable — Check Dimensions';
  }

  // If unit is mm, displaying in cm² or m² is typically much more readable for sheet goods
  if (unit === 'mm') {
    const cm2 = areaMm2 / 100;
    if (cm2 >= 10000) {
      const m2 = areaMm2 / 1_000_000;
      return `${m2.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
    }
    return `${Math.round(cm2).toLocaleString('en-US')} cm²`;
  }

  const converted = areaInUnit(areaMm2, unit);
  if (converted === null || !Number.isFinite(converted)) {
    return 'Unavailable — Check Dimensions';
  }

  const label = UNITS[unit]?.areaLabel || `${unit}²`;
  const digits = unit === 'm' || unit === 'ft' ? 2 : 0;
  return `${converted.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${label}`;
}

/**
 * Computes complete analytics from any layout and sheet definition.
 * 
 * @param {object} layout           Layout { sheets, unplaced, cuts, ... }
 * @param {object} sheetDef         { width, height } in mm
 * @param {array}  pieces           Original pieces cut list
 * @param {number} pricePerSheet    Price per sheet in $
 * @param {object} options          Optional estimator assumptions, laborRate, unit
 */
export function computeLayoutStats(layout, sheetDef, pieces = [], pricePerSheet = null, options = {}) {
  const sheets = layout?.sheets ?? [], placements = sheets.flatMap(s => s.placements ?? []);
  const validAreas = sheets.every(s => Number.isFinite(s.width) && s.width > 0 && Number.isFinite(s.height) && s.height > 0) &&
    Number.isFinite(sheetDef?.width) && sheetDef.width > 0 && Number.isFinite(sheetDef?.height) && sheetDef.height > 0 &&
    placements.every(p => Number.isFinite(p.w) && p.w > 0 && Number.isFinite(p.h) && p.h > 0);
  const consumed = sheets.reduce((n,s) => n+s.width*s.height,0), placed = placements.reduce((n,p) => n+p.w*p.h,0);
  const valid = validAreas && Number.isFinite(consumed) && Number.isFinite(placed) && placed <= consumed+1e-6;
  const totalSheetAreaMm2 = valid ? consumed : null, placedAreaMm2 = valid ? placed : null;
  const utilization = valid && consumed > 0 ? placed/consumed*100 : null;
  const waste = utilization === null ? null : 100-utilization;
  const leftoverAreaMm2 = valid ? Math.max(0,consumed-placed) : null;
  const price = productionNumber(pricePerSheet), cost = price === null ? (sheets.every(s=>s.stockKind==='offcut') ? 0 : null) : sheets.filter(s=>s.stockKind!=='offcut').length*price;
  const totalCost = Number.isFinite(cost) ? cost : null;
  const totalPieces = pieces.every(p => Number.isInteger(p.quantity ?? 1) && (p.quantity ?? 1) > 0) ? pieces.reduce((n,p) => n+(p.quantity ?? 1),0) : null;
  const unplacedCount = layout?.unplaced?.length ?? 0;
  const isComplete = layout?.validation?.valid === true && unplacedCount === 0 && placements.length === totalPieces;
  const timing = estimateCutting({...layout,sheets,cuttingSequence:layout?.cuttingSequence ?? []},options,options.sequenceValidated === true);
  const jobCost = totalCost !== null && timing.estimatedLaborCost !== null && isComplete ? totalCost+timing.estimatedLaborCost : null;
  const totalJobCost = Number.isFinite(jobCost) ? jobCost : null;
  return {
    sheetsUsed:sheets.length,purchasedSheets:sheets.filter(s=>s.stockKind!=='offcut').length,reusedOffcuts:sheets.filter(s=>s.stockKind==='offcut').length,sheetCostBasis:'New full sheets are priced at the configured sheet price; confirmed existing offcuts carry zero new purchasing cost.',
    totalSheetAreaMm2,placedAreaMm2,leftoverAreaMm2,placedCount:placements.length,totalPieces,unplacedCount,isComplete,
    utilization,waste,totalCost,formattedLeftoverArea:formatLeftoverArea(leftoverAreaMm2,options.unit ?? 'cm'),
    areaError:valid ? null : 'Unavailable — Check Dimensions',
    ...timing,laborCost:timing.estimatedLaborCost,totalJobCost,
    cuttingTime:{estimatedMinutes:timing.estimatedCuttingTimeMinutes,cuttingOperationsCount:timing.cuttingOperations,complexityScore:timing.complexityScore,formattedTime:timing.estimatedCuttingTimeMinutes === null ? 'Unavailable' : timing.estimatedCuttingTimeMinutes.toFixed(1)+' min'},
    jobCostUnavailableReason:timing.jobCostUnavailableReason || (totalCost === null ? 'Estimated job cost unavailable — enter a valid sheet price.' : totalJobCost === null ? 'Estimated job cost unavailable — the complete job or numeric range could not be verified.' : null),
    geometricLeftoverExplanation:'Full consumed sheet area minus placed piece area. Includes kerf and edge margins; recoverable offcuts are not measured.',
    kerfLossMm2:options.sequenceValidated ? layout.cuttingSequence.reduce((n,c) => n+c.length*c.gap,0) : null,
    recoverableOffcutMm2:null,
  };
}

/**
 * Compare two layouts with mathematically verified improvement metrics.
 * Correctly distinguishes percentage points from relative percentage gains.
 */
// Compatibility adapters retain older component interfaces without inventing differences.
function statsPlan(stats) {
  return {status:stats?.isComplete ? 'complete' : 'incomplete',valid:stats?.isComplete === true,stats};
}
export function compareLayoutStats(baseStats,optStats) {
  const c=comparePlans(statsPlan(baseStats),statsPlan(optStats));
  if(!c)return null;
  const difference=(a,b)=>Number.isFinite(a) && Number.isFinite(b) ? a-b : null;
  return {sheetReduction:c.savedSheets,sheetReductionPercent:baseStats.sheetsUsed>0 ? c.savedSheets/baseStats.sheetsUsed*100 : null,
    costSavings:c.savings,costSavingsPercent:c.costSavingsPercent,utilizationDiffPoints:c.utilizationPoints,
    relativeUtilizationGainPercent:c.relativeUtilizationPercent,timeDiffMinutes:c.timeSavedMinutes,cutOpsDiff:c.cutsSaved,
    laborSavings:difference(baseStats.estimatedLaborCost,optStats.estimatedLaborCost),totalJobSavings:difference(baseStats.totalJobCost,optStats.totalJobCost),provisional:c.provisional};
}
export function generateSmartRecommendation(efficientStats,fastestStats) {
  if(!efficientStats || !fastestStats)return null;
  const e=statsPlan(efficientStats),f=statsPlan(fastestStats),c=comparePlans(e,f);
  const hasCosts=c && !c.provisional && Number.isFinite(efficientStats.totalJobCost) && Number.isFinite(fastestStats.totalJobCost);
  const netSavingsFastest=hasCosts ? efficientStats.totalJobCost-fastestStats.totalJobCost : null;
  const recommendedStrategy=hasCosts && Math.abs(netSavingsFastest)>.005 ? netSavingsFastest>0?'fastest':'most_efficient' : null;
  return {recommendedStrategy,headline:recommendedStrategy ? 'Lower estimated material and labor cost under your settings' : 'Compare material use and modeled manufacturing effort',
    rationale:recommendPlans(e,f),sheetDiff:c ? -c.savedSheets : null,materialCostDiff:c?.savings == null ? null : -c.savings,
    timeSavedMinutes:c?.timeSavedMinutes ?? null,cutsReduced:c?.cutsSaved ?? null,breakevenLaborRate:null,netSavingsFastest,
    efficientTotal:efficientStats.totalJobCost,fastestTotal:fastestStats.totalJobCost};
}
