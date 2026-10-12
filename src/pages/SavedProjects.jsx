import ReuseHub from '@/components/reuse/ReuseHub';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useReuse } from '@/lib/ReuseContext';
import React from 'react';
import { FolderOpen, Trash2, Calendar, Layers } from 'lucide-react';
import { useProject } from '@/lib/ProjectContext';
import { getMaterial } from '@/lib/materials';

export default function SavedProjects() {
  const [params,setParams]=useSearchParams();const navigate=useNavigate();const {inventory}=useReuse();
  const reuse=params.get('tab')==='reuse';
  const { savedProjects, openProject, deleteProject } = useProject();
  return (
    <div className="p-4 sm:p-6 max-w-[1000px] mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[#172B21]">Saved Projects</h1>
        <p className="text-sm text-[#64748B] mt-1">Projects are stored locally in your browser.</p>
      </div>
      <div className="flex gap-3 mb-4"><button className={reuse ? "border rounded px-4 py-2" : "bg-[#123D26] text-white rounded px-4 py-2"} onClick={()=>setParams({})}>Projects</button><button className={reuse ? "bg-[#123D26] text-white rounded px-4 py-2" : "border rounded px-4 py-2"} onClick={()=>setParams({tab:'reuse'})}>Reusable Materials</button></div>
      {reuse ? <ReuseHub /> : savedProjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2E8E4] p-12 text-center">
          <FolderOpen className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
          <p className="text-[#64748B] font-medium">No saved projects yet</p>
          <p className="text-sm text-[#94A3B8] mt-1">Use the Save button in the header to store a project here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedProjects.map((p, i) => {
            const mat = getMaterial(p.material?.type);
            const totalPieces = (p.pieces || []).reduce((s, x) => s + Math.max(1, x.quantity || 1), 0);
            return (
              <div key={i} className="bg-white rounded-2xl border border-[#E2E8E4] p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-display font-bold text-[#172B21]">{p.name}</div>
                    <div className="text-xs text-[#64748B] flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3 h-3" /> {new Date(p.savedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button onClick={() => deleteProject(i)} className="w-8 h-8 rounded-lg hover:bg-red-50 text-[#DC2626] flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#64748B] mb-3">
                  <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] font-medium">{mat.name}</span>
                  <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {totalPieces} pieces</span>
                  <span>{p.material.sheetWidth}×{p.material.sheetHeight}mm</span>
                </div>
                <p className="text-xs text-green-700 mb-2">{inventory.offcuts.filter(o=>o.sourceProjectId===p.id).length} associated offcuts</p>
                <button onClick={() => {openProject(p);navigate('/');}} className="w-full px-3 py-2 rounded-lg bg-[#123D26] text-white text-sm font-semibold hover:bg-[#15803D] transition">
                  Open project
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
