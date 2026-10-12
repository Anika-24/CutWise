import React from 'react';
import { Plus, Copy, Trash2, Eraser, FileDown, AlertTriangle } from 'lucide-react';
import { useProject } from '@/lib/ProjectContext';
import { UNITS, fromMm, toMm, areaInUnit } from '@/lib/geometry';
import { getMaterial } from '@/lib/materials';

const inputCls =
  'w-full px-2 py-1.5 rounded-md border border-[#E2E8E4] bg-white text-sm text-[#172B21] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/30 focus:border-[#16A34A] transition';

export default function CutListTable() {
  const { pieces, addPiece, updatePiece, deletePiece, duplicatePiece, clearPieces, loadExample, material } = useProject();
  const u = material.unit;
  const fallbackColor = getMaterial(material.type).three.color;
  const conv = (mm) => Number(fromMm(mm, u).toFixed(u === 'mm' ? 0 : u === 'cm' ? 1 : 2));
  const usableW = material.sheetWidth - material.edgeMargin * 2;
  const usableH = material.sheetHeight - material.edgeMargin * 2;

  const totalPieces = pieces.reduce((s, p) => s + Math.max(1, Math.round(p.quantity || 1)), 0);
  const totalArea = pieces.reduce((s, p) => s + p.width * p.height * Math.max(1, Math.round(p.quantity || 1)), 0);

  const fitsSheet = (p) => {
    const w = p.width + material.kerf;
    const h = p.height + material.kerf;
    return (w <= usableW + 1e-6 && h <= usableH + 1e-6) || (p.rotationAllowed && h <= usableW + 1e-6 && w <= usableH + 1e-6);
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8E4] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[#E2E8E4] flex-wrap gap-2">
        <div>
          <h3 className="font-display font-bold text-[#172B21]">Cut list</h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            {pieces.length} part type{pieces.length !== 1 ? 's' : ''} · {totalPieces} total pieces ·{' '}
            {areaInUnit(totalArea, u === 'mm' ? 'cm' : u)?.toFixed(0) ?? 'Unavailable — Check Dimensions'} {u === 'mm' ? 'cm²' : u === 'cm' ? 'cm²' : 'in²'} required
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => addPiece()} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] transition">
            <Plus className="w-3.5 h-3.5" /> Add Piece
          </button>
          <button onClick={loadExample} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-[#E2E8E4] text-[#172B21] hover:bg-[#F4F7F5] transition">
            <FileDown className="w-3.5 h-3.5" /> Example
          </button>
          <button onClick={clearPieces} disabled={!pieces.length} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-[#E2E8E4] text-[#64748B] hover:bg-[#F4F7F5] transition disabled:opacity-40">
            <Eraser className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F7F5] text-[#64748B] text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-semibold px-3 py-2.5">ID</th>
              <th className="text-left font-semibold px-3 py-2.5">Name</th>
              <th className="text-left font-semibold px-3 py-2.5 w-24">Width ({u})</th>
              <th className="text-left font-semibold px-3 py-2.5 w-24">Height ({u})</th>
              <th className="text-left font-semibold px-3 py-2.5 w-20">Qty</th>
              <th className="text-center font-semibold px-3 py-2.5 w-16">Rotate</th>
              <th className="text-center font-semibold px-3 py-2.5 w-12">Color</th>
              <th className="text-right font-semibold px-3 py-2.5 w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pieces.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-[#94A3B8]">
                  No pieces yet. Click <span className="font-semibold text-[#15803D]">Add Piece</span> or load an example to begin.
                </td>
              </tr>
            )}
            {pieces.map((p) => {
              const fits = fitsSheet(p);
              return (
                <tr key={p.id} className="border-t border-[#E2E8E4] hover:bg-[#F4F7F5]/50">
                  <td className="px-3 py-2 font-mono text-xs text-[#64748B]">{p.id}</td>
                  <td className="px-3 py-2">
                    <input
                      className={inputCls}
                      value={p.name}
                      onChange={(e) => updatePiece(p.id, { name: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      step={UNITS[u].step}
                      className={inputCls}
                      value={conv(p.width)}
                      onChange={(e) => updatePiece(p.id, { width: toMm(Number(e.target.value) || 0, u) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      step={UNITS[u].step}
                      className={inputCls}
                      value={conv(p.height)}
                      onChange={(e) => updatePiece(p.id, { height: toMm(Number(e.target.value) || 0, u) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      value={p.quantity}
                      onChange={(e) => updatePiece(p.id, { quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded accent-[#16A34A]"
                      checked={p.rotationAllowed}
                      onChange={(e) => updatePiece(p.id, { rotationAllowed: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="color"
                      value={/^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color : fallbackColor}
                      onChange={(e) => updatePiece(p.id, { color: e.target.value })}
                      className="w-7 h-7 rounded cursor-pointer border border-[#E2E8E4]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => duplicatePiece(p.id)} className="w-7 h-7 rounded-md hover:bg-[#DCFCE7] text-[#15803D] flex items-center justify-center" title="Duplicate">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deletePiece(p.id)} className="w-7 h-7 rounded-md hover:bg-red-50 text-[#DC2626] flex items-center justify-center" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pieces.some((p) => !fitsSheet(p)) && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-t border-amber-200 text-amber-700 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Some pieces are larger than the usable sheet area and will be marked unplaced.
        </div>
      )}
    </div>
  );
}
