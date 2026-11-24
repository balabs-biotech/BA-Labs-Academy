# Academy Atlas V2 Morphology and Spacing Implementation Plan

> **For agentic workers:** Use the host's available task-by-task implementation workflow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the standalone Academy Atlas V2 preview read as a biological mycelial network, preserve explicit angular gaps at every hierarchy level, and prevent visible labels from overlapping.

**Architecture:** Keep the canonical pedagogy graph and radial universe anchors unchanged. Extend the renderer-neutral morphogenesis output with constrained child sectors and deterministic biological branch descriptors; solve label placement in the Pixi adapter using measured text bounds and zoom-aware visibility.

**Tech Stack:** JavaScript ES modules, Node.js built-in test runner, PixiJS, Playwright, GitHub Pages static build.

## Global Constraints

- Work only in the V2 engine and standalone `atlas-v2-preview.html` page.
- Do not change production Atlas runtime, production home page, canonical node IDs, parent relationships, or canonical edges.
- Do not import or synchronize source from the BA Labs website engine.
- Morphogenesis remains independent of PixiJS and the DOM.
- Decorative hyphae must not create pedagogical nodes or canonical relationships.
- Same topology, configuration version, and seed must produce identical geometry and branch descriptors.
- Every parent allocates child sectors with explicit reserved angular gaps; jitter must remain inside the assigned sector.
- Text placement is derived presentation state. Hiding a label must never remove its node or selection access.
- Keep mobile rendering bounded: secondary hyphae are capped and label detail is reduced at low zoom.
- Preserve the existing public scene contract unless an additive optional field is required.

---

### Task 1: Recursive angular sectors with explicit spacing

**Files:**
- Modify: `src/features/atlas/engine/biology/morphogenesis.js`
- Test: `tests/atlas-engine/morphogenesis.test.js`
- Modify: `src/features/atlas/CONSTELLATION-ARCHITECTURE.md` only after implementation is accepted

**Interfaces:**
- Consumes: `createRhizomorphicMorphology({ topology, radialTopology, seed, coreBranchLength, branchLength, universeSpread, branchSpread, lengthVariation, curveBend, minimumBranchLength })`
- Produces: existing morphology result plus per-node `sector` metadata and branch angular allocation diagnostics; preserve `nodes`, `branches`, `byId`, `territories`, and `metrics`.

- [ ] **Step 1: Add focused failing tests**

Add cases asserting:
1. Every child angle is inside its parent's allocated sector.
2. Adjacent sibling sectors have a strictly positive reserved gap whenever the available spread can accommodate the configured minimum.
3. A large sibling count triggers a bounded adaptive gap rather than negative sector widths or NaN values.
4. Unequal subtree weights receive proportionate usable sector widths.
5. One-child parents preserve the parent axis.
6. Results remain deterministic when the same fixture is reconstructed.
7. A deep chain of 1,500 descendants still completes iteratively.
8. The central full ring wraps correctly across the -π/π boundary.

- [ ] **Step 2: Verify the relevant failure**

Run: `node --test tests/atlas-engine/morphogenesis.test.js`

Expected: new sector/gap assertions fail against the current allocator, which has no reserved angular gaps or sector metadata.

- [ ] **Step 3: Implement the minimum behavior**

Replace the current angle-only allocator with a deterministic sector allocator. For each sibling set, compute total descendant weight, reserve a configurable gap budget between siblings, distribute the remaining angular span by subtree weight, and derive each child angle only from the interior of its sector. For full-ring core allocation, distribute the wrap gap consistently between the final and first sectors. If the requested gap budget is infeasible, reduce it uniformly to a positive feasible value; if no positive gap is geometrically possible, expose that condition in diagnostics rather than generating invalid geometry. Keep the allocator iterative with the existing breadth-first queue. Attach each child's sector start/end/center and effective gap to derived morphology metadata. Keep universe anchors fixed.

- [ ] **Step 4: Verify the focused pass**

Run: `node --test tests/atlas-engine/morphogenesis.test.js`

Expected: all morphogenesis tests pass, including deep-tree and deterministic-output tests.

- [ ] **Step 5: Run the affected integration check**

Run: `node --test tests/atlas-engine/*.test.js`

