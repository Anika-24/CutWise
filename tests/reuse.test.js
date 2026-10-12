import test from 'node:test';
import assert from 'node:assert/strict';
import {runStrategies} from '../src/lib/optimizationEngine.js';
import {detectOffcuts} from '../src/lib/offcutGeometry.js';
import {emptyInventory,inventoryTransition,compatible} from '../src/lib/reuseInventory.js';
import {suggestIdeas} from '../src/lib/reuseIdeas.js';
import {validatePlan} from '../src/lib/planValidation.js';
const material={type:'plywood',thickness:18,sheetWidth:500,sheetHeight:400,sheetQuantity:2,kerf:3,edgeMargin:5,rotationAllowed:true,pricePerSheet:40};
const piece=(width,height,quantity=1)=>({id:'p',name:'Panel',width,height,quantity,rotationAllowed:true});
const scrap=(id,width=300,height=200,patch={})=>({id,width,height,materialType:'plywood',thickness:18,shape:'rectangle',quantity:1,status:'Available',...patch});
test('Mixed-size stock places actual instances, respects kerf and charges only purchased sheets',()=>{
  for(const strategy of ['most_efficient','fastest']){
    const stock=[scrap('a'),scrap('b',200,180)];
    const plan=runStrategies({...material,sheetWidth:200,sheetHeight:180,sheetQuantity:1},[piece(170,150,3)],{},stock,'new')[strategy];
    assert.equal(plan.status,'complete',JSON.stringify(plan.validation));assert.equal(plan.stats.totalCost,40);assert.equal(plan.stats.purchasedSheets,1);assert.equal(plan.stats.reusedOffcuts,2);
    assert.equal(new Set(plan.sheets.flatMap(s=>s.placements.map(p=>p.instanceId))).size,3);
    const tampered=structuredClone(plan);tampered.sheets[0].width+=1;
    assert.equal(validatePlan(tampered,{width:200,height:180},[piece(170,150,3)],{kerf:3,margin:5,maxSheets:2,stocks:plan.stocks}).valid,false);
  }
});
test('Exact stock limits and material compatibility prevent false fits',()=>{
  const m={...material,sheetQuantity:0};
  for(const strategy of ['most_efficient','fastest']){
    assert.equal(runStrategies(m,[piece(190,140)],{},[scrap('a',200,150)])[strategy].status,'complete');
    assert.equal(runStrategies(m,[piece(191,141)],{},[scrap('a',200,150)])[strategy].status,'incomplete');
    assert.equal(runStrategies(m,[piece(100,100,2)],{},[scrap('a',120,120)])[strategy].unplaced.length,1);
  }
  for(const patch of [{materialType:'mdf'},{thickness:12},{shape:'polygon'},{status:'Used'},{status:'Reserved',reservedBy:'other'}])assert.equal(compatible(scrap('a',300,200,patch),m,'new'),false);
  assert.equal(runStrategies(m,[piece(100,100,2)],{},[scrap('a',212,120)]).most_efficient.status,'incomplete');
});
function disjoint(a,b){return a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y;}
test('Tree and irregular free-space candidates are disjoint and exclude margins and occupied geometry',()=>{
  const plans=runStrategies(material,[piece(180,130)]);
  const tree=detectOffcuts(plans.fastest,material,'source');assert.ok(tree.candidates.length>=2);
  const max=structuredClone(plans.most_efficient);max.sequenceValidated=false;
  const estimates=detectOffcuts(max,material,'source');assert.ok(estimates.candidates.length>=2);
  for(const result of [tree,estimates]){
    assert.ok(result.estimatedArea<=plans.fastest.stats.leftoverAreaMm2);
    result.candidates.forEach((r,i)=>{assert.ok(r.x>=5 && r.y>=5 && r.x+r.width<=495 && r.y+r.height<=395);result.candidates.slice(i+1).forEach(b=>assert.ok(disjoint(r,b)));});
  }
  for(const r of estimates.candidates)for(const p of max.sheets[0].placements)assert.ok(disjoint(r,{x:p.x-3,y:p.y-3,width:p.w+6,height:p.h+6}));
});
test('Reservation conflicts, cancellation, confirmed consumption and reload preserve unique physical identity',()=>{
  let state={...emptyInventory(),offcuts:[scrap('a')]};
  const reserve={type:'reserve',projectId:'second',ids:['a']};
  state=inventoryTransition(state,reserve);
  assert.throws(()=>inventoryTransition(state,{...reserve,projectId:'third'}),/reserved/);
  state=inventoryTransition(state,{type:'release',projectId:'second'});assert.equal(state.offcuts[0].status,'Available');
  state=inventoryTransition(state,reserve);
  state=inventoryTransition(state,{type:'produce',projectId:'second',ids:['a'],production:{projectName:'Second project',material,candidates:[{id:'remainder',sourceSheetId:'a',width:150,height:100,shape:'rectangle',quantity:1}]}});
  assert.equal(state.offcuts[0].status,'Used');
  assert.throws(()=>inventoryTransition(state,reserve),/consumed/);
  assert.throws(()=>inventoryTransition(state,{type:'capture',projectId:'second',records:[{id:'remainder',width:151,height:100}]}),/dimensions/);
  state=inventoryTransition(state,{type:'capture',projectId:'second',records:[{id:'remainder',width:140,height:100,notes:'Measured'}]});
  const restored=JSON.parse(JSON.stringify(state));assert.deepEqual(restored,state);assert.equal(restored.offcuts[1].sourceProjectId,'second');
  assert.throws(()=>inventoryTransition(restored,{type:'capture',projectId:'second',records:[]}),/once/);
  assert.throws(()=>inventoryTransition(restored,{type:'produce',projectId:'second',ids:[],production:{}}),/already confirmed/);
});
test('Small scraps produce no invented ideas; feasible catalog ideas use no purchased stock',()=>{
  assert.equal(suggestIdeas([scrap('tiny',55,55)],material).length,0);
  const ideas=suggestIdeas([scrap('big',800,600)],material);assert.ok(ideas.length>0);
  for(const idea of ideas){assert.equal(idea.plan.status,'complete');assert.equal(idea.plan.stats.purchasedSheets,0);assert.equal(idea.plan.stats.totalCost,0);assert.deepEqual(idea.offcutIds,['big']);}
});
test('Avoided purchases require comparable complete plans and duplicate stock cannot multiply inventory',()=>{
  const pieces=[piece(180,130)];
  const reused=runStrategies(material,pieces,{},[scrap('a')]).most_efficient;
  assert.deepEqual({sheets:reused.avoidedPurchases.sheets,cost:reused.avoidedPurchases.cost},{sheets:1,cost:40});
  const noNewStock=runStrategies({...material,sheetQuantity:0},pieces,{},[scrap('a')]).most_efficient;
  assert.equal(noNewStock.stats.purchasedSheets,0);
  assert.equal(noNewStock.avoidedPurchases.cost,40);
  assert.equal(noNewStock.avoidedPurchases.baselineCost,40);
  const duplicated=runStrategies({...material,sheetQuantity:0},[piece(170,150,2)],{},[scrap('a'),scrap('a')]).most_efficient;
  assert.equal(duplicated.status,'invalid');
});
test('Reuse honors forbidden rotation and original complete sheet plans remain candidates',()=>{
  const stock=[scrap('a',220,140)];const m={...material,sheetQuantity:0,edgeMargin:0,rotationAllowed:false};
  assert.equal(runStrategies(m,[piece(130,200)],{},stock).most_efficient.status,'incomplete');
  assert.equal(runStrategies({...m,rotationAllowed:true},[piece(130,200)],{},stock).most_efficient.status,'complete');
  const pieces=[piece(180,130,6)];const original=runStrategies(material,pieces).most_efficient;
  const selected=runStrategies(material,pieces,{},[scrap('tiny',60,60)]).most_efficient;
  assert.equal(selected.status,original.status);assert.ok(selected.stats.totalCost<=original.stats.totalCost);
});
test('Skipped recovery never creates stock and measurements cannot inflate available area',()=>{
  let state=inventoryTransition(emptyInventory(),{type:'produce',projectId:'one',ids:[],production:{projectName:'One',material,candidates:[{id:'left',width:100,height:100}]}});
  assert.equal(state.offcuts.length,0);
  assert.throws(()=>inventoryTransition(state,{type:'capture',projectId:'one',records:[{id:'left',width:Infinity,height:100}]}),/dimensions/);
  state=inventoryTransition(state,{type:'capture',projectId:'one',records:[]});assert.equal(state.offcuts.length,0);assert.equal(state.productions[0].captureDone,true);
});

