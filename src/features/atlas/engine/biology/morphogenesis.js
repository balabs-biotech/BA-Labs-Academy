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


function createSecondaryHyphae(branches, territories, seed, limit = 1200) {
  const hyphae = [];
  for (const branch of branches) {
    if (hyphae.length >= limit) break;
    const dx = branch.target.x - branch.source.x;
    const dy = branch.target.y - branch.source.y;
    const length = Math.hypot(dx, dy);
    if (length < 58) continue;
    const desired = branch.style === "emblem-stem" ? 5 : branch.style === "universe-spoke" ? 4 : branch.style === "primary-spine" ? 3 : branch.style === "lateral-hypha" ? 1 : branch.generation <= 3 ? 3 : stableUnit(seed + "|density|" + branch.id) > 0.55 ? 2 : 1;
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
        width: 0.9 + stableUnit(localSeed + "|width") * 0.5,
        curve: createCurve(origin, endpoint, localSeed, 0.28)
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

  // Emblem architecture: one central trunk rises from MYC and divides into
  // two continuous arms. Each arm follows a curved arc and emits four terminal
  // cords toward the eight universes distributed around the radial wheel.
  // All split points are derived geometry; none becomes a pedagogical node.
  const splitAngle = -Math.PI / 2;
  const splitRadius = Math.min(420, coreBranchLength * 2.3);
  const splitPoint = {
    id: "emblem-split",
    canonicalId: null,
    x: core.x + Math.cos(splitAngle) * splitRadius,
    y: core.y + Math.sin(splitAngle) * splitRadius,
    angle: splitAngle,
    generation: 1,
    territoryId: coreId
  };
  addBranch(core, splitPoint, {
    id: "emblem-stem",
    territoryId: coreId,
    generation: 1,
    visualOnly: true,
    style: "emblem-stem",
    sourceId: core.id,
    targetId: null,
    width: 10,
    curve: createCurve(core, splitPoint, seed + "|emblem-stem", curveBend * 0.2)
  });

  const signedDelta = (angle) => Math.atan2(
    Math.sin(angle - splitAngle), Math.cos(angle - splitAngle)
  );
  const rightArm = spatialTopology.territories
    .filter((territory) => signedDelta(territory.angle) > 0)
    .sort((a, b) => signedDelta(a.angle) - signedDelta(b.angle));
  const leftArm = spatialTopology.territories
    .filter((territory) => signedDelta(territory.angle) < 0)
    .sort((a, b) => Math.abs(signedDelta(a.angle)) - Math.abs(signedDelta(b.angle)));

  const growEmblemArm = (territories, side) => {
    let previousPoint = splitPoint;
    territories.forEach((territory, index) => {
      const target = positioned.get(territory.nodeId || territory.id);
      const delta = signedDelta(territory.angle);
      const branchAngle = splitAngle + delta * 0.66;
      const targetRadius = Math.hypot(target.x - core.x, target.y - core.y);
      const branchRadius = splitRadius + (targetRadius - splitRadius) * 0.56;
      const branchPoint = {
        id: "emblem-arm-point:" + side + ":" + index,
        canonicalId: null,
        x: core.x + Math.cos(branchAngle) * branchRadius,
        y: core.y + Math.sin(branchAngle) * branchRadius,
        angle: branchAngle,
        generation: 1,
        territoryId: target.territoryId
      };
      addBranch(previousPoint, branchPoint, {
        id: "emblem-arm-" + side + ":" + index,
        territoryId: target.territoryId,
        generation: 1,
        visualOnly: true,
        style: "emblem-arm-" + side,
        sourceId: null,
        targetId: null,
        width: 7.5,
        curve: createCurve(previousPoint, branchPoint,
          seed + "|emblem-arm|" + side + "|" + index, curveBend * 1.2)
      });
      addBranch(branchPoint, target, {
        id: "universe-spoke:" + target.id,
        territoryId: target.territoryId,
        generation: 1,
        visualOnly: true,
        style: "universe-spoke",
        sourceId: null,
        targetId: target.id,
        width: 5.5,
        curve: createCurve(branchPoint, target,
          seed + "|universe-spoke|" + target.id, curveBend * 1.15)
      });
      previousPoint = branchPoint;
    });
  };

  growEmblemArm(rightArm, "right");
  growEmblemArm(leftArm, "left");

  // MYC's own taxonomy occupies a compact complete inner ring around the
  // central nucleus; the outer Y arms carry four universes each.

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
