import React from 'react';
import { GitCompare, ArrowRight } from 'lucide-react';
import { useProject } from '@/lib/ProjectContext';
import BeforeAfter from '@/components/visualization/BeforeAfter';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

export default function CompareLayouts() {
  const { layout, baseline, setStep } = useProject();
  return (
    <div className="p-4 sm:p-6 max-w-[1300px] mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[#172B21] flex items-center gap-2"><GitCompare className="w-6 h-6 text-[#15803D]" /> Compare Layouts</h1>
        <p className="text-sm text-[#64748B] mt-1">Baseline, Most Efficient and Fastest plans, using the same pieces, sheet, kerf, and rotation rules.</p>
      </div>
      {layout && baseline ? (
        <div className="space-y-5">
          <BeforeAfter />
          <AnalyticsDashboard />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2E8E4] p-12 text-center">
          <GitCompare className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
          <p className="text-[#64748B] font-medium">No layout to compare yet</p>
          <p className="text-sm text-[#94A3B8] mt-1 mb-4">Run the optimizer on the Dashboard first.</p>
          <button onClick={() => setStep(3)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D]">
            Go to Optimize <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
