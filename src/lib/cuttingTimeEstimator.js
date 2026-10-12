// Cutting-time estimation and cutting complexity scoring engine.
// All length dimensions in millimeters, time in seconds/minutes.

export const MACHINE_PRESETS = {
  manual_table_saw: {
    id: 'manual_table_saw',
    name: 'Manual Table Saw',
    description: 'Standard cabinet table saw with rip fence and mitre gauge.',
    cutSpeedMmPerMin: 3200,    // ~3.2 m/min manual feed
    sheetSetupSec: 120,        // 2 min to load & square 4x8 sheet
    pieceHandlingSec: 14,      // 14s to label, stack, clear piece
    repositionSec: 10,         // 10s to reset fence / flip workpiece
    rotationSec: 8,            // 8s to turn workpiece 90 deg
  },
  panel_saw: {
    id: 'panel_saw',
    name: 'Sliding Panel Saw',
    description: 'Sliding carriage saw with scoring blade and crosscut stops.',
    cutSpeedMmPerMin: 5500,    // ~5.5 m/min sliding carriage feed
    sheetSetupSec: 90,         // 1.5 min sheet load
    pieceHandlingSec: 10,      // 10s per piece offload
    repositionSec: 6,          // 6s flip-stop adjustment
    rotationSec: 6,            // 6s workpiece rotate
  },
  cnc_beam_saw: {
    id: 'cnc_beam_saw',
    name: 'Automatic Beam Saw',
    description: 'Computer-controlled pressure-beam panel sizing saw.',
    cutSpeedMmPerMin: 14000,   // ~14 m/min automatic pusher feed
    sheetSetupSec: 45,         // 45s hydraulic lift load
    pieceHandlingSec: 6,       // 6s conveyor/roller offload
    repositionSec: 3,          // 3s automated fence position
    rotationSec: 4,            // 4s turntable rotate
  },
};

/**
 * Estimate cutting time and complexity for a layout.
 *
 * @param {object} layout           The layout object { sheets, cuts, algorithm, strategy }
 * @param {object} sheetDef         { width, height }
 * @param {object} options          Configurable assumptions or machine type
 * @returns {object}                Estimation result
 */
