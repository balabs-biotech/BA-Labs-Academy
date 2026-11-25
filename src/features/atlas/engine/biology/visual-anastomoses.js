function validateOptions({ maxDistance, maxLinks, maxDegree, cellSize, frontierBias }) {
  if (!Number.isFinite(maxDistance) || maxDistance <= 0) throw new RangeError("maxDistance must be positive");
  if (!Number.isSafeInteger(maxLinks) || maxLinks < 0) throw new RangeError("maxLinks must be a non-negative safe integer");
  if (!Number.isSafeInteger(maxDegree) || maxDegree < 1) throw new RangeError("maxDegree must be a positive safe integer");
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new RangeError("cellSize must be positive");
  if (Math.ceil(maxDistance / cellSize) > 16) throw new RangeError("cellSize creates an excessive neighborhood search");
  if (!Number.isFinite(frontierBias) || frontierBias < 0 || frontierBias > 1) throw new RangeError("frontierBias must be between 0 and 1");
}

function cellKey(x, y) {
  return Math.floor(x) + ":" + Math.floor(y);
}

function sampleCurve(curve, t) {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * curve.a.x + 3 * uu * t * curve.c1.x + 3 * u * tt * curve.c2.x + tt * t * curve.b.x,
    y: uu * u * curve.a.y + 3 * uu * t * curve.c1.y + 3 * u * tt * curve.c2.y + tt * t * curve.b.y
  };
}

function makeCurve(a, b, id) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy) || 1;
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const bend = Math.min(36, distance * 0.12) * (id.length % 2 ? 1 : -1);
  return {
    a: { x: a.x, y: a.y },
    c1: { x: a.x + dx / 3 + normalX * bend, y: a.y + dy / 3 + normalY * bend },
    c2: { x: a.x + 2 * dx / 3 + normalX * bend, y: a.y + 2 * dy / 3 + normalY * bend },
    b: { x: b.x, y: b.y }
  };
}

/**
 * Derive decorative cross-territory links without changing pedagogy edges.
 * Links are presentation-only and can be discarded/recomputed at any time.
 */
