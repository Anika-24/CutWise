import React from 'react';
import { Leaf, Zap, Check, ArrowRight, ShieldCheck, Clock, Scissors, DollarSign } from 'lucide-react';
import { useProject } from '@/lib/ProjectContext';

export default function OptimizationModeSelector({ onCompareClick }) {
  const { optimizationMode, setOptimizationMode, layout, efficientLayout, fastestLayout } = useProject();

  const hasBothResults = !!(efficientLayout && fastestLayout);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Choose Optimization Engine</span>
          <p className="text-xs text-[#94A3B8]">Select whether your manufacturing priority is saving material cost or reducing shop cutting time.</p>
        </div>
        {hasBothResults && onCompareClick && (
          <button
            type="button"
            onClick={onCompareClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#123D26] text-white hover:bg-[#15803D] transition shadow-sm"
          >
            Compare Both Modes <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* OPTION A — MOST EFFICIENT */}
        <div
          onClick={() => setOptimizationMode('most_efficient')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOptimizationMode('most_efficient'); }}
          className={`relative rounded-2xl p-5 cursor-pointer transition-all duration-200 border-2 text-left ${
            optimizationMode === 'most_efficient'
              ? 'bg-[#F0FDF4] border-[#16A34A] shadow-md shadow-[#16A34A]/10 ring-2 ring-[#16A34A]/20'
              : 'bg-white border-[#E2E8E4] hover:border-[#86EFAC] hover:bg-[#F9FCF9]'
          }`}
        >
          {/* Selected badge */}
          {optimizationMode === 'most_efficient' && (
            <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#16A34A] text-white shadow-sm">
              <Check className="w-3 h-3 stroke-[3]" /> Active Mode
            </span>
          )}

          <div className="flex items-start gap-3.5 mb-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              optimizationMode === 'most_efficient' ? 'bg-[#16A34A] text-white shadow' : 'bg-[#DCFCE7] text-[#15803D]'
            }`}>
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-bold text-lg text-[#172B21] leading-tight flex items-center gap-1.5">
                Most Efficient
                <span className="text-[11px] font-semibold text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-md">Save Money</span>
              </div>
              <p className="text-xs font-medium text-[#15803D] mt-0.5">Save Money & Reduce Waste</p>
            </div>
          </div>

          <p className="text-xs text-[#475569] leading-relaxed mb-3">
            Find the most material-efficient valid cutting arrangement to reduce sheet purchases, minimize waste, and lower material costs.
          </p>

          <div className="space-y-1.5 pt-2 border-t border-[#DCFCE7]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#15803D]">Priorities:</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-[#334155]">
              <span className="flex items-center gap-1.5"><DollarSign className="w-3 h-3 text-[#16A34A]" /> Minimize sheets</span>
              <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#16A34A]" /> Maximize utilization</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-[#16A34A]" /> Preserve large scrap</span>
              <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#16A34A]" /> Multi-heuristic MaxRects</span>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-[#64748B] italic bg-white/80 rounded-lg p-2 border border-[#E2E8E4]">
            Ideal for budget-conscious projects and high-value materials (hardwood, acrylic, composite panels).
          </div>
        </div>

        {/* OPTION B — FASTEST */}
        <div
          onClick={() => setOptimizationMode('fastest')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOptimizationMode('fastest'); }}
          className={`relative rounded-2xl p-5 cursor-pointer transition-all duration-200 border-2 text-left ${
            optimizationMode === 'fastest'
              ? 'bg-[#F0F9FF] border-[#0284C7] shadow-md shadow-[#0284C7]/10 ring-2 ring-[#0284C7]/20'
              : 'bg-white border-[#E2E8E4] hover:border-[#7DD3FC] hover:bg-[#F8FAFC]'
          }`}
        >
          {/* Selected badge */}
          {optimizationMode === 'fastest' && (
            <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0284C7] text-white shadow-sm">
              <Check className="w-3 h-3 stroke-[3]" /> Active Mode
            </span>
          )}

          <div className="flex items-start gap-3.5 mb-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              optimizationMode === 'fastest' ? 'bg-[#0284C7] text-white shadow' : 'bg-[#E0F2FE] text-[#0369A1]'
            }`}>
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="font-display font-bold text-lg text-[#172B21] leading-tight flex items-center gap-1.5">
                Fastest
                <span className="text-[11px] font-semibold text-[#0369A1] bg-[#E0F2FE] px-2 py-0.5 rounded-md">Save Time</span>
              </div>
              <p className="text-xs font-medium text-[#0369A1] mt-0.5">Save Time & Simplify Cutting</p>
            </div>
          </div>

          <p className="text-xs text-[#475569] leading-relaxed mb-3">
            Generate a cutting arrangement that is easier and quicker to manufacture, prioritizing full straight cuts over nested density.
          </p>

          <div className="space-y-1.5 pt-2 border-t border-[#BAE6FD]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#0369A1]">Priorities:</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-[#334155]">
              <span className="flex items-center gap-1.5"><Scissors className="w-3 h-3 text-[#0284C7]" /> Continuous straight cuts</span>
              <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#0284C7]" /> 100% guillotine saw cuts</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-[#0284C7]" /> Reduced physical saw time</span>
              <span className="flex items-center gap-1.5"><Check className="w-3 h-3 text-[#0284C7]" /> Fewer fence repositionings</span>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-[#64748B] italic bg-white/80 rounded-lg p-2 border border-[#E2E8E4]">
            Ideal for commercial shops, manual table saws, and busy production environments where labor time costs more than sheets.
          </div>
        </div>
      </div>
    </div>
  );
}
