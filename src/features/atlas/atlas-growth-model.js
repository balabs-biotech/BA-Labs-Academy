import { ATLAS_GOLDEN_RATIO, ATLAS_GEOMETRY } from "./atlas-geometry.js";
import { atlasConnectionCurvesClearance, atlasConnectionCurvesIntersect, atlasConnectionCurvesMayBeNear, createAtlasConnectionCurve } from "./atlas-curve.js";

const DEFAULT_OCCUPANCY = 1 - 1 / (ATLAS_GOLDEN_RATIO ** 3);
// World-space clearance threshold used to flag visually crowded, non-crossing
// filaments. It is diagnostic only; it never changes scientific relationships.
const CROSS_GENERATION_CLEARANCE_THRESHOLD = 18;
// Spatial hash cell size is deliberately larger than the near-miss threshold.
// Conservative Bezier control-hull bounds are cached when a branch is inserted.
const COLLISION_GRID_CELL_SIZE = 256;

function conservativeCurveBounds(curve) {
  // A cubic Bezier is contained by the convex hull of its four control
  // points. Unlike a sampled box, this cannot miss a narrow excursion.
  const points = [curve.a, curve.c1, curve.c2, curve.b];
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y))
  };
}

function collisionGridKeys(bounds, padding = CROSS_GENERATION_CLEARANCE_THRESHOLD) {
  const minX = Math.floor((bounds.minX - padding) / COLLISION_GRID_CELL_SIZE);
  const maxX = Math.floor((bounds.maxX + padding) / COLLISION_GRID_CELL_SIZE);
  const minY = Math.floor((bounds.minY - padding) / COLLISION_GRID_CELL_SIZE);
  const maxY = Math.floor((bounds.maxY + padding) / COLLISION_GRID_CELL_SIZE);
  const keys = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) keys.push(x + ":" + y);
  }
  return keys;
}


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

