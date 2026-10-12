// Strategy B: FASTEST — Save Time & Simplify Cutting
// Implements a genuinely different guillotine-oriented cutting strategy
// that produces strictly guillotine-compatible cutting layouts with an ordered cutting sequence.

const EPS = 1e-4;

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

/**
 * Strategy B Candidate 1: Strip-Guillotine (Rip-first, Height Clustered)
 * 
 * In commercial panel saws, operators rip the full sheet horizontally into strips of uniform
 * height, then make straight cross-cuts across each strip.
 * This guarantees 100% straight guillotine cuts, minimizes fence resets, and cuts physical saw time.
 */
function packStripGuillotineHorizontal(instances, sheet, options) {
  const { kerf = 0, margin = 0, maxSheets = Infinity, rotationAllowedGlobal = true } = options;
  const usableW = sheet.width - margin * 2;
  const usableH = sheet.height - margin * 2;

  // Group pieces to align heights (or widths if rotated) to minimize strip height changes
  const pending = instances.map((inst) => {
    const allowRot = rotationAllowedGlobal && inst.rotationAllowed !== false;
    let w = inst.width;
    let h = inst.height;
    let rotated = false;

    // Prefer orientation that aligns with existing piece dimensions or minimizes height
    if (allowRot && inst.width !== inst.height) {
      if (inst.width < inst.height) {
        // Lay down horizontally to produce lower strip heights and longer continuous rips
        w = inst.height;
        h = inst.width;
        rotated = true;
      }
    }
    return { ...inst, w, h, rotated };
  });

  // Sort primarily by height descending so strips pack tightly, then width descending
  pending.sort((a, b) => b.h - a.h || b.w - a.w);

  const sheets = [];
  const cuts = [];
  const unplaced = [];
  let cutCounter = 1;

  for (const inst of pending) {
    const fw = inst.w + kerf;
    const fh = inst.h + kerf;

    // Check bounds
    if (fw > usableW + EPS || fh > usableH + EPS) {
      // Try alternate rotation if allowed
      const allowRot = rotationAllowedGlobal && inst.rotationAllowed !== false;
      if (allowRot && inst.width !== inst.height) {
        const altW = inst.h;
        const altH = inst.w;
        if (altW + kerf <= usableW + EPS && altH + kerf <= usableH + EPS) {
          inst.w = altW;
          inst.h = altH;
          inst.rotated = !inst.rotated;
        } else {
          unplaced.push(inst);
          continue;
        }
      } else {
        unplaced.push(inst);
        continue;
      }
    }

    let placed = false;
    const limitSheets = Number.isFinite(maxSheets) && maxSheets > 0 ? maxSheets : 100;

    for (let sIdx = 0; sIdx < limitSheets && !placed; sIdx++) {
      if (!sheets[sIdx]) {
        sheets[sIdx] = {
          index: sIdx,
          width: sheet.width,
          height: sheet.height,
          placements: [],
          strips: [], // each strip: { y, h, curX, placements: [] }
          curY: margin,
        };
      }

      const s = sheets[sIdx];

      // Try placing into an existing strip of compatible height
      for (const strip of s.strips) {
        if (Math.abs(strip.h - inst.h) <= 1.0 || strip.h >= inst.h) {
          if (strip.curX + inst.w <= margin + usableW + EPS) {
            s.placements.push({
              instanceId: inst.instanceId,
              pieceId: inst.id,
              name: inst.name,
              color: inst.color,
              x: strip.curX,
              y: strip.y,
              w: inst.w,
              h: inst.h,
              origW: inst.origW,
              origH: inst.origH,
              rotated: inst.rotated,
              rotationAllowed: rotationAllowedGlobal && inst.rotationAllowed !== false,
            });

            // Cross cut to separate this piece from the strip
            cuts.push({
              id: `cut-${cutCounter++}`,
              step: cuts.length + 1,
              sheetIndex: sIdx,
              stage: 'cross_cut',
              orientation: 'vertical',
              x1: strip.curX + inst.w,
              y1: strip.y,
              x2: strip.curX + inst.w,
              y2: strip.y + strip.h,
              length: strip.h,
              description: `Cross cut strip vertically at X=${Math.round(strip.curX + inst.w)}mm to separate "${inst.name}"`,
            });

            strip.curX += inst.w + kerf;
            placed = true;
            break;
          }
        }
      }

      if (placed) break;

      // Start a new horizontal strip on this sheet if space remains
      if (s.curY + inst.h <= margin + usableH + EPS) {
        const stripY = s.curY;
        const stripH = inst.h;

        // Rip cut across the entire usable width of the sheet
        cuts.push({
          id: `cut-${cutCounter++}`,
          step: cuts.length + 1,
          sheetIndex: sIdx,
          stage: 'rip_cut',
          orientation: 'horizontal',
          x1: margin,
          y1: stripY + stripH,
          x2: sheet.width - margin,
          y2: stripY + stripH,
          length: sheet.width - margin * 2,
          description: `Rip cut Sheet ${sIdx + 1} horizontally from edge to edge at Y=${Math.round(stripY + stripH)}mm`,
        });

        const newStrip = {
          y: stripY,
          h: stripH,
          curX: margin + inst.w + kerf,
        };

        s.placements.push({
          instanceId: inst.instanceId,
          pieceId: inst.id,
          name: inst.name,
          color: inst.color,
          x: margin,
          y: stripY,
          w: inst.w,
          h: inst.h,
          origW: inst.origW,
          origH: inst.origH,
          rotated: inst.rotated,
          rotationAllowed: rotationAllowedGlobal && inst.rotationAllowed !== false,
        });

        // Cross cut separating first piece of the new strip
        cuts.push({
          id: `cut-${cutCounter++}`,
          step: cuts.length + 1,
          sheetIndex: sIdx,
          stage: 'cross_cut',
          orientation: 'vertical',
          x1: margin + inst.w,
          y1: stripY,
          x2: margin + inst.w,
          y2: stripY + stripH,
          length: stripH,
          description: `Cross cut strip vertically at X=${Math.round(margin + inst.w)}mm to separate "${inst.name}"`,
        });

        s.strips.push(newStrip);
        s.curY += stripH + kerf;
        placed = true;
        break;
      }
    }

    if (!placed) unplaced.push(inst);
  }

  const usedSheets = sheets.filter((s) => s && s.placements.length > 0);
  return {
    sheets: usedSheets.map((s) => ({
      index: s.index,
      width: s.width,
      height: s.height,
      placements: s.placements,
    })),
    cuts,
    unplaced,
    type: 'Strip-Guillotine (Rip-first)',
  };
}