export function createVisualAnastomoses(morphology, {
  maxDistance = 220,
  maxLinks = 24,
  maxDegree = 2,
  cellSize = maxDistance,
  includeRoots = false,
  includeSameTerritory = false,
  includeHyphae = false,
  frontierBias = 0.35
} = {}) {
  if (!morphology || !Array.isArray(morphology.nodes) || !Array.isArray(morphology.branches)) {
    throw new TypeError("Anastomoses require a morphology model");
  }
  validateOptions({ maxDistance, maxLinks, maxDegree, cellSize, frontierBias });
  if (maxLinks === 0) return { links: [], metrics: { candidateCount: 0, linkCount: 0 } };

  const territorySet = morphology.territories instanceof Map
    ? new Set(morphology.territories.keys())
    : null;
  const nodeCandidates = morphology.nodes.filter((node) =>
    node && typeof node.id === "string" &&
    typeof node.territoryId === "string" &&
    (!territorySet || territorySet.has(node.territoryId)) &&
    Number.isFinite(node.x) && Number.isFinite(node.y) &&
    (includeRoots || node.generation > 1)
  ).map((node) => ({ ...node, sourceKind: "node" }));
  const hyphaCandidates = includeHyphae
    ? (morphology.hyphae || []).filter((hypha) =>
      hypha && typeof hypha.id === "string" &&
      typeof hypha.territoryId === "string" &&
      (!territorySet || territorySet.has(hypha.territoryId)) &&
      Number.isFinite(hypha.curve?.b?.x) && Number.isFinite(hypha.curve?.b?.y)
    ).flatMap((hypha) => {
      const base = {
        territoryId: hypha.territoryId,
        generation: hypha.generation ?? 1,
        parent: hypha.parentHyphaId ?? null,
        hyphaId: hypha.id,
        sourceKind: "hypha",
        color: hypha.color ?? null
      };
      const tip = { ...base, id: hypha.id, x: hypha.curve.b.x, y: hypha.curve.b.y };
      const curve = hypha.curve;
      const hasFullCurve = ["a", "c1", "c2", "b"].every((key) =>
        Number.isFinite(curve[key]?.x) && Number.isFinite(curve[key]?.y)
      );
      if (!hasFullCurve) return [tip];
      const body = [0.2, 0.4, 0.5, 0.6, 0.8].map((t, index) => ({
        ...base,
        id: hypha.id + ":body:" + index,
        ...sampleCurve(curve, t)
      }));
      return [tip, ...body];
    })
    : [];
  const candidates = [...nodeCandidates, ...hyphaCandidates];
  const cells = new Map();
  for (const node of candidates) {
    const key = cellKey(node.x / cellSize, node.y / cellSize);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(node);
  }

  const pairs = new Map();
  const radius = Math.ceil(maxDistance / cellSize);
  for (const node of candidates) {
    const cx = Math.floor(node.x / cellSize);
    const cy = Math.floor(node.y / cellSize);
    for (let ox = -radius; ox <= radius; ox += 1) {
      for (let oy = -radius; oy <= radius; oy += 1) {
        for (const other of cells.get(cellKey(cx + ox, cy + oy)) || []) {
          if (node.id === other.id || (node.hyphaId && node.hyphaId === other.hyphaId)) continue;
          const sameTerritory = node.territoryId === other.territoryId;
          if (sameTerritory && !includeSameTerritory) continue;
          // Anastomoses connect separate hyphal branches, never a parent directly to its child.
          if (node.parent === (other.hyphaId ?? other.id) || other.parent === (node.hyphaId ?? node.id)) continue;
          const distance = Math.hypot(node.x - other.x, node.y - other.y);
          if (distance > maxDistance) continue;
          const nodeKey = node.hyphaId ?? node.id;
          const otherKey = other.hyphaId ?? other.id;
          const [first, second] = nodeKey < otherKey ? [node, other] : [other, node];
          const firstKey = first.hyphaId ?? first.id;
          const secondKey = second.hyphaId ?? second.id;
          const id = "anastomosis:" + firstKey + ":" + secondKey;
          const existing = pairs.get(id);
          if (!existing || distance < existing.distance) pairs.set(id, {
            id, source: first, target: second, distance,
            territoryIds: [...new Set([first.territoryId, second.territoryId])].sort()
          });
        }
      }
    }
  }

  const maxRadius = Math.max(1, candidates.reduce((maximum, node) => Math.max(maximum, Math.hypot(node.x, node.y)), 0));
  const score = (pair) => {
    const frontier = (Math.hypot(pair.source.x, pair.source.y) + Math.hypot(pair.target.x, pair.target.y)) / (2 * maxRadius);
    const joinsHyphalTips = pair.source.sourceKind === "hypha" && pair.target.sourceKind === "hypha";
    const frontierPairBonus = joinsHyphalTips ? maxDistance * 0.55 : 0;
    return pair.distance - frontierBias * maxDistance * frontier - frontierPairBonus;
  };
  const ordered = [...pairs.values()].sort((a, b) =>
    score(a) - score(b) || a.distance - b.distance || a.id.localeCompare(b.id)
  );
  const territoryIds = territorySet
    ? [...territorySet]
    : [...new Set(candidates.map((node) => node.territoryId))];
  if (maxLinks > 0 && maxLinks < territoryIds.length - 1) {
    throw new RangeError("maxLinks must allow a bridge network across every territory");
  }

  const parent = new Map(territoryIds.map((id) => [id, id]));
  const find = (id) => {
    while (parent.get(id) !== id) id = parent.get(id);
    return id;
  };
  const degree = new Map();
  const selected = new Set();
  const links = [];
  const addLink = (pair) => {
    selected.add(pair.id);
    const sourceDegreeId = pair.source.hyphaId ?? pair.source.id;
    const targetDegreeId = pair.target.hyphaId ?? pair.target.id;
    degree.set(sourceDegreeId, (degree.get(sourceDegreeId) || 0) + 1);
    degree.set(targetDegreeId, (degree.get(targetDegreeId) || 0) + 1);
    links.push({
      id: pair.id,
      sourceId: pair.source.sourceKind === "hypha" ? null : pair.source.id,
      targetId: pair.target.sourceKind === "hypha" ? null : pair.target.id,
      sourceHyphaId: pair.source.hyphaId ?? null,
      targetHyphaId: pair.target.hyphaId ?? null,
      territoryIds: pair.territoryIds,
      intraTerritory: pair.territoryIds.length === 1,
      distance: pair.distance,
      visualOnly: true,
      relationshipType: "anastomosis",
      color: pair.source.color ?? pair.target.color ?? pair.source.universeColor ?? pair.target.universeColor ?? null,
      curve: makeCurve(pair.source, pair.target, pair.id)
    });
  };

  // First build the shortest spanning network: every peripheral territory
  // must communicate before optional local loops or extra cross-links appear.
  for (const pair of ordered) {
    if (links.length >= maxLinks) break;
    if (pair.territoryIds.length !== 2) continue;
    const [first, second] = pair.territoryIds;
    const a = find(first), b = find(second);
    if (a === b) continue;
    parent.set(a, b);
    addLink(pair);
  }

  // Reinforce cross-territory bridges before spending the budget on local loops.
  // This makes the colony a shared mesh rather than eight isolated bouquets.
  for (const pair of ordered) {
    if (links.length >= maxLinks) break;
    if (selected.has(pair.id) || pair.territoryIds.length !== 2) continue;
    if ((degree.get(pair.source.hyphaId ?? pair.source.id) || 0) >= maxDegree || (degree.get(pair.target.hyphaId ?? pair.target.id) || 0) >= maxDegree) continue;
    addLink(pair);
  }

  // Use the remaining budget for local anastomoses within each territory.
  for (const pair of ordered) {
    if (links.length >= maxLinks) break;
    if (selected.has(pair.id) || pair.territoryIds.length !== 1) continue;
    if ((degree.get(pair.source.id) || 0) >= maxDegree || (degree.get(pair.target.id) || 0) >= maxDegree) continue;
    addLink(pair);
  }

  const connectedTerritories = new Set(territoryIds.map(find)).size <= 1 ? territoryIds.length : 0;
  return {
    links,
    metrics: {
      candidateCount: pairs.size,
      linkCount: links.length,
      territoryCount: territoryIds.length,
      connected: territoryIds.length <= 1 || connectedTerritories === territoryIds.length,
      bridgeCount: links.filter((link) => !link.intraTerritory).length
    }
  };
}
