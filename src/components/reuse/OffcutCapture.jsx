import React,{useMemo,useState} from 'react';
import {useProject} from '@/lib/ProjectContext';
import {useReuse} from '@/lib/ReuseContext';
import {detectOffcuts} from '@/lib/offcutGeometry';
export function ScrapPreview({width,height,scaleWidth=width,scaleHeight=height}) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return <svg viewBox={`0 0 ${scaleWidth} ${scaleHeight}`} aria-label={`${width} by ${height} millimeter rectangular offcut`} role="img" className="w-full h-32" preserveAspectRatio="xMidYMid meet">
    <rect x={(scaleWidth-width)/2} y={(scaleHeight-height)/2} width={width} height={height} rx={Math.min(width,height)/40} fill="#DCFCE7" stroke="#15803D" strokeWidth={Math.max(scaleWidth,scaleHeight)/160}/>
  </svg>;
}
export default function OffcutCapture(){
  const {layout,material,projectId,projectName,pieces,saveProject}=useProject();const {inventory,transact}=useReuse();
  const [unusable,setUnusable]=useState([]);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [edits,setEdits]=useState({});const [excluded,setExcluded]=useState([]);
  const detected=useMemo(()=>detectOffcuts(layout,material,projectId),[layout,material,projectId]);
  if(!layout?.valid || layout.status!=='complete')return null;
  const production=inventory.productions.find(p=>p.projectId===projectId);
  const candidates=production?.captureDone ? inventory.offcuts.filter(o=>o.sourceProjectId===projectId) : production?.candidates ?? detected.candidates;
  const ids=layout.sheets.filter(s=>s.offcutId).map(s=>s.offcutId);
  const act=async action=>{setBusy(true);setError('');try{await transact(action);saveProject();}catch(e){setError(e.message);}finally{setBusy(false);}};
  const save=all=>act({type:'capture',projectId,records:candidates.filter(c=>!unusable.includes(c.id) && (all || !excluded.includes(c.id))).map(c=>({...c,...edits[c.id],notes:edits[c.id]?.notes ?? ''}))});
  const finite=Number.isFinite;
  const scaleWidth=Math.max(1,...candidates.map(c=>c.width).filter(finite));
  const scaleHeight=Math.max(1,...candidates.map(c=>c.height).filter(finite));
  const areaMetrics=[
    ['Geometric leftover',layout.stats.leftoverAreaMm2],
    ['Estimated reusable area',detected.estimatedArea],
    ['Verified kerf loss',layout.stats.kerfLossMm2],
    ['Excluded area (includes kerf)',detected.excludedArea],
  ].filter(([,value])=>finite(value));
  return <section className="rounded-2xl border border-[#E2E8E4] bg-white p-5 sm:p-6 space-y-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#15803D] mb-2">Give material another life</p><h3 className="font-display text-xl font-bold text-[#123D26]">{production?.captureDone ? 'Recovered Offcuts' : 'Recoverable Offcuts'}</h3><p className="text-sm text-[#64748B] mt-2">{production?.captureDone ? 'Recovery has been recorded for this production run.' : 'Preview potential offcuts, then confirm production and physical recovery.'}</p></div><span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-[#15803D]">{candidates.length} {production?.captureDone ? 'recovered' : 'candidates'}</span></div>

    {candidates.length > 0 ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{candidates.map((c,index)=>{
      const editable=production && !production.captureDone;
      const width=edits[c.id]?.width ?? c.width,height=edits[c.id]?.height ?? c.height;
      return <div key={c.id} className={`rounded-xl border p-4 ${unusable.includes(c.id) ? 'border-slate-200 bg-slate-50' : 'border-[#E2E8E4] bg-white'}`}>
        <div className="mb-3 rounded-lg border border-emerald-100 bg-[#F4F7F5] p-3"><ScrapPreview width={width} height={height} scaleWidth={scaleWidth} scaleHeight={scaleHeight}/></div>
        <div className="flex justify-between items-center gap-2"><h4 className="font-semibold text-[#123D26]">Offcut {index+1}</h4><span className="text-xs text-[#64748B]">{material.type}</span></div>
        <p className="mt-1 text-sm font-semibold text-[#172B21]">{width} &times; {height} mm</p>
        {finite(width*height) && <p className="mt-1 text-xs text-[#64748B]">{(width*height/100).toFixed(1)} cm&sup2; &middot; previews share the same scale</p>}
        {editable && <div className="mt-4 space-y-3 border-t border-[#E2E8E4] pt-3">
          <label className="flex items-center gap-2 text-sm font-medium text-[#123D26]"><input type="checkbox" disabled={unusable.includes(c.id)} checked={!unusable.includes(c.id) && !excluded.includes(c.id)} onChange={e=>setExcluded(prev=>e.target.checked?prev.filter(id=>id!==c.id):[...prev,c.id])}/>Recover this offcut</label>
          <div className="grid grid-cols-2 gap-2">{['width','height'].map(k=><label key={k} className="text-xs capitalize text-[#64748B]">{k} (mm)<input className="mt-1 block w-full rounded-lg border border-[#E2E8E4] p-2 text-[#172B21]" type="number" min="0.1" max={c[k]} value={edits[c.id]?.[k] ?? c[k]} onChange={e=>setEdits(prev=>({...prev,[c.id]:{...prev[c.id],[k]:Number(e.target.value)}}))}/></label>)}</div>
          <input aria-label={`Offcut ${index+1} notes`} placeholder="Recovery notes" className="w-full rounded-lg border border-[#E2E8E4] p-2 text-sm" onChange={e=>setEdits(prev=>({...prev,[c.id]:{...prev[c.id],notes:e.target.value}}))}/>
          <button className="text-xs font-medium text-red-700" onClick={()=>setUnusable(prev=>prev.includes(c.id)?prev.filter(id=>id!==c.id):[...prev,c.id])}>{unusable.includes(c.id)?'Restore usable':'Mark unusable'}</button>
        </div>}
      </div>;
    })}</div> : <p className="rounded-xl bg-[#F4F7F5] p-4 text-sm text-[#64748B]">{production?.captureDone ? 'No offcuts were saved from this production run.' : 'No offcuts meet the recovery threshold for this layout.'}</p>}

    <details className="rounded-xl bg-[#F4F7F5] p-4 text-xs text-[#64748B]"><summary className="cursor-pointer font-semibold text-[#123D26]">Recovery method & area breakdown</summary><dl className="grid sm:grid-cols-2 gap-3 mt-3">{areaMetrics.map(([label,value])=><div key={label}><dt>{label}</dt><dd className="mt-1 font-semibold text-[#172B21]">{(value/100).toFixed(1)} cm&sup2;</dd></div>)}</dl><p className="mt-3">{detected.method}. Candidate threshold: 50 mm minimum side and 100 cm&sup2; minimum area. Excluded area includes margins, small fragments, conservative exclusions and kerf; it is not additional area.</p></details>

    <div className="rounded-xl border border-[#E2E8E4] bg-[#F4F7F5] p-4 space-y-3">
      <h4 className="font-semibold text-[#123D26]">Production & recovery confirmation</h4>
      {!production && <><p className="text-sm text-[#64748B]">Reserve existing offcuts for this layout. Confirm production only after the material has physically been consumed. Recovery is confirmed separately.</p><div className="flex gap-2 flex-wrap">
        <button disabled={busy} className="border border-[#E2E8E4] bg-white rounded-lg px-3 py-2 text-sm disabled:opacity-50" onClick={()=>act({type:'reserve',projectId,ids})}>Reserve layout offcuts</button>
        <button disabled={busy} className="border border-[#E2E8E4] bg-white rounded-lg px-3 py-2 text-sm disabled:opacity-50" onClick={()=>act({type:'release',projectId})}>Cancel reservation</button>
        <button disabled={busy} className="bg-[#123D26] text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={()=>act({type:'produce',projectId,ids,production:{projectName,material:{...material},pieces,candidates:detected.candidates,confirmedAt:new Date().toISOString(),purchasedSheets:layout.stats.purchasedSheets,avoidedPurchases:layout.avoidedPurchases}})}>Confirm production / consumption</button>
      </div></>}
      {production && !production.captureDone && <><p className="text-sm text-[#64748B]">Production confirmed. Measure and physically recover each offcut before saving it to your Reuse Hub. Corrections can reduce candidate dimensions.</p><div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={()=>save(true)} className="bg-[#123D26] text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">Save all usable offcuts</button>
        <button disabled={busy} onClick={()=>save(false)} className="border border-[#E2E8E4] bg-white rounded-lg px-3 py-2 text-sm disabled:opacity-50">Save selected</button>
        <button disabled={busy} className="px-3 py-2 text-sm text-[#64748B] disabled:opacity-50" onClick={()=>act({type:'capture',projectId,records:[]})}>Skip saving</button>
      </div></>}
      {production?.captureDone && <p className="text-green-700 text-sm">Production confirmed. Offcut recovery recorded once for this physical run.</p>}
      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
    </div>
  </section>;
}
