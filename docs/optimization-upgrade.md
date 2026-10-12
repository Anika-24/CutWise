# Optimization accuracy and production cost upgrade

The existing design, routes, material setup, chatbot and visualizations remain in place. Nothing was deployed, pushed, merged or reset. This folder has no Git metadata, so Git status and branch inspection were unavailable.

## Corrected behavior

Equality messages now come from actual results; equal utilization is never called an improvement. Negative savings mean additional cost, and negative sheet savings mean additional sheets. Partial jobs are excluded from complete-job comparisons and total job cost estimates.

All consumed sheets are modeled as newly purchased full sheets. Inventory is an availability limit, not free stock. Utilization uses actual piece area divided by full consumed sheet area, including margins. Waste is its complement. Geometric leftover includes kerf and margins and is not measured recoverable scrap. Areas use mm² internally and divide by 100 for cm².

## Algorithms and validated versus estimated metrics

Most Efficient searches the existing MaxRects BSSF, BAF and BLSF candidates with multiple sorting orders and permitted rotations. Independently valid candidates are selected by unplaced count, sheet count, then larger contiguous free-rectangle potential. That last metric is a geometric tie-breaker, not measured scrap recovery.

Fastest independently searches six binary guillotine candidates: three sorting orders and two split orders. Selection minimizes unplaced count, then configured production time or relative complexity, with sheet count as a tie-breaker. It does not copy MaxRects coordinates or artificially require extra sheets.

The independent validator checks dimensions, coordinates, bounds, rotation, kerf, inventory, and every requested identity exactly once. For cutting trees, it checks every binary workpiece split, blade gap, piece leaf and ordered cut endpoints and lengths. Internal separation and trimming cuts are included. Edge margins represent pre-trimmed stock; margin trimming is excluded.

For baseline and MaxRects, a bounded search attempts to reconstruct a guillotine tree from actual placement coordinates. Coordinates are unchanged, and the resulting tree must independently validate. Failure means no supported sequence was found within the search limit, not that manufacturing is impossible.

When a tree validates, cut count and distance are **validated**. Without a tree, they are explicitly **estimated** using a separate-edge proxy: four edges per finished piece, without merging shared cuts or stock edges. This is not a claim that four physical cuts are necessary. No production time or labor cost is computed from that fallback. Cuts-saved metrics are withheld when methods differ; complexity comparisons are provisional.

Handling counts, complexity, production time and labor remain estimates even when the cutting sequence validates. Recoverable offcuts are not measured.

## Complexity and production formulas

Lower complexity is simpler. The deterministic formula is:

`10 × operations + 3 × reposition events + 4 × orientation events + distanceMm / 1000 + 8 × sheets`

Distance is normalized to metres. Weights are planning weights, not calibrated physical time. Transitions are `max(0, cuts - sheets)`. Orientation events are `min(rotated placements, transitions)`; reposition events are the remaining transitions. Orientation replaces repositioning to prevent double-counting. Rotated placements are shown separately. The UI explains these assumptions.

Production Settings are blank by default and may be cleared: hourly labor rate ($/hour), cutting speed (mm/min), setup (minutes/sheet), reposition (seconds/event) and rotation (seconds/event). Placeholder examples are not applied values. Settings are saved with projects; changed inputs hide stale results.

For supported, validated sequences:

`minutes = cutDistanceMm / speedMmPerMinute + sheets × setupMinutes + repositionEvents × repositionSeconds / 60 + orientationEvents × rotationSeconds / 60`

An explicitly supplied legacy handling-per-piece value is also supported; otherwise per-piece handling is excluded. Time can be estimated without a labor rate; labor and total cost require a valid rate. Missing settings remain unavailable.

`laborCost = minutes / 60 × hourlyRate`

`estimatedJobCost = purchasedSheetCost + estimatedLaborCost`

These are partial estimates, not quotations. Margin trimming, unconfigured per-piece handling, machine depreciation, electricity, tool wear, taxes and other overhead are excluded. Machine type is descriptive and applies no hidden presets.

## Visualization and charts

