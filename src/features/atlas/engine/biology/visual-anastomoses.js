function validateOptions({ maxDistance, maxLinks, maxDegree, cellSize }) {
  if (!Number.isFinite(maxDistance) || maxDistance <= 0) throw new RangeError("maxDistance must be positive");
  if (!Number.isSafeInteger(maxLinks) || maxLinks < 0) throw new RangeError("maxLinks must be a non-negative safe integer");
  if (!Number.isSafeInteger(maxDegree) || maxDegree < 1) throw new RangeError("maxDegree must be a positive safe integer");
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new RangeError("cellSize must be positive");
  if (Math.ceil(maxDistance / cellSize) > 16) throw new RangeError("cellSize creates an excessive neighborhood search");
}

function cellKey(x, y) {
  return Math.floor(x) + ":" + Math.floor(y);
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
  includeSameTerritory = false
} = {}) {
  if (!morphology || !Array.isArray(morphology.nodes) || !Array.isArray(morphology.branches)) {
    throw new TypeError("Anastomoses require a morphology model");
  }
  validateOptions({ maxDistance, maxLinks, maxDegree, cellSize });
  if (maxLinks === 0) return { links: [], metrics: { candidateCount: 0, linkCount: 0 } };

  const candidates = morphology.nodes.filter((node) =>
    node && typeof node.id === "string" &&
    typeof node.territoryId === "string" &&
    Number.isFinite(node.x) && Number.isFinite(node.y) &&
    (includeRoots || node.generation > 1)
  );
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
          if (node.id === other.id) continue;
          const sameTerritory = node.territoryId === other.territoryId;
          if (sameTerritory && !includeSameTerritory) continue;
          // Anastomoses connect separate hyphal branches, never a parent directly to its child.
          if (node.parent === other.id || other.parent === node.id) continue;
          const distance = Math.hypot(node.x - other.x, node.y - other.y);
          if (distance > maxDistance) continue;
          const [first, second] = node.id < other.id ? [node, other] : [other, node];
          const id = "anastomosis:" + first.id + ":" + second.id;
          if (!pairs.has(id)) pairs.set(id, {
            id, source: first, target: second, distance,
            territoryIds: [...new Set([first.territoryId, second.territoryId])].sort()
          });
        }
      }
    }
  }

  const ordered = [...pairs.values()].sort((a, b) =>
    a.distance - b.distance || a.id.localeCompare(b.id)
  );
  const degree = new Map();
  const links = [];
  for (const pair of ordered) {
    if (links.length >= maxLinks) break;
    if ((degree.get(pair.source.id) || 0) >= maxDegree || (degree.get(pair.target.id) || 0) >= maxDegree) continue;
    degree.set(pair.source.id, (degree.get(pair.source.id) || 0) + 1);
    degree.set(pair.target.id, (degree.get(pair.target.id) || 0) + 1);
    links.push({
      id: pair.id,
      sourceId: pair.source.id,
      targetId: pair.target.id,
      territoryIds: pair.territoryIds,
      intraTerritory: pair.territoryIds.length === 1,
      distance: pair.distance,
      visualOnly: true,
      relationshipType: "anastomosis",
      curve: makeCurve(pair.source, pair.target, pair.id)
    });
  }

  return {
    links,
    metrics: { candidateCount: pairs.size, linkCount: links.length }
  };
}
