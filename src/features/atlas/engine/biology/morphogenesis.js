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
    const jitter = (stableUnit(seed + "|" + child.id) - 0.5) * width * 0.72;
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

function tangentOnCurve(curve, t) {
  const inverse = 1 - t;
  const dx = 3 * inverse ** 2 * (curve.c1.x - curve.a.x)
    + 6 * inverse * t * (curve.c2.x - curve.c1.x)
    + 3 * t ** 2 * (curve.b.x - curve.c2.x);
  const dy = 3 * inverse ** 2 * (curve.c1.y - curve.a.y)
    + 6 * inverse * t * (curve.c2.y - curve.c1.y)
    + 3 * t ** 2 * (curve.b.y - curve.c2.y);
  return Math.atan2(dy, dx);
}

function createSecondaryHyphae(branches, territories, seed, limit = 1200) {
  const hyphae = [];
  const queue = [];
  // Reserve enough first-generation capacity for every territory trunk when
  // the total budget allows it, while keeping tight test/runtime budgets recursive.
  const trunkReserve = branches.filter((branch) => branch.style === "mycelial-trunk").length * 26;
  const basePrimaryBudget = Math.floor(limit * 0.3);
  const primaryBudget = Math.max(basePrimaryBudget, trunkReserve);

  // First generation: lateral explorers emerge from the main colony cords.
  const growthOrder = [...branches].sort((a, b) =>
    Number(b.style === "mycelial-trunk") - Number(a.style === "mycelial-trunk")
  );
  for (const branch of growthOrder) {
    if (queue.length >= primaryBudget) break;
    const dx = branch.target.x - branch.source.x;
    const dy = branch.target.y - branch.source.y;
    const length = Math.hypot(dx, dy);
    if (length < 58) continue;
    const density = stableUnit(seed + "|density|" + branch.id);
    const count = branch.style === "colony-front" ? 2 + Math.floor(density * 2)
      : branch.style === "mycelial-trunk" ? 18 + Math.floor(density * 9)
      : branch.style === "primary-spine" ? 4 + Math.floor(density * 4)
      : branch.generation <= 3 ? (density > 0.3 ? 3 : 2)
      : density > 0.56 ? 3 : 2;
    for (let index = 0; index < count && queue.length < primaryBudget; index += 1) {
      const id = "hypha:" + branch.id + ":" + index;
      const localSeed = seed + "|" + id;
      const t = 0.06 + stableUnit(localSeed + "|position") * 0.88;
      const origin = pointOnCurve(branch.curve, t);
      const side = stableUnit(localSeed + "|side") > 0.5 ? 1 : -1;
      const baseAngle = tangentOnCurve(branch.curve, t);
      const angle = baseAngle + side * (0.5 + stableUnit(localSeed + "|angle") * 0.55);
      const branchLength = length * (0.16 + stableUnit(localSeed + "|length") * 0.12);
      const endpoint = {
        x: origin.x + Math.cos(angle) * branchLength,
        y: origin.y + Math.sin(angle) * branchLength
      };
      const color = territories.get(branch.territoryId)?.color
        ?? branch.target.universeColor ?? branch.target.color ?? branch.source.universeColor ?? null;
      const item = {
        id, parentBranchId: branch.id, originT: t, territoryId: branch.territoryId, color,
        style: "secondary-hypha", generation: 1,
        width: 1.35 + stableUnit(localSeed + "|width") * 0.75,
        curve: createCurve(origin, endpoint, localSeed, 0.18)
      };
      queue.push({ item, endpoint, angle, length: branchLength, color, territoryId: branch.territoryId, seed: localSeed });
    }
  }

  // Subsequent generations branch from the previous hyphae, with decreasing
  // length and caliber. This produces a deterministic fractal exploration
  // instead of isolated decorative hairs attached only to the main branches.
  for (let cursor = 0; cursor < queue.length && hyphae.length < limit; cursor += 1) {
    const parent = queue[cursor];
    hyphae.push(parent.item);
    if (parent.item.generation >= 3 || parent.length < 28 || hyphae.length + queue.length - cursor >= limit) continue;
    const count = parent.item.generation === 1
      ? (stableUnit(parent.seed + "|fork") > 0.18 ? 2 : 1)
      : 1;
    for (let index = 0; index < count && hyphae.length + queue.length - cursor < limit; index += 1) {
      const id = parent.item.id + ":fork:" + index;
      const localSeed = seed + "|" + id;
      const side = stableUnit(localSeed + "|side") > 0.5 ? 1 : -1;
      const parentTangent = tangentOnCurve(parent.item.curve, 1);
      const angle = parentTangent + side * (0.35 + stableUnit(localSeed + "|angle") * 0.45);
      const length = parent.length * (0.48 + stableUnit(localSeed + "|length") * 0.2);
      const endpoint = {
        x: parent.endpoint.x + Math.cos(angle) * length,
        y: parent.endpoint.y + Math.sin(angle) * length
      };
      queue.push({
        item: {
          id, parentHyphaId: parent.item.id, territoryId: parent.territoryId, color: parent.color,
          style: "secondary-hypha", generation: parent.item.generation + 1,
          width: Math.max(0.38, parent.item.width * 0.62),
          curve: createCurve(parent.endpoint, endpoint, localSeed, 0.18)
        },
        endpoint, angle, length, color: parent.color,
        territoryId: parent.territoryId, seed: localSeed
      });
    }
  }
  return hyphae;
}

