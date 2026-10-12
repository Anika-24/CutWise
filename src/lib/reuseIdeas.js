import {runStrategies} from './optimizationEngine.js';
import {compatible} from './reuseInventory.js';
export const DIY_CATALOG=[
  {name:'Desk tray',types:['plywood','mdf','acrylic'],minThickness:3,maxThickness:25,parts:[[240,160,1],[240,40,2],[160,40,2]]},
  {name:'Workshop sorting dividers',types:['plywood','mdf','cardboard'],minThickness:1,maxThickness:20,parts:[[180,60,4]]},
  {name:'Display shelf',types:['plywood','mdf'],minThickness:12,maxThickness:25,parts:[[400,160,1],[160,120,2]]},
  {name:'Geometric learning tiles',types:['plywood','mdf','acrylic','cardboard'],minThickness:1,maxThickness:20,parts:[[80,80,6]]},
];
export function suggestIdeas(stock,material) {
  const eligible=stock.filter(o=>compatible(o,material,null));
  const m={...material,sheetQuantity:0};
  return DIY_CATALOG.filter(t=>t.types.includes(m.type) && Number(m.thickness)>=t.minThickness && Number(m.thickness)<=t.maxThickness).flatMap(t=>{
    const pieces=t.parts.map(([width,height,quantity],i)=>({id:`idea-${i}`,name:`Part ${i+1}`,width,height,quantity,rotationAllowed:true,color:'#16A34A'}));
    const plan=runStrategies(m,pieces,{},eligible).most_efficient;
    return plan.valid && plan.status==='complete' ? [{...t,pieces,material:m,plan,offcutIds:plan.sheets.map(s=>s.offcutId)}] : [];
  });
}
