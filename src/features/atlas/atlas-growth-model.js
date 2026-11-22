import { ATLAS_GOLDEN_RATIO, ATLAS_GEOMETRY } from "./atlas-geometry.js";
import { atlasConnectionCurvesIntersect, createAtlasConnectionCurve, sampleAtlasConnectionCurve } from "./atlas-curve.js";

const DEFAULT_OCCUPANCY = 1 - 1 / (ATLAS_GOLDEN_RATIO ** 3);

function descendantsWeight(nodeId, childrenByParent, memo, visiting) {
  if (memo.has(nodeId)) return memo.get(nodeId);
  if (visiting.has(nodeId)) throw new Error("Atlas hierarchy contains a cycle at " + nodeId);
  visiting.add(nodeId);
  const children = childrenByParent.get(nodeId) || [];
  const weight = children.length
    ? children.reduce((sum, child) => sum + descendantsWeight(child.id, childrenByParent, memo, visiting), 0)
    : 1;
  visiting.delete(nodeId);
  memo.set(nodeId, Math.max(1, weight));
  return Math.max(1, weight);
}

function allocateSectors(children, parentSector, weights, occupancy) {
  const totalWeight = children.reduce((sum, child) => sum + weights.get(child.id), 0);
  // Occupancy creates a visible gap between sibling fans, but is not
  // compounded into the next generation's reserved sector.
  const allocationSpread = parentSector.fullRing
    ? parentSector.spread
    : parentSector.spread * occupancy;
  const start = parentSector.fullRing ? 0 : -allocationSpread / 2;
  let cursor = start;
  return children.map((child) => {
    const width = allocationSpread * weights.get(child.id) / totalWeight;
    const sector = {
      angle: parentSector.angle + cursor + width / 2,
      spread: parentSector.fullRing ? width : width / occupancy,
      fullRing: false
    };
    cursor += width;
    return sector;
  });
}

function branchLength(generation, rootId, siblingCount) {
  const base = ATLAS_GEOMETRY.childDistances[1] || 760;
  const recursiveLength = base / (ATLAS_GOLDEN_RATIO ** Math.max(0, generation - 1));
  // MYCOLOGIE is the central heart, not a ninth satellite arm. Keep its
  // internal taxonomy compact so the eight disciplinary trunks stay legible.
  const coreScale = rootId === "myc" ? 0.28 : 1;
  // Dense secondary fans need a little more radial room to keep adjacent
  // filaments legible. Primary department anchors remain geometrically fixed.
  const densityScale = generation >= 2
    ? Math.min(1.28, 1 + Math.log2(Math.max(1, siblingCount)) * 0.075)
    : 1;
  return Math.max(72, recursiveLength * coreScale * densityScale);
}

/**
 * Builds a deterministic, recursive growth skeleton from the canonical
 * parent-child hierarchy. Cross-disciplinary edges remain relationships,
 * never growth instructions.
 *
 * All positions are computed before visibility is filtered. Increasing
 * visibleDepth therefore reveals another generation without moving any
 * previously visible node.
 */
