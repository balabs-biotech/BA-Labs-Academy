function readCurvePoints(curve) {
  const points = [curve?.a, curve?.c1, curve?.c2, curve?.b];
  if (points.some((point) => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new TypeError("Bezier curves require four finite control points");
  }
  return points;
}

/** The convex hull of a cubic Bezier's control points conservatively contains the curve. */
export function getConservativeBezierBounds(curve, padding = 0) {
  if (!Number.isFinite(padding) || padding < 0) throw new RangeError("padding must be finite and non-negative");
  const points = readCurvePoints(curve);
  return {
    minX: Math.min(...points.map(({ x }) => x)) - padding,
    minY: Math.min(...points.map(({ y }) => y)) - padding,
    maxX: Math.max(...points.map(({ x }) => x)) + padding,
    maxY: Math.max(...points.map(({ y }) => y)) + padding
  };
}

function keysForBounds(bounds, cellSize, maxCellsPerBranch) {
  const minX = Math.floor(bounds.minX / cellSize);
  const maxX = Math.floor(bounds.maxX / cellSize);
  const minY = Math.floor(bounds.minY / cellSize);
  const maxY = Math.floor(bounds.maxY / cellSize);
  const cellCount = (maxX - minX + 1) * (maxY - minY + 1);
  if (!Number.isSafeInteger(cellCount) || cellCount > maxCellsPerBranch) {
    throw new RangeError("Bezier envelope spans too many spatial cells");
  }
  const keys = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) keys.push(x + ":" + y);
  }
  return keys;
}

/** Build a broad-phase spatial hash using one conservative envelope for insert and query. */
export function createCurveSpatialIndex(branches, { cellSize = 256, padding = 0, maxCellsPerBranch = 16384 } = {}) {
  if (!Array.isArray(branches)) throw new TypeError("Spatial index requires a branches array");
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new RangeError("cellSize must be positive");
  if (!Number.isFinite(padding) || padding < 0) throw new RangeError("padding must be non-negative");
  if (!Number.isSafeInteger(maxCellsPerBranch) || maxCellsPerBranch < 1) {
    throw new RangeError("maxCellsPerBranch must be a positive safe integer");
  }

  const cells = new Map();
  const boundsById = new Map();
  const branchById = new Map();
  let totalCellEntries = 0;
  for (const branch of branches) {
    if (!branch || typeof branch.id !== "string" || !branch.id.trim()) {
      throw new TypeError("Spatial index branches require a non-empty string id");
    }
    if (branchById.has(branch.id)) throw new Error("Spatial index contains duplicate branch id: " + branch.id);
    const bounds = getConservativeBezierBounds(branch.curve, padding);
    const keys = keysForBounds(bounds, cellSize, maxCellsPerBranch);
    branchById.set(branch.id, branch);
    boundsById.set(branch.id, bounds);
    for (const key of keys) {
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(branch.id);
      totalCellEntries += 1;
    }
  }

  const queryCurve = (curve, queryPadding = padding, excludeIds = []) => {
    const bounds = getConservativeBezierBounds(curve, queryPadding);
    const excluded = new Set(excludeIds);
    const candidates = new Set();
    for (const key of keysForBounds(bounds, cellSize, maxCellsPerBranch)) {
      for (const id of cells.get(key) || []) if (!excluded.has(id)) candidates.add(id);
    }
    return [...candidates].sort().map((id) => branchById.get(id));
  };

  return {
    queryCurve,
    getBounds: (branchId) => boundsById.get(branchId) || null,
    getBranch: (branchId) => branchById.get(branchId) || null,
    stats: { indexedBranchCount: branchById.size, cellCount: cells.size, totalCellEntries }
  };
}
