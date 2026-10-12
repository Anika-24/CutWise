// Reconstruct a guillotine sequence without changing placement coordinates.
// Search is bounded; failure means no supported sequence was found, not impossibility.
const EPS = 1e-6;
export function sequenceFromTrees(sheets) {
  const sequence = [];
  for (const sheet of sheets) {
    const walk = node => {
      if (!node?.cut) return;
      const { axis, at, gap, children } = node.cut;
      sequence.push({ sheetIndex: sheet.index, axis, gap,
        x1: node.x + (axis === 'x' ? at : 0), y1: node.y + (axis === 'y' ? at : 0),
        x2: node.x + (axis === 'x' ? at : node.width), y2: node.y + (axis === 'y' ? at : node.height),
        length: axis === 'x' ? node.height : node.width });
      children.forEach(walk);
    };
    walk(sheet.cuttingTree);
  }
  return sequence;
}
export function reconstructCuttingTrees(plan, { margin = 0, kerf = 0 } = {}) {
  let budget = 10000;
  const build = (rect, pieces, depth = 0) => {
    if (--budget < 0 || depth > 250) return null;
    if (!pieces.length) return { ...rect };
    if (pieces.length === 1) {
      const p = pieces[0];
      if (Math.abs(rect.x-p.x) < EPS && Math.abs(rect.y-p.y) < EPS && Math.abs(rect.width-p.w) < EPS && Math.abs(rect.height-p.h) < EPS) return { ...rect, piece: p.instanceId };
    }
    for (const axis of ['x','y']) {
      const dim = axis === 'x' ? 'width' : 'height', pieceDim = axis === 'x' ? 'w' : 'h';
      const candidates = [...new Set(pieces.flatMap(p => [p[axis]+p[pieceDim], p[axis]-kerf]))].sort((a,b) => a-b);
      for (const coordinate of candidates) {
        const at = coordinate-rect[axis];
        if (at <= EPS || at >= rect[dim]-EPS || at+kerf > rect[dim]+EPS) continue;
        const firstPieces = pieces.filter(p => p[axis]+p[pieceDim] <= coordinate+EPS);
        const secondPieces = pieces.filter(p => p[axis] >= coordinate+kerf-EPS);
        if (firstPieces.length+secondPieces.length !== pieces.length) continue;
        const first = build({ ...rect, [dim]: at }, firstPieces, depth+1);
        if (!first) continue;
        const second = build({ ...rect, [axis]: coordinate+kerf, [dim]: rect[dim]-at-kerf }, secondPieces, depth+1);
        if (second) return { ...rect, cut: { axis, at, gap: kerf, children: [first,second] } };
      }
    }
    return null;
  };
  const sheets = [];
  for (const s of plan.sheets) {
    const tree = build({ x: margin, y: margin, width: s.width-2*margin, height: s.height-2*margin }, s.placements);
    if (!tree) return null;
    sheets.push({ ...s, cuttingTree: tree });
  }
  return { ...plan, sheets, hasCuttingTree: true, cuttingSequence: sequenceFromTrees(sheets) };
}
