/** Screen-space level of detail for the fractal hierarchy. */
const LEVEL_VISIBILITY_THRESHOLDS = Object.freeze([0, 0.04, 0.065, 0.095, 0.13, 0.22, 0.3]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function getAtlasLevelAlpha(level, scale) {
  const safeLevel = Math.max(0, Math.floor(Number(level) || 0));
  const safeScale = Math.max(0, Number(scale) || 0);
  if (safeLevel === 0) return 1;
  const threshold = LEVEL_VISIBILITY_THRESHOLDS[
    Math.min(safeLevel, LEVEL_VISIBILITY_THRESHOLDS.length - 1)
  ];
  return clamp((safeScale - threshold * 0.72) / (threshold * 0.42), 0, 1);
}
