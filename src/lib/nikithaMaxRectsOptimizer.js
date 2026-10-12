// Nikitha's MaxRects optimizer preserved alongside Jinal's strategy optimizer.

// MaxRects (Best Short Side Fit) rectangular sheet packing.
// All units are millimeters. The optimizer is pure and UI-independent.

const EPS = 1e-6;

function contains(a, b) {
  return a.x <= b.x + EPS && a.y <= b.y + EPS &&
    a.x + a.width >= b.x + b.width - EPS &&
    a.y + a.height >= b.y + b.height - EPS;
}

function pruneFree(rects) {
  const out = [];
  for (let i = 0; i < rects.length; i++) {
    let keep = true;
    for (let j = 0; j < rects.length; j++) {
      if (i !== j && contains(rects[j], rects[i])) { keep = false; break; }
    }
    if (keep) out.push(rects[i]);
  }
  return out;
}

function splitFree(freeRects, used) {
  const out = [];
  for (const fr of freeRects) {
    const noOverlap =
      used.x >= fr.x + fr.width - EPS || used.x + used.width <= fr.x + EPS ||
      used.y >= fr.y + fr.height - EPS || used.y + used.height <= fr.y + EPS;
    if (noOverlap) { out.push(fr); continue; }
    if (used.x > fr.x + EPS && used.x < fr.x + fr.width - EPS)
      out.push({ x: fr.x, y: fr.y, width: used.x - fr.x, height: fr.height });
    if (used.x + used.width < fr.x + fr.width - EPS)
      out.push({ x: used.x + used.width, y: fr.y, width: fr.x + fr.width - (used.x + used.width), height: fr.height });
    if (used.y > fr.y + EPS && used.y < fr.y + fr.height - EPS)
      out.push({ x: fr.x, y: fr.y, width: fr.width, height: used.y - fr.y });
    if (used.y + used.height < fr.y + fr.height - EPS)
      out.push({ x: fr.x, y: used.y + used.height, width: fr.width, height: fr.y + fr.height - (used.y + used.height) });
  }
  return pruneFree(out);
}

// Best Short Side Fit — returns best position + a score (lower is better).
function findBSSF(freeRects, pw, ph) {
  let best = null;
  let bestShort = Infinity;
  let bestLong = Infinity;
  for (const fr of freeRects) {
    if (fr.width >= pw - EPS && fr.height >= ph - EPS) {
      const lh = fr.width - pw;
      const lv = fr.height - ph;
      const ss = Math.min(lh, lv);
      const ls = Math.max(lh, lv);
      if (ss < bestShort - EPS || (Math.abs(ss - bestShort) < EPS && ls < bestLong - EPS)) {
        bestShort = ss;
        bestLong = ls;
        best = { x: fr.x, y: fr.y, width: pw, height: ph, score: ss * 2 + ls };
      }
    }
  }
  return best;
}

function expandInstances(pieces) {
  const instances = [];
  for (const p of pieces) {
    const qty = Math.max(1, Math.round(p.quantity || 1));
    for (let i = 0; i < qty; i++) {
      instances.push({
        ...p,
        instanceId: `${p.id}#${i + 1}`,
        origW: p.width,
        origH: p.height,
      });
    }
  }
  // Sort by max side descending — a strong general heuristic for BSSF.
  instances.sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));
  return instances;
}

function newSheet(index, width, height, margin) {
  return {
    index,
    width,
    height,
    freeRects: [{ x: margin, y: margin, width: width - margin * 2, height: height - margin * 2 }],
    placements: [],
  };
}

/**
 * Run the MaxRects-BSSF optimizer.
 * @param {object} sheet   { width, height } in mm
 * @param {array}  pieces  [{ id, name, width, height, quantity, rotationAllowed, color }]
 * @param {object} options { kerf, margin, maxSheets, rotationAllowedGlobal }
 */
