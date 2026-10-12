import React from 'react';
import { Percent, Layers, DollarSign } from 'lucide-react';
import { useProject } from '@/lib/ProjectContext';
import { formatLeftoverArea } from '@/lib/geometry';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

function MetricCard({ icon: Icon, label, value, children }) {
  return <div className="rounded-2xl border border-[#E2E8E4] bg-white p-5 sm:p-6">
    <div className="flex items-center gap-2 text-sm font-medium text-[#64748B]"><Icon className="h-4 w-4 text-[#15803D]" />{label}</div>
    <div className="mt-3 font-display text-3xl font-bold tracking-tight text-[#123D26]">{value}</div>
    <div className="mt-2 text-xs leading-relaxed text-[#64748B]">{children}</div>
  </div>;
}

function MaterialDonut({ usedPercent }) {
  const used = Number(usedPercent.toFixed(1));
  const remaining = (100 - used).toFixed(1);
  return <div className="mt-4 flex flex-wrap items-center gap-4">
    <svg viewBox="0 0 120 120" role="img" aria-label={`Used material ${used.toFixed(1)} percent; remaining material ${remaining} percent`} className="h-32 w-32 shrink-0">
      <circle cx="60" cy="60" r="46" fill="none" stroke="#FDE7BA" strokeWidth="16" />
      <circle cx="60" cy="60" r="46" fill="none" stroke="#16A34A" strokeWidth="16" pathLength="100" strokeDasharray={`${usedPercent} ${100 - usedPercent}`} transform="rotate(-90 60 60)" />
      <text x="60" y="58" textAnchor="middle" fontSize="12" fill="#64748B">Material</text>
      <text x="60" y="75" textAnchor="middle" fontSize="12" fontWeight="600" fill="#123D26">breakdown</text>
    </svg>
    <dl className="min-w-0 space-y-3 text-sm">
      <div><dt className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />Used</dt><dd className="mt-1 font-semibold text-[#123D26]">{used.toFixed(1)}%</dd></div>
      <div><dt className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#FDE7BA]" />Remaining</dt><dd className="mt-1 font-semibold text-[#123D26]">{remaining}%</dd></div>
    </dl>
  </div>;
}