Expected: all existing topology, radial, morphology, and scene contract tests pass without changes to canonical graph data.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/features/atlas/engine/biology/morphogenesis.js tests/atlas-engine/morphogenesis.test.js
git commit -m "feat(atlas): reserve angular gaps at every hierarchy level"
```

### Task 2: Rhizomorphic primary cords and bounded secondary hyphae

**Files:**
- Modify: `src/features/atlas/engine/biology/morphogenesis.js`
- Modify: `src/features/atlas/engine/rendering/scene-model.js`
- Test: `tests/atlas-engine/morphogenesis.test.js`
- Test: `tests/atlas-engine/scene-model.test.js`

**Interfaces:**
- Consumes: deterministic node positions, sector metadata, and existing hierarchy branches.
- Produces: primary branch curve plus additive `style` metadata (`primary-cord` / `universe-trunk`) and a bounded list of secondary hypha curves represented as renderer-neutral decorative paths. No new topology nodes or canonical edges.

- [ ] **Step 1: Add focused failing tests**

Assert that:
1. Primary curves have finite control points and differ deterministically from straight linear interpolation.
2. Curve asymmetry is deterministic for a stable branch ID and seed.
3. Secondary hypha descriptors have stable IDs, finite coordinates, bounded count, and smaller width/length metadata than primary cords.
4. The same input produces identical primary and secondary paths.
5. Decorative hyphae do not appear in `morphology.nodes`, `topology.edges`, or canonical relationship arrays.
6. Deep trees and zero-child/one-child parents do not generate invalid or unbounded detail.

- [ ] **Step 2: Verify the relevant failure**

Run: `node --test tests/atlas-engine/morphogenesis.test.js tests/atlas-engine/scene-model.test.js`

Expected: tests fail because current branches expose only one symmetric cubic curve and no secondary hypha descriptors.

- [ ] **Step 3: Implement the minimum behavior**

Generate an asymmetric two-control-point cubic curve from stable branch identity, local sector, generation, and territory density. Add a bounded number of lateral hypha descriptors to eligible primary branches. Use deterministic IDs derived from the parent branch and hypha index; keep hyphae short, thinner, and visually subordinate. Exclude tiny branches and cap total detail per territory. Extend `createAtlasScene` to copy and freeze these descriptors as a distinct decorative path type, validate finite points and stable IDs, and keep them separate from `relationships` and `relationshipPaths`.

- [ ] **Step 4: Verify the focused pass**

Run: `node --test tests/atlas-engine/morphogenesis.test.js tests/atlas-engine/scene-model.test.js`

Expected: deterministic biological curves and bounded secondary details pass; canonical graph arrays remain byte-for-byte unchanged in fixture assertions.

- [ ] **Step 5: Run the affected integration check**

Run: `node --test tests/atlas-engine/*.test.js`

Expected: all engine tests pass and scene metrics distinguish canonical hierarchy paths from decorative hyphae.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/features/atlas/engine/biology/morphogenesis.js src/features/atlas/engine/rendering/scene-model.js tests/atlas-engine/morphogenesis.test.js tests/atlas-engine/scene-model.test.js
git commit -m "feat(atlas): add layered rhizomorphic hypha growth"
```

### Task 3: Collision-aware label layout and zoom-aware detail

**Files:**
- Create: `src/features/atlas/engine/rendering/label-layout.js`
- Modify: `src/features/atlas/engine/rendering/pixi-adapter.js`
- Test: `tests/atlas-engine/label-layout.test.js`
- Modify: `src/features/atlas/engine/preview/atlas-v2-preview.js` only if camera scale metadata is not already passed to renderer

**Interfaces:**
- Produces: pure `resolveAtlasLabelLayout({ nodes, measurements, scale, gap, priorities })` returning deterministic placements with `visible`, `x`, `y`, `width`, `height`, and `reason`.
- Pixi adapter consumes measured `Text.width` / `Text.height` values and applies resolved placements. Existing `render(scene, camera)` contract remains.

- [ ] **Step 1: Add focused failing tests**

Add pure layout tests for:
1. Two labels with overlapping rectangles are separated or one lower-priority label is hidden.
2. A label cannot cover a non-associated node's exclusion circle.
3. Core and universe labels outrank leaf labels.
4. Equal-priority conflicts resolve deterministically independent of input order.
5. A label with zero/invalid measured dimensions is safely omitted without aborting other labels.
6. Low zoom hides lower-priority labels but leaves all scene nodes present.
7. Higher zoom progressively restores labels.
8. Labels remain within their assigned local territory bounds when a feasible placement exists.

- [ ] **Step 2: Verify the relevant failure**

Run: `node --test tests/atlas-engine/label-layout.test.js`

Expected: module-not-found or missing-export failure proves the label solver is not implemented.

- [ ] **Step 3: Implement the minimum behavior**

Implement a DOM- and Pixi-independent rectangle/exclusion-circle solver. Use stable priority ordering (core, universe, structural nodes, leaves, then stable ID). Try a bounded sequence of local offsets around the node; if no valid position exists, hide the lower-priority label with a reason code. In Pixi, create text objects, read actual measured bounds, invoke the solver, then apply the returned position/visibility. Recompute on each render when camera scale changes. Use scale thresholds to reduce label density at overview zoom and restore it at closer zoom. Never remove or disable nodes or pointer selection because a label is hidden.

- [ ] **Step 4: Verify the focused pass**

Run: `node --test tests/atlas-engine/label-layout.test.js`

Expected: all collision, priority, deterministic ordering, invalid measurement, and LOD tests pass.

- [ ] **Step 5: Run the affected integration check**

Run: `node --test tests/atlas-engine/*.test.js`

Expected: all engine tests pass with the existing scene and camera contracts.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add src/features/atlas/engine/rendering/label-layout.js src/features/atlas/engine/rendering/pixi-adapter.js tests/atlas-engine/label-layout.test.js src/features/atlas/engine/preview/atlas-v2-preview.js
git commit -m "feat(atlas): prevent label collisions across zoom levels"
```

### Task 4: V2 browser verification and architecture record

**Files:**
- Create: `tests/atlas-v2-preview-smoke.mjs`
- Modify: `package.json` to add `test:atlas-v2-browser`
- Modify: `src/features/atlas/CONSTELLATION-ARCHITECTURE.md`
- Modify: `src/features/atlas/engine/ATLAS-V2-MORPHOLOGY-SPACING-SPEC.md` to record final implemented parameters and behavior

**Interfaces:**
- Browser test targets the standalone `/atlas-v2-preview.html` page, not legacy `#/atlas`.
- Build continues to use the existing `npm run build` command.

- [ ] **Step 1: Add focused failing browser assertions**

The Playwright smoke must run at desktop (1440×900) and mobile (390×844), verify the V2 canvas is mounted and has nonzero dimensions, wait for the V2 status to indicate successful startup, exercise fit/zoom controls, collect page errors/console errors/failed requests, and save screenshots. Expose a small diagnostic surface for rendered label count, hidden label count, node count, and secondary hypha count so assertions do not depend on screenshot pixel heuristics. Verify all graph nodes remain present while some labels may be hidden at overview zoom.

- [ ] **Step 2: Verify the relevant failure**

Run: `npm run build && node tests/atlas-v2-preview-smoke.mjs`

Expected: the new smoke test initially fails because the dedicated V2 browser assertions/diagnostics are not yet present.

- [ ] **Step 3: Implement the minimum behavior**

Add the V2-specific browser test without modifying the legacy smoke test. Add only the renderer diagnostics needed for deterministic assertions. Update the canonical architecture document to describe sector allocation, biological branch hierarchy, text collision policy, and LOD as derived presentation. Keep the architecture reference consistent with the implemented configuration and tests.

- [ ] **Step 4: Verify the focused pass**

Run: `npm run build`

Expected: source syntax validation, public-bundle credential guard, and static build pass.

- [ ] **Step 5: Run the affected integration check**

Run: `npm test` and `npm run build`; then run the V2 Playwright smoke against the built static site.

Expected: all Node tests pass, build passes, and the V2 browser smoke passes at both viewports with no uncaught page errors or failed requests.

- [ ] **Step 6: Commit the passing deliverable**

```bash
git add tests/atlas-v2-preview-smoke.mjs package.json src/features/atlas/CONSTELLATION-ARCHITECTURE.md src/features/atlas/engine/ATLAS-V2-MORPHOLOGY-SPACING-SPEC.md src/features/atlas/engine/rendering/pixi-adapter.js src/features/atlas/engine/preview/atlas-v2-preview.js
git commit -m "test(atlas): verify V2 morphology and label legibility"
```

## Unresolved externally observable decisions

- Exact angular gap and sector jitter values are tuning parameters. Select them from fixture geometry and desktop/mobile screenshots while preserving positive feasible gaps and deterministic output.
- Exact label visibility scale thresholds and local offset search radius are tuning parameters. Select them from measured text bounds and the V2 overview/detail screenshots.
- Secondary hypha density cap is a performance tuning parameter. Select it from mobile browser smoke measurements; decorative details must remain bounded per territory.
- Browser screenshots are review artifacts. They are not published to the public site unless separately requested.
