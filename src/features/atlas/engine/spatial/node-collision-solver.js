function validateOptions(options) {
  const { padding, maxIterations, maxStep, maxDisplacement, cellSize } = options;
  if (!Number.isFinite(padding) || padding < 0) throw new RangeError("padding must be non-negative");
  if (!Number.isSafeInteger(maxIterations) || maxIterations < 0) throw new RangeError("maxIterations must be a non-negative safe integer");
  if (!Number.isFinite(maxStep) || maxStep <= 0) throw new RangeError("maxStep must be positive");
  if (!Number.isFinite(maxDisplacement) || maxDisplacement <= 0) throw new RangeError("maxDisplacement must be positive");
  if (cellSize !== undefined && (!Number.isFinite(cellSize) || cellSize <= 0)) throw new RangeError("cellSize must be positive");
}

function deterministicDirection(a, b) {
  const text = a + "|" + b;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  const angle = (hash >>> 0) / 0xffffffff * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function buildPairs(nodes, positions, cellSize, neighborhoodRadius, padding) {
  const cells = new Map();
  const key = (x, y) => x + ":" + y;
  for (const node of nodes) {
    const position = positions.get(node.id);
    const cx = Math.floor(position.x / cellSize);
    const cy = Math.floor(position.y / cellSize);
    const cell = key(cx, cy);
    if (!cells.has(cell)) cells.set(cell, []);
    cells.get(cell).push(node);
  }

  const pairs = [];
  for (const node of nodes) {
    const position = positions.get(node.id);
    const cx = Math.floor(position.x / cellSize);
    const cy = Math.floor(position.y / cellSize);
    for (let ox = -neighborhoodRadius; ox <= neighborhoodRadius; ox += 1) {
      for (let oy = -neighborhoodRadius; oy <= neighborhoodRadius; oy += 1) {
        for (const other of cells.get(key(cx + ox, cy + oy)) || []) {
          if (node.id >= other.id) continue;
          const otherPosition = positions.get(other.id);
          const dx = otherPosition.x - position.x;
          const dy = otherPosition.y - position.y;
          const distance = Math.hypot(dx, dy);
          const required = node.radius + other.radius + padding;
          if (distance + 1e-9 < required) {
            pairs.push({ a: node, b: other, dx, dy, distance, overlap: required - distance });
          }
        }
      }
    }
  }
  pairs.sort((a, b) => a.a.id.localeCompare(b.a.id) || a.b.id.localeCompare(b.b.id));
  return pairs;
}

function countOverlaps(nodes, positions, cellSize, neighborhoodRadius, padding) {
  return buildPairs(nodes, positions, cellSize, neighborhoodRadius, padding).length;
}

/**
 * Deterministic bounded circle separation. Input nodes are never mutated;
 * pinned anchors remain fixed and total movement is capped per node.
 */
export function resolveNodeOverlaps(inputNodes, {
  padding = 12,
  maxIterations = 24,
  maxStep = 12,
  maxDisplacement = 96,
  cellSize
} = {}) {
  if (!Array.isArray(inputNodes)) throw new TypeError("Collision solver requires a nodes array");
  validateOptions({ padding, maxIterations, maxStep, maxDisplacement, cellSize });

  const ids = new Set();
  const nodes = inputNodes.map((node) => {
    if (!node || typeof node.id !== "string" || !node.id.trim()) throw new TypeError("Collision nodes require stable IDs");
    if (ids.has(node.id)) throw new Error("Collision solver contains duplicate node id: " + node.id);
    ids.add(node.id);
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) throw new TypeError("Collision node coordinates must be finite: " + node.id);
    const radius = node.radius ?? 0;
    if (!Number.isFinite(radius) || radius < 0) throw new RangeError("Collision node radius must be non-negative: " + node.id);
    return { ...node, radius, pinned: Boolean(node.pinned) };
  }).sort((a, b) => a.id.localeCompare(b.id));

  const maxRadius = nodes.reduce((maximum, node) => Math.max(maximum, node.radius), 0);
  const interactionDistance = maxRadius * 2 + padding;
  const effectiveCellSize = cellSize ?? Math.max(64, interactionDistance || 64);
  const neighborhoodRadius = Math.ceil(interactionDistance / effectiveCellSize);
  if (neighborhoodRadius > 16) throw new RangeError("cellSize creates an excessive collision neighborhood");

  const positions = new Map(nodes.map((node) => [node.id, { x: node.x, y: node.y }]));
  const origins = new Map(nodes.map((node) => [node.id, { x: node.x, y: node.y }]));
  const initialOverlapCount = countOverlaps(nodes, positions, effectiveCellSize, neighborhoodRadius, padding);
  let iterations = 0;

  for (; iterations < maxIterations; iterations += 1) {
    const pairs = buildPairs(nodes, positions, effectiveCellSize, neighborhoodRadius, padding);
    if (!pairs.length) break;
    const deltas = new Map(nodes.map((node) => [node.id, { x: 0, y: 0 }]));

    for (const pair of pairs) {
      const { a, b, overlap } = pair;
      if (a.pinned && b.pinned) continue;
      let direction;
      if (pair.distance <= 1e-9) direction = deterministicDirection(a.id, b.id);
      else direction = { x: pair.dx / pair.distance, y: pair.dy / pair.distance };
      const aShare = a.pinned ? 0 : b.pinned ? 1 : 0.5;
      const bShare = b.pinned ? 0 : a.pinned ? 1 : 0.5;
      const da = deltas.get(a.id);
      const db = deltas.get(b.id);
      da.x -= direction.x * overlap * aShare;
      da.y -= direction.y * overlap * aShare;
      db.x += direction.x * overlap * bShare;
      db.y += direction.y * overlap * bShare;
    }

    let maximumStep = 0;
    for (const node of nodes) {
      if (node.pinned) continue;
      const delta = deltas.get(node.id);
      const length = Math.hypot(delta.x, delta.y);
      if (length <= 1e-9) continue;
      const scale = Math.min(1, maxStep / length);
      const origin = origins.get(node.id);
      const current = positions.get(node.id);
      let nextX = current.x + delta.x * scale;
      let nextY = current.y + delta.y * scale;
      const totalX = nextX - origin.x;
      const totalY = nextY - origin.y;
      const totalLength = Math.hypot(totalX, totalY);
      if (totalLength > maxDisplacement) {
        const cap = maxDisplacement / totalLength;
        nextX = origin.x + totalX * cap;
        nextY = origin.y + totalY * cap;
      }
      maximumStep = Math.max(maximumStep, Math.hypot(nextX - current.x, nextY - current.y));
      positions.set(node.id, { x: nextX, y: nextY });
    }
    if (maximumStep <= 1e-6) {
      iterations += 1;
      break;
    }
  }

  const resolvedNodes = nodes.map((node) => {
    const position = positions.get(node.id);
    return { ...node, x: position.x, y: position.y };
  });
  const remainingOverlapCount = countOverlaps(nodes, positions, effectiveCellSize, neighborhoodRadius, padding);
  return {
    nodes: resolvedNodes,
    metrics: {
      iterations,
      initialOverlapCount,
      remainingOverlapCount,
      resolved: remainingOverlapCount === 0,
      movedNodeCount: resolvedNodes.filter((node) => {
        const origin = origins.get(node.id);
        return Math.hypot(node.x - origin.x, node.y - origin.y) > 1e-6;
      }).length
    }
  };
}
