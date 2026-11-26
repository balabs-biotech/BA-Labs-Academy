# BA Labs Academy — shared 2D biological engine

## Contract

The Academy uses the same biological graph geometry and PixiJS renderer as the public BA Labs explorer:

- `src/features/atlas/shared/explorer-2d-network.js`
- `src/features/atlas/shared/explorer-2d-pixi.js`

These files are synchronized from `balabs-biotech/BA-lab/ecosystem-core/` at an explicitly pinned source commit. Academy-specific code is restricted to data adapters, navigation and educational interaction.

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

MYC is not a ninth universe. It is the central biological core, fixed at the origin and visually emphasized. The eight universes keep their own growth territories. No eight-spoke connector set is drawn from MYC to the universe anchors; the shared biological field is expressed through the organic morphology and evidence-bearing relations.

## Source-of-truth and navigation

The canonical Academy catalogue remains the source of truth for the content currently integrated. Each of the eight universes is a separate logical data branch with its own stable department key, hierarchy, modules and routes. The adapter preserves every canonical node ID and record, including departments, domains, sections, modules and pathways.

The eight logical source bindings are declared independently in `src/features/atlas/adapters/academy-universe-sources.js` (MIC, BIO, AGR, BPR, BMT, GEN, INF, PHY). Each has a stable source ID and its own hierarchy, modules and routes. The current seed records still live in `src/catalogue-map.js`; the manifest is the adapter boundary for connecting or migrating each universe to a separate Notion tree, file or database. The eight bindings are independent contracts, not eight physically separate repositories yet.

Each node retains its canonical `data` record and route. Selection opens the Academy information panel; the explicit route link opens the corresponding Academy page. Pathways are placed once in their primary disciplinary territory. Additional pathway links become evidence-bearing cross-universe relations.

## Morphology

The shared engine controls deterministic branching, local spacing, territory packing and local anastomoses. The Academy adapter fixes the MYC core, preserves its configured visual radius and supplies the eight stable universe anchors. No radial topology, radial sector, pathway orbit, artificial MYC spokes, decorative branch generator or Academy-only morphology solver is allowed.

## Rendering and interaction

The shared PixiJS renderer owns filaments, junctions, tapered terminal hyphae, labels, zoom-dependent detail and motion. Labels must remain within the visible canvas on desktop and mobile. The Academy mount adapter supplies the canonical graph, camera state and selection callbacks. Camera and pointer modules remain renderer-independent utilities.

## Acceptance checks

- Exactly one MYC core and eight disciplinary universes.
- MYC is central and visually emphasized, without eight artificial radial spokes.
- All canonical Academy IDs are represented exactly once.
- Repeated builds with identical inputs produce identical coordinates.
- Academy and public site use byte-synchronized shared geometry and Pixi renderer.
- No Academy radial topology or radial pathway orbit is imported by the active Atlas view.
- Each selected record retains its canonical Academy route.
- All visible label hitboxes remain inside the viewport on desktop and mobile.
- Desktop, mobile, reduced-motion and keyboard/accessibility behavior are verified before merge.
