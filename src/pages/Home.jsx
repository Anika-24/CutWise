import ReuseStockPanel from '@/components/reuse/ReuseStockPanel';
import OffcutCapture from '@/components/reuse/OffcutCapture';
import React from 'react';
import { ArrowRight, ArrowLeft, Zap, Loader2, Layers, PlayCircle } from 'lucide-react';
import { useProject } from '@/lib/ProjectContext';
import Stepper from '@/components/layout/Stepper';
import MaterialSelector from '@/components/materials/MaterialSelector';
import SheetConfig from '@/components/sheet/SheetConfig';
import CutListTable from '@/components/cutlist/CutListTable';
import Workspace from '@/components/visualization/Workspace';
import PieceInspector from '@/components/visualization/PieceInspector';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import BeforeAfter from '@/components/visualization/BeforeAfter';
import OptimizationAnimation from '@/components/visualization/OptimizationAnimation';
import ExportBar from '@/components/visualization/ExportBar';
import StrategySelector, { STRATEGY_NAMES } from '@/components/analytics/StrategySelector';
import CuttingSequence from '@/components/visualization/CuttingSequence';
import { areaInUnit } from '@/lib/geometry';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

export default function Home() {
  const {
    projectId, step, setStep, material, pieces, layout, optimizing, runOptimization,
    matDef, strategy, optimizationError,
  } = useProject();

  const totalPieces = pieces.reduce((s, p) => s + Math.max(1, Math.round(p.quantity || 1)), 0);
  const totalArea = pieces.reduce((s, p) => s + p.width * p.height * Math.max(1, Math.round(p.quantity || 1)), 0);
  const u = material.unit;

  return (
    <div className="p-4 sm:p-6 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <Stepper />
        <div className="flex items-center gap-2">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E2E8E4] text-sm font-medium text-[#64748B] hover:bg-white transition">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          {step < 3 && (
            <button onClick={() => setStep(step + 1)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#123D26] text-white text-sm font-semibold hover:bg-[#15803D] transition">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Step 1 — Material */}
      {step === 1 && (
        <div className="space-y-5">
          <MaterialSelector />
          <SheetConfig />
          <ReuseStockPanel />
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition">
              Continue to Pieces <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Pieces */}
      {step === 2 && (
        <div className="space-y-5">
          <CutListTable />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-[#64748B]">
              {totalPieces} piece{totalPieces !== 1 ? 's' : ''} · {areaInUnit(totalArea, u === 'mm' ? 'cm' : u)?.toFixed(0) ?? 'Unavailable — Check Dimensions'} {u === 'in' ? 'in²' : 'cm²'} required
            </div>
            <button
              onClick={() => setStep(3)}
              disabled={pieces.length === 0}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition disabled:opacity-40"
            >
              Ready to Optimize <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Optimize */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-[#E2E8E4] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-[#DCFCE7] flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#15803D]" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-[#172B21]">Optimize your layout</h2>
                <p className="text-sm text-[#64748B]">Select Most Efficient to save material, or Fastest to simplify physical cutting.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="rounded-xl bg-[#F4F7F5] p-3">
                <div className="text-xs text-[#64748B]">Material</div>
                <div className="font-semibold text-[#172B21]">{matDef.name}</div>
              </div>
              <div className="rounded-xl bg-[#F4F7F5] p-3">
                <div className="text-xs text-[#64748B]">Sheet</div>
                <div className="font-semibold text-[#172B21]">{material.sheetWidth}×{material.sheetHeight}mm</div>
              </div>
              <div className="rounded-xl bg-[#F4F7F5] p-3">
                <div className="text-xs text-[#64748B]">Pieces</div>
                <div className="font-semibold text-[#172B21]">{totalPieces}</div>
              </div>
              <div className="rounded-xl bg-[#F4F7F5] p-3">
                <div className="text-xs text-[#64748B]">Kerf</div>
                <div className="font-semibold text-[#172B21]">{material.kerf}mm</div>
              </div>
            </div>
            <ReuseStockPanel />
            <StrategySelector settings />
            {optimizationError && <p role="alert" className="text-red-600 mb-3">{optimizationError}</p>}
            <button
              onClick={() => runOptimization(strategy)}
              disabled={optimizing || pieces.length === 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#16A34A] text-white font-display font-bold text-base hover:bg-[#15803D] transition disabled:opacity-50 shadow-lg shadow-[#16A34A]/20"
            >
              {optimizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              {optimizing ? 'Optimizing…' : 'Optimize Layout'}
            </button>
            <p className="text-xs text-[#94A3B8] text-center mt-2">
              The selected strategy produces its own validated layout — not guaranteed globally optimal. Kerf reserves blade width; it does not by itself produce a saw sequence.
            </p>
          </div>
        </div>
      )}

      {/* Step 4 — Results */}
      {step === 4 && layout && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#15803D] mb-2">Your cutting plan</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#123D26]">{strategy === 'fastest' && layout.status === 'complete' ? 'Fastest Valid Plan Found' : STRATEGY_NAMES[strategy]}</h2>
              <p className="text-sm text-[#64748B] mt-2">{matDef.name} &middot; {totalPieces} requested pieces &middot; <span className="capitalize">{layout.status}</span></p>
            </div>
            <button onClick={() => setStep(3)} className="border border-[#E2E8E4] bg-white rounded-xl px-4 py-2.5 text-sm font-semibold text-[#123D26] hover:bg-emerald-50 transition">Adjust & optimize again</button>
          </div>
          {layout.additionalSheetsFound !== null && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">A complete plan was found with {layout.additionalSheetsFound} additional sheet(s). This is the smallest count found by this search, not a proven minimum. Adjust inventory in Material setup.</p>}
          {/* Validation banner */}
          {layout.validation && !layout.validation.valid && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-[#DC2626] text-sm">
              <Layers className="w-4 h-4" /> Layout validation found issues: {layout.validation.errors.slice(0, 2).join('; ')}
            </div>
          )}
          {layout.unplaced.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              {layout.unplaced.length} piece(s) could not be placed: {layout.unplaced.map((p) => p.name).join(', ')}. Try more sheets or smaller pieces.
            </div>
          )}

          {layout.rejectedStock?.length > 0 && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            <p className="font-semibold">Some selected offcuts were excluded from this plan.</p>
            <ul className="mt-2 space-y-1">{layout.rejectedStock.map((stock, index) => <li key={`${stock.id}-${index}`}>{stock.id}: {stock.reason}</li>)}</ul>
            <p className="mt-2">Excluded stock contributes no material use or avoided purchases.</p>
          </div>}
          <div className="rounded-2xl border border-[#E2E8E4] bg-white p-5"><StrategySelector /></div>
          {layout.valid && <Workspace />}
          <AnalyticsDashboard />
          <OffcutCapture key={projectId + strategy} />
          <BeforeAfter />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
            <Accordion type="multiple" className="rounded-2xl border border-[#E2E8E4] bg-white px-5">
              <AccordionItem value="animation" className="border-0"><AccordionTrigger><span className="flex items-center gap-2"><PlayCircle className="h-4 w-4 text-[#15803D]" />{strategy === 'fastest' ? 'Validated cutting sequence' : 'Placement animation'}</span></AccordionTrigger><AccordionContent>
                {layout.valid && (strategy === 'fastest' ? <CuttingSequence /> : <OptimizationAnimation height={360} />)}
              </AccordionContent></AccordionItem>
            </Accordion>
            <div className="bg-white rounded-2xl border border-[#E2E8E4] p-5"><h3 className="font-display font-bold text-[#123D26] mb-3">Export your plan</h3><ExportBar /></div>
          </div>
          <Accordion type="single" collapsible className="rounded-2xl border border-[#E2E8E4] bg-white px-5">
            <AccordionItem value="inspector" className="border-0"><AccordionTrigger>Piece inspector &middot; select a piece in the workspace</AccordionTrigger><AccordionContent><PieceInspector /></AccordionContent></AccordionItem>
          </Accordion>
        </div>
      )}

      {step === 4 && !layout && (
        <div className="bg-white rounded-2xl border border-[#E2E8E4] p-10 text-center">
          <p className="text-[#64748B]">No layout yet. Go back and run the optimizer.</p>
          <button onClick={() => setStep(3)} className="mt-3 px-4 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold">Back to Optimize</button>
        </div>
      )}
    </div>
  );
}
