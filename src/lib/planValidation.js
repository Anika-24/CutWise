// Independent validation of requests, geometry, inventory, identities and cutting trees.
const EPS = 1e-6;
export function expandPieces(pieces) {
  return pieces.flatMap(p => Array.from({length:p.quantity ?? 1},(_,i) => ({...p,instanceId:`${p.id}#${i+1}`})));
}
export function validateInputs(sheet,pieces,options = {}) {
  const errors = [], ids = new Set();
  const positive = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (!positive(sheet.width) || !positive(sheet.height)) errors.push('Sheet dimensions must be positive finite numbers.');
  for (const key of ['kerf','margin']) if (!Number.isFinite(options[key] ?? 0) || (options[key] ?? 0) < 0) errors.push(`${key} must be finite and nonnegative.`);
  if (!Number.isInteger(options.maxSheets ?? 1) || (options.maxSheets ?? 1) < 0) errors.push('Inventory must be a nonnegative integer.');
  if (sheet.width <= 2*(options.margin ?? 0) || sheet.height <= 2*(options.margin ?? 0)) errors.push('Margins leave no usable sheet.');
  let count = 0;
  for (const p of pieces) {
    if (!p.id || ids.has(p.id)) errors.push('Piece IDs must be unique and nonempty.');
    ids.add(p.id);
    if (!positive(p.width) || !positive(p.height)) errors.push(`${p.name}: dimensions must be positive finite numbers.`);
    if (!Number.isInteger(p.quantity ?? 1) || (p.quantity ?? 1) < 1) errors.push(`${p.name}: quantity must be a positive integer.`);
    count += p.quantity ?? 1;
  }
  if (!Number.isFinite(sheet.width*sheet.height) || pieces.some(p => !Number.isFinite(p.width*p.height))) errors.push('Dimensions exceed supported numeric range.');
  if (count > 2000) errors.push('Search limit: 2,000 pieces. Split this job into batches.');
  return {valid:!errors.length,errors};
}
export function validatePlan(plan,sheet,pieces,options = {}) {
  const input = validateInputs(sheet,pieces,options);
  if (!input.valid) return input;
  const errors = [], warnings = [], expected = new Map(expandPieces(pieces).map(p => [p.instanceId,p]));
  const seen = new Set(), indices = new Set(), stockIds = new Set(), sequence = [];
  const kerf = options.kerf ?? 0, margin = options.margin ?? 0;
  if (!Array.isArray(plan.sheets) || !Array.isArray(plan.unplaced)) return {valid:false,errors:['Missing layout arrays.']};
  for (const s of plan.sheets) {
    if (!Number.isInteger(s.index) || s.index < 0 || indices.has(s.index)) errors.push('Invalid or duplicate sheet assignment.');
    indices.add(s.index);
    const assigned = options.stocks ? options.stocks.find(a=>a.id===s.stockId) : sheet;
    if(options.stocks && (!assigned || stockIds.has(s.stockId))) errors.push('Unknown or duplicate stock unit.');
    stockIds.add(s.stockId);
    if(options.stocks && assigned && (s.stockKind!==assigned.stockKind || s.offcutId!==assigned.offcutId)) errors.push('Incorrect stock identity or purchasing category.');
    if (!assigned || s.width !== assigned.width || s.height !== assigned.height) errors.push('Incorrect assigned sheet dimensions.');
    if (!Array.isArray(s.placements)) {errors.push('Missing placements array.');continue;}
    for (const p of s.placements) {
      const req = expected.get(p.instanceId);
      if (!req || seen.has(p.instanceId)) errors.push(`Unknown or duplicate piece: ${p.instanceId}.`);
      seen.add(p.instanceId);
      if (![p.x,p.y,p.w,p.h].every(Number.isFinite) || p.w <= 0 || p.h <= 0) errors.push(`Invalid placement: ${p.instanceId}.`);
      if (req && (p.pieceId !== req.id || p.w !== (p.rotated ? req.height : req.width) || p.h !== (p.rotated ? req.width : req.height))) errors.push(`Incorrect dimensions or identity: ${p.instanceId}.`);
      if (p.rotated && (options.rotationAllowedGlobal === false || req?.rotationAllowed === false)) errors.push(`Rotation forbidden: ${p.instanceId}.`);
      if (p.x < margin-EPS || p.y < margin-EPS || p.x+p.w > s.width-margin+EPS || p.y+p.h > s.height-margin+EPS) errors.push(`Out of bounds: ${p.instanceId}.`);
    }
    for (let i=0;i<s.placements.length;i++) for (let j=i+1;j<s.placements.length;j++) {
      const a=s.placements[i],b=s.placements[j];
      if (!(a.x+a.w+kerf <= b.x+EPS || b.x+b.w+kerf <= a.x+EPS || a.y+a.h+kerf <= b.y+EPS || b.y+b.h+kerf <= a.y+EPS)) errors.push(`Overlap or insufficient kerf: ${a.instanceId}, ${b.instanceId}.`);
    }
    if ((plan.strategy === 'fastest' || plan.hasCuttingTree === true)) {
      const leaves = new Map();
      const visited = new Set();
      const walk = (node,rect,depth = 0) => {
        if (depth > 1000 || visited.has(node)) {errors.push('Cyclic or excessive cutting tree.');return;}
        visited.add(node);
        if (!node || !['x','y','width','height'].every(k => Number.isFinite(node[k]) && Math.abs(node[k]-rect[k]) <= EPS)) {errors.push('Invalid cutting-tree workpiece.');return;}
        if (node.piece) { if (node.cut || leaves.has(node.piece)) errors.push('Duplicate or nonterminal piece leaf.'); leaves.set(node.piece,node);return; }
        if (!node.cut) return;
        const {axis,at,gap,children} = node.cut, size = axis === 'x' ? rect.width : rect.height;
        if (!['x','y'].includes(axis) || !Number.isFinite(at) || !Number.isFinite(gap) || at<=0 || at>=size || Math.abs(gap-kerf)>EPS || at+gap>size+EPS || children?.length!==2) {errors.push('Invalid guillotine split.');return;}
        sequence.push({sheetIndex:s.index,axis,gap,x1:node.x+(axis==='x'?at:0),y1:node.y+(axis==='y'?at:0),x2:node.x+(axis==='x'?at:node.width),y2:node.y+(axis==='y'?at:node.height),length:axis==='x'?node.height:node.width});
        walk(children[0],{...rect,[axis==='x'?'width':'height']:at},depth+1);
        walk(children[1],{...rect,[axis]:rect[axis]+at+gap,[axis==='x'?'width':'height']:size-at-gap},depth+1);
      };
      walk(s.cuttingTree,{x:margin,y:margin,width:s.width-2*margin,height:s.height-2*margin});
      for (const p of s.placements) {
        const leaf = leaves.get(p.instanceId);
        if (!leaf || Math.abs(leaf.x-p.x)>EPS || Math.abs(leaf.y-p.y)>EPS || Math.abs(leaf.width-p.w)>EPS || Math.abs(leaf.height-p.h)>EPS) errors.push(`Cut tree does not isolate ${p.instanceId}.`);
      }
      if (leaves.size!==s.placements.length) errors.push('Unexpected cut-tree leaves.');
    }
  }
  for (const p of plan.unplaced) {if (!expected.has(p.instanceId) || seen.has(p.instanceId)) errors.push(`Invalid unplaced identity: ${p.instanceId}.`);seen.add(p.instanceId);}
  for (const id of expected.keys()) if (!seen.has(id)) errors.push(`Missing piece: ${id}.`);
  if (plan.sheets.filter(s=>!options.stocks || s.stockKind==='purchased').length>(options.maxSheets ?? 1)) errors.push('Inventory exceeded.');
  if ((plan.strategy === 'fastest' || plan.hasCuttingTree === true) && (plan.cuttingSequence?.length !== sequence.length || sequence.some((c,i) => Object.keys(c).some(k => typeof c[k] === 'number' ? !Number.isFinite(plan.cuttingSequence[i]?.[k]) || Math.abs(c[k]-plan.cuttingSequence[i]?.[k])>EPS : c[k]!==plan.cuttingSequence[i]?.[k])))) errors.push('Cut sequence does not match the verified cutting tree.');
  if (plan.unplaced.length) warnings.push('Partial layout: not a complete job cost.');
  return {valid:!errors.length,errors,warnings};
}
