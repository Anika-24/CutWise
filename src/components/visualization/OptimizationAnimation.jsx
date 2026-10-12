import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipBack, SkipForward, Gauge } from 'lucide-react';
import { useProject } from '@/lib/ProjectContext';

const EDU = [
  'Pieces are sorted by their largest dimension — big parts first fills the sheet more evenly.',
  'For each piece the optimizer searches every free rectangle for the tightest fit.',
  'Best Short Side Fit picks the gap whose smaller leftover is smallest, wasting the least space.',
  'When rotation is allowed, both orientations are tested and the better fit wins.',
  'Saw kerf is reserved around every placed piece so cuts never overlap.',
  'When one sheet is full, the next available sheet is opened automatically.',
  'Pieces that cannot fit on any remaining sheet are reported as unplaced.',
];

export default function OptimizationAnimation({ height = 380 }) {
  const { layout, material } = useProject();
  const containerRef = useRef(null);
  const [containerW, setContainerW] = useState(800);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((e) => setContainerW(e[0].contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { setStep(0); setPlaying(false); }, [layout]);

  const allPlacements = React.useMemo(() => {
    if (!layout) return [];
    const arr = [];
    layout.sheets.forEach((s) => s.placements.forEach((p) => arr.push({ ...p, sheetIndex: s.index })));
    return arr;
  }, [layout]);

  const total = allPlacements.length;

  useEffect(() => {
    if (playing && step < total) {
      timerRef.current = setTimeout(() => setStep((s) => s + 1), 700 / speed);
      return () => clearTimeout(timerRef.current);
    }
    if (step >= total) setPlaying(false);
  }, [playing, step, speed, total]);

  if (!layout || total === 0) {
    return <div ref={containerRef} className="flex items-center justify-center text-[#94A3B8] text-sm" style={{ height }}>Optimize first to watch the placement animation.</div>;
  }

  const sheet = layout.sheets[0];
  const pad = 20;
  const baseScale = Math.min((containerW - pad * 2) / sheet.width, (height - 60) / sheet.height);
  const scale = baseScale;
  const w = sheet.width * scale + pad * 2;
  const h = sheet.height * scale + pad * 2;

  const activePiece = allPlacements[step - 1];
  const eduIndex = Math.min(step, EDU.length) - 1;

  return (
    <div ref={containerRef} className="w-full">
      <div className="flex items-center justify-center" style={{ height }}>
        <svg width={w} height={h}>
          <g transform={`translate(${pad}, ${pad})`}>
            <rect x={0} y={0} width={sheet.width * scale} height={sheet.height * scale} rx={6} fill="#E2E8E4" stroke="#94A3B8" strokeWidth={1.5} />
            {allPlacements.slice(0, step).map((p, i) => {
              const active = i === step - 1;
              return (
                <g key={p.instanceId}>
                  <rect
                    x={p.x * scale}
                    y={p.y * scale}
                    width={p.w * scale}
                    height={p.h * scale}
                    rx={2}
                    fill={p.color}
                    fillOpacity={active ? 0.95 : 0.7}
                    stroke={active ? '#123D26' : '#fff'}
                    strokeWidth={active ? 3 : 1}
                    style={{ transition: 'all 0.3s ease' }}
                  />
                  {p.w * scale > 30 && p.h * scale > 18 && (
                    <text x={p.x * scale + 4} y={p.y * scale + 12} fontSize={10} fill="#fff" fontWeight={700}>{p.name}</text>
                  )}
                </g>
              );
            })}
            {activePiece && (
              <text x={(activePiece.x + activePiece.w / 2) * scale} y={activePiece.y * scale - 6} textAnchor="middle" fontSize={11} fill="#123D26" fontWeight={700}>
                {Math.round(activePiece.w)}×{Math.round(activePiece.h)}mm
              </text>
            )}
          </g>
        </svg>
      </div>

      {/* Controls */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button onClick={() => setPlaying((p) => !p)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D]">
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />} {playing ? 'Pause' : 'Play'}
        </button>
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} className="w-9 h-9 rounded-lg border border-[#E2E8E4] flex items-center justify-center text-[#64748B] hover:bg-[#F4F7F5]"><SkipBack className="w-4 h-4" /></button>
        <button onClick={() => setStep((s) => Math.min(total, s + 1))} className="w-9 h-9 rounded-lg border border-[#E2E8E4] flex items-center justify-center text-[#64748B] hover:bg-[#F4F7F5]"><SkipForward className="w-4 h-4" /></button>
        <button onClick={() => { setStep(0); setPlaying(false); }} className="w-9 h-9 rounded-lg border border-[#E2E8E4] flex items-center justify-center text-[#64748B] hover:bg-[#F4F7F5]"><RotateCcw className="w-4 h-4" /></button>
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <Gauge className="w-4 h-4" />
          {[0.5, 1, 2].map((sp) => (
            <button key={sp} onClick={() => setSpeed(sp)} className={`px-2 py-1 rounded ${speed === sp ? 'bg-[#DCFCE7] text-[#15803D] font-semibold' : 'hover:bg-[#F4F7F5]'}`}>{sp}x</button>
          ))}
        </div>
        <div className="flex-1 min-w-[120px]">
          <div className="h-2 rounded-full bg-[#F4F7F5] overflow-hidden">
            <div className="h-full bg-[#16A34A] transition-all" style={{ width: `${(step / total) * 100}%` }} />
          </div>
        </div>
        <span className="text-xs font-semibold text-[#172B21]">{step} / {total} placed</span>
      </div>

      <div className="mt-2 text-xs text-[#64748B] bg-[#F4F7F5] rounded-lg px-3 py-2 min-h-[40px]">
        {step === 0 ? 'Press Play to watch how CutWise places each piece on the sheet.' : EDU[Math.max(0, eduIndex)]}
      </div>
    </div>
  );
}
