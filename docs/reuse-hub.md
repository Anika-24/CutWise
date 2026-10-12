# CutWise Reuse Hub

## Using the feature

Open **Saved Projects → Reusable Materials** for confirmed inventory, filters, source projects, small 2D previews and catalog suggestions. Local browser storage is used; no backend or paid AI API was added.

After obtaining a complete valid layout, use **Production & reusable offcuts**. Reserve any existing offcuts used by that actual layout, then explicitly confirm production/consumption. Purchased-only projects need no offcut reservation. Review the frozen candidate regions, deselect or mark unusable, reduce dimensions to physical measurements, and save all/selected or skip. A production run can be confirmed and captured once per project ID. Repeated saves update that project's record instead of creating a new project identity. Create a new project for a second physical run.

Compatible offcuts appear during material setup and optimization. Selecting stock does not consume or reserve it. Existing material type, thickness, kerf, edge margin, piece rotation rules and purchased-sheet quantity still apply. The dashboard can cancel a project's reservations, including abandoned drafts.

Select available inventory in the hub to find catalog cut templates. Only templates with complete independently validated optimizer results are shown. Creating an idea produces a new editable project, selects the used offcuts, and runs the existing optimizer; it does not consume inventory.

## Geometry, cost and inventory rules

- Validated cutting trees supply unused terminal rectangles. Other layouts subtract kerf-expanded piece envelopes from the usable sheet interior using a disjoint rectangular decomposition. Neither method equates waste percentage to reusable stock.
- Candidates require each side >= 50 mm and area >= 10,000 mm² (100 cm²). This is a disclosed candidate threshold, not a guarantee of physical recovery. Small fragments, margins and conservative exclusions remain outside inventory.
- Geometric leftover includes kerf and margins. Estimated candidate area is separate from confirmed available inventory. Excluded leftover includes kerf; these figures must not be summed as independent areas.
- Each physical region has a unique stable ID, source project/sheet, geometry, material, thickness, quantity 1, status, saved date and notes. Multiple regions on one sheet remain distinct physical units. New remainders retain the consumed offcut ID as their parent link.
- Mixed stock evaluates several stock orders and the original whole-job new-sheet-only candidate. Most Efficient ranks completed placements first, then purchased-sheet count; Fastest ranks completed placements first, then its existing manufacturing model. Searches are heuristic, not guaranteed globally optimal.
- Actual stock dimensions, instance identities, stock IDs/categories, kerf, margins and cutting trees are independently validated. A physical stock unit cannot appear twice in one plan.
- Reused offcuts have zero new purchasing cost. New full sheets use the configured sheet price. Avoided purchases compare complete same-strategy plans with and without selected scraps, and dashboard totals include only confirmed runs with that comparison. They are modeled purchases, not receipt-based savings.
- Inventory transactions reread persistent state inside a browser Web Lock. Conflicting reservations or repeated consumption are rejected. Canceling restores availability. Previewing leaves inventory unchanged. Other tabs receive storage events, and conflicting availability changes invalidate draft results.

## Verification and limitations

`node --test tests/optimization.test.js tests/reuse.test.js`: **39 tests passed**, including all 31 existing optimizer tests. Reuse checks cover mixed-size stock, purchase costs, exact stock limits, insufficient stock, material/thickness compatibility, kerf/margins, rotation, disjoint tree and irregular-space decomposition, duplicate physical IDs, reservation conflicts/cancellation, second-project consumption, remainder capture, JSON persistence round trip, duplicate production/capture rejection, invalid measurements, skipped recovery, feasible catalog ideas and tiny scraps with no feasible suggestion.

`npm.cmd run lint`: passed. `npm.cmd run build`: passed. Build warnings remain for missing `VITE_BASE44_APP_ID`, missing `VITE_BASE44_APP_BASE_URL`, and bundles above 500 kB. Hosted API calls require the existing Base44 environment configuration.

Full type checking fails in existing auth/UI code and Three.js JavaScript declarations; the new Reuse Hub modules and modified project/engine/analytics/export code have no reported diagnostics. Browser interactions, actual multi-tab Web Locks, physical cutting and WebGL were not manually exercised. Reload persistence was checked by serializing/restoring inventory data in tests, not by browser automation.

Only rectangular stock is supported. Irregular free space is conservatively split into rectangles; polygon-shaped physical stock is not offered to the optimizer. User measurements may reduce, but cannot enlarge, detected regions. Inventory is local to this browser/origin; it is not synchronized across devices. Inventory updates require Web Locks on localhost or HTTPS and fail explicitly if unavailable. Catalog suggestions are deterministic local cut templates, without generative AI, joinery or assembly validation. Geometric candidates for non-guillotine layouts need physical cutting/recovery review.

No Git metadata exists in this checkout, so Git status/diff was unavailable. No pull, push, merge or deployment was performed.

## Files changed in this upgrade

Existing files:

- `src/App.jsx`
- `src/lib/ProjectContext.jsx`
- `src/lib/optimizationEngine.js`
- `src/lib/planValidation.js`
- `src/lib/analyticsCalculator.js`
- `src/pages/Home.jsx`
- `src/pages/SavedProjects.jsx`
- `src/components/analytics/AnalyticsDashboard.jsx`
- `src/components/visualization/ExportBar.jsx`
- `src/components/visualization/View2D.jsx`
- `src/components/visualization/View3D.jsx`
- `package.json`

Added files:

- `src/lib/offcutGeometry.js`
- `src/lib/reuseInventory.js`
- `src/lib/ReuseContext.jsx`
- `src/lib/mixedStockOptimizer.js`
- `src/lib/reuseIdeas.js`
- `src/components/reuse/ReuseStockPanel.jsx`
- `src/components/reuse/OffcutCapture.jsx`
- `src/components/reuse/ReuseHub.jsx`
- `tests/reuse.test.js`
- `docs/reuse-hub.md`

The production build also regenerates `dist/` output.