test('Hypothetical new-sheet baseline has enough sheets without changing actual inventory',()=>{
  const m={...material,sheetWidth:220,sheetHeight:160,sheetQuantity:0};
  const stock=[scrap('a',220,160),scrap('b',220,160),scrap('c',220,160)];
  for(const strategy of ['most_efficient','fastest']){
    const plan=runStrategies(m,[piece(180,130,3)],{},stock)[strategy];
    assert.equal(plan.status,'complete');assert.equal(plan.stats.purchasedSheets,0);
    assert.equal(plan.stats.totalCost,0);assert.equal(plan.stats.reusedOffcuts,3);
    assert.equal(plan.avoidedPurchases.baselinePurchasedSheets,3);
    assert.equal(plan.avoidedPurchases.baselineCost,120);assert.equal(plan.avoidedPurchases.cost,120);
    assert.equal(m.sheetQuantity,0);
    assert.equal(runStrategies(m,[piece(180,130,4)],{},stock)[strategy].status,'incomplete');
  }
});

test('Purchasing comparison verifies current material and configured price, not historical offcut cost',()=>{
  const m={...material,type:'mdf',thickness:12,pricePerSheet:27,sheetQuantity:0};
  const stock=[scrap('mdf',300,200,{materialType:'mdf',thickness:12,pricePerSheet:999})];
  for(const strategy of ['most_efficient','fastest']){
    const plan=runStrategies(m,[piece(180,130)],{},stock)[strategy];
    assert.equal(plan.avoidedPurchases.actualCost,0);assert.equal(plan.avoidedPurchases.baselineCost,27);
    assert.equal(plan.avoidedPurchases.materialType,'mdf');assert.equal(plan.avoidedPurchases.thickness,12);
    for(const patch of [{type:''},{thickness:null},{pricePerSheet:null},{pricePerSheet:''},{pricePerSheet:-1}]){
      const invalid=runStrategies({...m,...patch},[piece(180,130)],{},stock)[strategy];
      assert.equal(invalid.avoidedPurchases,null);assert.ok(invalid.comparisonUnavailableReason);
    }
  }
});

