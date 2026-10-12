const finite = Number.isFinite;
export function comparePlans(before, after) {
  if (!before || !after || before.status !== 'complete' || after.status !== 'complete' || before.valid === false || after.valid === false) return null;
  const b=before.stats,a=after.stats;
  const comparableCuts=b.methodology === 'validated_guillotine' && a.methodology === 'validated_guillotine';
  const comparableTime=comparableCuts && finite(b.estimatedCuttingTimeMinutes) && finite(a.estimatedCuttingTimeMinutes);
  const savings=finite(b.totalCost) && finite(a.totalCost) ? b.totalCost-a.totalCost : null;
  return {
    savedSheets:b.sheetsUsed-a.sheetsUsed,savings,
    costSavingsPercent:finite(savings) && b.totalCost>0 ? savings/b.totalCost*100 : null,
    utilizationPoints:finite(a.utilization) && finite(b.utilization) ? a.utilization-b.utilization : null,
    relativeUtilizationPercent:finite(a.utilization) && b.utilization>0 ? (a.utilization-b.utilization)/b.utilization*100 : null,
    cutsComparable:comparableCuts,timeComparable:comparableTime,
    cutsSaved:comparableCuts ? b.cuttingOperations-a.cuttingOperations : null,
    timeSavedMinutes:comparableTime ? b.estimatedCuttingTimeMinutes-a.estimatedCuttingTimeMinutes : null,
    complexityDifference:finite(a.complexityScore) && finite(b.complexityScore) ? b.complexityScore-a.complexityScore : null,
    provisional:!comparableCuts,
  };
}
export function savingsLabel(value) {
  if (!finite(value)) return 'Unavailable';
  return value<0 ? `$${(-value).toFixed(2)} additional cost` : `$${value.toFixed(2)} saved`;
}
export function sheetsLabel(value) {
  if (!finite(value)) return 'Unavailable';
  return value === 0 ? 'Same sheet count' : `${Math.abs(value)} ${value>0 ? 'fewer' : 'additional'} sheet${Math.abs(value)===1 ? '' : 's'}`;
}
export function explainComparison(before,after) {
  const c=comparePlans(before,after);
  if (!c) return 'Incomplete or invalid plans cannot be compared as complete job costs. Review validation and unplaced pieces.';
  const b=before.stats,a=after.stats;
  const material=c.savedSheets===0 && Math.abs(c.utilizationPoints ?? Infinity)<1e-6
    ? `Both layouts use ${a.sheetsUsed} sheet${a.sheetsUsed===1?'':'s'} with ${finite(a.utilization)?a.utilization.toFixed(1):'unavailable'}% utilization${c.savings===0 ? ' and identical material purchasing costs ($0 saved)' : '. '+savingsLabel(c.savings)}.`
    : `${sheetsLabel(c.savedSheets)}; ${savingsLabel(c.savings)}. ${finite(c.utilizationPoints) ? Math.abs(c.utilizationPoints).toFixed(1)+' percentage points '+(c.utilizationPoints>=0?'higher':'lower')+' utilization, using full consumed sheet area as the denominator.' : 'Utilization unavailable.'}`;
  let process='';
  if (finite(c.complexityDifference)) process=Math.abs(c.complexityDifference)<1e-6 ? ' Modeled cutting complexity is equal.' : ` The second strategy has ${c.complexityDifference>0?'lower':'higher'} modeled cutting complexity.`;
  process+=c.provisional ? ' Cutting methodologies differ: one or both counts are separate-edge estimates, so complexity comparisons are provisional and no actual cuts-saved or time-savings claim is made.' : ' Cut counts and distances come from independently validated guillotine sequences; handling and complexity remain estimates.';
  if(c.timeComparable) process+=` Estimated production time is ${Math.abs(c.timeSavedMinutes).toFixed(1)} minutes ${c.timeSavedMinutes>=0?'lower':'higher'} under the entered settings.`;
  return material+process;
}
export function recommendPlans(efficient,fastest) {
  const c=comparePlans(efficient,fastest);
  if(!c) return 'Complete valid results from both strategies are required for a recommendation.';
  const a=efficient.stats,b=fastest.stats;
  const equivalent=c.savedSheets===0 && c.savings===0 && Math.abs(c.utilizationPoints ?? Infinity)<1e-6 && Math.abs(c.complexityDifference ?? Infinity)<1e-6 && (!c.timeComparable || Math.abs(c.timeSavedMinutes)<1e-6);
  if(equivalent) return 'Both strategies produce equivalent results for the selected inputs. There is no demonstrated advantage in material cost or estimated manufacturing time.';
  let text=explainComparison(efficient,fastest).replace('The second strategy','Fastest');
  if(c.savedSheets<0) text+=' Most Efficient requires fewer purchased sheets. Fastest may offer simpler manufacturing; compare estimated job costs when production settings support time estimates.';
  if(c.timeComparable && c.timeSavedMinutes>0 && c.savings<0) text+=' Fastest uses additional material but has lower estimated manufacturing time.';
  if(finite(a.totalJobCost) && finite(b.totalJobCost) && !c.provisional) text+=` Including material purchases and estimated labor only, Most Efficient is $${a.totalJobCost.toFixed(2)} and Fastest is $${b.totalJobCost.toFixed(2)}. ${Math.abs(a.totalJobCost-b.totalJobCost)<0.005?'Costs are equivalent.':'Favor '+(a.totalJobCost<b.totalJobCost?'Most Efficient':'Fastest')+' under these assumptions.'} This is not a quotation.`;
  else text+=' Actual time savings depend on supported cutting sequences and explicit production settings.';
  return text;
}
