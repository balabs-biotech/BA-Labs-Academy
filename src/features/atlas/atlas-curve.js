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