/**
 * Strategy B Candidate 2: Strip-Guillotine (Vertical Columns / Cross-first)
 * Rips columns vertically from top to bottom, then cuts strips horizontally.
 */
function packStripGuillotineVertical(instances, sheet, options) {
  const { kerf = 0, margin = 0, maxSheets = Infinity, rotationAllowedGlobal = true } = options;
  const usableW = sheet.width - margin * 2;
  const usableH = sheet.height - margin * 2;

  const pending = instances.map((inst) => {
    const allowRot = rotationAllowedGlobal && inst.rotationAllowed !== false;
    let w = inst.width;
    let h = inst.height;
    let rotated = false;
    if (allowRot && inst.width !== inst.height && inst.height < inst.width) {
      w = inst.height;
      h = inst.width;
      rotated = true;
    }
    return { ...inst, w, h, rotated };
  });

  pending.sort((a, b) => b.w - a.w || b.h - a.h);

  const sheets = [];
  const cuts = [];
  const unplaced = [];
  let cutCounter = 1;

  for (const inst of pending) {
    const fw = inst.w + kerf;
    const fh = inst.h + kerf;

    if (fw > usableW + EPS || fh > usableH + EPS) {
      const allowRot = rotationAllowedGlobal && inst.rotationAllowed !== false;
      if (allowRot && inst.width !== inst.height) {
        const altW = inst.h;
        const altH = inst.w;
        if (altW + kerf <= usableW + EPS && altH + kerf <= usableH + EPS) {
          inst.w = altW;
          inst.h = altH;
          inst.rotated = !inst.rotated;
        } else {
          unplaced.push(inst);
          continue;
        }
      } else {
        unplaced.push(inst);
        continue;
      }
    }

    let placed = false;
    const limitSheets = Number.isFinite(maxSheets) && maxSheets > 0 ? maxSheets : 100;

    for (let sIdx = 0; sIdx < limitSheets && !placed; sIdx++) {
      if (!sheets[sIdx]) {
        sheets[sIdx] = {
          index: sIdx,
          width: sheet.width,
          height: sheet.height,
          placements: [],
          cols: [],
          curX: margin,
        };
      }

      const s = sheets[sIdx];

      for (const col of s.cols) {
        if (Math.abs(col.w - inst.w) <= 1.0 || col.w >= inst.w) {
          if (col.curY + inst.h <= margin + usableH + EPS) {
            s.placements.push({
              instanceId: inst.instanceId,
              pieceId: inst.id,
              name: inst.name,
              color: inst.color,
              x: col.x,
              y: col.curY,
              w: inst.w,
              h: inst.h,
              origW: inst.origW,
              origH: inst.origH,
              rotated: inst.rotated,
              rotationAllowed: rotationAllowedGlobal && inst.rotationAllowed !== false,
            });

            cuts.push({
              id: `cut-${cutCounter++}`,
              step: cuts.length + 1,
              sheetIndex: sIdx,
              stage: 'cross_cut',
              orientation: 'horizontal',
              x1: col.x,
              y1: col.curY + inst.h,
              x2: col.x + col.w,
              y2: col.curY + inst.h,
              length: col.w,
              description: `Cross cut column horizontally at Y=${Math.round(col.curY + inst.h)}mm to separate "${inst.name}"`,
            });

            col.curY += inst.h + kerf;
            placed = true;
            break;
          }
        }
      }

      if (placed) break;

      if (s.curX + inst.w <= margin + usableW + EPS) {
        const colX = s.curX;
        const colW = inst.w;

        cuts.push({
          id: `cut-${cutCounter++}`,
          step: cuts.length + 1,
          sheetIndex: sIdx,
          stage: 'rip_cut',
          orientation: 'vertical',
          x1: colX + colW,
          y1: margin,
          x2: colX + colW,
          y2: sheet.height - margin,
          length: sheet.height - margin * 2,
          description: `Rip cut Sheet ${sIdx + 1} vertically from edge to edge at X=${Math.round(colX + colW)}mm`,
        });

        const newCol = {
          x: colX,
          w: colW,
          curY: margin + inst.h + kerf,
        };

        s.placements.push({
          instanceId: inst.instanceId,
          pieceId: inst.id,
          name: inst.name,
          color: inst.color,
          x: colX,
          y: margin,
          w: inst.w,
          h: inst.h,
          origW: inst.origW,
          origH: inst.origH,
          rotated: inst.rotated,
          rotationAllowed: rotationAllowedGlobal && inst.rotationAllowed !== false,
        });

        cuts.push({
          id: `cut-${cutCounter++}`,
          step: cuts.length + 1,
          sheetIndex: sIdx,
          stage: 'cross_cut',
          orientation: 'horizontal',
          x1: colX,
          y1: margin + inst.h,
          x2: colX + colW,
          y2: margin + inst.h,
          length: colW,
          description: `Cross cut column horizontally at Y=${Math.round(margin + inst.h)}mm to separate "${inst.name}"`,
        });

        s.cols.push(newCol);
        s.curX += colW + kerf;
        placed = true;
        break;
      }
    }

    if (!placed) unplaced.push(inst);
  }

  const usedSheets = sheets.filter((s) => s && s.placements.length > 0);
  return {
    sheets: usedSheets.map((s) => ({
      index: s.index,
      width: s.width,
      height: s.height,
      placements: s.placements,
    })),
    cuts,
    unplaced,
    type: 'Strip-Guillotine (Column-first)',
  };
}

