// Both renderers and project state use these selectors; never substitute another strategy.
export function activePlan(plans, strategy, resultSignature, inputSignature) {
  return resultSignature === inputSignature ? plans?.[strategy] ?? null : null;
}
export function layoutSheet(layout,index=0) {
  return Number.isInteger(index) && index >= 0 ? layout?.sheets?.[index] ?? null : null;
}
