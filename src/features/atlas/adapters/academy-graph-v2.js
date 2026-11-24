import { PALETTE } from "../atlas-palette.js";
import { createAtlasTopology } from "../engine/core/topology.js";
import { createMycelialTopology } from "../engine/spatial/mycelial-topology.js";
import { createRhizomorphicMorphology } from "../engine/biology/morphogenesis.js";
import { createVisualAnastomoses } from "../engine/biology/visual-anastomoses.js";
import { createAtlasScene } from "../engine/rendering/scene-model.js";

const TAU = Math.PI * 2;

function resolveColor(node, colors) {
  const key = String(node.entity_key || "").toLowerCase();
  return colors[node.entity_key] ?? colors[key] ?? PALETTE[key] ?? PALETTE.pathways;
}

/**
 * Compose the existing Academy graph into the independent V2 engine.
 * All catalogue nodes remain represented; pathways are secondary-orbit
 * anchors connected only through their canonical, explicitly declared edges.
 */
export function createAcademyAtlasV2({
  graph,
  seed = "academy-atlas-v2",
  universeRadius = 760,
  pathwayOrbitRadius = 1320,
  pathwayStartAngle = -Math.PI / 2,
  pathwayDirection = 1,
  universeStartAngle = -Math.PI / 2,
  universeDirection = 1,
  universeAnchors = {
    MIC: { x: -220, y: -470 },
    BIO: { x: 260, y: -520 },
    AGR: { x: 690, y: -210 },
    BPR: { x: 570, y: 270 },
    BMT: { x: 110, y: 610 },
    PHY: { x: -410, y: 500 },
    INF: { x: -760, y: 160 },
    GEN: { x: -80, y: 40 }
  },
  universeColors = {},
  morphologyOptions = {},
  anastomosisOptions = {}
} = {}) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new TypeError("Academy Atlas V2 requires a canonical Academy graph");
  }
  if (!Number.isFinite(universeRadius) || universeRadius <= 0) {
    throw new RangeError("universeRadius must be positive");
  }
  if (!Number.isFinite(pathwayOrbitRadius) || pathwayOrbitRadius <= universeRadius) {
    throw new RangeError("pathwayOrbitRadius must be greater than universeRadius");
  }
  if (!Number.isFinite(pathwayStartAngle)) throw new TypeError("pathwayStartAngle must be finite");
  if (pathwayDirection !== 1 && pathwayDirection !== -1) throw new RangeError("pathwayDirection must be 1 or -1");

  const topology = createAtlasTopology({ nodes: graph.nodes, edges: graph.edges });
  const departmentRoots = topology.roots.filter((node) => node.entity_type === "DEPARTMENT");
  const pathwayRoots = topology.roots.filter((node) => node.entity_type === "PATHWAY");
  const core = departmentRoots.find((node) => node.isAcademyCore || node.entity_key === "MYC");

  if (!core) throw new Error("Academy graph must declare its MYC core department");
  if (departmentRoots.length < 2) throw new Error("Academy graph requires at least one peripheral department");
  const unclassifiedRoots = topology.roots.filter((node) =>
    node.id !== core.id && node.entity_type !== "DEPARTMENT" && node.entity_type !== "PATHWAY"
  );
  if (unclassifiedRoots.length) {
    throw new Error("Academy graph contains unsupported root type: " + unclassifiedRoots[0].id);
  }

  const universeRecords = departmentRoots
    .filter((node) => node.id !== core.id)
    .map((node) => ({
      id: node.id,
      nodeId: node.id,
      label: node.title,
      entity_key: node.entity_key,
      color: resolveColor(node, universeColors),
      ...(universeAnchors[node.entity_key] || {})
    }));

  const mycelialTopology = createMycelialTopology({
    core: {
      id: core.id,
      label: core.title,
      color: resolveColor(core, universeColors),
      x: -520,
      y: -80
    },
    territories: universeRecords.map((territory) => ({
      ...territory,
      ...(universeAnchors[territory.entity_key] || { x: 0, y: 0 })
    }))
  });

  const morphology = createRhizomorphicMorphology({
    ...morphologyOptions,
    topology,
    mycelialTopology,
    seed
  });

  const territoryColors = new Map([
    [core.id, resolveColor(core, universeColors)],
    ...universeRecords.map((universe) => [universe.id, universe.color])
  ]);
  const coloredNodes = morphology.nodes.map((node) => ({
    ...node,
    universeColor: territoryColors.get(node.territoryId) ?? node.universeColor ?? PALETTE.pathways
  }));

  const pathwayCount = pathwayRoots.length;
  const pathwayNodes = pathwayRoots.map((node, index) => {
    const angle = pathwayStartAngle + pathwayDirection * TAU * index / Math.max(1, pathwayCount);
    return {
      ...node,
      x: [-600, -250, 80, 600, 1000, 700, 100, -500, -900, -100][index % 10],
      y: [-700, -400, -800, -450, -100, 400, 900, 850, 300, 100][index % 10],
      angle,
      generation: 1,
      territoryId: "pathways",
      universeColor: resolveColor(node, universeColors)
    };
  });

  morphology.nodes = [...coloredNodes, ...pathwayNodes];
  morphology.byId = new Map(morphology.nodes.map((node) => [node.id, node]));
  morphology.metrics = {
    ...morphology.metrics,
    nodeCount: morphology.nodes.length,
    pathwayAnchorCount: pathwayNodes.length,
    territoryCount: territoryColors.size + (pathwayNodes.length ? 1 : 0)
  };
  if (morphology.nodes.length !== topology.nodes.length) {
    const missing = topology.nodes.find((node) => !morphology.byId.has(node.id));
    throw new Error("V2 composition omitted a canonical Academy node: " + (missing?.id || "unknown"));
  }

  const anastomoses = createVisualAnastomoses(morphology, {
    maxDistance: 520,
    maxLinks: 260,
    maxDegree: 5,
    cellSize: 260,
    includeSameTerritory: true,
    ...anastomosisOptions
  });
  const scene = createAtlasScene({
    topology,
    morphology,
    anastomoses: anastomoses.links,
    coreId: core.id
  });

  return Object.freeze({
    topology,
    mycelialTopology,
    morphology,
    anastomoses,
    scene,
    metrics: Object.freeze({
      canonicalNodeCount: topology.nodes.length,
      canonicalRelationshipCount: topology.edges.length,
      departmentCount: departmentRoots.length,
      peripheralUniverseCount: mycelialTopology.count,
      pathwayAnchorCount: pathwayNodes.length,
      renderedNodeCount: scene.metrics.nodeCount,
      hierarchyPathCount: scene.paths.filter((path) => path.type === "hierarchy").length,
      visualOnlyPathCount: scene.metrics.decorativePathCount,
      semanticRelationshipPathCount: scene.relationshipPaths.length
    })
  });
}