/**
 * Strategy B Candidate 3: Recursive Binary Guillotine Tree (Shorter Axis Split)
 * Recursively partitions rectangular free regions using straight through-cuts.
 */
function packRecursiveGuillotine(instances, sheet, options, splitRule = 'SLAS') {
  const { kerf = 0, margin = 0, maxSheets = Infinity, rotationAllowedGlobal = true } = options;
  const usableW = sheet.width - margin * 2;
  const usableH = sheet.height - margin * 2;

  const pending = [...instances].sort((a, b) => (b.width * b.height) - (a.width * a.height));

  const sheets = [];
  const cuts = [];
  const unplaced = [];
  let cutCounter = 1;

  function newGuillotineSheet(index) {
    return {
      index,
      width: sheet.width,
      height: sheet.height,
      freeBlocks: [{ x: margin, y: margin, w: usableW, h: usableH }],
      placements: [],
    };
  }

  for (const inst of pending) {
    const allowRot = rotationAllowedGlobal && inst.rotationAllowed !== false;
    let placed = false;
    const limitSheets = Number.isFinite(maxSheets) && maxSheets > 0 ? maxSheets : 100;

    for (let sIdx = 0; sIdx < limitSheets && !placed; sIdx++) {
      if (!sheets[sIdx]) sheets[sIdx] = newGuillotineSheet(sIdx);
      const s = sheets[sIdx];

      // Find best fitting free block that can accommodate piece
      let bestBlockIdx = -1;
      let bestScore = Infinity;
      let chosenRot = false;
      let chosenW = inst.width;
      let chosenH = inst.height;

      for (let bIdx = 0; bIdx < s.freeBlocks.length; bIdx++) {
        const b = s.freeBlocks[bIdx];

        // Try direct orientation
        if (b.w >= inst.width - EPS && b.h >= inst.height - EPS) {
          const score = (b.w - inst.width) + (b.h - inst.height);
          if (score < bestScore) {
            bestScore = score;
            bestBlockIdx = bIdx;
            chosenRot = false;
            chosenW = inst.width;
            chosenH = inst.height;
          }
        }

        // Try rotated orientation
        if (allowRot && inst.width !== inst.height && b.w >= inst.height - EPS && b.h >= inst.width - EPS) {
          const score = (b.w - inst.height) + (b.h - inst.width);
          if (score < bestScore) {
            bestScore = score;
            bestBlockIdx = bIdx;
            chosenRot = true;
            chosenW = inst.height;
            chosenH = inst.width;
          }
        }
      }

      if (bestBlockIdx !== -1) {
        const targetBlock = s.freeBlocks.splice(bestBlockIdx, 1)[0];
        const pw = chosenW;
        const ph = chosenH;

        s.placements.push({
          instanceId: inst.instanceId,
          pieceId: inst.id,
          name: inst.name,
          color: inst.color,
          x: targetBlock.x,
          y: targetBlock.y,
          w: pw,
          h: ph,
          origW: inst.origW,
          origH: inst.origH,
          rotated: chosenRot,
          rotationAllowed: allowRot,
        });

        // Split target block into remaining rectangular sub-blocks using guillotine cut
        const remainW = targetBlock.w - pw - kerf;
        const remainH = targetBlock.h - ph - kerf;

        // Choose cut axis
        const splitHorizontalFirst = splitRule === 'SLAS' ? remainH < remainW : remainW >= remainH;

        if (splitHorizontalFirst) {
          // Horizontal cut first: cuts across block width at y = targetBlock.y + ph
          if (ph + kerf < targetBlock.h - EPS) {
            cuts.push({
              id: `cut-${cutCounter++}`,
              step: cuts.length + 1,
              sheetIndex: sIdx,
              stage: 'guillotine_split',
              orientation: 'horizontal',
              x1: targetBlock.x,
              y1: targetBlock.y + ph,
              x2: targetBlock.x + targetBlock.w,
              y2: targetBlock.y + ph,
              length: targetBlock.w,
              description: `Horizontal guillotine cut from (${Math.round(targetBlock.x)}, ${Math.round(targetBlock.y + ph)}) to (${Math.round(targetBlock.x + targetBlock.w)}, ${Math.round(targetBlock.y + ph)})`,
            });
          }

          // Vertical cut in bottom sub-block
          if (pw + kerf < targetBlock.w - EPS) {
            cuts.push({
              id: `cut-${cutCounter++}`,
              step: cuts.length + 1,
              sheetIndex: sIdx,
              stage: 'guillotine_split',
              orientation: 'vertical',
              x1: targetBlock.x + pw,
              y1: targetBlock.y,
              x2: targetBlock.x + pw,
              y2: targetBlock.y + ph,
              length: ph,
              description: `Vertical guillotine cut from (${Math.round(targetBlock.x + pw)}, ${Math.round(targetBlock.y)}) to (${Math.round(targetBlock.x + pw)}, ${Math.round(targetBlock.y + ph)})`,
            });
          }

          if (remainW > 5) {
            s.freeBlocks.push({
              x: targetBlock.x + pw + kerf,
              y: targetBlock.y,
              w: remainW,
              h: ph,
            });
          }
          if (remainH > 5) {
            s.freeBlocks.push({
              x: targetBlock.x,
              y: targetBlock.y + ph + kerf,
              w: targetBlock.w,
              h: remainH,
            });
          }
        } else {
          // Vertical cut first
          if (pw + kerf < targetBlock.w - EPS) {
            cuts.push({
              id: `cut-${cutCounter++}`,
              step: cuts.length + 1,
              sheetIndex: sIdx,
              stage: 'guillotine_split',
              orientation: 'vertical',
              x1: targetBlock.x + pw,
              y1: targetBlock.y,
              x2: targetBlock.x + pw,
              y2: targetBlock.y + targetBlock.h,
              length: targetBlock.h,
              description: `Vertical guillotine cut across block at X=${Math.round(targetBlock.x + pw)}mm`,
            });
          }

          if (ph + kerf < targetBlock.h - EPS) {
            cuts.push({
              id: `cut-${cutCounter++}`,
              step: cuts.length + 1,
              sheetIndex: sIdx,
              stage: 'guillotine_split',
              orientation: 'horizontal',
              x1: targetBlock.x,
              y1: targetBlock.y + ph,
              x2: targetBlock.x + pw,
              y2: targetBlock.y + ph,
              length: pw,
              description: `Horizontal cut separating piece at Y=${Math.round(targetBlock.y + ph)}mm`,
            });
          }

          if (remainW > 5) {
            s.freeBlocks.push({
              x: targetBlock.x + pw + kerf,
              y: targetBlock.y,
              w: remainW,
              h: targetBlock.h,
            });
          }
          if (remainH > 5) {
            s.freeBlocks.push({
              x: targetBlock.x,
              y: targetBlock.y + ph + kerf,
              w: pw,
              h: remainH,
            });
          }
        }

        placed = true;
        break;
      }
    }

    if (!placed) unplaced.push(inst);
  }

  const usedSheets = sheets.filter((s) => s && s.placements.length > 0);
  return {
    sheets: usedSheets.map((s) => ({
      index: s.index,
      width: s.width,
      height: s.height,
      placements: s.placements,
    })),
    cuts,
    unplaced,
    type: `Recursive Guillotine (${splitRule})`,
  };
}

