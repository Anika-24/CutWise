// Candidates are geometric estimates until the user measures and confirms recovery.
export function detectOffcuts(plan, material, projectId) {
  if (!plan?.valid) return { candidates: [], estimatedArea: 0, excludedArea: null };
  const margin = Number(material.edgeMargin), kerf = Number(material.kerf);
  const candidates = [];
  for (const sheet of plan.sheets) {
    let regions = [];
    if (plan.sequenceValidated && sheet.cuttingTree) {
      const visit = node => { if (node.cut) node.cut.children.forEach(visit); else if (!node.piece) regions.push({x:node.x,y:node.y,width:node.width,height:node.height}); };
      visit(sheet.cuttingTree);
    } else {
      regions = [{x:margin,y:margin,width:sheet.width-2*margin,height:sheet.height-2*margin}];
      // Subtract an expanded safety envelope. Disjoint strips conservatively represent irregular free space.
      for (const p of sheet.placements) {
        const b = {x:p.x-kerf,y:p.y-kerf,right:p.x+p.w+kerf,bottom:p.y+p.h+kerf};
        regions = regions.flatMap(r => {
          const x=Math.max(r.x,b.x), y=Math.max(r.y,b.y), right=Math.min(r.x+r.width,b.right), bottom=Math.min(r.y+r.height,b.bottom);
          if (right<=x || bottom<=y) return [r];
          return [{x:r.x,y:r.y,width:r.width,height:y-r.y},{x:r.x,y:bottom,width:r.width,height:r.y+r.height-bottom},
            {x:r.x,y,width:x-r.x,height:bottom-y},{x:right,y,width:r.x+r.width-right,height:bottom-y}].filter(a=>a.width>0 && a.height>0);
        });
      }
    }
    for (const r of regions.filter(r=>r.width>=50 && r.height>=50 && r.width*r.height>=10000)) {
      const sourceSheetId = sheet.stockId ?? `sheet-${sheet.index}`;
      const id = `${projectId}:${sourceSheetId}:${r.x},${r.y},${r.width},${r.height}`;
      candidates.push({...r,id,sourceSheetId,parentOffcutId:sheet.offcutId ?? null,shape:'rectangle',quantity:1});
    }
  }
  const estimatedArea = candidates.reduce((a,r)=>a+r.width*r.height,0);
  return {candidates,estimatedArea,excludedArea:Math.max(0,(plan.stats.leftoverAreaMm2 ?? 0)-estimatedArea),
    method:plan.sequenceValidated ? 'Unused verified cutting-tree leaves' : 'Conservative disjoint rectangles; kerf safety envelopes excluded'};
}
