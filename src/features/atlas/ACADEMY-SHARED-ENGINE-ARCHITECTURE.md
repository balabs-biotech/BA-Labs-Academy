# BA Labs Academy — shared 2D biological engine

## Contract

The Academy uses the same biological graph geometry and PixiJS renderer as the public BA Labs explorer:

- `src/features/atlas/shared/explorer-2d-network.js`
- `src/features/atlas/shared/explorer-2d-pixi.js`

These files are synchronized from `balabs-biotech/BA-lab/ecosystem-core/`. Academy-specific code is restricted to the data adapter and navigation integration.

## Biological composition

The Academy graph contains one fixed MYC core and exactly eight disciplinary universes:

1. MIC — Microbiology
2. BIO — Plants
3. AGR — Ecology
4. BPR — Bioprocesses
5. BMT — Biomaterials
6. GEN — Instrumentation
7. INF — Digital
8. PHY — Physical sciences

MYC is not a ninth universe. It is the central biological core. Its central coordinate is fixed at the origin and its eight primary trunks connect to the eight universe anchors.

## Source-of-truth and navigation

The canonical Academy catalogue remains the source of truth. The adapter preserves every canonical node ID and record, including departments, domains, sections, modules and pathways. It creates visual coordinates only; it does not rewrite the taxonomy or fabricate educational content.

Each node retains its canonical `data` record and its route. Selection opens the Academy information panel; the explicit route link opens the corresponding Academy page. Pathways are placed once in their primary disciplinary territory. Additional pathway links become evidence-bearing cross-universe relations.

## Morphology

The shared engine controls deterministic branching, local spacing, territory packing and local anastomoses. The Academy adapter fixes the MYC core and supplies the eight stable universe anchors. No radial topology, radial sector, pathway orbit, decorative branch generator or Academy-only morphology solver is allowed.

## Rendering and interaction

The shared PixiJS renderer owns filaments, junctions, tapered terminal hyphae, labels, zoom-dependent detail and motion. The Academy mount adapter supplies the canonical graph, camera state and selection callbacks. Camera and pointer modules remain renderer-independent utilities.

## Acceptance checks

- Exactly one MYC core and eight disciplinary universes.
- All canonical Academy IDs are represented exactly once.
- Repeated builds with identical inputs produce identical coordinates.
- Academy and public site import the same shared geometry and Pixi renderer.
- No Academy radial topology or radial pathway orbit is imported by the active Atlas view.
- Each selected record retains its canonical Academy route.
- Desktop, mobile, reduced-motion and keyboard/accessibility behavior are verified before merge.
