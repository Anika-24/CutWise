import { expandPieces, validatePlan } from './planValidation.js';
import { estimateCutting } from './cuttingProcessModel.js';
const EPS = 1e-6;
function pack(sheet,pieces,options,sort,split) {
 const {kerf=0,margin=0,maxSheets=1,rotationAllowedGlobal=true}=options;
 const instances=expandPieces(pieces).sort((a,b)=>sort==='height'?b.height-a.height:sort==='width'?b.width-a.width:b.width*b.height-a.width*a.height);
 const sheets=[],unplaced=[];
 for(const p of instances){
  let best=null;
  for(let si=0;si<=sheets.length && si<maxSheets;si++){
   const root={x:margin,y:margin,width:sheet.width-2*margin,height:sheet.height-2*margin};
   for(const leaf of si<sheets.length?sheets[si].free:[root]) for(const rotated of [false,true]){
    if(rotated && (rotationAllowedGlobal===false || p.rotationAllowed===false || p.width===p.height)) continue;
    const w=rotated?p.height:p.width,h=rotated?p.width:p.height,dx=leaf.width-w,dy=leaf.height-h;
    if(dx<-EPS || dy<-EPS || (dx>EPS && dx<kerf-EPS) || (dy>EPS && dy<kerf-EPS)) continue;
    const cuts=Number(dx>EPS)+Number(dy>EPS),length=split==='x'?(dx>EPS?leaf.height:0)+(dy>EPS?w:0):(dy>EPS?leaf.width:0)+(dx>EPS?h:0);
    const score=cuts*100000+Number(rotated)*20000+(si===sheets.length?50000:0)+length+(leaf.width*leaf.height-w*h)/1e6;
    if(!best || score<best.score) best={si,leaf,root,w,h,rotated,score};
   }
  }
  if(!best){unplaced.push({...p,reason:'No guillotine placement found within inventory and geometric constraints.'});continue;}
  const {si,leaf,root,w,h,rotated}=best;
  if(!sheets[si]) sheets.push({index:si,...sheet,placements:[],cuttingTree:root,free:[root]});
  const s=sheets[si]; s.free=s.free.filter(r=>r!==leaf); let current=leaf;
  for(const axis of split==='x'?['x','y']:['y','x']){
   const dim=axis==='x'?'width':'height',at=axis==='x'?w:h;
   if(current[dim]-at>EPS){
    const first={x:current.x,y:current.y,width:current.width,height:current.height,[dim]:at};
    const second={x:current.x,y:current.y,width:current.width,height:current.height,[axis]:current[axis]+at+kerf,[dim]:current[dim]-at-kerf};
    current.cut={axis,at,gap:kerf,children:[first,second]};
    if(second.width>EPS && second.height>EPS) s.free.push(second); current=first;
   }
  }
  current.piece=p.instanceId;
  s.placements.push({instanceId:p.instanceId,pieceId:p.id,name:p.name,color:p.color,x:leaf.x,y:leaf.y,w,h,rotated,rotationAllowed:rotationAllowedGlobal && p.rotationAllowed!==false});
 }
 const plan={strategy:'fastest',algorithm:'Guillotine cutting tree',sheets:sheets.map(({free,...s})=>s),unplaced,cuttingSequence:[]};
 for(const s of plan.sheets){
  const walk=node=>{if(!node.cut)return;const {axis,at,gap,children}=node.cut;plan.cuttingSequence.push({sheetIndex:s.index,axis,gap,x1:node.x+(axis==='x'?at:0),y1:node.y+(axis==='y'?at:0),x2:node.x+(axis==='x'?at:node.width),y2:node.y+(axis==='y'?at:node.height),length:axis==='x'?node.height:node.width});children.forEach(walk);};walk(s.cuttingTree);
 }
 return plan;
}
export function fastCutLayout(sheet,pieces,options={},score=plan=>estimateCutting(plan,{},true).complexityScore){
 const candidates=['height','width','area'].flatMap(sort=>['x','y'].map(split=>pack(sheet,pieces,options,sort,split))).filter(p=>validatePlan(p,sheet,pieces,options).valid);
 candidates.sort((a,b)=>a.unplaced.length-b.unplaced.length || score(a)-score(b) || a.sheets.length-b.sheets.length);
 return candidates[0] ?? {strategy:'fastest',algorithm:'Guillotine search',sheets:[],unplaced:expandPieces(pieces),cuttingSequence:[]};
}
