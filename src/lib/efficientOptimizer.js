import { validatePlan } from './planValidation.js';
// Strategy A: MOST EFFICIENT — Save Money & Reduce Waste
// Advanced multi-sheet MaxRects nesting optimizer evaluating multiple heuristics
// (BSSF, BAF, BLSF) across multiple piece sorting orders to minimize sheets and waste.

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
      if (i !== j && contains(rects[j], rects[i]) && (!contains(rects[i], rects[j]) || j < i)) { keep = false; break; }
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

    if (used.x > fr.x + EPS && used.x < fr.x + fr.width - EPS) {
      out.push({ x: fr.x, y: fr.y, width: used.x - fr.x, height: fr.height });
    }
    if (used.x + used.width < fr.x + fr.width - EPS) {
      out.push({ x: used.x + used.width, y: fr.y, width: fr.x + fr.width - (used.x + used.width), height: fr.height });
    }
    if (used.y > fr.y + EPS && used.y < fr.y + fr.height - EPS) {
      out.push({ x: fr.x, y: fr.y, width: fr.width, height: used.y - fr.y });
    }
    if (used.y + used.height < fr.y + fr.height - EPS) {
      out.push({ x: fr.x, y: used.y + used.height, width: fr.width, height: fr.y + fr.height - (used.y + used.height) });
    }
  }
  return pruneFree(out);
}

// Heuristic 1: Best Short Side Fit
function findBSSF(freeRects, pw, ph) {
  let best = null;
  let bestShort = Infinity;
  let bestLong = Infinity;
  for (const fr of freeRects) {
    if (fr.width >= pw - EPS && fr.height >= ph - EPS) {
      const leftoverW = fr.width - pw;
      const leftoverH = fr.height - ph;
      const ss = Math.min(leftoverW, leftoverH);
      const ls = Math.max(leftoverW, leftoverH);
      if (ss < bestShort - EPS || (Math.abs(ss - bestShort) < EPS && ls < bestLong - EPS)) {
        bestShort = ss;
        bestLong = ls;
        best = { x: fr.x, y: fr.y, width: pw, height: ph, score: ss * 2 + ls };
      }
    }
  }
  return best;
}

// Heuristic 2: Best Area Fit
function findBAF(freeRects, pw, ph) {
  let best = null;
  let bestArea = Infinity;
  let bestShort = Infinity;
  for (const fr of freeRects) {
    if (fr.width >= pw - EPS && fr.height >= ph - EPS) {
      const areaFit = fr.width * fr.height - pw * ph;
      const ss = Math.min(fr.width - pw, fr.height - ph);
      if (areaFit < bestArea - EPS || (Math.abs(areaFit - bestArea) < EPS && ss < bestShort - EPS)) {
        bestArea = areaFit;
        bestShort = ss;
        best = { x: fr.x, y: fr.y, width: pw, height: ph, score: areaFit };
      }
    }
  }
  return best;
}

// Heuristic 3: Best Long Side Fit
function findBLSF(freeRects, pw, ph) {
  let best = null;
  let bestLong = Infinity;
  let bestShort = Infinity;
  for (const fr of freeRects) {
    if (fr.width >= pw - EPS && fr.height >= ph - EPS) {
      const leftoverW = fr.width - pw;
      const leftoverH = fr.height - ph;
      const ss = Math.min(leftoverW, leftoverH);
      const ls = Math.max(leftoverW, leftoverH);
      if (ls < bestLong - EPS || (Math.abs(ls - bestLong) < EPS && ss < bestShort - EPS)) {
        bestLong = ls;
        bestShort = ss;
        best = { x: fr.x, y: fr.y, width: pw, height: ph, score: ls * 2 + ss };
      }
    }
  }
  return best;
}

