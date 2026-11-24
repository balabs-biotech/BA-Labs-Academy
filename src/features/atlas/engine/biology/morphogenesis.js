const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;
const TAU = Math.PI * 2;

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

function stableUnit(value) {
  return hashString(value) / 0xffffffff;
}

function buildSubtreeWeights(topology) {
  const weights = new Map(topology.nodes.map((node) => [node.id, 1]));
  const deepestFirst = [...topology.nodes].sort((a, b) => topology.depthById.get(b.id) - topology.depthById.get(a.id));
  for (const node of deepestFirst) {
    const parentId = topology.parentById.get(node.id);
    if (parentId) weights.set(parentId, weights.get(parentId) + weights.get(node.id));
  }
  return weights;
}

function allocateSectors(children, centerAngle, spread, weights, {
  fullRing = false, seed = "", minimumAngularGap = 0.08
} = {}) {
  if (!children.length) return [];
  if (children.length === 1) {
    const width = fullRing ? TAU : spread;
    const start = fullRing ? centerAngle - Math.PI : centerAngle - width / 2;
    return [{
      angle: centerAngle,
      sector: { start, end: start + width, center: centerAngle, gapAfter: 0, effectiveGap: 0 }
    }];
  }

  const available = fullRing ? TAU : spread;
  const gapCount = fullRing ? children.length : children.length - 1;
  const gapCap = available / (children.length * 2);
  const effectiveGap = Math.min(minimumAngularGap, gapCap);
  const usable = Math.max(available - effectiveGap * gapCount, available * 0.5);
  const total = children.reduce((sum, child) => sum + weights.get(child.id), 0);
  const baseStart = fullRing ? centerAngle : centerAngle - available / 2;
  let cursor = 0;

  return children.map((child) => {
    const width = usable * weights.get(child.id) / total;
    const start = baseStart + cursor;
    const end = start + width;
    const center = start + width / 2;
    const jitter = (stableUnit(seed + "|" + child.id) - 0.5) * width * 0.22;
    const angle = Math.max(start + width * 0.1, Math.min(end - width * 0.1, center + jitter));
    cursor += width + effectiveGap;
    return {
      angle,
      sector: {
        start, end, center, gapAfter: effectiveGap, effectiveGap
      }
    };
  });
}

function createCurve(source, target, seed, bendRatio) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy) || 1;
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const bend = (stableUnit(seed + "|bend") - 0.5) * 2 * distance * bendRatio;
  return {
    a: { x: source.x, y: source.y },
    c1: { x: source.x + dx / 3 + normalX * bend, y: source.y + dy / 3 + normalY * bend },
    c2: { x: source.x + 2 * dx / 3 + normalX * bend, y: source.y + 2 * dy / 3 + normalY * bend },
    b: { x: target.x, y: target.y }
  };
}

