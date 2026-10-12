import React from 'react';
import { Box, Square, Columns2, GitCompare } from 'lucide-react';
import { useProject } from '@/lib/ProjectContext';
import View2D from './View2D';
import View3D from './View3D';


const MODES = [
  { id: '3d', label: '3D View', icon: Box },
  { id: '2d', label: '2D View', icon: Square },
  { id: 'split', label: 'Split View', icon: Columns2 },
  { id: 'compare', label: 'Compare', icon: GitCompare },
];

export default function Workspace() {
  const { viewMode, setViewMode, layout } = useProject();

  return (
    <section className="rounded-2xl border border-[#E2E8E4] bg-white p-3 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div><h3 className="font-display text-lg font-bold text-[#123D26]">Your cutting layout</h3><p className="text-xs text-[#64748B] mt-1">Inspect pieces across purchased sheets and existing offcuts.</p></div>
        <div className="flex flex-wrap items-center gap-1 bg-white rounded-xl border border-[#E2E8E4] p-1 shadow-sm">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { if (id === 'compare') { document.getElementById('plan-comparison')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else { setViewMode(id); } }}
              aria-pressed={id !== 'compare' && (viewMode === id || (id === '3d' && viewMode === 'compare'))}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                (id !== 'compare' && (viewMode === id || (id === '3d' && viewMode === 'compare'))) ? 'bg-[#123D26] text-white' : 'text-[#64748B] hover:bg-[#F4F7F5]'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8E4] p-3">
        {(viewMode === '3d' || viewMode === 'compare') && <View3D height={560} />}
        {viewMode === '2d' && <View2D height={520} />}
        {viewMode === 'split' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-[#64748B] mb-1.5 px-1">2D Plan</div>
              <View2D height={420} />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#64748B] mb-1.5 px-1">3D Simulation</div>
              <View3D height={420} />
            </div>
          </div>
        )}
      </div>

      {!layout && (
        <div className="mt-3 text-center text-sm text-[#94A3B8]">
          No layout yet — complete the Material and Pieces steps, then run Optimize.
        </div>
      )}
    </section>
  );
}
