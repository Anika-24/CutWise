import React from 'react';
import { Shield, Scissors, Compass, Ruler } from 'lucide-react';
import { MATERIALS } from '@/lib/materials';
import { useProject } from '@/lib/ProjectContext';

function Preview({ mat }) {
  const style = (() => {
    switch (mat.three.kind) {
      case 'wood': return { background: `repeating-linear-gradient(92deg, ${mat.base} 0px, ${mat.edge} 2px, ${mat.base} 6px, #A87B45 9px, ${mat.base} 14px)` };
      case 'mdf': return { background: `linear-gradient(135deg, ${mat.base}, #8A6544)` };
      case 'acrylic': return { background: `linear-gradient(135deg, ${mat.base}, #7FC4E0 60%, ${mat.base})`, opacity: 0.45 };
      case 'cardboard': return { background: `repeating-linear-gradient(90deg, ${mat.base} 0px, ${mat.edge} 3px, ${mat.base} 7px)` };
      case 'metal': return { background: `repeating-linear-gradient(90deg, ${mat.base} 0px, #9AA1A8 1px, ${mat.base} 3px, ${mat.edge} 5px)` };
      default: return { background: mat.base };
    }
  })();
  return <div className="material-texture-preview relative h-40 overflow-hidden rounded-xl border border-black/5" data-material={mat.three.kind} style={style} />;
}

export default function MaterialsGuide() {
  const { setMaterial, setStep } = useProject();
  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[#172B21]">Materials Guide</h1>
        <p className="text-sm text-[#64748B] mt-1">Everything you need to know before cutting each material in CutWise.</p>
      </div>
      <div className="space-y-5">
        {MATERIALS.map((m) => (
          <div key={m.id} className="bg-white rounded-2xl border border-[#E2E8E4] p-5 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5">
            <div>
              <Preview mat={m} />
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <div className="font-display font-bold text-[#172B21]">{m.name}</div>
                  <div className="text-xs text-[#64748B]">{m.tagline}</div>
                </div>
                <button
                  onClick={() => { setMaterial((prev) => ({ ...prev, type: m.id })); setStep(1); }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#DCFCE7] text-[#15803D] hover:bg-[#16A34A] hover:text-white transition"
                >
                  Use this
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm text-[#172B21] mb-3">{m.description}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1.5">Typical uses</div>
                  <ul className="space-y-0.5">
                    {m.uses.map((u) => <li key={u} className="text-[#172B21] flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-[#16A34A]" /> {u}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1.5">Common sizes (mm)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {m.commonSizes.map((s, i) => <span key={i} className="text-xs px-2 py-1 rounded-md bg-[#F4F7F5] text-[#64748B]">{s.length}×{s.width}×{s.thickness}</span>)}
                  </div>
                </div>
                <div className="flex items-start gap-2"><Scissors className="w-4 h-4 text-[#15803D] mt-0.5 shrink-0" /><span className="text-[#172B21]">{m.cutting}</span></div>
                <div className="flex items-start gap-2"><Compass className="w-4 h-4 text-[#15803D] mt-0.5 shrink-0" /><span className="text-[#172B21]">{m.grain}</span></div>
                <div className="flex items-start gap-2 sm:col-span-2"><Shield className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" /><span className="text-amber-700 bg-amber-50 px-2 py-1 rounded-md text-xs">{m.safety}</span></div>
              </div>
            </div>
          </div>
        ))}
        <div className="text-xs text-[#94A3B8] flex items-center gap-1.5"><Ruler className="w-3.5 h-3.5" /> Sizes shown are illustrative common dimensions, not live market prices or guaranteed stock.</div>
      </div>
    </div>
  );
}
