import { detectOffcuts } from './offcutGeometry.js';
import { packMixed } from './mixedStockOptimizer.js';
import { compatible } from './reuseInventory.js';
import { baselineLayout } from './optimizer.js';
import { optimizeEfficient } from './efficientOptimizer.js';
import { fastCutLayout } from './guillotinePlanner.js';
import { validateInputs, validatePlan, expandPieces } from './planValidation.js';
import { computeStats } from './geometry.js';
import { estimateCutting } from './cuttingProcessModel.js';
import { reconstructCuttingTrees } from './cuttingSequence.js';

// Missing numeric fields must not become a verified zero through Number(null).
function configuredNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function materialMatches(offcut, material) {
  const thickness = configuredNumber(material.thickness);
  return typeof material.type === 'string' && material.type.trim().length > 0 &&
    offcut.materialType === material.type && thickness !== null && thickness > 0 &&
    configuredNumber(offcut.thickness) === thickness &&
    ['grade', 'subtype'].every(key => {
      const required = material[key], actual = offcut[key];
      return required == null && actual == null || required === actual;
    });
}

export function runStrategies(material,pieces,assumptions = {}, stock = [], projectId = null) {
  const sheet = { width: Number(material.sheetWidth), height: Number(material.sheetHeight) };
  const opts = { kerf: Number(material.kerf), margin: Number(material.edgeMargin), maxSheets: Number(material.sheetQuantity), rotationAllowedGlobal: material.rotationAllowed };
  const offcuts=stock.filter(o=>materialMatches(o,material) && compatible(o,material,projectId));
  const rejectedStock=stock.filter(o=>!offcuts.includes(o)).map(o=>({
    id:o.id,
    reason:materialMatches(o,material)
      ? 'Stock is unavailable, reserved elsewhere, or has an unsupported usable shape or dimensions.'
      : 'Material type, thickness, or supplied grade/subtype does not match the project.',
  }));
  const inputs = validateInputs(sheet,pieces,opts);
  if(new Set(offcuts.map(o=>o.id)).size!==offcuts.length){inputs.valid=false;inputs.errors.push('Duplicate physical stock IDs.');}
  // This is a hypothetical purchase, not an increase to actual available inventory.
  const baselineSheetQuantity=inputs.valid ? Math.max(1,expandPieces(pieces).length) : 0;
  const newSheetPlans=offcuts.length && inputs.valid
    ? runStrategies({...material,sheetQuantity:baselineSheetQuantity},pieces,assumptions) : null;
  const score = plan => { const e = estimateCutting(plan,assumptions,true); return e.estimatedCuttingTimeMinutes ?? e.complexityScore; };
  const methods = { baseline: baselineLayout, most_efficient: optimizeEfficient, fastest: (s,p,o) => fastCutLayout(s,p,o,score) };
  const results = {};
  for (const [strategy,method] of Object.entries(methods)) {
    /** @type {any} */
    let plan = inputs.valid ? { ...(offcuts.length ? packMixed(method,sheet,pieces,opts,strategy,offcuts,assumptions) : method(sheet,pieces,opts)), strategy } : { strategy, algorithm: 'Invalid input', sheets: [], unplaced: [] };
    let validation = inputs.valid ? validatePlan(plan,sheet,pieces,{...opts,stocks:plan.stocks}) : inputs;
    if (inputs.valid && validation.valid && strategy !== 'fastest' && !offcuts.length) {
      const reconstructed = reconstructCuttingTrees(plan,opts);
      if (reconstructed) {
        const sequenceCheck = validatePlan(reconstructed,sheet,pieces,opts);
        if (sequenceCheck.valid) {plan=reconstructed;validation=sequenceCheck;}
      }
    }
    const sequenceValidated = validation.valid && (strategy === 'fastest' || plan.hasCuttingTree === true);
    let additionalSheetsFound = null;
    if (inputs.valid && plan.unplaced.length && strategy !== 'baseline' && !offcuts.length) {
      const trial = method(sheet,pieces,{ ...opts, maxSheets: Math.max(opts.maxSheets,expandPieces(pieces).length) });
      if (!trial.unplaced.length && validatePlan({ ...trial,strategy },sheet,pieces,{ ...opts,maxSheets: trial.sheets.length }).valid) additionalSheetsFound = Math.max(0,trial.sheets.length-opts.maxSheets);
    }
    plan.validation = validation;
    const raw = computeStats(plan,sheet,pieces,material.pricePerSheet,{...assumptions,unit:material.unit,sequenceValidated});
    const stats = {...raw,leftoverArea:raw.leftoverAreaMm2,totalSheetArea:raw.totalSheetAreaMm2,placedArea:raw.placedAreaMm2};
    if (!inputs.valid) {
      for (const key of ['utilization','waste','leftoverArea','totalCost','cuttingOperations','cutLengthMm','complexityScore','estimatedCuttingTimeMinutes','estimatedLaborCost','totalJobCost']) stats[key]=null;
      stats.areaError='Unavailable — Check Dimensions';stats.cuttingMetricStatus='Unavailable';
    }
    const status = !validation.valid ? 'invalid' : plan.unplaced.length ? 'incomplete' : 'complete';
    if (status !== 'complete') {stats.totalJobCost=null;stats.estimatedLaborCost=null;stats.laborCost=null;stats.jobCostUnavailableReason='Estimated job cost unavailable — this plan is incomplete or invalid.';}
    results[strategy] = { ...plan, valid: validation.valid, validation, sequenceValidated, status, stats, additionalSheetsFound, rejectedStock };
    const detected=detectOffcuts(results[strategy],material,projectId ?? 'preview');
    stats.recoverableOffcutMm2=validation.valid ? detected.estimatedArea : null;
    // A purchased-only plan is its own equivalent baseline (zero avoided cost).
    // Reuse compares the same CURRENT cut list and strategy without existing stock.
    const purchasedBaseline=stats.reusedOffcuts>0 ? newSheetPlans?.[strategy] : results[strategy];
    const price=configuredNumber(material.pricePerSheet);
    const thickness=configuredNumber(material.thickness);
    const materialVerified=typeof material.type==='string' && material.type.trim().length>0 &&
      thickness!==null && thickness>0 && price!==null;
    const baselineStats=purchasedBaseline?.stats;
    const costsVerified=price!==null && Number.isFinite(stats.totalCost) &&
      Number.isFinite(baselineStats?.totalCost) &&
      stats.totalCost===stats.purchasedSheets*price &&
      baselineStats.totalCost===baselineStats.purchasedSheets*price;
    const comparable=materialVerified && costsVerified && status==='complete' &&
      validation.valid && purchasedBaseline?.status==='complete' && purchasedBaseline.valid===true &&
      purchasedBaseline.validation?.valid===true && baselineStats.reusedOffcuts===0;
    results[strategy].avoidedPurchases = comparable ? {
      verified:true,
      sheets:baselineStats.purchasedSheets-stats.purchasedSheets,
      cost:baselineStats.totalCost-stats.totalCost,
      baselineCost:baselineStats.totalCost,
      actualCost:stats.totalCost,
      baselinePurchasedSheets:baselineStats.purchasedSheets,
      actualPurchasedSheets:stats.purchasedSheets,
      materialType:material.type,
      thickness,
      pricePerSheet:price,
      sheetWidth:sheet.width,
      sheetHeight:sheet.height,
      baselineSheetQuantity:stats.reusedOffcuts>0 ? baselineSheetQuantity : opts.maxSheets,
      method:'Modeled avoided material purchases: same current cut list, material type, thickness, configured sheet price, dimensions, assumptions and strategy, with versus without selected compatible existing stock. Complete validated heuristic plans; not cash earned or a refund.',
    } : null;
    results[strategy].comparisonUnavailableReason = comparable ? null
      : !materialVerified ? 'Enter a material type, positive thickness and valid new-sheet price in Material setup.'
      : status!=='complete' || !validation.valid ? 'The current plan must be complete and valid before purchasing savings can be compared.'
      : purchasedBaseline?.status!=='complete' || purchasedBaseline.valid!==true ? 'The new-sheet-only baseline could not place every piece with the configured sheet dimensions and cutting rules.'
      : 'New-sheet purchasing costs or material compatibility could not be verified.';
  }
  return results;
}