/** Generate deterministic rhizomorphic growth from validated pedagogy and radial anchors. */
export function createRhizomorphicMorphology({
  topology,
  radialTopology,
  seed = "academy-atlas-v2",
  coreBranchLength = 180,
  branchLength = 280,
  universeSpread = 1.35,
  branchSpread = 1.05,
  lengthVariation = 0.08,
  curveBend = 0.12,
  minimumBranchLength = 42,
  minimumAngularGap = 0.08
}) {
  if (!topology?.byId || !topology?.childrenByParent || !topology?.depthById) {
    throw new TypeError("Morphogenesis requires a validated Atlas topology");
  }
  if (!radialTopology?.core || !Array.isArray(radialTopology.universes)) {
    throw new TypeError("Morphogenesis requires a radial topology");
  }
  for (const [name, value] of Object.entries({ coreBranchLength, branchLength, universeSpread, branchSpread, lengthVariation, curveBend, minimumBranchLength, minimumAngularGap })) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(name + " must be finite and non-negative");
  }
  if (branchLength <= 0 || coreBranchLength <= 0 || minimumBranchLength <= 0) throw new RangeError("Branch lengths must be positive");
  if (lengthVariation > 0.5 || curveBend > 0.5 || universeSpread > TAU || branchSpread > TAU || minimumAngularGap > TAU) {
    throw new RangeError("Morphogenesis variation and spread exceed safe bounds");
  }

  const coreId = radialTopology.core.id;
  const coreRecord = topology.byId.get(coreId);
  if (!coreRecord) throw new Error("Radial core is absent from Atlas topology: " + coreId);

  const weights = buildSubtreeWeights(topology);
  const positioned = new Map();
  const branches = [];
  const territories = new Map();
  const queue = [];
  const core = { ...coreRecord, x: 0, y: 0, angle: null, generation: 0, territoryId: coreId };
  positioned.set(coreId, core);

  const addBranch = (source, target, { id, territoryId, generation, visualOnly = false }) => {
    branches.push({
      id, sourceId: source.id, targetId: target.id, source, target,
      territoryId, generation, visualOnly,
      seed: hashString(seed + "|" + id),
      curve: createCurve(source, target, seed + "|" + id, curveBend)
    });
  };

  const coreChildren = topology.childrenByParent.get(coreId) || [];
  const coreSectors = allocateSectors(coreChildren, -Math.PI / 2, TAU, weights, {
    fullRing: true, seed: seed + "|core", minimumAngularGap
  });
  coreChildren.forEach((child, index) => {
    const { angle, sector } = coreSectors[index];
    const distance = coreBranchLength * (0.96 + stableUnit(seed + "|core-length|" + child.id) * 0.08);
    const node = { ...child, x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, angle, sector, generation: 1, territoryId: coreId };
    positioned.set(node.id, node);
    addBranch(core, node, { id: "branch:" + coreId + ":" + node.id, territoryId: coreId, generation: 1 });
    queue.push({ node, angle, generation: 1, territoryId: coreId, spread: branchSpread });
  });

  for (const universe of radialTopology.universes) {
    const nodeId = universe.nodeId || universe.id;
    const record = topology.byId.get(nodeId);
    if (!record) throw new Error("Radial universe has no matching topology node: " + nodeId);
    if (topology.parentById.has(nodeId)) throw new Error("Radial universe must map to a hierarchy root: " + nodeId);
    if (positioned.has(nodeId)) throw new Error("Morphogenesis node belongs to multiple territories: " + nodeId);
    const node = {
      ...record, x: universe.x, y: universe.y, angle: universe.angle,
      generation: 1, territoryId: universe.id, universeColor: universe.color
    };
    positioned.set(node.id, node);
    territories.set(universe.id, { id: universe.id, nodeId, color: universe.color, angle: universe.angle });
    addBranch(core, node, { id: "trunk:" + coreId + ":" + universe.id, territoryId: universe.id, generation: 1, visualOnly: true });
    queue.push({ node, angle: universe.angle, generation: 1, territoryId: universe.id, spread: universeSpread });
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const children = topology.childrenByParent.get(current.node.id) || [];
    if (!children.length) continue;
    const sectors = allocateSectors(children, current.angle, current.spread, weights, {
      seed: seed + "|" + current.node.id + "|fan", minimumAngularGap
    });
    children.forEach((child, index) => {
      if (positioned.has(child.id)) throw new Error("Morphogenesis encountered a node more than once: " + child.id);
      const generation = current.generation + 1;
      const { angle, sector } = sectors[index];
      const nominalLength = branchLength / (GOLDEN_RATIO ** Math.max(0, generation - 2));
      const lengthUnit = stableUnit(seed + "|length|" + current.node.id + "|" + child.id);
      const distance = Math.max(minimumBranchLength, nominalLength * (1 - lengthVariation + 2 * lengthVariation * lengthUnit));
      const node = {
        ...child,
        x: current.node.x + Math.cos(angle) * distance,
        y: current.node.y + Math.sin(angle) * distance,
        angle, sector, generation, territoryId: current.territoryId
      };
      positioned.set(node.id, node);
      addBranch(current.node, node, { id: "branch:" + current.node.id + ":" + node.id, territoryId: current.territoryId, generation });
      queue.push({ node, angle, generation, territoryId: current.territoryId, spread: Math.max(0.28, current.spread / GOLDEN_RATIO) });
    });
  }

  const nodes = [...positioned.values()];
  return {
    nodes, branches,
    byId: new Map(nodes.map((node) => [node.id, node])),
    territories,
    metrics: {
      nodeCount: nodes.length,
      branchCount: branches.length,
      territoryCount: territories.size,
      maxGeneration: nodes.reduce((maximum, node) => Math.max(maximum, node.generation), 0)
    }
  };
}