function expandInstances(pieces) {
  const instances = [];
  for (const p of pieces) {
    const qty = Math.max(1, Math.round(Number(p.quantity) || 1));
    for (let i = 0; i < qty; i++) {
      instances.push({
        ...p,
        instanceId: `${p.id}#${i + 1}`,
        origW: p.width,
        origH: p.height,
      });
    }
  }
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
 * Runs a single candidate simulation of MaxRects packing.
 */
function runCandidate(instancesSorted, sheet, options, heuristicFn) {
  const { kerf = 0, margin = 0, maxSheets = Infinity, rotationAllowedGlobal = true } = options;
  const usableW = sheet.width - margin * 2;
  const usableH = sheet.height - margin * 2;

  const sheets = [];
  const unplaced = [];

  for (const inst of instancesSorted) {
    const allowRot = rotationAllowedGlobal && inst.rotationAllowed !== false;
    const fw = inst.width + kerf;
    const fh = inst.height + kerf;

    // Check if piece can fit within sheet bounds at all
    const directFit = inst.width <= usableW + EPS && inst.height <= usableH + EPS;
    const rotatedFit = allowRot && inst.height <= usableW + EPS && inst.width <= usableH + EPS;
    if (!directFit && !rotatedFit) {
      unplaced.push(inst);
      continue;
    }

    let placed = false;
    const limitSheets = Number.isFinite(maxSheets) ? maxSheets : 100;

    for (let s = 0; s < limitSheets && !placed; s++) {
      if (!sheets[s]) { sheets[s] = newSheet(s, sheet.width, sheet.height, margin); sheets[s].freeRects[0].width += kerf; sheets[s].freeRects[0].height += kerf; }
      const free = sheets[s].freeRects;
      const candidates = [];

      if (directFit) {
        const p1 = heuristicFn(free, fw, fh);
        if (p1) candidates.push({ ...p1, rotated: false, pw: inst.width, ph: inst.height });
      }
      if (allowRot && inst.width !== inst.height && rotatedFit) {
        const p2 = heuristicFn(free, fh, fw);
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
        origW: inst.origW,
        origH: inst.origH,
        rotated: chosen.rotated,
        rotationAllowed: allowRot,
      });

      sheets[s].freeRects = splitFree(free, {
        x: chosen.x,
        y: chosen.y,
        width: chosen.width,
        height: chosen.height,
      });
      placed = true;
    }

    if (!placed) unplaced.push(inst);
  }

  const usedSheets = sheets.filter((s) => s && s.placements.length > 0);

  // Compute largest leftover rectangle across used sheets
  let maxFreeArea = 0;
  for (const s of usedSheets) {
    for (const fr of s.freeRects) {
      const a = fr.width * fr.height;
      if (a > maxFreeArea) maxFreeArea = a;
    }
  }

  // Calculate placed area
  let placedArea = 0;
  for (const s of usedSheets) {
    for (const p of s.placements) {
      placedArea += p.w * p.h;
    }
  }

  const totalArea = usedSheets.length * sheet.width * sheet.height;
  const util = totalArea > 0 ? (placedArea / totalArea) * 100 : 0;

  return {
    sheets: usedSheets.map((s) => ({
      index: s.index,
      width: s.width,
      height: s.height,
      placements: s.placements,
    })),
    unplaced,
    utilization: util,
    maxFreeArea,
  };
}

/**
 * Optimizes cut-list layout using Strategy A: MOST EFFICIENT.
 * 
 * Evaluates multiple sorting orders and packing heuristics to deterministically find
 * the minimum-sheet, maximum-utilization valid rectangular nesting.
 */
export function optimizeEfficient(sheet, pieces, options = {}) {
  const instances = expandInstances(pieces);
  if (instances.length === 0) {
    return {
      strategy: 'most_efficient',
      name: 'Most Efficient',
      tagline: 'Save Money & Reduce Waste',
      algorithm: 'MaxRects Multi-Heuristic Nesting',
      sheets: [],
      unplaced: [],
      isGuillotine: false,
    };
  }

  // Define candidate sorting heuristics
  const sortingStrategies = [
    {
      name: 'Max Side Descending',
      sortFn: (a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height),
    },
    {
      name: 'Area Descending',
      sortFn: (a, b) => (b.width * b.height) - (a.width * a.height),
    },
    {
      name: 'Short Side Descending',
      sortFn: (a, b) => Math.min(b.width, b.height) - Math.min(a.width, a.height),
    },
    {
      name: 'Perimeter Descending',
      sortFn: (a, b) => (b.width + b.height) - (a.width + a.height),
    },
    {
      name: 'Aspect Ratio Descending',
      sortFn: (a, b) => {
        const rB = Math.max(b.width, b.height) / Math.min(b.width, b.height);
        const rA = Math.max(a.width, a.height) / Math.min(a.width, a.height);
        return rB - rA;
      },
    },
  ];

  // Define free-rectangle heuristics
  const packingHeuristics = [
    { name: 'BSSF', fn: findBSSF },
    { name: 'BAF', fn: findBAF },
    { name: 'BLSF', fn: findBLSF },
  ];

  let bestResult = null;
  let bestHeuristicName = '';

  // Evaluate candidate permutations
  for (const sortStrat of sortingStrategies) {
    const sorted = [...instances].sort(sortStrat.sortFn);

    for (const packHeur of packingHeuristics) {
      const result = runCandidate(sorted, sheet, options, packHeur.fn);
      if (!validatePlan({...result,strategy:'most_efficient'},sheet,pieces,options).valid) continue;

      // Lexicographic objectives are stable at every supported dimension scale.
      const better = !bestResult || result.unplaced.length < bestResult.unplaced.length ||
        (result.unplaced.length === bestResult.unplaced.length &&
          (result.sheets.length < bestResult.sheets.length ||
           (result.sheets.length === bestResult.sheets.length && result.maxFreeArea > bestResult.maxFreeArea)));
      if (better) {
        bestResult = result;
        bestHeuristicName = `${packHeur.name} (${sortStrat.name})`;
      }
    }
  }

  return {
    strategy: 'most_efficient',
    name: 'Most Efficient',
    tagline: 'Save Money & Reduce Waste',
    algorithm: `MaxRects ${bestHeuristicName}`,
    heuristicUsed: bestHeuristicName,
    sheets: bestResult?.sheets || [],
    unplaced: bestResult?.unplaced || instances,
    isGuillotine: false,
  };
}
