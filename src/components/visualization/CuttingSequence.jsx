import React, { useEffect, useState } from 'react';
import { useProject } from '@/lib/ProjectContext';
export default function CuttingSequence() {
  const { layout } = useProject();
  const [step,setStep] = useState(0), [playing,setPlaying] = useState(false);
  const cuts = layout?.cuttingSequence ?? [];
  useEffect(() => { setStep(0); setPlaying(false); }, [layout]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setStep(n => Math.min(cuts.length,n+1)),800);
    return () => clearInterval(timer);
  }, [playing,cuts.length]);
  useEffect(() => { if (step >= cuts.length) setPlaying(false); }, [step,cuts.length]);
  if (!layout?.valid || !layout.sequenceValidated) return <p>A valid guillotine sequence is required.</p>;
  const current = cuts[Math.max(0,step-1)], sheet = layout.sheets.find(s => s.index === current?.sheetIndex) ?? layout.sheets[0];
  if (!sheet) return <p>No cuts available.</p>;
  return <div>
    <p className="text-xs text-[#64748B] mb-3">Each cut crosses its current rectangular workpiece. Edge margins represent pre-trimmed stock; trimming is excluded from the time model.</p>
    <svg className="w-full bg-[#F4F7F5] rounded-xl" style={{height:300}} viewBox={`-10 -10 ${sheet.width+20} ${sheet.height+20}`}>
      <rect width={sheet.width} height={sheet.height} fill="#E2E8E4" />
      {sheet.placements.map(p => <rect key={p.instanceId} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.color ?? '#16A34A'} opacity="0.7" stroke="white" />)}
      {cuts.slice(0,step).filter(c => c.sheetIndex === sheet.index).map((c,i) => <line key={i} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke={c === current ? '#EF4444' : '#34A99D'} strokeWidth={Math.max(2,sheet.width/300)} />)}
    </svg>
    <div className="flex flex-wrap gap-2 mt-3">{[
      {label:'Restart',action:() => {setStep(0);setPlaying(false);}},
      {label:'Previous Cut',action:() => {setStep(n => Math.max(0,n-1));setPlaying(false);}},
      {label:playing ? 'Pause' : 'Play',action:() => setPlaying(p => !p)},
      {label:'Next Cut',action:() => {setStep(n => Math.min(cuts.length,n+1));setPlaying(false);}}
    ].map(({label,action}) => <button key={label} onClick={action} className="border rounded-lg px-3 py-2 text-sm">{label}</button>)}</div>
    <p className="text-sm mt-2">Cut {step} / {cuts.length} ? Sheet {sheet.index+1}{current && step > 0 ? ` ? ${current.length.toFixed(0)} mm straight cut` : ''}</p>
  </div>;
}
