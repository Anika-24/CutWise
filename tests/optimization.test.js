import test from 'node:test';
import assert from 'node:assert/strict';
import { runStrategies } from '../src/lib/optimizationEngine.js';
import { validatePlan } from '../src/lib/planValidation.js';
import { areaInUnit } from '../src/lib/geometry.js';
import { comparePlans, explainComparison, recommendPlans } from '../src/lib/optimizationComparison.js';
import { estimateCutting } from '../src/lib/cuttingProcessModel.js';
import { activePlan, layoutSheet } from '../src/lib/layoutSelection.js';
import { DEMO_PROJECT } from '../src/lib/demoData.js';
const material={sheetWidth:100,sheetHeight:100,sheetQuantity:3,kerf:0,edgeMargin:0,rotationAllowed:true,pricePerSheet:38};
const piece=(w,h,q=1,rotationAllowed=true)=>({id:'A',name:'A',width:w,height:h,quantity:q,rotationAllowed});
function run(pieces,patch={}) {
 const m={...material,...patch},results=runStrategies(m,pieces);
 for(const p of Object.values(results)) {
  assert.equal(validatePlan(p,{width:m.sheetWidth,height:m.sheetHeight},pieces,{kerf:m.kerf,margin:m.edgeMargin,maxSheets:m.sheetQuantity,rotationAllowedGlobal:m.rotationAllowed}).valid,p.valid);
  for(const value of Object.values(p.stats)) if(typeof value==='number') assert.ok(Number.isFinite(value));
 }
 return results;
}
for(const strategy of ['most_efficient','fastest']) {
 test(`${strategy}: exact fit with kerf requires no extra edge clearance`,()=>{const p=run([piece(100,100)],{kerf:3})[strategy];assert.equal(p.status,'complete');assert.equal(p.stats.utilization,100);assert.equal(p.stats.leftoverArea,0);});
 test(`${strategy}: oversized piece is reported`,()=>{const p=run([piece(101,101)])[strategy];assert.equal(p.status,'incomplete');assert.equal(p.unplaced.length,1);});
 test(`${strategy}: rotation constraints`,()=>{assert.equal(run([piece(80,120)],{sheetWidth:120,sheetHeight:80})[strategy].status,'complete');assert.equal(run([piece(80,120,1,false)],{sheetWidth:120,sheetHeight:80})[strategy].status,'incomplete');});
 test(`${strategy}: multiple sheets and finite analytics`,()=>{const p=run([piece(60,60,3)])[strategy];assert.equal(p.status,'complete');assert.equal(p.stats.sheetsUsed,3);assert.equal(p.stats.totalCost,114);assert.equal(p.stats.utilization,36);assert.equal(p.stats.waste,64);});
 test(`${strategy}: inventory shortage reports an additional plan`,()=>{const p=run([piece(60,60,3)],{sheetQuantity:1})[strategy];assert.equal(p.status,'incomplete');assert.equal(p.additionalSheetsFound,2);assert.equal(comparePlans(p,p),null);});
 test(`${strategy}: zero inventory is respected`,()=>{const p=run([piece(20,20)],{sheetQuantity:0})[strategy];assert.equal(p.sheets.length,0);assert.equal(p.unplaced.length,1);});
 test(`${strategy}: margins and kerf`,()=>{const p=run([piece(40,40,4)],{kerf:3,edgeMargin:5})[strategy];assert.equal(p.status,'complete');assert.equal(p.sheets.length,1);});
}
test('Cut sequence tampering is rejected',()=>{const p=run([piece(40,40,4)]).fastest;const broken=structuredClone(p);broken.cuttingSequence[0].length+=10;assert.equal(validatePlan(broken,{width:100,height:100},[piece(40,40,4)],{maxSheets:3}).valid,false);});
test('Unknown, missing and overlapping instances are rejected',()=>{const pieces=[piece(40,40,4)],p=run(pieces).most_efficient;const broken=structuredClone(p);broken.sheets[0].placements[1].x=broken.sheets[0].placements[0].x;broken.sheets[0].placements[1].y=broken.sheets[0].placements[0].y;assert.equal(validatePlan(broken,{width:100,height:100},pieces,{maxSheets:3}).valid,false);});
test('Invalid inputs return invalid results without throwing',()=>{for(const m of [{sheetWidth:NaN},{kerf:-1},{edgeMargin:60},{sheetQuantity:1.5}]) for(const p of Object.values(runStrategies({...material,...m},[piece(20,20)]))) assert.equal(p.status,'invalid');});
test('Area units are correct and invalid areas stay unavailable',()=>{assert.equal(areaInUnit(10000,'cm'),100);assert.equal(areaInUnit(1000000,'m'),1);assert.equal(areaInUnit(NaN,'cm'),null);});
test('Percentage points and relative improvement remain distinct',()=>{const p=s=>({status:'complete',stats:s});const c=comparePlans(p({sheetsUsed:4,totalCost:152,utilization:62.4}),p({sheetsUsed:3,totalCost:114,utilization:83.2}));assert.equal(c.savings,38);assert.equal(c.costSavingsPercent,25);assert.ok(Math.abs(c.utilizationPoints-20.8)<1e-8);assert.ok(Math.abs(c.relativeUtilizationPercent-33.333333)<1e-5);});
test('Time requires explicit complete assumptions',()=>{const pieces=[piece(40,40,4)];assert.equal(run(pieces).fastest.stats.estimatedCuttingTimeMinutes,null);const p=runStrategies(material,pieces,{cuttingSpeed:1000,handlingSeconds:2,repositionSeconds:1,rotationSeconds:3,setupSeconds:10,laborRate:30}).fastest;assert.ok(p.stats.estimatedCuttingTimeMinutes>0);assert.ok(p.stats.totalJobCost>p.stats.totalCost);});
test('Demo strategies independently produce valid complete plans',()=>{const r=runStrategies(DEMO_PROJECT.material,DEMO_PROJECT.pieces);for(const p of Object.values(r))assert.equal(p.status,'complete');assert.ok(r.most_efficient.sheets.length<r.baseline.sheets.length);assert.ok(r.fastest.sequenceValidated);assert.equal(comparePlans(r.most_efficient,r.fastest).cutsComparable,r.most_efficient.sequenceValidated);});

