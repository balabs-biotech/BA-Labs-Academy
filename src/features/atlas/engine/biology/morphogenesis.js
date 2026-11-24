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
  if (children.length > 1 && !fullRing && spread <= 0) {
    throw new RangeError("Branch spread must be positive when a parent has multiple children");
  }
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

  return children.map((child, index) => {
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
        start, end, center,
        gapAfter: fullRing || index < children.length - 1 ? effectiveGap : 0,
        effectiveGap
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
  const bend1 = (stableUnit(seed + "|bend-a") - 0.5) * 2 * distance * bendRatio;
  const bend2 = (stableUnit(seed + "|bend-b") - 0.5) * 2 * distance * bendRatio;
  return {
    a: { x: source.x, y: source.y },
    c1: { x: source.x + dx / 3 + normalX * bend1, y: source.y + dy / 3 + normalY * bend1 },
    c2: { x: source.x + 2 * dx / 3 + normalX * bend2, y: source.y + 2 * dy / 3 + normalY * bend2 },
    b: { x: target.x, y: target.y }
  };
}


function pointOnCurve(curve, t) {
  const inverse = 1 - t;
  const a = inverse ** 3;
  const b = 3 * inverse ** 2 * t;
  const c = 3 * inverse * t ** 2;
  const d = t ** 3;
  return {
    x: a * curve.a.x + b * curve.c1.x + c * curve.c2.x + d * curve.b.x,
    y: a * curve.a.y + b * curve.c1.y + c * curve.c2.y + d * curve.b.y
  };
}

function createSecondaryHyphae(branches, territories, seed, limit = 1200) {
  const hyphae = [];
  for (const branch of branches) {
    if (hyphae.length >= limit) break;
    const dx = branch.target.x - branch.source.x;
    const dy = branch.target.y - branch.source.y;
    const length = Math.hypot(dx, dy);
    if (length < 58) continue;
    const desired = branch.generation <= 3 ? 2 : stableUnit(seed + "|density|" + branch.id) > 0.62 ? 1 : 0;
    const normal = { x: -dy / length, y: dx / length };
    const tangent = { x: dx / length, y: dy / length };
    for (let index = 0; index < desired && hyphae.length < limit; index += 1) {
      const id = "hypha:" + branch.id + ":" + index;
      const localSeed = seed + "|" + id;
      const t = 0.28 + stableUnit(localSeed + "|position") * 0.44;
      const origin = pointOnCurve(branch.curve, t);
      const side = stableUnit(localSeed + "|side") > 0.5 ? 1 : -1;
      const branchLength = length * (0.12 + stableUnit(localSeed + "|length") * 0.1);
      const drift = branchLength * 0.28;
      const endpoint = {
        x: origin.x + normal.x * branchLength * side + tangent.x * drift,
        y: origin.y + normal.y * branchLength * side + tangent.y * drift
      };
      const color = territories.get(branch.territoryId)?.color
        ?? branch.target.universeColor ?? branch.target.color ?? branch.source.universeColor ?? null;
      hyphae.push({
        id, territoryId: branch.territoryId, color,
        style: "secondary-hypha",
        width: 0.65 + stableUnit(localSeed + "|width") * 0.35,
        curve: createCurve(origin, endpoint, localSeed, 0.28)
      });
    }
  }
  return hyphae;
}

/** Generate deterministic rhizomorphic growth across an irregular, non-radial mycelial field. */
export function createRhizomorphicMorphology({
  topology,
  mycelialTopology,
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
  const spatialTopology = mycelialTopology ?? (radialTopology?.core && Array.isArray(radialTopology.universes) ? {
    core: { ...radialTopology.core, x: radialTopology.core.x ?? 0, y: radialTopology.core.y ?? 0 },
    territories: radialTopology.universes.map((universe) => ({ ...universe, x: universe.x, y: universe.y }))
  } : null);
  if (!spatialTopology?.core || !Array.isArray(spatialTopology.territories)) {
    throw new TypeError("Morphogenesis requires a validated mycelial spatial topology");
  }
  for (const [name, value] of Object.entries({ coreBranchLength, branchLength, universeSpread, branchSpread, lengthVariation, curveBend, minimumBranchLength, minimumAngularGap })) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(name + " must be finite and non-negative");
  }
  if (branchLength <= 0 || coreBranchLength <= 0 || minimumBranchLength <= 0) throw new RangeError("Branch lengths must be positive");
  if (minimumAngularGap <= 0) throw new RangeError("minimumAngularGap must be positive");
  if (lengthVariation > 0.5 || curveBend > 0.5 || universeSpread > TAU || branchSpread > TAU || minimumAngularGap > TAU) {
    throw new RangeError("Morphogenesis variation and spread exceed safe bounds");
  }

  const coreId = spatialTopology.core.id;
  const coreRecord = topology.byId.get(coreId);
  if (!coreRecord) throw new Error("Radial core is absent from Atlas topology: " + coreId);

  const weights = buildSubtreeWeights(topology);
  const positioned = new Map();
  const branches = [];
  const territories = new Map();
  const queue = [];
  const core = { ...coreRecord, x: spatialTopology.core.x, y: spatialTopology.core.y, angle: null, generation: 1, territoryId: coreId };
  positioned.set(coreId, core);

  const addBranch = (source, target, { id, territoryId, generation, visualOnly = false }) => {
    branches.push({
      id, sourceId: source.id, targetId: target.id, source, target,
      territoryId, generation, visualOnly,
      style: visualOnly ? "universe-trunk" : generation <= 2 ? "rhizomorph" : "primary-hypha",
      width: visualOnly ? 5 : Math.max(1.1, 4.2 / Math.sqrt(generation)),
      seed: hashString(seed + "|" + id),
      curve: createCurve(source, target, seed + "|" + id, curveBend)
    });
  };

  const roots = [core];
  for (const territory of spatialTopology.territories) {
    const nodeId = territory.nodeId || territory.id;
    const record = topology.byId.get(nodeId);
    if (!record) throw new Error("Mycelial territory has no matching topology node: " + nodeId);
    if (topology.parentById.has(nodeId)) throw new Error("Mycelial territory must map to a hierarchy root: " + nodeId);
    if (positioned.has(nodeId)) throw new Error("Morphogenesis node belongs to multiple territories: " + nodeId);
    const node = {
      ...record, x: territory.x, y: territory.y, angle: null,
      generation: 1, territoryId: territory.id, universeColor: territory.color
    };
    positioned.set(node.id, node);
    territories.set(territory.id, { id: territory.id, nodeId, color: territory.color });
    roots.push(node);
  }

  // Connect department territories with a minimum-spanning growth walk.
  // The biological root is one territory in the field, not a central radial hub.
  const connected = [core];
  const remaining = roots.slice(1);
  while (remaining.length) {
    let best = null;
    for (const source of connected) {
      for (const target of remaining) {
        const distance = Math.hypot(target.x - source.x, target.y - source.y);
        if (!best || distance < best.distance) best = { source, target, distance };
      }
    }
    const targetIndex = remaining.indexOf(best.target);
    remaining.splice(targetIndex, 1);
    connected.push(best.target);
    addBranch(best.source, best.target, {
      id: "trunk:" + best.source.id + ":" + best.target.id,
      territoryId: best.target.territoryId,
      generation: 1,
      visualOnly: true
    });
  }

  // Orient each territory toward its nearest neighboring territory, not away from a
  // global centroid. This prevents isolated radial bouquets and encourages interwoven growth.
  for (const root of roots) {
    const children = topology.childrenByParent.get(root.id) || [];
    const neighbor = roots
      .filter((candidate) => candidate.id !== root.id)
      .map((candidate) => ({
        node: candidate,
        distance: Math.hypot(candidate.x - root.x, candidate.y - root.y)
      }))
      .sort((a, b) => a.distance - b.distance || a.node.id.localeCompare(b.node.id))[0]?.node;
    const baseAngle = neighbor
      ? Math.atan2(neighbor.y - root.y, neighbor.x - root.x)
      : 0;
    const orientationJitter = (stableUnit(seed + "|territory-axis|" + root.id) - 0.5) * 1.1;
    const growthAngle = baseAngle + orientationJitter;
    queue.push({
      node: root,
      angle: growthAngle,
      generation: 1,
      territoryId: root.territoryId,
      spread: universeSpread
    });
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
  const hyphae = createSecondaryHyphae(branches, territories, seed, 1200);
  return {
    nodes, branches, hyphae,
    byId: new Map(nodes.map((node) => [node.id, node])),
    territories,
    metrics: {
      nodeCount: nodes.length,
      branchCount: branches.length,
      hyphaCount: hyphae.length,
      territoryCount: territories.size,
      maxGeneration: nodes.reduce((maximum, node) => Math.max(maximum, node.generation), 0)
    }
  };
}
