// Relative complexity weights: operations 10, estimated reposition events 3,
// orientation events 4, cutting distance 1 point per metre, sheet setup 8.
export const COMPLEXITY_EXPLANATION = 'Lower is simpler. Score = 10 × operations + 3 × reposition events + 4 × orientation events + distance in mm / 1000 + 8 × sheets. This is a relative process estimate, not minutes. Comparisons are provisional when cutting methodologies differ.';
export function productionNumber(value, positive = false) {
  if (value === '' || value == null || (typeof value === 'string' && !value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) && (positive ? n > 0 : n >= 0) ? n : null;
}
export function estimateCutting(plan, assumptions = {}, sequenceValidated = false) {
  const pieces = plan.sheets.flatMap(s => s.placements);
  const rotations = pieces.filter(p => p.rotated).length;
  const verified = sequenceValidated;
  // Fallback is explicitly a separate-edge upper process proxy; common edges are not merged.
  const cuts = verified ? plan.cuttingSequence.length : pieces.length * 4;
  const length = verified ? plan.cuttingSequence.reduce((n,c) => n+c.length,0) : pieces.reduce((n,p) => n+2*(p.w+p.h),0);
  const transitions = Math.max(0,cuts-plan.sheets.length);
  const rotationEvents = Math.min(rotations,transitions);
  const repositioning = transitions-rotationEvents; // Rotation events replace reposition events.
  const complexity = cuts*10 + rotationEvents*4 + repositioning*3 + length/1000 + plan.sheets.length*8;
  const speed = productionNumber(assumptions.cuttingSpeed,true);
  const setup = Object.hasOwn(assumptions,'setupMinutes') ? productionNumber(assumptions.setupMinutes) : productionNumber(assumptions.setupSeconds) === null ? null : Number(assumptions.setupSeconds)/60;
  const reposition = productionNumber(assumptions.repositionSeconds), rotation = productionNumber(assumptions.rotationSeconds);
  const laborRate = productionNumber(assumptions.laborRate);
  const configured = speed !== null && setup !== null && reposition !== null && rotation !== null;
  const handling = productionNumber(assumptions.handlingSeconds); // Optional legacy field, never silently defaulted.
  const time = verified && configured ? length/speed + plan.sheets.length*setup + (repositioning*reposition+rotationEvents*rotation+(handling === null ? 0 : pieces.length*handling))/60 : null;
  const minutes = Number.isFinite(time) ? time : null;
  const labor = minutes !== null && laborRate !== null ? minutes/60*laborRate : null;
  const estimatedLaborCost = Number.isFinite(labor) ? labor : null;
  return {
    cuttingOperations:cuts, cutLengthMm:Number.isFinite(length) ? length : null, repositioningCount:repositioning, rotations, rotationEvents,
    complexityScore:Number.isFinite(complexity) ? complexity : null,
    estimatedCuttingTimeMinutes:minutes, estimatedLaborCost,
    methodology:verified ? 'validated_guillotine' : 'separate_edge_estimate',
    cuttingMetricStatus:verified ? 'Validated' : 'Estimated',
    cuttingModel:verified ? 'Validated guillotine sequence (includes separation and internal trim cuts)' : 'Estimated separate-edge process: 4 edges/piece; shared cuts and sheet edges are not merged',
    complexityExplanation:COMPLEXITY_EXPLANATION,
    processExplanation:'Reposition events = max(0, cuts − sheets) minus orientation events. Orientation events = min(rotated placements, transitions). Both are handling estimates, not validated machine motions.',
    timeExplanation:'Partial production estimate: pre-trimmed stock, straight cuts, sheet setup and handling events. Margin trimming, unconfigured per-piece handling, machine overhead, tool wear, electricity and taxes are excluded.',
    productionSettingsComplete:configured,
    jobCostUnavailableReason:!verified ? 'Estimated job cost unavailable — no supported cutting-time estimate for this layout.' : !configured || laborRate === null ? 'Estimated job cost unavailable — enter labor rate and production settings.' : minutes === null || estimatedLaborCost === null ? 'Estimated job cost unavailable — production values exceed supported numeric range.' : null,
  };
}
