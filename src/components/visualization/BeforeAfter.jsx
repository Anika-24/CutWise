import React, { useState } from 'react';
import { useProject } from '@/lib/ProjectContext';
import { comparePlans } from '@/lib/optimizationComparison';
import { STRATEGY_NAMES } from '@/components/analytics/StrategySelector';
import Recommendation from '@/components/analytics/Recommendation';

export default function BeforeAfter() {
  const { plans, strategy } = useProject();
  const [pair, setPair] = useState('');
  if (!plans) return null;
  const selectedPair = pair || `baseline,${strategy === 'fastest' ? 'fastest' : 'most_efficient'}`;
  const keys = selectedPair.split(',');
  const before = plans[keys[0]], after = plans[keys[1]];
  const comparison = comparePlans(before, after);
  const finite = Number.isFinite;
  const rows = [
    ['Material utilization', 'utilization', v => `${v.toFixed(1)}%`],
    ['Purchased sheets', 'purchasedSheets', v => v],
    ['Existing offcuts', 'reusedOffcuts', v => v],
    ['Material cost', 'totalCost', v => `$${v.toFixed(2)}`],
    ...(comparison?.timeComparable ? [['Estimated production time', 'estimatedCuttingTimeMinutes', v => `${v.toFixed(1)} min`]] : []),
  ].filter(([, key]) => finite(before?.stats?.[key]) && finite(after?.stats?.[key]));
  return <section id="plan-comparison" className="scroll-mt-6 rounded-2xl border border-[#E2E8E4] bg-white p-5 sm:p-6 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-lg font-bold text-[#123D26]">Before / after</h3><p className="text-xs text-[#64748B] mt-1">Compare material purchasing and supported production estimates.</p></div>
      <label className="text-xs font-medium text-[#64748B]">Compare plans<select value={selectedPair} onChange={e => setPair(e.target.value)} className="mt-1 block w-full rounded-lg border border-[#E2E8E4] bg-[#F4F7F5] p-2 text-sm text-[#172B21]">
        <option value="baseline,most_efficient">Baseline vs. Most Efficient</option><option value="baseline,fastest">Baseline vs. Fastest</option><option value="most_efficient,fastest">Most Efficient vs. Fastest</option>
      </select></label>
    </div>
    {comparison ? <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="border-b border-[#E2E8E4] text-[#64748B]"><th className="py-3 pr-4 font-medium">Metric</th>{keys.map(key => <th key={key} className="py-3 px-3 font-semibold text-[#123D26]">{STRATEGY_NAMES[key]}</th>)}</tr></thead>
      <tbody>{rows.map(([label, key, format]) => <tr key={key} className="border-b border-[#F4F7F5] last:border-0"><th className="py-3 pr-4 font-normal text-[#64748B]">{label}</th>{[before, after].map((plan, i) => <td key={keys[i]} className="px-3 py-3 font-semibold text-[#172B21]">{format(plan.stats[key])}</td>)}</tr>)}</tbody></table></div> : <p className="text-sm text-amber-700">Complete, valid plans are required for a full-job comparison. Review unplaced pieces and validation warnings.</p>}
    {plans.most_efficient?.status === 'complete' && plans.fastest?.status === 'complete' && plans.most_efficient.valid && plans.fastest.valid && <details className="text-sm"><summary className="cursor-pointer font-semibold text-[#123D26]">Strategy guidance & assumptions</summary><div className="mt-3"><Recommendation /></div></details>}
  </section>;
}
