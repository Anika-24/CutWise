import React,{useState} from 'react';
import {Link} from 'react-router-dom';
import {useProject} from '@/lib/ProjectContext';
import {useReuse} from '@/lib/ReuseContext';
import {compatible} from '@/lib/reuseInventory';
export default function ReuseStockPanel(){
  const {material,pieces,projectId,selectedOffcutIds,setSelectedOffcutIds}=useProject();const {inventory}=useReuse();const [show,setShow]=useState(false);
  const matches=inventory.offcuts.filter(o=>compatible(o,material,projectId)).filter(o=>!pieces.length || pieces.some(p=>
    (p.width<=o.width-2*material.edgeMargin && p.height<=o.height-2*material.edgeMargin) || (material.rotationAllowed && p.rotationAllowed!==false && p.height<=o.width-2*material.edgeMargin && p.width<=o.height-2*material.edgeMargin)));
  if(!matches.length)return null;
  return <section className="bg-white rounded-2xl border border-[#E2E8E4] p-4 space-y-3"><h3 className="font-semibold text-[#123D26]">Reuse existing material</h3>
    <p className="text-sm text-slate-600">You already have reusable {material.type} from previous projects. Would you like to check your existing material before buying new sheets?</p>
    <div className="flex gap-3 flex-wrap text-sm"><Link to="/saved?tab=reuse" className="underline">View Available Scraps</Link><button onClick={()=>setShow(true)} className="text-green-700 font-semibold">Use Existing Material</button><button onClick={()=>{setSelectedOffcutIds([]);setShow(false);}}>Continue with New Sheets</button></div>
    {(show || selectedOffcutIds.length>0) && <><p className="text-xs text-slate-500">Rectangular usable regions only. Selection previews stock; it does not reserve or consume it. Existing kerf and margins apply to each stock unit.</p>{matches.map(o=><label key={o.id} className="flex gap-2 text-sm"><input type="checkbox" checked={selectedOffcutIds.includes(o.id)} onChange={e=>setSelectedOffcutIds(prev=>e.target.checked?[...prev,o.id]:prev.filter(id=>id!==o.id))}/>{o.width.toFixed(1)} × {o.height.toFixed(1)} mm · {o.thickness} mm · {o.sourceProjectName} · {o.status}</label>)}</>}
  </section>;
}
