export const INVENTORY_KEY = 'scrapsmart_reuse_inventory_v1';
export const emptyInventory = () => ({offcuts:[],productions:[]});
export const compatible = (o,m,owner) => o.shape==='rectangle' && o.materialType===m.type && Number(o.thickness)===Number(m.thickness) &&
  (o.status==='Available' || (o.status==='Reserved' && o.reservedBy===owner)) && Number.isFinite(o.width) && Number.isFinite(o.height) && o.width>2*Number(m.edgeMargin) && o.height>2*Number(m.edgeMargin);

// Every record is one identified physical region, quantity 1, including distinct regions on the same sheet.
export function inventoryTransition(state, action) {
  const next=structuredClone(state), ids=new Set(action.ids ?? []);
  const selected=next.offcuts.filter(o=>ids.has(o.id));
  if (selected.length!==ids.size) throw new Error('Stock is missing. Refresh inventory and optimize again.');
  if (action.type==='reserve') {
    if (selected.some(o=>o.status!=='Available' && !(o.status==='Reserved' && o.reservedBy===action.projectId))) throw new Error('An offcut is already reserved or consumed.');
    selected.forEach(o=>{o.status='Reserved';o.reservedBy=action.projectId;});
  } else if (action.type==='release') {
    next.offcuts.filter(o=>o.status==='Reserved' && o.reservedBy===action.projectId).forEach(o=>{o.status='Available';delete o.reservedBy;});
  } else if (action.type==='produce') {
    if(next.productions.some(p=>p.projectId===action.projectId)) throw new Error('Production already confirmed for this project. Create a new project for another physical run.');
    if(selected.some(o=>o.status!=='Reserved' || o.reservedBy!==action.projectId)) throw new Error('Reserve the actual layout stock before confirming consumption.');
    selected.forEach(o=>{o.status='Used';o.usedBy=action.projectId;delete o.reservedBy;});
    next.offcuts.filter(o=>o.status==='Reserved' && o.reservedBy===action.projectId).forEach(o=>{o.status='Available';delete o.reservedBy;});
    next.productions.push({...action.production,projectId:action.projectId,offcutIds:[...ids]});
  } else if (action.type==='capture') {
    const production=next.productions.find(p=>p.projectId===action.projectId);
    if(!production || production.captureDone) throw new Error('Confirm production first; offcuts from this run can be saved once.');
    for(const record of action.records) {
      const candidate=production.candidates.find(c=>c.id===record.id);
      if(!candidate || !Number.isFinite(record.width) || !Number.isFinite(record.height) || record.width<=0 || record.height<=0 || record.width>candidate.width || record.height>candidate.height) throw new Error('Measured dimensions must be positive and within the candidate usable region.');
      if(next.offcuts.some(o=>o.id===record.id)) throw new Error('This physical offcut is already saved.');
      next.offcuts.push({...candidate,width:record.width,height:record.height,notes:record.notes ?? '',sourceProjectId:action.projectId,sourceProjectName:production.projectName,materialType:production.material.type,thickness:production.material.thickness,
        savedDate:new Date().toISOString(),status:'Available',quantity:1,shape:'rectangle',polygon:[[0,0],[record.width,0],[record.width,record.height],[0,record.height]]});
    }
    production.captureDone=true;
  } else if(action.type==='discard') {
    if(selected.some(o=>o.status!=='Available')) throw new Error('Only available stock may be discarded.');
    selected.forEach(o=>{o.status='Discarded';});
  } else throw new Error('Unknown inventory action.');
  return next;
}