/**
 * Optimizes cut-list layout using Strategy B: FASTEST.
 * 
 * Generates an arrangement strictly achievable through continuous straight guillotine cuts,
 * prioritizing fewer cutting operations, simpler fence alignments, and minimal cutting time.
 */
export function optimizeFastest(sheet, pieces, options = {}) {
  const instances = expandInstances(pieces);
  if (instances.length === 0) {
    return {
      strategy: 'fastest',
      name: 'Fastest',
      tagline: 'Save Time & Simplify Cutting',
      algorithm: 'Guillotine Cutting Plan',
      sheets: [],
      unplaced: [],
      cuts: [],
      isGuillotine: true,
    };
  }

  // Generate candidate plans using distinct guillotine strategies
  const candidates = [
    packStripGuillotineHorizontal(instances, sheet, options),
    packStripGuillotineVertical(instances, sheet, options),
    packRecursiveGuillotine(instances, sheet, options, 'SLAS'),
    packRecursiveGuillotine(instances, sheet, options, 'LAS'),
  ];

  let bestCandidate = null;
  let bestScore = -Infinity;

  for (const c of candidates) {
    // Score prioritized for Fastest mode:
    // 1. Heavy penalty for unplaced pieces (-1,000,000 per unplaced piece)
    // 2. Penalty for excessive sheet count (-5,000 per sheet)
    // 3. Heavy penalty for total number of cut operations (-150 per cut operation)
    // 4. Moderate penalty for total cut length (-length / 1000)
    let totalCutLength = 0;
    for (const cut of c.cuts) totalCutLength += (cut.length || 0);

    const unplacedPenalty = c.unplaced.length * 1_000_000;
    const sheetPenalty = c.sheets.length * 5_000;
    const cutCountPenalty = c.cuts.length * 150;
    const cutLengthPenalty = totalCutLength * 0.05;

    const score = -unplacedPenalty - sheetPenalty - cutCountPenalty - cutLengthPenalty;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = c;
    }
  }

  return {
    strategy: 'fastest',
    name: 'Fastest',
    tagline: 'Save Time & Simplify Cutting',
    algorithm: `Guillotine Plan (${bestCandidate?.type || 'Strip-Cut'})`,
    sheets: bestCandidate?.sheets || [],
    unplaced: bestCandidate?.unplaced || [],
    cuts: bestCandidate?.cuts || [],
    isGuillotine: true,
  };
}