export default function AnalyticsDashboard() {
  const { layout, material, isStale } = useProject();
  if (!layout || isStale) return null;
  const s = layout.stats;
  const finite = Number.isFinite;
  const money = v => `$${v.toFixed(2)}`;
  const comparison = layout.avoidedPurchases;
  const validPlan = layout.valid && layout.validation?.valid === true;
  const consumedStock = layout.sheets.filter(sheet => sheet.placements.length > 0);
  const purchasedSheets = consumedStock.filter(sheet => sheet.stockKind !== 'offcut').length;
  const reusedOffcuts = consumedStock.filter(sheet => sheet.stockKind === 'offcut').length;
  const stockPieces = purchasedSheets + reusedOffcuts;
  const countsMatchStats = s.sheetsUsed === stockPieces && s.purchasedSheets === purchasedSheets && s.reusedOffcuts === reusedOffcuts;
  const verifiedComparison = validPlan && countsMatchStats && layout.status === 'complete' && comparison?.verified === true &&
    comparison.materialType === material.type && comparison.thickness === Number(material.thickness) &&
    comparison.pricePerSheet === Number(material.pricePerSheet) &&
    comparison.sheetWidth === Number(material.sheetWidth) && comparison.sheetHeight === Number(material.sheetHeight) &&
    finite(comparison.baselineCost) && finite(comparison.actualCost) && finite(comparison.cost) &&
    comparison.actualCost === s.totalCost;
  // Sum only consumed stock and successfully placed rectangles, including mixed sizes.
  const stockArea = consumedStock.reduce((sum, sheet) => sum + sheet.width * sheet.height, 0);
  const placedArea = consumedStock.reduce((sum, sheet) => sum + sheet.placements.reduce((area, piece) => area + piece.w * piece.h, 0), 0);
  const validGeometry = validPlan &&
    consumedStock.every(sheet => finite(sheet.width) && sheet.width > 0 && finite(sheet.height) && sheet.height > 0 &&
      sheet.placements.every(piece => finite(piece.w) && piece.w > 0 && finite(piece.h) && piece.h > 0)) &&
    finite(stockArea) && stockArea > 0 && finite(placedArea) && placedArea >= 0 && placedArea <= stockArea + 1e-6;
  const usedPercent = validGeometry ? Math.min(100, placedArea / stockArea * 100) : null;
  const details = [
    ['Pieces placed', finite(s.placedCount) ? `${s.placedCount}${finite(s.totalPieces) ? ` of ${s.totalPieces}` : ''}` : null],
    ['Waste', finite(s.waste) ? `${s.waste.toFixed(1)}%` : null],
    ['Cutting operations', finite(s.cuttingOperations) ? s.cuttingOperations : null, s.cuttingModel],
    ['Estimated production time', finite(s.estimatedCuttingTimeMinutes) ? `${s.estimatedCuttingTimeMinutes.toFixed(1)} min` : null, s.timeExplanation],
    ['Estimated labor cost', finite(s.estimatedLaborCost) ? money(s.estimatedLaborCost) : null],
    ['Estimated job cost', finite(s.totalJobCost) ? money(s.totalJobCost) : null, 'Purchased material and estimated labor; excludes overhead, electricity, tool wear and taxes.'],
    ['Cutting distance', finite(s.cutLengthMm) ? `${s.cutLengthMm.toFixed(0)} mm` : null, s.cuttingModel],
    ['Estimated repositioning', finite(s.repositioningCount) ? s.repositioningCount : null, s.processExplanation],
    ['Estimated orientation events', finite(s.rotationEvents) ? s.rotationEvents : null],
    ['Geometric leftover', finite(s.leftoverArea ?? s.leftoverAreaMm2) ? formatLeftoverArea(s.leftoverArea ?? s.leftoverAreaMm2, material.unit === 'mm' ? 'cm' : material.unit) : null, s.geometricLeftoverExplanation],
  ].filter(([, value]) => value !== null);
  return <div className="space-y-4">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {usedPercent !== null && <MetricCard icon={Percent} label="Material Utilization" value={`${usedPercent.toFixed(1)}%`}>
        <MaterialDonut usedPercent={usedPercent} />
        {layout.status !== 'complete' && <p className="mt-2 text-amber-700">Partial plan: areas describe placed pieces and consumed stock only.</p>}
      </MetricCard>}
      {validPlan && <MetricCard icon={Layers} label="Material Used" value={`${stockPieces} stock ${stockPieces === 1 ? 'piece' : 'pieces'}`}>
        <span className="block">{purchasedSheets} new purchased {purchasedSheets === 1 ? 'sheet' : 'sheets'} used</span>
        <span className="block">{reusedOffcuts} existing {reusedOffcuts === 1 ? 'offcut' : 'offcuts'} used</span>
        <span className="block mt-2">Total stock consumed by this plan; finished pieces are counted separately.</span>
      </MetricCard>}
      {validPlan && countsMatchStats && finite(s.totalCost) && <MetricCard icon={DollarSign} label="Material Cost and Savings" value={money(s.totalCost)}>
        <p>{layout.status !== 'complete' ? 'New material cost for this partial plan' : 'New Material Cost'}</p>
        {verifiedComparison && comparison.cost !== 0 && <div className="mt-5 border-t border-[#E2E8E4] pt-4">
          <p className="font-medium">{comparison.cost > 0 ? 'Money Saved Through Reuse' : 'Additional Material Cost'}</p>
          <p className={`font-display text-2xl font-bold ${comparison.cost > 0 ? 'text-[#15803D]' : comparison.cost < 0 ? 'text-amber-700' : 'text-[#64748B]'}`}>
            {money(Math.abs(comparison.cost))}
          </p>
          <p className="mt-2">Baseline Cost: {money(comparison.baselineCost)}</p>
        </div>}
        {!verifiedComparison && <p className="mt-3">{layout.comparisonUnavailableReason || 'No verified new-sheet-only purchasing comparison for these inputs.'}</p>}
      </MetricCard>}
    </div>
    {details.length > 0 && <Accordion type="single" collapsible className="rounded-2xl border border-[#E2E8E4] bg-white px-5">
      <AccordionItem value="details" className="border-0"><AccordionTrigger>Plan details & production estimates</AccordionTrigger><AccordionContent>
        <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">{details.map(([label, value, explanation]) => <div key={label}><dt className="text-xs text-[#64748B]">{label}</dt><dd className="mt-1 font-semibold text-[#172B21]">{value}</dd>{explanation && <p className="mt-1 text-xs text-[#64748B]">{explanation}</p>}</div>)}</dl>
      </AccordionContent></AccordionItem>
    </Accordion>}
  </div>;
}
