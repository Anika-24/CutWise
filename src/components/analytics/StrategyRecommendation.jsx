import React from 'react';
import { Sparkles, DollarSign, Clock, Layers, Scissors, Check } from 'lucide-react';
import { useProject } from '@/lib/ProjectContext';
import { generateSmartRecommendation } from '@/lib/analyticsCalculator';

export default function StrategyRecommendation() {
  const { efficientLayout, fastestLayout, laborRate, setLaborRate, setOptimizationMode } = useProject();

  if (!efficientLayout || !fastestLayout) return null;

  const eff = efficientLayout.stats;
  const fast = fastestLayout.stats;

  if (!eff || !fast) return null;

  const rec = generateSmartRecommendation(eff, fast);
  if (!rec) return null;

  const effLabor = eff.estimatedLaborCost;
  const fastLabor = fast.estimatedLaborCost;
  const effTotalJob = eff.totalJobCost;
  const fastTotalJob = fast.totalJobCost;
  const number = (value,digits=2) => Number.isFinite(value) ? value.toFixed(digits) : 'Unavailable';

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8E4] p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#DCFCE7] flex items-center justify-center text-[#15803D]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg text-[#172B21]">Which Cutting Strategy Should You Choose?</h3>
            <p className="text-xs text-[#64748B]">Data-driven trade-off analysis comparing material cost versus shop labor time.</p>
          </div>
        </div>

        {/* Labor rate controller */}
        <div className="flex items-center gap-2 bg-[#F4F7F5] border border-[#E2E8E4] px-3 py-1.5 rounded-xl">
          <span className="text-xs font-semibold text-[#64748B] flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" /> Labor Rate:
          </span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-[#94A3B8]">$</span>
            <input
              type="number"
              min={0}
              max={500}
              step={5}
              value={laborRate}
              onChange={(e) => setLaborRate(e.target.value)}
              className="w-14 px-1.5 py-0.5 rounded border border-[#CBD5E1] bg-white text-xs font-bold text-[#172B21] text-right focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
            />
            <span className="text-xs text-[#64748B]">/hr</span>
          </div>
        </div>
      </div>

      {/* Recommendation Banner */}
      <div className={`rounded-xl p-4 border ${
        rec.recommendedStrategy === 'fastest'
          ? 'bg-[#F0F9FF] border-[#BAE6FD] text-[#0369A1]'
          : 'bg-[#F0FDF4] border-[#BBF7D0] text-[#15803D]'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            rec.recommendedStrategy === 'fastest' ? 'bg-[#0284C7] text-white' : 'bg-[#16A34A] text-white'
          }`}>
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
          <div className="space-y-1">
            <div className="font-display font-bold text-sm text-[#0F172A]">{rec.headline}</div>
            <p className="text-xs text-[#334155] leading-relaxed">{rec.rationale}</p>
          </div>
        </div>
      </div>

      {/* Side-by-Side Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Most Efficient Summary Card */}
        <div className="rounded-xl border border-[#DCFCE7] bg-[#F9FCF9] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
              <span className="font-display font-bold text-sm text-[#172B21]">Most Efficient Plan</span>
            </div>
            <span className="text-[11px] font-semibold text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-md">
              {eff.sheetsUsed} sheet{eff.sheetsUsed !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-[#E2E8E4]/60">
              <span className="text-[#64748B] flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-[#16A34A]" /> Material Purchasing:</span>
              <span className="font-bold text-[#172B21]">${number(eff.totalCost)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E2E8E4]/60">
              <span className="text-[#64748B] flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#16A34A]" /> Est. Cutting Time:</span>
              <span className="font-semibold text-[#172B21]">{eff.cuttingTime.formattedTime}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E2E8E4]/60">
              <span className="text-[#64748B] flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5 text-[#16A34A]" /> Cutting Operations (see methodology):</span>
              <span className="font-semibold text-[#172B21]">{eff.cuttingTime.cuttingOperationsCount} operations</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E2E8E4]/60">
              <span className="text-[#64748B] flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-[#16A34A]" /> Material Utilization:</span>
              <span className="font-bold text-[#15803D]">{number(eff.utilization,1)}%</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E2E8E4]/60">
              <span className="text-[#64748B]">Labor Cost (@ ${laborRate}/hr):</span>
              <span className="font-semibold text-[#172B21]">${number(effLabor)}</span>
            </div>
            <div className="flex justify-between py-1.5 pt-2 font-display text-sm font-bold text-[#172B21]">
              <span>Total Estimated Job Cost:</span>
              <span className="text-[#15803D]">${number(effTotalJob)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOptimizationMode('most_efficient')}
            className="w-full text-center py-2 rounded-lg text-xs font-semibold bg-[#16A34A] text-white hover:bg-[#15803D] transition"
          >
            Use Most Efficient Plan
          </button>
        </div>

        {/* Fastest Summary Card */}
        <div className="rounded-xl border border-[#BAE6FD] bg-[#F8FAFC] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" />
              <span className="font-display font-bold text-sm text-[#172B21]">Fastest Guillotine Plan</span>
            </div>
            <span className="text-[11px] font-semibold text-[#0369A1] bg-[#E0F2FE] px-2 py-0.5 rounded-md">
              {fast.sheetsUsed} sheet{fast.sheetsUsed !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-[#E2E8E4]/60">
              <span className="text-[#64748B] flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-[#0284C7]" /> Material Purchasing:</span>
              <span className="font-bold text-[#172B21]">${number(fast.totalCost)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E2E8E4]/60">
              <span className="text-[#64748B] flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-[#0284C7]" /> Est. Cutting Time:</span>
              <span className="font-bold text-[#0369A1]">{fast.cuttingTime.formattedTime}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E2E8E4]/60">
              <span className="text-[#64748B] flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5 text-[#0284C7]" /> Cutting Operations (see methodology):</span>
              <span className="font-bold text-[#0369A1]">{fast.cuttingTime.cuttingOperationsCount} operations</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E2E8E4]/60">
              <span className="text-[#64748B] flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-[#0284C7]" /> Material Utilization:</span>
              <span className="font-semibold text-[#172B21]">{number(fast.utilization,1)}%</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E2E8E4]/60">
              <span className="text-[#64748B]">Labor Cost (@ ${laborRate}/hr):</span>
              <span className="font-semibold text-[#172B21]">${number(fastLabor)}</span>
            </div>
            <div className="flex justify-between py-1.5 pt-2 font-display text-sm font-bold text-[#172B21]">
              <span>Total Estimated Job Cost:</span>
              <span className="text-[#0369A1]">${number(fastTotalJob)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOptimizationMode('fastest')}
            className="w-full text-center py-2 rounded-lg text-xs font-semibold bg-[#0284C7] text-white hover:bg-[#0369A1] transition"
          >
            Use Fastest Guillotine Plan
          </button>
        </div>
      </div>

      <div className="text-[11px] text-[#94A3B8] text-center">
        * Labor calculations provide an engineering estimate for decision planning. Actual shop times vary by machinery feed rate, blade tooth count, operator workflow, and material density.
      </div>
    </div>
  );
}
