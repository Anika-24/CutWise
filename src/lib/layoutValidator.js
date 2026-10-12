// Independent layout and geometry validator for all optimization strategies.
// Pure JavaScript, unit-independent (uses millimeters internally).

const EPS = 1e-4;

/**
 * Validates any generated layout against geometric constraints.
 * 
 * @param {object} layout           The layout to validate { sheets: [...], unplaced: [...] }
 * @param {object} sheetDef         { width, height }
 * @param {object} options          { kerf, margin, maxSheets, pieces, rotationAllowedGlobal, isFastestMode }
 * @returns {object}                Validation result { valid, errors, warnings, isGuillotine, details }
 */
export function validateLayout(layout, sheetDef, options = {}) {
  const {
    kerf = 0,
    margin = 0,
    maxSheets = Infinity,
    pieces = [],
    rotationAllowedGlobal = true,
    isFastestMode = false,
  } = options;

  const errors = [];
  const warnings = [];

  if (!layout || !Array.isArray(layout.sheets)) {
    return {
      valid: false,
      errors: ['Invalid layout structure: missing sheets array'],
      warnings: [],
      isGuillotine: false,
      sheetsCount: 0,
      inventoryExceeded: false,
      minAdditionalSheetsNeeded: 0,
      placedCount: 0,
      unplacedCount: 0,
    };
  }

  const sheetW = Number(sheetDef?.width);
  const sheetH = Number(sheetDef?.height);

  if (!Number.isFinite(sheetW) || sheetW <= 0 || !Number.isFinite(sheetH) || sheetH <= 0) {
    return {
      valid: false,
      errors: ['Sheet dimensions must be positive finite numbers'],
      warnings: [],
      isGuillotine: false,
      sheetsCount: layout.sheets.length,
      inventoryExceeded: false,
      minAdditionalSheetsNeeded: 0,
      placedCount: 0,
      unplacedCount: 0,
    };
  }

  const placedInstanceIds = new Set();
  let placedCount = 0;

  // Build piece lookup for original dimensions and rotation rules
  const pieceMap = new Map();
  if (Array.isArray(pieces)) {
    for (const p of pieces) {
      if (p && p.id) {
        pieceMap.set(p.id, p);
      }
    }
  }

  const sheetsCount = layout.sheets.length;
  const inventoryExceeded = sheetsCount > maxSheets;
  const minAdditionalSheetsNeeded = Math.max(0, sheetsCount - maxSheets);

  if (inventoryExceeded) {
    warnings.push(
      `Layout uses ${sheetsCount} sheets, which exceeds available inventory of ${maxSheets}. Minimum ${minAdditionalSheetsNeeded} additional sheet(s) needed.`
    );
  }

  for (let sIdx = 0; sIdx < layout.sheets.length; sIdx++) {
    const s = layout.sheets[sIdx];
    const sIndex = s.index !== undefined ? s.index : sIdx;

    if (!Array.isArray(s.placements)) {
      errors.push(`Sheet ${sIndex} is missing a placements array`);
      continue;
    }

    // Check each piece on this sheet
    for (let pIdx = 0; pIdx < s.placements.length; pIdx++) {
      const p = s.placements[pIdx];
      placedCount += 1;

      // Positive & finite dimensions and coordinates
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.w) || !Number.isFinite(p.h)) {
        errors.push(`Piece ${p.name || p.instanceId || pIdx} on sheet ${sIndex} has invalid/non-finite coordinates or dimensions.`);
        continue;
      }

      if (p.w <= 0 || p.h <= 0) {
        errors.push(`Piece ${p.name || p.instanceId || pIdx} on sheet ${sIndex} has non-positive dimensions (${p.w}×${p.h}).`);
      }

      // Unique instance ID check
      if (p.instanceId) {
        if (placedInstanceIds.has(p.instanceId)) {
          errors.push(`Duplicate instance ID detected: ${p.instanceId} placed more than once.`);
        }
        placedInstanceIds.add(p.instanceId);
      }

      // Margin and sheet boundary check
      if (p.x < margin - EPS) {
        errors.push(`Piece ${p.name || p.instanceId} on sheet ${sIndex} starts before left margin (${p.x.toFixed(1)} < ${margin}).`);
      }
      if (p.y < margin - EPS) {
        errors.push(`Piece ${p.name || p.instanceId} on sheet ${sIndex} starts before top margin (${p.y.toFixed(1)} < ${margin}).`);
      }
      if (p.x + p.w > sheetW - margin + EPS) {
        errors.push(`Piece ${p.name || p.instanceId} on sheet ${sIndex} exceeds right margin / sheet width (${(p.x + p.w).toFixed(1)} > ${(sheetW - margin).toFixed(1)}).`);
      }
      if (p.y + p.h > sheetH - margin + EPS) {
        errors.push(`Piece ${p.name || p.instanceId} on sheet ${sIndex} exceeds bottom margin / sheet height (${(p.y + p.h).toFixed(1)} > ${(sheetH - margin).toFixed(1)}).`);
      }

      // Rotation restrictions check
      const originalPiece = p.pieceId ? pieceMap.get(p.pieceId) : null;
      if (originalPiece) {
        const canRotate = rotationAllowedGlobal && originalPiece.rotationAllowed !== false;
        if (p.rotated && !canRotate) {
          errors.push(`Piece ${p.name || p.instanceId} is rotated, but rotation is disallowed.`);
        }

        // Verify dimensions match original (or swapped if rotated)
        const expectedW = p.rotated ? originalPiece.height : originalPiece.width;
        const expectedH = p.rotated ? originalPiece.width : originalPiece.height;
        if (Math.abs(p.w - expectedW) > 1e-2 || Math.abs(p.h - expectedH) > 1e-2) {
          errors.push(`Piece ${p.name || p.instanceId} placed dimensions (${p.w}×${p.h}) do not match piece definition (${expectedW}×${expectedH}).`);
        }
      }
    }

    // Overlap check (accounting for kerf spacing)
    for (let i = 0; i < s.placements.length; i++) {
      for (let j = i + 1; j < s.placements.length; j++) {
        const a = s.placements[i];
        const b = s.placements[j];

        // Two pieces do NOT overlap if one is completely to the left, right, top, or bottom with kerf
        const separated =
          a.x + a.w + kerf <= b.x + EPS ||
          b.x + b.w + kerf <= a.x + EPS ||
          a.y + a.h + kerf <= b.y + EPS ||
          b.y + b.h + kerf <= a.y + EPS;

        if (!separated) {
          errors.push(`Overlap detected: "${a.name || a.instanceId}" overlaps "${b.name || b.instanceId}" on sheet ${sIndex} (kerf=${kerf}mm).`);
        }
      }
    }
  }

  // Check unplaced pieces
  const unplacedCount = Array.isArray(layout.unplaced) ? layout.unplaced.length : 0;
  if (Array.isArray(layout.unplaced)) {
    for (const u of layout.unplaced) {
      if (u.instanceId && placedInstanceIds.has(u.instanceId)) {
        errors.push(`Inconsistent state: Piece ${u.instanceId} is listed in both placed and unplaced.`);
      }
    }
  }

  // Guillotine cut sequence validation
  let isGuillotine = true;
  if (isFastestMode || layout.strategy === 'fastest' || layout.isGuillotine) {
    // Validate that each sheet's pieces are separable via recursive guillotine cuts
    for (let sIdx = 0; sIdx < layout.sheets.length; sIdx++) {
      const s = layout.sheets[sIdx];
      if (s.placements.length > 1) {
        const checkGuillotine = verifyGuillotineCuttable(s.placements, sheetW, sheetH, margin, kerf);
        if (!checkGuillotine.guillotine) {
          isGuillotine = false;
          if (isFastestMode) {
            errors.push(`Sheet ${s.index || sIdx} does not satisfy guillotine cutting requirement: ${checkGuillotine.reason}`);
          } else {
            warnings.push(`Layout is not strictly guillotine-cuttable: ${checkGuillotine.reason}`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    isGuillotine,
    sheetsCount,
    inventoryExceeded,
    minAdditionalSheetsNeeded,
    placedCount,
    unplacedCount,
    details: {
      totalRequested: placedCount + unplacedCount,
    },
  };
}

/**
 * Checks if a set of placements on a sheet can be recursively cut using straight guillotine cuts.
 */
export function verifyGuillotineCuttable(placements, sheetW, sheetH, margin = 0, kerf = 0) {
  if (placements.length <= 1) return { guillotine: true };

  // Recursive block partition test
  function canSplit(rects) {
    if (rects.length <= 1) return true;

    // Find bounding box of rects
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rects) {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    }

    // Try finding a straight vertical cut line that separates rects into two non-empty subsets without intersecting any rect interior
    // Collect candidate vertical cut lines (right edge + kerf or left edge of each piece)
    const xCandidates = new Set();
    for (const r of rects) {
      xCandidates.add(r.x);
      xCandidates.add(r.x + r.w);
      xCandidates.add(r.x + r.w + kerf);
    }

    for (const cx of xCandidates) {
      if (cx <= minX + EPS || cx >= maxX - EPS) continue;
      // Check if cx cuts through the interior of any rectangle
      let cutsInterior = false;
      const leftGroup = [];
      const rightGroup = [];

      for (const r of rects) {
        if (r.x + EPS < cx && r.x + r.w - EPS > cx) {
          cutsInterior = true;
          break;
        }
        if (r.x + r.w <= cx + EPS) {
          leftGroup.push(r);
        } else if (r.x >= cx - EPS) {
          rightGroup.push(r);
        }
      }

      if (!cutsInterior && leftGroup.length > 0 && rightGroup.length > 0 && leftGroup.length + rightGroup.length === rects.length) {
        if (canSplit(leftGroup) && canSplit(rightGroup)) {
          return true;
        }
      }
    }

    // Try finding a straight horizontal cut line that separates rects into two non-empty subsets
    const yCandidates = new Set();
    for (const r of rects) {
      yCandidates.add(r.y);
      yCandidates.add(r.y + r.h);
      yCandidates.add(r.y + r.h + kerf);
    }

    for (const cy of yCandidates) {
      if (cy <= minY + EPS || cy >= maxY - EPS) continue;
      let cutsInterior = false;
      const topGroup = [];
      const bottomGroup = [];

      for (const r of rects) {
        if (r.y + EPS < cy && r.y + r.h - EPS > cy) {
          cutsInterior = true;
          break;
        }
        if (r.y + r.h <= cy + EPS) {
          topGroup.push(r);
        } else if (r.y >= cy - EPS) {
          bottomGroup.push(r);
        }
      }

      if (!cutsInterior && topGroup.length > 0 && bottomGroup.length > 0 && topGroup.length + bottomGroup.length === rects.length) {
        if (canSplit(topGroup) && canSplit(bottomGroup)) {
          return true;
        }
      }
    }

    return false;
  }

  const ok = canSplit(placements);
  return {
    guillotine: ok,
    reason: ok ? null : 'Interlocking placement pattern cannot be separated by full-length straight saw passes without cutting into other pieces.',
  };
}