export function createAtlasGrowthModel({
  nodes,
  visibleDepth = Number.POSITIVE_INFINITY,
  occupancy = DEFAULT_OCCUPANCY
}) {
  if (!Array.isArray(nodes)) throw new TypeError("Atlas growth requires a node array");
  if (!(occupancy > 0 && occupancy <= 1)) throw new RangeError("occupancy must be in (0, 1]");

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map();
  for (const node of nodes) {
    if (!node.parent) continue;
    if (!byId.has(node.parent)) throw new Error("Missing Atlas parent: " + node.parent);
    if (!childrenByParent.has(node.parent)) childrenByParent.set(node.parent, []);
    childrenByParent.get(node.parent).push(node);
  }

  const weights = new Map();
  // Validate every connected component, including malformed components with no root.
  for (const node of nodes) descendantsWeight(node.id, childrenByParent, weights, new Set());
  const roots = nodes.filter((node) => !node.parent);
  const positioned = new Map();
  const branches = [];

  function grow(parent, parentSector) {
    const children = childrenByParent.get(parent.id) || [];
    if (!children.length) return;
    const sectors = allocateSectors(children, parentSector, weights, occupancy);

    children.forEach((child, index) => {
      const sector = sectors[index];
      const generation = Number.isFinite(child.level) ? child.level : (parent.level || 0) + 1;
      // Small, stable deviations prevent the hierarchy from reading as a perfect
      // geometric fan. Jitter stays inside each child's allocated angular sector.
      const angularUnit = stableUnit(hashString(parent.id + "|" + child.id + "|angle"));
      const lengthUnit = stableUnit(hashString(parent.id + "|" + child.id + "|length"));
      const allocatedWidth = sector.spread * occupancy;
      const angularJitter = children.length > 1
        ? (angularUnit - 0.5) * allocatedWidth * 0.18
        : 0;
      const angle = sector.angle + angularJitter;
      const densityScale = generation >= 2
        ? Math.min(1.28, 1 + Math.log2(Math.max(1, children.length)) * 0.075)
        : 1;
      const distance = branchLength(generation, parent.rootId, children.length) *
        (0.94 + lengthUnit * 0.12);
      const point = {
        ...child,
        x: parent.x + Math.cos(angle) * distance,
        y: parent.y + Math.sin(angle) * distance,
        angle,
        generation,
        growthSector: {
          angle,
          centerAngle: sector.angle,
          angularOffset: angularJitter,
          allocatedSpread: allocatedWidth,
          densityScale,
          spread: sector.spread
        }
      };
      positioned.set(child.id, point);
      const source = positioned.get(parent.id) || parent;
      // Narrow child sectors use straighter filaments. This reduces lateral
      // excursions that can visually cross neighboring branches in dense fans.
      const bendScale = Math.max(0.2, Math.min(1, allocatedWidth / 1.8));
      const curve = createAtlasConnectionCurve(source, point, {
        seed: hashString(parent.id + "|" + child.id),
        depth: generation,
        bendScale
      });
      branches.push({
        id: parent.id + "->" + child.id,
        sourceId: parent.id,
        targetId: child.id,
        generation,
        source,
        target: point,
        curve
      });
      grow(point, sector);
    });
  }

  for (const root of roots) {
    positioned.set(root.id, { ...root, generation: 0 });
    const isMycologyCore = root.entity_type === "DEPARTMENT" && root.entity_key === "MYC";
    const sector = root.growthSector;
    const spread = Number.isFinite(sector?.spread)
      ? sector.spread
      : isMycologyCore ? Math.PI * 2 : ATLAS_GEOMETRY.departmentPetalSpread;
    grow(root, {
      angle: Number.isFinite(sector?.angle) ? sector.angle
        : Number.isFinite(root.angle) ? root.angle : -Math.PI / 2,
      spread,
      fullRing: sector?.fullRing ?? isMycologyCore
    });
  }

  const allNodes = nodes.map((node) => positioned.get(node.id) || { ...node, generation: node.level || 0 });
  const allBranches = branches;
  // Measure sibling filament geometry once during model construction. These
  // diagnostics deliberately exclude the shared launch region near the parent.
  const branchesByParent = new Map();
  for (const branch of allBranches) {
    if (!branchesByParent.has(branch.sourceId)) branchesByParent.set(branch.sourceId, []);
    branchesByParent.get(branch.sourceId).push(branch);
  }
  const fanDiagnostics = [...branchesByParent.entries()].map(([parentId, siblings]) => {
    let crossingCount = 0;
    let minimumClearance = Number.POSITIVE_INFINITY;
    for (let first = 0; first < siblings.length; first += 1) {
      const firstSamples = sampleAtlasConnectionCurve(siblings[first].curve, {
        steps: 16,
        startProgress: 0.12
      });
      for (let second = first + 1; second < siblings.length; second += 1) {
        const secondSamples = sampleAtlasConnectionCurve(siblings[second].curve, {
          steps: 16,
          startProgress: 0.12
        });
        if (atlasConnectionCurvesIntersect(siblings[first].curve, siblings[second].curve, {
          steps: 16,
          startProgress: 0.12
        })) crossingCount += 1;
        for (const a of firstSamples) {
          for (const b of secondSamples) {
            minimumClearance = Math.min(minimumClearance, Math.hypot(a.x - b.x, a.y - b.y));
          }
        }
      }
    }
    return {
      parentId,
      siblingCount: siblings.length,
      crossingCount,
      minimumClearance: Number.isFinite(minimumClearance) ? minimumClearance : null
    };
  });
  return {
    nodes: allNodes,
    branches: allBranches,
    fanDiagnostics,
    visibleNodes: allNodes.filter((node) => node.generation <= visibleDepth),
    visibleBranches: allBranches.filter((branch) => branch.generation <= visibleDepth),
    byId: new Map(allNodes.map((node) => [node.id, node])),
    maxDepth: allNodes.reduce((max, node) => Math.max(max, node.generation || 0), 0)
  };
}

function stableUnit(hash) {
  return (hash >>> 0) / 0xffffffff;
}

function hashString(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
}

export const ATLAS_GROWTH_DEFAULTS = Object.freeze({
  occupancy: DEFAULT_OCCUPANCY,
  generationLengthBase: ATLAS_GEOMETRY.childDistances[1],
  generationLengthRatio: ATLAS_GOLDEN_RATIO
});


/**
 * Creates a render-ready graph snapshot for the optional growth preview.
 * Hierarchy edges follow the new positions; transversal edges are retained
 * only when both endpoints are visible at the requested depth.
 */
export function createAtlasGrowthGraph(graph, { visibleDepth = Number.POSITIVE_INFINITY } = {}) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new TypeError("Atlas growth preview requires a graph with nodes and edges");
  }
  const growthModel = createAtlasGrowthModel({ nodes: graph.nodes, visibleDepth });
  const nodes = growthModel.visibleNodes;
  const visibleIds = new Set(nodes.map((node) => node.id));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = graph.edges
    .filter((edge) => visibleIds.has(edge.a.id) && visibleIds.has(edge.b.id))
    .map((edge) => ({
      ...edge,
      a: byId.get(edge.a.id),
      b: byId.get(edge.b.id)
    }));
  const remap = (index) => new Map(
    [...(index || new Map()).entries()]
      .filter(([, node]) => byId.has(node.id))
      .map(([key, node]) => [key, byId.get(node.id)])
  );

  return {
    ...graph,
    nodes,
    edges,
    morphologyBranches: (graph.morphologyBranches || []).map((branch) => ({
      ...branch,
      source: byId.get(branch.sourceId),
      target: byId.get(branch.targetId)
    })).filter((branch) => branch.source && branch.target),
    byId,
    departmentNodes: remap(graph.departmentNodes),
    domainNodes: remap(graph.domainNodes),
    sectionNodes: remap(graph.sectionNodes),
    growthPreview: {
      depth: visibleDepth,
      maxDepth: growthModel.maxDepth,
      totalNodes: growthModel.nodes.length,
      visibleNodes: nodes.length,
      visibleBranches: growthModel.visibleBranches.length
    }
  };
}