export function optimizeLayout(sheet, pieces, options = {}) {
  const { kerf = 0, margin = 0, maxSheets = 1, rotationAllowedGlobal = true } = options;
  const usableW = sheet.width - margin * 2;
  const usableH = sheet.height - margin * 2;

  const instances = expandInstances(pieces);
  const sheets = [];
  const unplaced = [];

  for (const inst of instances) {
    const allowRot = rotationAllowedGlobal && inst.rotationAllowed !== false;
    const fw = inst.width + kerf;
    const fh = inst.height + kerf;

    // Piece too big for any sheet -> unplaced immediately.
    if (fw > usableW + EPS || fh > usableH + EPS) {
      // still try rotated if allowed and different
      const canRotFit = allowRot && inst.width !== inst.height &&
        fh <= usableW + EPS && fw <= usableH + EPS;
      if (!canRotFit) { unplaced.push(inst); continue; }
    }

    let placed = false;
    for (let s = 0; s < maxSheets && !placed; s++) {
      if (!sheets[s]) sheets[s] = newSheet(s, sheet.width, sheet.height, margin);
      const free = sheets[s].freeRects;
      const candidates = [];

      const p1 = findBSSF(free, fw, fh);
      if (p1) candidates.push({ ...p1, rotated: false, pw: inst.width, ph: inst.height });
      if (allowRot && inst.width !== inst.height) {
        const p2 = findBSSF(free, fh, fw);
        if (p2) candidates.push({ ...p2, rotated: true, pw: inst.height, ph: inst.width });
      }
      if (!candidates.length) continue;

      candidates.sort((a, b) => a.score - b.score);
      const chosen = candidates[0];
      sheets[s].placements.push({
        instanceId: inst.instanceId,
        pieceId: inst.id,
        name: inst.name,
        color: inst.color,
        x: chosen.x,
        y: chosen.y,
        w: chosen.pw,
        h: chosen.ph,
        rotated: chosen.rotated,
        rotationAllowed: allowRot,
      });
      sheets[s].freeRects = splitFree(free, { x: chosen.x, y: chosen.y, width: chosen.width, height: chosen.height });
      placed = true;
    }
    if (!placed) unplaced.push(inst);
  }

  const usedSheets = sheets.filter((s) => s && s.placements.length > 0);
  return {
    sheets: usedSheets.map((s) => ({ index: s.index, width: s.width, height: s.height, placements: s.placements })),
    unplaced,
    algorithm: 'MaxRects-BSSF',
  };
}

/**
 * Baseline row/shelf packing — same inputs, simpler strategy, for before/after.
 */
export function baselineLayout(sheet, pieces, options = {}) {
  const { kerf = 0, margin = 0, maxSheets = 1, rotationAllowedGlobal = true } = options;
  const usableW = sheet.width - margin * 2;
  const usableH = sheet.height - margin * 2;

  const instances = expandInstances(pieces);
  // Sort by height descending for shelf packing.
  instances.sort((a, b) => b.height - a.height);

  const sheets = [newSheet(0, sheet.width, sheet.height, margin)];
  const unplaced = [];
  let curX = margin;
  let curY = margin;
  let rowH = 0;

  const place = (sIdx, inst, x, y, rotated) => {
    sheets[sIdx].placements.push({
      instanceId: inst.instanceId,
      pieceId: inst.id,
      name: inst.name,
      color: inst.color,
      x, y,
      w: rotated ? inst.height : inst.width,
      h: rotated ? inst.width : inst.height,
      rotated,
      rotationAllowed: rotationAllowedGlobal && inst.rotationAllowed !== false,
    });
  };

  for (const inst of instances) {
    const w = inst.width;
    const h = inst.height;
    if (w > usableW + EPS || h > usableH + EPS) { unplaced.push(inst); continue; }

    let sIdx = sheets.length - 1;
    // Try to place in the current row.
    if (curX + w <= margin + usableW + EPS && curY + Math.max(rowH, h) <= margin + usableH + EPS) {
      place(sIdx, inst, curX, curY, false);
      curX += w + kerf;
      rowH = Math.max(rowH, h);
      continue;
    }
    // Start a new row.
    curX = margin;
    curY += rowH + kerf;
    rowH = h;
    if (curY + h > margin + usableH + EPS) {
      // Need a new sheet.
      if (sheets.length < maxSheets) {
        sheets.push(newSheet(sheets.length, sheet.width, sheet.height, margin));
        sIdx = sheets.length - 1;
        curX = margin;
        curY = margin;
        rowH = h;
      } else {
        unplaced.push(inst);
        continue;
      }
    }
    place(sIdx, inst, curX, curY, false);
    curX += w + kerf;
  }

  const usedSheets = sheets.filter((s) => s.placements.length > 0);
  return {
    sheets: usedSheets.map((s) => ({ index: s.index, width: s.width, height: s.height, placements: s.placements })),
    unplaced,
    algorithm: 'Row/Shelf',
  };
}
