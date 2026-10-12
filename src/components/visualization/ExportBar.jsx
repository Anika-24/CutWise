import React from 'react';
import { FileImage, FileText, Loader2, Download, Boxes, Cpu, PenTool } from 'lucide-react';
import jsPDF from 'jspdf';
import { useProject } from '@/lib/ProjectContext';
import { getMaterial } from '@/lib/materials';
import { formatMm, areaInUnit } from '@/lib/geometry';
import {
  sanitizeFileName,
  buildExportBundle,
  generateCsvExport,
  generateLaserSvgExport,
  generateCncProgram,
  generateObjExport,
} from '@/lib/exportFormats';

export default function ExportBar() {
  const { layout, material, projectName, pieces } = useProject();
  const [busy, setBusy] = React.useState(null);

  if (!layout || !layout.valid || !layout.sheets.length) return null;

  const matDef = getMaterial(material.type);
  const s = layout.stats;
  const u = material.unit;
  const areaUnit = u === 'in' ? 'in²' : 'cm²';

  const prefix = sanitizeFileName(projectName || 'CutWise_Project');

  const downloadBlob = (filename, content, type) => {
    if (typeof document === 'undefined') return;
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  function renderLayoutToCanvas(src, scale = 0.25) {
    const sheets = src.sheets;
    const cols = Math.min(sheets.length, 2);
    const rows = Math.ceil(sheets.length / cols);
    const sheetW = Math.max(...sheets.map((s) => s.width));
    const sheetH = Math.max(...sheets.map((s) => s.height));
    const gap = 40;
    const canvasW = (sheetW * scale + gap) * cols + gap;
    const canvasH = (sheetH * scale + gap) * rows + gap + 60;
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#123D26';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.fillText('CutWise — Cutting Plan', 40, 44);

    sheets.forEach((sheet, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ox = gap + col * (sheetW * scale + gap);
      const oy = 60 + gap + row * (sheetH * scale + gap);
      ctx.fillStyle = '#E2E8E4';
      ctx.fillRect(ox, oy, sheet.width * scale, sheet.height * scale);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox, oy, sheet.width * scale, sheet.height * scale);
      sheet.placements.forEach((p) => {
        ctx.fillStyle = p.color || '#16A34A';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(ox + p.x * scale, oy + p.y * scale, p.w * scale, p.h * scale);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox + p.x * scale, oy + p.y * scale, p.w * scale, p.h * scale);
      });
      ctx.fillStyle = '#64748B';
      ctx.font = '16px Inter, sans-serif';
      ctx.fillText(`Sheet ${i + 1}`, ox, oy - 8);
    });
    return canvas;
  }

  const exportPNG = () => {
    setBusy('png');
    setTimeout(() => {
      const canvas = renderLayoutToCanvas(layout, 0.25);
      const link = document.createElement('a');
      link.download = `${prefix}_cutting_plan.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setBusy(null);
    }, 50);
  };

  const exportPDF = () => {
    setBusy('pdf');
    setTimeout(() => {
      const canvas = renderLayoutToCanvas(layout, 0.28);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 36;

      pdf.setFillColor(18, 61, 38);
      pdf.rect(0, 0, pageW, 70, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.text('CutWise — Cutting Plan Report', margin, 44);

      const logisticsX = margin;
      const logisticsY = 90;
      const logisticsW = 180;
      const logisticsH = 210;
      const imageX = logisticsX + logisticsW + 20;
      const imageW = pageW - imageX - margin;
      const imageH = Math.min(Math.max(180, (canvas.height / canvas.width) * imageW), 250);

      pdf.setDrawColor(220, 226, 232);
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(logisticsX, logisticsY, logisticsW, logisticsH, 8, 8, 'FD');

      pdf.setTextColor(23, 43, 33);
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('Logistics', logisticsX + 14, logisticsY + 20);
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(71, 85, 105);

      const logisticsRows = [
        ['Project', projectName],
        ['Material', matDef.name],
        ['Sheet size', `${formatMm(material.sheetWidth, u)} × ${formatMm(material.sheetHeight, u)}`],
        ['Thickness', formatMm(material.thickness, u)],
        ['Saw kerf', formatMm(material.kerf, u)],
        ['Edge margin', formatMm(material.edgeMargin, u)],
        ['Sheets used', `${s.sheetsUsed} / ${material.sheetQuantity}`],
        ['Placed pieces', `${s.placedCount} / ${s.totalPieces}`],
        ['Unplaced', String(s.unplacedCount)],
        ['Utilization', `${s.utilization?.toFixed(1) ?? 'Unavailable'}%`],
        ['Waste', `${s.waste?.toFixed(1) ?? 'Unavailable'}%`],
        ['Cost', s.totalCost === null ? 'Unavailable' : `$${s.totalCost.toFixed(2)}`],
      ];

      let logisticsCursor = logisticsY + 32;
      logisticsRows.forEach(([label, value]) => {
        pdf.setTextColor(100, 116, 139);
        pdf.text(String(label), logisticsX + 14, logisticsCursor);
        pdf.setTextColor(23, 43, 33);
        pdf.text(String(value), logisticsX + 96, logisticsCursor, { maxWidth: logisticsW - 110 });
        logisticsCursor += 14;
      });

      pdf.setDrawColor(220, 226, 232);
      pdf.roundedRect(imageX, logisticsY, imageW, imageH, 8, 8, 'S');
      pdf.addImage(imgData, 'PNG', imageX + 7, logisticsY + 8, imageW - 14, imageH - 14, undefined, 'FAST');

      let y = logisticsY + logisticsH + 18;
      pdf.setTextColor(23, 43, 33);
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('Piece placements', margin, y);
      y += 14;

      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Name', margin, y);
      pdf.text('Sheet', margin + 120, y);
      pdf.text('X', margin + 170, y);
      pdf.text('Y', margin + 200, y);
      pdf.text('W×H', margin + 235, y);
      pdf.text('Rot', margin + 285, y);
      y += 12;

      pdf.setTextColor(23, 43, 33);
      let rowsOnPage = 0;
      layout.sheets.forEach((sh) => {
        sh.placements.forEach((p) => {
          if (y > pageH - 56) {
            pdf.addPage();
            y = margin + 10;
            pdf.setTextColor(23, 43, 33);
            pdf.setFontSize(12);
            pdf.setFont(undefined, 'bold');
            pdf.text('Piece placements', margin, y);
            y += 14;
            pdf.setFont(undefined, 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor(100, 116, 139);
            pdf.text('Name', margin, y);
            pdf.text('Sheet', margin + 120, y);
            pdf.text('X', margin + 170, y);
            pdf.text('Y', margin + 200, y);
            pdf.text('W×H', margin + 235, y);
            pdf.text('Rot', margin + 285, y);
            y += 12;
            pdf.setTextColor(23, 43, 33);
          }

          pdf.text(String(p.name).slice(0, 20), margin, y);
          pdf.text(String(sh.index + 1), margin + 120, y);
          pdf.text(String(Math.round(p.x)), margin + 170, y);
          pdf.text(String(Math.round(p.y)), margin + 200, y);
          pdf.text(`${Math.round(p.w)}×${Math.round(p.h)}`, margin + 235, y);
          pdf.text(p.rotated ? '90°' : '0°', margin + 285, y);
          y += 12;
          rowsOnPage += 1;
        });
      });

      if (layout.unplaced.length > 0) {
        pdf.setTextColor(220, 38, 38);
        pdf.setFontSize(10);
        pdf.text(`Unplaced: ${layout.unplaced.map((p) => p.name).join(', ')}`, margin, pageH - 32);
      }

      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text('Generated by CutWise. Best Layout Found — not guaranteed globally optimal.', margin, pageH - 18);

      pdf.save(`${prefix}_CutWise_report.pdf`);
      setBusy(null);
    }, 50);
  };

  const exportCsv = () => {
    setBusy('csv');
    const csv = generateCsvExport(projectName, material, layout);
    downloadBlob(`${prefix}_cutting_plan.csv`, csv, 'text/csv;charset=utf-8');
    setBusy(null);
  };

  const exportJson = () => {
    setBusy('json');
    const payload = buildExportBundle(projectName, material, layout, pieces);
    downloadBlob(`${prefix}_cutting_plan.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    setBusy(null);
  };

  const exportLaser = () => {
    setBusy('laser');
    const svg = generateLaserSvgExport(projectName, material, layout);
    downloadBlob(`${prefix}_laser_cut.svg`, svg, 'image/svg+xml;charset=utf-8');
    setBusy(null);
  };

  const exportCnc = () => {
    setBusy('cnc');
    const program = generateCncProgram(projectName, material, layout);
    downloadBlob(`${prefix}_cnc_cut.nc`, program, 'text/plain;charset=utf-8');
    setBusy(null);
  };

  const exportThreeD = () => {
    setBusy('threeD');
    const obj = generateObjExport(projectName, material, layout);
    downloadBlob(`${prefix}_3d_machine.obj`, obj, 'text/plain;charset=utf-8');
    setBusy(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={exportPNG} disabled={!!busy} className="flex items-center gap-2 rounded-lg border border-[#E2E8E4] px-3 py-2 text-sm font-medium text-[#172B21] transition hover:bg-[#F4F7F5] disabled:opacity-50">
        {busy === 'png' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileImage className="w-4 h-4" />} PNG
      </button>
      <button onClick={exportThreeD} disabled={!!busy} className="flex items-center gap-2 rounded-lg border border-[#E2E8E4] px-3 py-2 text-sm font-medium text-[#172B21] transition hover:bg-[#F4F7F5] disabled:opacity-50">
        {busy === 'threeD' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Boxes className="w-4 h-4" />} 3D Machine
      </button>
      <button onClick={exportCnc} disabled={!!busy} className="flex items-center gap-2 rounded-lg border border-[#E2E8E4] px-3 py-2 text-sm font-medium text-[#172B21] transition hover:bg-[#F4F7F5] disabled:opacity-50">
        {busy === 'cnc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />} CNC Machine
      </button>
      <button onClick={exportLaser} disabled={!!busy} className="flex items-center gap-2 rounded-lg border border-[#E2E8E4] px-3 py-2 text-sm font-medium text-[#172B21] transition hover:bg-[#F4F7F5] disabled:opacity-50">
        {busy === 'laser' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />} Laser Cut
      </button>
      <button onClick={exportPDF} disabled={!!busy} className="flex items-center gap-2 rounded-lg bg-[#123D26] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#15803D] disabled:opacity-50">
        {busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
      </button>
      <button onClick={exportCsv} disabled={!!busy} className="flex items-center gap-2 rounded-lg border border-[#E2E8E4] px-3 py-2 text-sm font-medium text-[#172B21] transition hover:bg-[#F4F7F5] disabled:opacity-50">
        {busy === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} CSV
      </button>
      <button onClick={exportJson} disabled={!!busy} className="flex items-center gap-2 rounded-lg border border-[#E2E8E4] px-3 py-2 text-sm font-medium text-[#172B21] transition hover:bg-[#F4F7F5] disabled:opacity-50">
        {busy === 'json' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} JSON
      </button>
    </div>
  );
}