test('Unavailable comparisons stay distinct from verified zero and incomplete new-sheet baselines',()=>{
  for(const strategy of ['most_efficient','fastest']){
    const purchased=runStrategies(material,[piece(180,130)])[strategy];
    assert.equal(purchased.avoidedPurchases.cost,0);assert.equal(purchased.comparisonUnavailableReason,null);
    const tooSmall={...material,sheetWidth:150,sheetHeight:150,sheetQuantity:0};
    const reused=runStrategies(tooSmall,[piece(180,130)],{},[scrap('large')])[strategy];
    assert.equal(reused.status,'complete');assert.equal(reused.avoidedPurchases,null);
    assert.match(reused.comparisonUnavailableReason,/baseline could not place every piece/);
    const incomplete=runStrategies({...material,sheetQuantity:0},[piece(180,130,2)],{},[scrap('one',220,160)])[strategy];
    assert.equal(incomplete.status,'incomplete');assert.equal(incomplete.avoidedPurchases,null);
  }
});

test('Stock counts follow consumed plan stock across quantities, mixed sizes and excluded inventory',()=>{
  const m={...material,sheetWidth:220,sheetHeight:160,sheetQuantity:1};
  const stock=[scrap('a',220,160),scrap('b',220,160),scrap('unused',60,60),
    scrap('wrong-material',220,160,{materialType:'mdf'}),scrap('used',220,160,{status:'Used'})];
  for(const strategy of ['most_efficient','fastest']){
    for(const [quantity,purchased,reused] of [[1,0,1],[2,0,2],[3,1,2]]){
      const plan=runStrategies(m,[piece(180,130,quantity)],{},stock)[strategy];
      assert.equal(plan.status,'complete');assert.equal(plan.stats.purchasedSheets,purchased);
      assert.equal(plan.stats.reusedOffcuts,reused);assert.equal(plan.stats.sheetsUsed,purchased+reused);
      assert.equal(plan.sheets.filter(s=>s.placements.length>0).length,purchased+reused);
      assert.equal(plan.stats.totalCost,purchased*m.pricePerSheet);
      assert.equal(plan.avoidedPurchases.actualCost,plan.stats.totalCost);
      assert.ok(plan.sheets.every(s=>!['unused','wrong-material','used'].includes(s.offcutId)));
    }
    const none=runStrategies(m,[piece(180,130)],{},[scrap('unused',60,60)])[strategy];
    assert.equal(none.stats.reusedOffcuts,0);assert.equal(none.avoidedPurchases.cost,0);
  }
});

test('Material thickness and supplied grade/subtype mismatches cannot contribute stock or savings',()=>{
  const m={...material,sheetQuantity:0};
  for(const patch of [{materialType:'mdf'},{thickness:12},{grade:'exterior'},{subtype:'different'},
    {status:'Reserved',reservedBy:'another-project'}]){
    const plan=runStrategies(m,[piece(180,130)],{},[scrap('incompatible',300,200,patch)]).most_efficient;
    assert.equal(plan.stats.reusedOffcuts,0);assert.equal(plan.avoidedPurchases,null);
    assert.equal(plan.rejectedStock.length,1);
  }
});