Both renderers share strategy and sheet selectors. 3D now renders only the selected sheet instead of superimposing all sheets. Comparison panels retain shared piece selection. A missing corresponding sheet is shown as unavailable. Charts separate minutes from relative complexity and correctly label Geometric Leftover (cm²). Comparisons show actual material metrics, leftover, method status, distance, complexity, rotation and handling events, time, labor and estimated total cost.

## Verification and limitations

31 tests pass, including both supplied regressions and 20 seeded stress jobs. Tests independently validate geometry, rotations, kerf, inventory, identity coverage and trimming sequences. They also cover altered sequences, invalid or missing prices and production settings, area conversions, percentage points, zero-cut exact fits, calculation formulas and shared strategy/sheet selectors.

Small project: 750,000 mm² of pieces; 2,976,800 mm² sheet; 25.1948401% utilization; 2,226,800 mm² leftover = 22,268 cm²; $38 for each one-sheet plan; $0 material savings. Its reconstructed baseline and Most Efficient sequences have eight cuts, while Fastest has six. These are calculated results, not hardcoded benchmarks.

Crowded project: 12 instances and 3,600,000 mm² of pieces. Every plan is complete and independently valid, uses at least two sheets, and derives purchasing cost and waste from actual sheets. Tests do not fix an arbitrary heuristic sheet count.

Production build and lint pass. Type checking still reports existing auth/UI, Vite environment and Three.js declaration issues; no new diagnostics were found in the updated analytics, process model, validator, selectors or Home code. Build warnings include missing Base44 environment configuration and large chunks. Browser/WebGL rendering was not manually exercised; synchronization was checked through shared-selector tests and source inspection. Search is bounded; neither strategy proves global optimality. Physical estimates require equipment-specific calibration.

## Files modified or added

| File | Change |
|---|---|
| `src/lib/analyticsCalculator.js` | Precise finite area/cost calculations and compatible comparison/recommendation adapters |
| `src/lib/cuttingProcessModel.js` | Documented methods, complexity weights, explicit time/labor estimates and unavailable reasons |
| `src/lib/cuttingSequence.js` (new) | Bounded reconstruction of executable trees from existing placements |
| `src/lib/efficientOptimizer.js` | Independent candidate validation and consistent tolerance |
| `src/lib/guillotinePlanner.js` | Shared process model for validated-candidate scoring |
| `src/lib/layoutSelection.js` (new) | Fresh strategy and corresponding-sheet selectors |
| `src/lib/optimizationComparison.js` | Dynamic equality, savings and recommendations with comparability guards |
| `src/lib/optimizationEngine.js` | Independently validated sequences and real metrics for each strategy |
| `src/lib/planValidation.js` | Reconstructed-sequence validation and malformed-tree guards |
| `src/lib/ProjectContext.jsx` | Consistent active strategy, shared sheet state and saved optional settings |
| `src/components/analytics/AnalyticsDashboard.jsx` | Dynamic explanations, metric methods, distinct area categories and separate charts |
| `src/components/analytics/Recommendation.jsx` | Shared data-driven recommendation logic |
| `src/components/analytics/StrategyRecommendation.jsx` | Preserve alternative UI while guarding unavailable labor totals and formatting |
| `src/components/analytics/StrategySelector.jsx` | Optional Production Settings with editable blank fields and correct units |
| `src/components/cutlist/CutListTable.jsx` | Safe unavailable-area formatting |
| `src/components/visualization/BeforeAfter.jsx` | Complete metric comparisons and method explanations |
| `src/components/visualization/CuttingSequence.jsx` | Require independently validated sequences for playback |
| `src/components/visualization/ExportBar.jsx` | Safe unavailable-stat formatting |
| `src/components/visualization/View2D.jsx` | Shared selected sheet and absent-sheet handling |
| `src/components/visualization/View3D.jsx` | Corresponding-sheet geometry and old-outline disposal |
| `src/pages/Home.jsx` | Honest result titles and safe invalid-area formatting |
| `tests/optimization.test.js` | Supplied regressions, production formulas, comparability and stress coverage |
| `docs/optimization-upgrade.md` | This report |