/** Generate deterministic radial fractal growth from a central MYC core. */
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
  minimumAngularGap = 0.08,
  maximumSecondaryHyphae = 1200
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
  if (!Number.isSafeInteger(maximumSecondaryHyphae) || maximumSecondaryHyphae < 0 || maximumSecondaryHyphae > 3000) {
    throw new RangeError("maximumSecondaryHyphae must be an integer between 0 and 3000");
  }
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

  const addBranch = (source, target, {
    id, territoryId, generation, visualOnly = false, style = null,
    sourceId, targetId, width = null, curve = null
  }) => {
    branches.push({
      id,
      sourceId: sourceId === undefined ? source.id : sourceId,
      targetId: targetId === undefined ? target.id : targetId,
      source, target, territoryId, generation, visualOnly,
      style: style || (visualOnly ? "universe-trunk" : generation <= 2 ? "rhizomorph" : "primary-hypha"),
      width: width ?? (visualOnly ? 6.5 : Math.max(1.2, 4.4 / Math.sqrt(generation))),
      seed: hashString(seed + "|" + id),
      curve: curve || createCurve(source, target, seed + "|" + id, curveBend)
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
      ...record, x: territory.x, y: territory.y, angle: territory.angle,
      generation: 1, territoryId: territory.id, universeColor: territory.color
    };
    positioned.set(node.id, node);
    territories.set(territory.id, { id: territory.id, nodeId, color: territory.color });
    roots.push(node);
  }

  // A colony is a shared growth field, not one trunk per knowledge universe.
  // Many primary fronts emerge from a small inoculation zone, explore the
  // substrate in different directions and are assigned to the nearest sector.
  const territoriesByAngle = spatialTopology.territories.map((territory) => ({
    territory,
    angle: Number.isFinite(territory.angle)
      ? territory.angle
      : Math.atan2(territory.y - core.y, territory.x - core.x)
  }));
  const frontCount = Math.min(32, Math.max(24, territoriesByAngle.length * 3));
  for (let index = 0; index < frontCount; index += 1) {
    const localSeed = seed + "|colony-front|" + index;
    const angle = TAU * index / frontCount
      + (stableUnit(localSeed + "|angle") - 0.5) * (TAU / frontCount) * 0.42;
    const territory = territoriesByAngle
      .map((candidate) => ({
        ...candidate,
        delta: Math.abs(Math.atan2(
          Math.sin(candidate.angle - angle),
          Math.cos(candidate.angle - angle)
        ))
      }))
      .sort((a, b) => a.delta - b.delta)[0]?.territory;
    if (!territory) continue;
    const anchor = positioned.get(territory.nodeId || territory.id);
    const anchorDistance = Math.hypot(anchor.x - core.x, anchor.y - core.y);
    const originRadius = 18 + stableUnit(localSeed + "|origin") * 42;
    const reach = anchorDistance * (0.96 + stableUnit(localSeed + "|reach") * 0.04);
    const source = {
      id: "colony-origin:" + index,
      x: core.x + Math.cos(angle) * originRadius,
      y: core.y + Math.sin(angle) * originRadius
    };
    const endpointAngle = angle + (stableUnit(localSeed + "|drift") - 0.5) * 0.06;
    const target = {
      id: "colony-front-end:" + index,
      x: core.x + Math.cos(endpointAngle) * reach,
      y: core.y + Math.sin(endpointAngle) * reach
    };
    addBranch(source, target, {
      id: "colony-front:" + index,
      territoryId: territory.id,
      generation: 1,
      visualOnly: true,
      style: "colony-front",
      sourceId: null,
      targetId: null,
      width: 2.2 + stableUnit(localSeed + "|width") * 1.8,
      curve: createCurve(source, target, localSeed, 0.3 + stableUnit(localSeed + "|bend") * 0.2)
    });
  }

  // MYC's own taxonomy occupies a compact complete inner ring around the
  // central nucleus; peripheral territories form the outer radial colony.

  for (const root of roots) {
    const isCore = root.id === coreId;
    const angle = isCore
      ? -Math.PI / 2
      : Math.atan2(root.y - core.y, root.x - core.x);
    queue.push({
      node: root,
      angle,
      generation: 1,
      territoryId: root.territoryId,
      spread: isCore ? TAU : universeSpread
    });
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const children = topology.childrenByParent.get(current.node.id) || [];
    if (!children.length) continue;
    const sectors = allocateSectors(children, current.angle, current.spread, weights, {
      fullRing: current.node.id === coreId,
      seed: seed + "|" + current.node.id + "|fan", minimumAngularGap
    });
    const generation = current.generation + 1;
    const nominalLength = current.node.id === coreId
      ? coreBranchLength
      : branchLength / (GOLDEN_RATIO ** Math.max(0, generation - 2));
    const growsAlongSpine = current.node.id !== coreId && children.length > 1;
    if (growsAlongSpine) {
      const spineLength = nominalLength * 0.88;
      const spineEnd = {
        id: "spine-end:" + current.node.id,
        canonicalId: null,
        x: current.node.x + Math.cos(current.angle) * spineLength,
        y: current.node.y + Math.sin(current.angle) * spineLength,
        angle: current.angle,
        territoryId: current.territoryId
      };
      addBranch(current.node, spineEnd, {
        id: "spine:" + current.node.id,
        territoryId: current.territoryId,
        generation: current.generation,
        visualOnly: true,
        style: "primary-spine",
        sourceId: current.node.id,
        targetId: null,
        width: Math.max(3.2, 5.2 / Math.sqrt(current.generation)),
        curve: createCurve(current.node, spineEnd, seed + "|spine|" + current.node.id, curveBend * 0.75)
      });
    }
    children.forEach((child, index) => {
      if (positioned.has(child.id)) throw new Error("Morphogenesis encountered a node more than once: " + child.id);
      const { angle, sector } = sectors[index];
      const lengthUnit = stableUnit(seed + "|length|" + current.node.id + "|" + child.id);
      // Siblings do not terminate on one shared circular arc: side branches
      // emerge at staggered radial depths while the stronger subtrees can
      // continue farther into the territory, like an exploring mycelium.
      const radialProgress = children.length <= 1 ? 0.82 : index / (children.length - 1);
      const radialJitter = (stableUnit(seed + "|radial-depth|" + child.id) - 0.5) * 0.22;
      const radialFactor = current.node.id === coreId ? 1 : Math.max(0.52, Math.min(1.08, 0.58 + radialProgress * 0.38 + radialJitter));
      const distance = Math.max(minimumBranchLength, nominalLength * radialFactor * (1 - lengthVariation + 2 * lengthVariation * lengthUnit));
      const node = {
        ...child,
        x: current.node.x + Math.cos(angle) * distance,
        y: current.node.y + Math.sin(angle) * distance,
        angle, sector, generation, territoryId: current.territoryId
      };
      positioned.set(node.id, node);

      const branchOriginDistance = distance * (0.2 + radialProgress * 0.42);
      const branchOrigin = growsAlongSpine ? {
        id: "branch-origin:" + child.id,
        canonicalId: null,
        x: current.node.x + Math.cos(current.angle) * branchOriginDistance,
        y: current.node.y + Math.sin(current.angle) * branchOriginDistance,
        angle: current.angle,
        territoryId: current.territoryId,
        universeColor: current.node.universeColor
      } : current.node;
      addBranch(branchOrigin, node, {
        id: "branch:" + current.node.id + ":" + node.id,
        territoryId: current.territoryId,
        generation,
        visualOnly: growsAlongSpine,
        style: growsAlongSpine ? "lateral-hypha" : null,
        sourceId: growsAlongSpine ? null : current.node.id,
        targetId: node.id,
        width: growsAlongSpine ? Math.max(1.6, 3.4 / Math.sqrt(generation)) : null,
        curve: createCurve(branchOrigin, node, seed + "|branch|" + child.id, curveBend * (growsAlongSpine ? 1.25 : 1))
      });
      queue.push({ node, angle, generation, territoryId: current.territoryId, spread: Math.max(0.28, current.spread / GOLDEN_RATIO) });
    });
  }

  const nodes = [...positioned.values()];
  const hyphae = createSecondaryHyphae(branches, territories, seed, maximumSecondaryHyphae);
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
