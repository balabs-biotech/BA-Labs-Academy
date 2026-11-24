/**
 * Non-radial spatial anchors for the Academy mycelial field.
 * Department roots occupy an irregular two-dimensional territory map.
 */
export function createMycelialTopology({ core, territories }) {
  if (!core || typeof core.id !== "string" || !Number.isFinite(core.x) || !Number.isFinite(core.y)) {
    throw new TypeError("Mycelial topology requires a positioned Academy root");
  }
  if (!Array.isArray(territories)) throw new TypeError("Mycelial topology requires territories");
  const seen = new Set([core.id]);
  const positioned = territories.map((territory) => {
    if (!territory || typeof territory.id !== "string" || !territory.id.trim()) {
      throw new TypeError("Each territory requires a non-empty id");
    }
    if (seen.has(territory.id)) throw new Error("Duplicate mycelial territory: " + territory.id);
    seen.add(territory.id);
    if (!Number.isFinite(territory.x) || !Number.isFinite(territory.y)) {
      throw new TypeError("Mycelial territory requires finite x/y coordinates: " + territory.id);
    }
    return { ...territory };
  });
  const positionedCore = { ...core };
  const byId = new Map([[positionedCore.id, positionedCore]]);
  for (const territory of positioned) byId.set(territory.id, territory);
  return { core: positionedCore, territories: positioned, byId, count: positioned.length };
}
