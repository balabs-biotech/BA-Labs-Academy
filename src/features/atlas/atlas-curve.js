import { ATLAS_GOLDEN_RATIO, getAtlasGoldenConnectionProfile } from "./atlas-geometry.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function hashAtlasConnection(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
}

/** Pure world-space curve geometry; no PixiJS dependency. */
export function createAtlasConnectionCurve(a, b, {
  seed, depth = 1, sharedPathway = false, bendScale = 1
} = {}) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const stableSeed = (seed ?? hashAtlasConnection(a.id + b.id)) >>> 0;
  const side = stableSeed & 1 ? 1 : -1;
  const nx = -dy / length;
  const ny = dx / length;
  const tx = dx / length;
  const ty = dy / length;
  const profile = getAtlasGoldenConnectionProfile(length, depth);
  // Fine branches bend less than primary branches: curvature tapers with
  // hierarchy depth while the main eight trunks (depth 1) keep their full arc.
  const depthScale = 1 / Math.sqrt(Math.max(1, depth));
  const safeBendScale = clamp(Number(bendScale) || 0, 0.2, 1);
  const bend = Math.min(sharedPathway ? 150 : 68, profile.bend) *
    depthScale * safeBendScale * side;
  const drift = (((stableSeed >>> 12) & 255) / 255 - 0.5) *
    Math.min(sharedPathway ? 18 : 14, profile.bend / ATLAS_GOLDEN_RATIO) *
    depthScale * safeBendScale;

  return {
    a,
    b,
    seed: stableSeed,
    length,
    profile,
    c1: {
      x: a.x + dx * (1 - profile.controlPointRatio) + nx * bend + tx * drift,
      y: a.y + dy * (1 - profile.controlPointRatio) + ny * bend + ty * drift
    },
    c2: {
      x: a.x + dx * profile.controlPointRatio +
        nx * (bend / ATLAS_GOLDEN_RATIO) -
        tx * drift / ATLAS_GOLDEN_RATIO,
      y: a.y + dy * profile.controlPointRatio +
        ny * (bend / ATLAS_GOLDEN_RATIO) -
        ty * drift / ATLAS_GOLDEN_RATIO
    }
  };
}

export function getAtlasConnectionCurvePoint(curve, progress) {
  const t = clamp(Number(progress) || 0, 0, 1);
  const u = 1 - t;
  const { a, b, c1, c2 } = curve;
  return {
    x: u ** 3 * a.x + 3 * u ** 2 * t * c1.x + 3 * u * t ** 2 * c2.x + t ** 3 * b.x,
    y: u ** 3 * a.y + 3 * u ** 2 * t * c1.y + 3 * u * t ** 2 * c2.y + t ** 3 * b.y
  };
}

/** Fixed-step samples for deterministic geometry diagnostics and fan layout. */
export function sampleAtlasConnectionCurve(curve, {
  steps = 24,
  startProgress = 0.12,
  endProgress = 1
} = {}) {
  const count = Math.max(2, Math.floor(steps));
  const start = clamp(Number(startProgress) || 0, 0, 1);
  const end = clamp(Number(endProgress) || 1, start, 1);
  return Array.from({ length: count + 1 }, (_, index) => {
    const progress = start + (end - start) * index / count;
    return { ...getAtlasConnectionCurvePoint(curve, progress), progress };
  });
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(a, b, c, d) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return ((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
    ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0));
}

function distancePointToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1
  );
  return Math.hypot(
    point.x - (start.x + projection * dx),
    point.y - (start.y + projection * dy)
  );
}

function distanceBetweenSegments(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    distancePointToSegment(a, c, d),
    distancePointToSegment(b, c, d),
    distancePointToSegment(c, a, b),
    distancePointToSegment(d, a, b)
  );
}

/** Minimum distance between sampled filament segments, not just sample points. */
export function atlasConnectionCurvesClearance(first, second, options = {}) {
  const a = sampleAtlasConnectionCurve(first, options);
  const b = sampleAtlasConnectionCurve(second, options);
  // Do not substitute a bounding-box gap for the true curve clearance:
  // the boxes provide only a lower bound, not the distance between filaments.
  let minimum = Number.POSITIVE_INFINITY;

  for (let i = 0; i < a.length - 1; i += 1) {
    for (let j = 0; j < b.length - 1; j += 1) {
      minimum = Math.min(minimum, distanceBetweenSegments(
        a[i], a[i + 1], b[j], b[j + 1]
      ));
      if (minimum === 0) return 0;
    }
  }
  return minimum;
}

/** Ignores the shared launch area where sibling filaments necessarily meet. */
export function atlasConnectionCurvesIntersect(first, second, options = {}) {
  const a = sampleAtlasConnectionCurve(first, options);
  const b = sampleAtlasConnectionCurve(second, options);
  const bounds = (points) => ({
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y))
  });
  const firstBounds = bounds(a);
  const secondBounds = bounds(b);
  if (firstBounds.maxX < secondBounds.minX || secondBounds.maxX < firstBounds.minX ||
      firstBounds.maxY < secondBounds.minY || secondBounds.maxY < firstBounds.minY) {
    return false;
  }
  for (let i = 0; i < a.length - 1; i += 1) {
    for (let j = 0; j < b.length - 1; j += 1) {
      if (segmentsIntersect(a[i], a[i + 1], b[j], b[j + 1])) return true;
    }
  }
  return false;
}