const production={cuttingSpeed:3000,setupMinutes:2,repositionSeconds:10,rotationSeconds:8,laborRate:30};
const smallPieces=[[700,500],[300,200],[900,200],[800,200]].map(([width,height],i)=>({id:String(i),name:String(i),width,height,quantity:1,rotationAllowed:true}));
const fullMaterial={sheetWidth:2440,sheetHeight:1220,pricePerSheet:38,sheetQuantity:4,kerf:3,edgeMargin:0,rotationAllowed:true};
test('Supplied small project has exact geometry, equal costs and honest explanations',()=>{
 const r=runStrategies(fullMaterial,smallPieces);
 for(const p of Object.values(r)){
  assert.equal(p.status,'complete');assert.equal(p.stats.sheetsUsed,1);assert.equal(p.stats.placedArea,750000);assert.equal(p.stats.totalSheetArea,2976800);assert.equal(p.stats.leftoverArea,2226800);assert.equal(areaInUnit(p.stats.leftoverArea,'cm'),22268);assert.equal(p.stats.totalCost,38);assert.ok(Math.abs(p.stats.utilization-25.1948401)<1e-6);
 }
 for(const key of ['most_efficient','fastest']){const c=comparePlans(r.baseline,r[key]);assert.equal(c.savings,0);assert.equal(c.utilizationPoints,0);assert.match(explainComparison(r.baseline,r[key]),/identical material purchasing costs/);assert.doesNotMatch(explainComparison(r.baseline,r[key]),/efficiency improved/);}
 assert.ok(r.fastest.sequenceValidated);
});
test('Crowded 12-piece job independently validates all three geometries',()=>{
 const ps=[[1200,600,2],[800,500,3],[600,400,3],[300,200,4]].map(([width,height,quantity],i)=>({id:String(i),name:String(i),width,height,quantity}));
 const r=runStrategies(fullMaterial,ps);
 for(const p of Object.values(r)){
  assert.equal(validatePlan(p,{width:2440,height:1220},ps,{kerf:3,margin:0,maxSheets:4}).valid,true);assert.equal(p.status,'complete');assert.equal(p.stats.placedCount,12);assert.equal(p.stats.placedArea,3600000);assert.ok(p.stats.sheetsUsed>=2);assert.equal(p.stats.totalCost,38*p.stats.sheetsUsed);assert.equal(p.stats.leftoverArea,2976800*p.stats.sheetsUsed-3600000);assert.ok(Math.abs(p.stats.waste+p.stats.utilization-100)<1e-8);
 }
});
test('Production time and labor use explicit units and distinct handling events',()=>{
 const p=runStrategies(fullMaterial,smallPieces,production).fastest,s=p.stats;
 const expected=s.cutLengthMm/3000+s.sheetsUsed*2+s.repositioningCount*10/60+s.rotationEvents*8/60;
 assert.ok(Math.abs(s.estimatedCuttingTimeMinutes-expected)<1e-10);assert.equal(s.estimatedLaborCost,expected/60*30);assert.equal(s.totalJobCost,s.totalCost+s.estimatedLaborCost);
 assert.equal(s.repositioningCount+s.rotationEvents,Math.max(0,s.cuttingOperations-s.sheetsUsed));
});
test('Missing and invalid production inputs stay unavailable, including cleared values',()=>{
 for(const patch of [{laborRate:''},{laborRate:-1},{laborRate:'nonsense'},{cuttingSpeed:''},{cuttingSpeed:0},{setupMinutes:''},{rotationSeconds:Infinity}]){
  const p=runStrategies(fullMaterial,smallPieces,{...production,...patch}).fastest;assert.equal(p.stats.totalJobCost,null);assert.match(p.stats.jobCostUnavailableReason,/unavailable/);
 }
 for(const price of ['',null,-1,Infinity,'bad']){const p=runStrategies({...fullMaterial,pricePerSheet:price},smallPieces,production).fastest;assert.equal(p.stats.totalCost,null);assert.equal(p.stats.totalJobCost,null);}
});
test('Exact piece produces zero operations and zero reposition count',()=>{
 const p=runStrategies(material,[piece(100,100)],production).fastest;assert.equal(p.stats.cuttingOperations,0);assert.equal(p.stats.repositioningCount,0);assert.equal(p.stats.estimatedCuttingTimeMinutes,2);
 assert.match(recommendPlans(p,p),/equivalent results/);
});
test('Separate-edge fallback cannot be compared as validated cuts or real time',()=>{
 const plan={strategy:'most_efficient',sheets:[{placements:[{w:10,h:20,rotated:false}]}],cuttingSequence:[]};
 const estimated=estimateCutting(plan,production,false),verified=estimateCutting(plan,production,true);
 assert.equal(estimated.cuttingOperations,4);assert.equal(estimated.estimatedCuttingTimeMinutes,null);assert.equal(estimated.estimatedLaborCost,null);
 const p=stats=>({status:'complete',valid:true,stats:{...stats,sheetsUsed:1,totalCost:38,utilization:10}}),c=comparePlans(p(estimated),p(verified));
 assert.equal(c.cutsSaved,null);assert.equal(c.timeSavedMinutes,null);assert.equal(c.provisional,true);assert.match(explainComparison(p(estimated),p(verified)),/provisional/);
});
test('Guillotine plan contains every internal trimming cut',()=>{
 const p=runStrategies(material,[piece(40,30)],production).fastest;assert.equal(p.sequenceValidated,true);assert.equal(p.cuttingSequence.length,2);assert.ok(p.stats.kerfLossMm2>=0);
 const broken=structuredClone(p);broken.cuttingSequence.pop();assert.equal(validatePlan(broken,{width:100,height:100},[piece(40,30)],{maxSheets:3}).valid,false);
});
test('Kerf blocks pieces that would fit with zero blade width',()=>{
 for(const strategy of ['most_efficient','fastest']){assert.equal(run([piece(50,100,2)],{sheetQuantity:1})[strategy].status,'complete');assert.equal(run([piece(50,100,2)],{sheetQuantity:1,kerf:3})[strategy].status,'incomplete');}
});
test('Mode and sheet selectors never mix layouts or stale results',()=>{
 const plans=runStrategies(fullMaterial,smallPieces),signature='current';
 for(const key of ['baseline','most_efficient','fastest']){const p=activePlan(plans,key,signature,signature);assert.equal(p,plans[key]);assert.equal(layoutSheet(p,0),p.sheets[0]);assert.equal(layoutSheet(p,999),null);}
 assert.equal(activePlan(plans,'fastest','previous',signature),null);
});
test('Seeded stress cases validate real geometry and contain only finite numeric metrics',()=>{
 let state=1234;const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296;};
 for(let job=0;job<20;job++){
  const ps=Array.from({length:10+job%5},(_,i)=>({id:String(i),name:String(i),width:50+Math.floor(random()*1000),height:50+Math.floor(random()*650),quantity:1+Math.floor(random()*2),rotationAllowed:random()>.4}));
  const r=runStrategies(fullMaterial,ps,job%2 ? production : {});
  for(const p of Object.values(r)){assert.equal(validatePlan(p,{width:2440,height:1220},ps,{kerf:3,margin:0,maxSheets:4}).valid,true);for(const value of Object.values(p.stats))if(typeof value==='number')assert.ok(Number.isFinite(value));}
 }
});