function branchLength(generation, rootId, densityScale) {
  const base = ATLAS_GEOMETRY.childDistances[1] || 760;
  const recursiveLength = base / (ATLAS_GOLDEN_RATIO ** Math.max(0, generation - 1));
  // MYCOLOGIE is the central heart, not a ninth satellite arm. Keep its
  // internal taxonomy compact so the eight disciplinary trunks stay legible.
  const coreScale = rootId === "myc" ? 0.28 : 1;
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
  // Reject malformed identity before indexing: Map construction alone would
  // silently overwrite duplicate IDs and make parent resolution ambiguous.
  const seenIds = new Set();
  for (const node of nodes) {
    if (!node || typeof node.id !== "string" || !node.id.trim()) {
      throw new TypeError("Atlas growth nodes require a non-empty string id");
    }
    if (seenIds.has(node.id)) {
      throw new Error("Atlas hierarchy contains duplicate node id: " + node.id);
    }
    seenIds.add(node.id);
  }

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
  const collisionGrid = new Map();
  const siblingBranches = new Map();
  let collisionCandidateChecks = 0;
  let collisionPossibleChecks = 0;
  function indexCollisionBranch(branch) {
    branch.collisionBounds = conservativeCurveBounds(branch.curve);
    for (const key of collisionGridKeys(branch.collisionBounds, 0)) {
      if (!collisionGrid.has(key)) collisionGrid.set(key, []);
      collisionGrid.get(key).push(branch);
    }
    if (!siblingBranches.has(branch.sourceId)) siblingBranches.set(branch.sourceId, []);
    siblingBranches.get(branch.sourceId).push(branch);
  }
  function findCollisionCandidates(curve, parentId) {
    const bounds = conservativeCurveBounds(curve);
    const candidates = new Set();
    for (const key of collisionGridKeys(bounds)) {
      for (const branch of collisionGrid.get(key) || []) {
        if (branch.sourceId === parentId || branch.targetId === parentId) continue;
        candidates.add(branch);
      }
    }
    return [...candidates];
  }

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
      // Radial spacing responds to both fan population and actual angular
      // crowding. Narrow sectors receive a small bounded extension; the eight
      // generation-1 department anchors are deliberately unchanged.
      const populationScale = generation >= 2
        ? 1 + Math.log2(Math.max(1, children.length)) * 0.075
        : 1;
      const angularCrowding = generation >= 2
        ? Math.max(0, Math.min(1, (0.5 - allocatedWidth) / 0.5)) * 0.08
        : 0;
      const densityScale = Math.min(1.28, populationScale + angularCrowding);
      const distance = branchLength(generation, parent.rootId, densityScale) *
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
          angularCrowding,
          spread: sector.spread
        }
      };
      positioned.set(child.id, point);
      const source = positioned.get(parent.id) || parent;
      // Narrow child sectors use straighter filaments. This reduces lateral
      // excursions that can visually cross neighboring branches in dense fans.
      const bendScale = Math.max(0.2, Math.min(1, allocatedWidth / 1.8));
      const curveOptions = {
        seed: hashString(parent.id + "|" + child.id),
        depth: generation
      };
      // Compare against both siblings and already-created branches from other
      // hierarchy levels. The incoming parent filament and same-parent siblings
      // are handled separately so shared junctions are not misclassified.
      // Query only spatially nearby prior filaments. The grid indexes
      // conservative sampled bounds; the query expands by the full clearance
      // threshold, so it cannot omit a crossing or a qualifying near miss.
      let collisionCandidates = [];
      const crossGenerationOptions = {
        steps: 12,
        startProgress: 0.12,
        endProgress: 0.9
      };
      const hasCrossGenerationIntersection = (candidate) =>
        collisionCandidates.some((branch) =>
          atlasConnectionCurvesIntersect(candidate, branch.curve, {
            steps: 16,
            startProgress: 0.12,
            endProgress: 0.9
          })
        );
      // Clearance is more expensive than intersection testing. Only measure it
      // for cross-generation pairs whose sampled curve bounds can be within
      // the diagnostic threshold; the broad phase cannot discard a true near miss.
      const hasCrossGenerationCrowding = (candidate) =>
        collisionCandidates.some((branch) =>
          branch.generation !== generation &&
          atlasConnectionCurvesMayBeNear(
            candidate, branch.curve,
            CROSS_GENERATION_CLEARANCE_THRESHOLD,
            crossGenerationOptions
          ) &&
          atlasConnectionCurvesClearance(
            candidate, branch.curve, crossGenerationOptions
          ) < CROSS_GENERATION_CLEARANCE_THRESHOLD
        );
      const previousSiblings = siblingBranches.get(parent.id) || [];
      let resolvedBendScale = bendScale;
      let curve = createAtlasConnectionCurve(source, point, {
        ...curveOptions,
        bendScale: resolvedBendScale
      });
      collisionCandidates = findCollisionCandidates(curve, parent.id);
      collisionCandidateChecks += collisionCandidates.length;
      collisionPossibleChecks += Math.max(0,
        branches.length - previousSiblings.length - (parent.parent ? 1 : 0)
      );
      let adjustmentAttempts = 0;
      let crowdingAdjustmentAttempts = 0;
      // Resolve intersections first, then reduce cross-generation near misses.
      // Only curvature changes: node coordinates, sectors and primary anchors
      // remain untouched by this bounded local correction.
      while (adjustmentAttempts < 8) {
        const siblingCollision = previousSiblings.some((branch) =>
          atlasConnectionCurvesIntersect(curve, branch.curve, {
            steps: 20,
            startProgress: 0.12
          })
        );
        const crossGenerationIntersection = hasCrossGenerationIntersection(curve);
        const crossGenerationCrowding = !siblingCollision && !crossGenerationIntersection &&
          hasCrossGenerationCrowding(curve);
        if (!siblingCollision && !crossGenerationIntersection && !crossGenerationCrowding) break;
        if (crossGenerationCrowding) crowdingAdjustmentAttempts += 1;
        resolvedBendScale = Math.max(0.2, resolvedBendScale * 0.75);
        adjustmentAttempts += 1;
        curve = createAtlasConnectionCurve(source, point, {
          ...curveOptions,
          bendScale: resolvedBendScale
        });
        if (resolvedBendScale === 0.2) break;
      }
      const completedBranch = {
        id: parent.id + "->" + child.id,
        sourceId: parent.id,
        targetId: child.id,
        generation,
        source,
        target: point,
        curve,
        bendScale: resolvedBendScale,
        curveAdjustmentAttempts: adjustmentAttempts,
        crowdingAdjustmentAttempts,
        crossGenerationChecked: true
      };
      branches.push(completedBranch);
      indexCollisionBranch(completedBranch);
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
  let crossGenerationComparedPairs = 0;
  let crossGenerationBroadPhaseRejectedPairs = 0;
  let crossGenerationCrossingCount = 0;
  let crossGenerationNearMissCount = 0;
  let crossGenerationMinimumClearance = Number.POSITIVE_INFINITY;
  for (let first = 0; first < allBranches.length; first += 1) {
    for (let second = first + 1; second < allBranches.length; second += 1) {
      const a = allBranches[first];
      const b = allBranches[second];
      if (a.generation === b.generation || a.sourceId === b.sourceId ||
          a.targetId === b.sourceId || b.targetId === a.sourceId) continue;
      crossGenerationComparedPairs += 1;
      const comparisonOptions = {
        steps: 12,
        startProgress: 0.12,
        endProgress: 0.9
      };
      // Reject curve pairs whose sampled world-space bounds cannot approach
      // within the clearance threshold. This broad phase is conservative:
      // intersecting curves necessarily have overlapping bounds.
      if (!atlasConnectionCurvesMayBeNear(
        a.curve, b.curve, CROSS_GENERATION_CLEARANCE_THRESHOLD, comparisonOptions
      )) {
        crossGenerationBroadPhaseRejectedPairs += 1;
        continue;
      }
      if (atlasConnectionCurvesIntersect(a.curve, b.curve, comparisonOptions)) {
        crossGenerationCrossingCount += 1;
        crossGenerationMinimumClearance = 0;
        continue;
      }
      // Segment-level bounding boxes inside the clearance routine prune
      // distant segment pairs before exact distance calculations.
      const clearance = atlasConnectionCurvesClearance(
        a.curve, b.curve, comparisonOptions
      );
      crossGenerationMinimumClearance = Math.min(crossGenerationMinimumClearance, clearance);
      if (clearance < CROSS_GENERATION_CLEARANCE_THRESHOLD) {
        crossGenerationNearMissCount += 1;
      }
    }
  }
  const fanDiagnostics = [...branchesByParent.entries()].map(([parentId, siblings]) => {
    let crossingCount = 0;
    let adjustedBranchCount = 0;
    let minimumClearance = Number.POSITIVE_INFINITY;
    adjustedBranchCount = siblings.filter((branch) => branch.curveAdjustmentAttempts > 0).length;
    for (let first = 0; first < siblings.length; first += 1) {
      for (let second = first + 1; second < siblings.length; second += 1) {
        if (atlasConnectionCurvesIntersect(siblings[first].curve, siblings[second].curve, {
          steps: 16,
          startProgress: 0.12
        })) crossingCount += 1;
        minimumClearance = Math.min(minimumClearance,
          atlasConnectionCurvesClearance(siblings[first].curve, siblings[second].curve, {
            steps: 16,
            startProgress: 0.12
          })
        );
      }
    }
    return {
      parentId,
      siblingCount: siblings.length,
      crossingCount,
      adjustedBranchCount,
      minimumClearance: Number.isFinite(minimumClearance) ? minimumClearance : null
    };
  });
  return {
    nodes: allNodes,
    branches: allBranches,
    fanDiagnostics,
    collisionCandidateDiagnostics: {
      possibleChecks: collisionPossibleChecks,
      candidateChecks: collisionCandidateChecks,
      excludedChecks: collisionPossibleChecks - collisionCandidateChecks,
      candidateRatio: collisionPossibleChecks
        ? collisionCandidateChecks / collisionPossibleChecks
        : 0
    },
    crossGenerationDiagnostics: {
      comparedPairs: crossGenerationComparedPairs,
      broadPhaseRejectedPairs: crossGenerationBroadPhaseRejectedPairs,
      narrowPhasePairs: crossGenerationComparedPairs - crossGenerationBroadPhaseRejectedPairs,
      crossingCount: crossGenerationCrossingCount,
      nearMissCount: crossGenerationNearMissCount,
      minimumClearance: Number.isFinite(crossGenerationMinimumClearance)
        ? crossGenerationMinimumClearance
        : null,
      clearanceThreshold: CROSS_GENERATION_CLEARANCE_THRESHOLD
    },
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
    fanDiagnostics: growthModel.fanDiagnostics,
    collisionCandidateDiagnostics: growthModel.collisionCandidateDiagnostics,
    crossGenerationDiagnostics: growthModel.crossGenerationDiagnostics,
    growthPreview: {
      depth: visibleDepth,
      maxDepth: growthModel.maxDepth,
      totalNodes: growthModel.nodes.length,
      visibleNodes: nodes.length,
      visibleBranches: growthModel.visibleBranches.length
    }
  };
}