export function estimateCuttingTime(layout, sheetDef, options = {}) {
  const machineKey = options.machineType || 'manual_table_saw';
  const machine = MACHINE_PRESETS[machineKey] || MACHINE_PRESETS.manual_table_saw;

  const cutSpeedMmPerMin = Number(options.cutSpeedMmPerMin) || machine.cutSpeedMmPerMin;
  const sheetSetupSec = Number(options.sheetSetupSec) || machine.sheetSetupSec;
  const pieceHandlingSec = Number(options.pieceHandlingSec) || machine.pieceHandlingSec;
  const repositionSec = Number(options.repositionSec) || machine.repositionSec;
  const rotationSec = Number(options.rotationSec) || machine.rotationSec;

  if (!layout || !Array.isArray(layout.sheets) || layout.sheets.length === 0) {
    return {
      estimatedMinutes: 0,
      formattedTime: '0 min',
      cuttingComplexityScore: 0,
      totalCutLengthMm: 0,
      cuttingOperationsCount: 0,
      repositionCount: 0,
      rotationCount: 0,
      sheetSetupCount: 0,
      machine,
      breakdown: {
        setupMinutes: 0,
        cuttingMinutes: 0,
        repositionMinutes: 0,
        handlingMinutes: 0,
        rotationMinutes: 0,
      },
      disclaimer: 'Estimates depend on equipment, operator experience, blade sharpness, and material characteristics.',
    };
  }

  const sheetsUsed = layout.sheets.length;
  let placedCount = 0;
  let rotationCount = 0;

  for (const s of layout.sheets) {
    for (const p of (s.placements || [])) {
      placedCount += 1;
      if (p.rotated) rotationCount += 1;
    }
  }

  let totalCutLengthMm = 0;
  let cuttingOperationsCount = 0;
  let repositionCount = 0;

  // If the layout has explicit cutting operations (e.g. Fastest guillotine optimizer)
  if (Array.isArray(layout.cuts) && layout.cuts.length > 0) {
    cuttingOperationsCount = layout.cuts.length;
    for (const c of layout.cuts) {
      totalCutLengthMm += Number(c.length) || 0;
    }
    // Repositioning roughly correlates to cuts minus continuous rip passes
    repositionCount = Math.max(0, cuttingOperationsCount - sheetsUsed);
  } else {
    // Estimator for MaxRects / Baseline where cuts are not straight guillotine sequences
    // In arbitrary nested rectangular layouts, cutting requires perimeter cuts or stepped cuts
    // Estimated cuts = each piece requires at least 2 cuts (x and y) plus initial sheet trims
    for (const s of layout.sheets) {
      let sheetPerimeterCuts = 0;
      for (const p of (s.placements || [])) {
        totalCutLengthMm += (p.w + p.h);
        sheetPerimeterCuts += 2;
      }
      cuttingOperationsCount += sheetPerimeterCuts + 2; // +2 for edge squaring
    }
    // Interlocking / nested layouts require significantly more repositioning and workpiece turning
    const isGuillotine = layout.strategy === 'fastest' || layout.isGuillotine;
    repositionCount = Math.round(cuttingOperationsCount * (isGuillotine ? 0.6 : 1.35));
  }

  // Calculate times
  const setupSecTotal = sheetsUsed * sheetSetupSec;
  const cuttingTravelSecTotal = (totalCutLengthMm / cutSpeedMmPerMin) * 60;
  const repositionSecTotal = repositionCount * repositionSec;
  const handlingSecTotal = placedCount * pieceHandlingSec;
  const rotationSecTotal = rotationCount * rotationSec;

  const totalSeconds = setupSecTotal + cuttingTravelSecTotal + repositionSecTotal + handlingSecTotal + rotationSecTotal;
  const estimatedMinutes = Math.max(0.5, Number((totalSeconds / 60).toFixed(1)));

  // Format time nicely (e.g. "14 min" or "1 hr 12 min")
  let formattedTime = `${estimatedMinutes.toFixed(1)} min`;
  if (estimatedMinutes >= 60) {
    const hrs = Math.floor(estimatedMinutes / 60);
    const mins = Math.round(estimatedMinutes % 60);
    formattedTime = `${hrs} hr ${mins} min`;
  }

  // Cutting Complexity Score (1-100 scale)
  // Factors:
  // - Sheet count
  // - Cut operations per placed piece (simpler layouts have lower ratio)
  // - Workpiece rotations
  // - Non-guillotine nested penalty
  const isGuillotine = layout.strategy === 'fastest' || layout.isGuillotine;
  const baseRatio = placedCount > 0 ? (cuttingOperationsCount / placedCount) : 1;
  let rawScore = (baseRatio * 22) + (sheetsUsed * 6) + (rotationCount * 1.5);
  if (!isGuillotine && layout.strategy !== 'fastest') {
    rawScore += 24; // non-guillotine nested nesting penalty (blind stops, manual plunge/turns)
  }

  const cuttingComplexityScore = Math.min(100, Math.max(12, Math.round(rawScore)));

  return {
    estimatedMinutes,
    formattedTime,
    cuttingComplexityScore,
    totalCutLengthMm: Math.round(totalCutLengthMm),
    cuttingOperationsCount,
    repositionCount,
    rotationCount,
    sheetSetupCount: sheetsUsed,
    machine,
    breakdown: {
      setupMinutes: Number((setupSecTotal / 60).toFixed(1)),
      cuttingMinutes: Number((cuttingTravelSecTotal / 60).toFixed(1)),
      repositionMinutes: Number((repositionSecTotal / 60).toFixed(1)),
      handlingMinutes: Number((handlingSecTotal / 60).toFixed(1)),
      rotationMinutes: Number((rotationSecTotal / 60).toFixed(1)),
    },
    disclaimer: 'Estimated cutting time depends on equipment, operator experience, blade sharpness, and cutting speed.',
  };
}
