import {expandPieces} from './planValidation.js';
import {sequenceFromTrees,reconstructCuttingTrees} from './cuttingSequence.js';
import {estimateCutting} from './cuttingProcessModel.js';

export function packMixed(method,sheet,pieces,opts,strategy,offcuts,assumptions) {
  const scraps=offcuts.map(o=>({id:o.id,offcutId:o.id,stockKind:'offcut',width:o.width,height:o.height}));
  const purchased=Array.from({length:Math.min(opts.maxSheets,expandPieces(pieces).length)},(_,i)=>({id:`purchased-${i}`,stockKind:'purchased',...sheet}));
  const stocks=[...scraps,...purchased];
  const orders=[stocks,[...scraps].sort((a,b)=>a.width*a.height-b.width*b.height).concat(purchased),[...purchased,...scraps]];
  const candidates=orders.map(order=>{
    let remaining=expandPieces(pieces);const sheets=[];
    for(const stock of order) {
      if(!remaining.length)break;
      if(stock.width<=2*opts.margin || stock.height<=2*opts.margin)continue;
      const lookup=new Map(remaining.map(p=>[`${p.instanceId}#1`,p]));
      let partial=method(stock,remaining.map(p=>({...p,id:p.instanceId,quantity:1})),{...opts,maxSheets:1});
      if(!partial.sheets.length)continue;
      if(strategy!=='fastest')partial=reconstructCuttingTrees(partial,opts) ?? partial;
      const used=new Set();
      for(const s of partial.sheets) {
        for(const p of s.placements) {const original=lookup.get(p.instanceId);p.instanceId=original.instanceId;p.pieceId=original.id;used.add(original.instanceId);}
        const remap=node=>{if(node.piece)node.piece=lookup.get(node.piece).instanceId;if(node.cut)node.cut.children.forEach(remap);};
        if(s.cuttingTree)remap(s.cuttingTree);
        sheets.push({...s,...stock,stockId:stock.id,index:sheets.length});
      }
      remaining=remaining.filter(p=>!used.has(p.instanceId));
    }
    const hasCuttingTree=sheets.every(s=>s.cuttingTree);
    return {strategy,algorithm:`Mixed-size stock / ${strategy==='fastest'?'guillotine':'MaxRects'} search`,sheets,unplaced:remaining,hasCuttingTree,cuttingSequence:hasCuttingTree?sequenceFromTrees(sheets):[],stocks};
  });
  // Preserve the original whole-job candidate: reuse must not worsen purchasing cost just because stock is visited one unit at a time.
  let full=method(sheet,pieces,opts);
  if(strategy!=='fastest')full=reconstructCuttingTrees(full,opts) ?? full;
  const fullSheets=full.sheets.map((s,i)=>({...s,...purchased[i],stockId:purchased[i].id}));
  const fullTree=fullSheets.every(s=>s.cuttingTree);
  candidates.push({...full,strategy,sheets:fullSheets,stocks,hasCuttingTree:fullTree,cuttingSequence:fullTree?sequenceFromTrees(fullSheets):[]});
  const purchaseCount=p=>p.sheets.filter(s=>s.stockKind==='purchased').length;
  const manufacturing=p=>{const e=estimateCutting(p,assumptions,p.hasCuttingTree);return e.estimatedCuttingTimeMinutes ?? e.complexityScore;};
  candidates.sort((a,b)=>a.unplaced.length-b.unplaced.length || (strategy==='fastest'?manufacturing(a)-manufacturing(b):purchaseCount(a)-purchaseCount(b)) || purchaseCount(a)-purchaseCount(b) || a.sheets.length-b.sheets.length);
  return candidates[0];
}
