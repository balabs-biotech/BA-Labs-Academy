const TAU = Math.PI * 2;

/**
 * Place a configurable set of knowledge universes around one central core.
 * This is a topological anchor model, not the fractal growth algorithm.
 */
export function createRadialTopology({
  core, universes, startAngle = -Math.PI / 2, direction = 1, radius = 1000
}) {
  if (!core || typeof core.id !== "string" || !core.id.trim()) {
    throw new TypeError("Radial topology requires a core with a non-empty id");
  }
  if (!Array.isArray(universes)) throw new TypeError("Radial topology requires a universes array");
  if (!Number.isFinite(startAngle)) throw new TypeError("startAngle must be finite");
  if (direction !== 1 && direction !== -1) throw new RangeError("direction must be 1 or -1");
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new RangeError("radius must be a finite positive number");
  }

  const seen = new Set([core.id]);
  const count = universes.length;
  const positioned = universes.map((universe, index) => {
    if (!universe || typeof universe.id !== "string" || !universe.id.trim()) {
      throw new TypeError("Each universe requires a non-empty string id");
    }
    if (seen.has(universe.id)) throw new Error("Radial topology contains duplicate identity: " + universe.id);
    seen.add(universe.id);

    const angle = universe.angle === undefined
      ? startAngle + direction * TAU * index / Math.max(1, count)
      : universe.angle;
    const orbitRadius = universe.radius === undefined ? radius : universe.radius;
    if (!Number.isFinite(angle)) throw new TypeError("Universe angle must be finite: " + universe.id);
    if (!Number.isFinite(orbitRadius) || orbitRadius <= 0) {
      throw new RangeError("Universe radius must be positive: " + universe.id);
    }

    return {
      ...universe, angle, radius: orbitRadius,
      x: Math.cos(angle) * orbitRadius, y: Math.sin(angle) * orbitRadius
    };
  });

  const positionedCore = { ...core, x: 0, y: 0, angle: null, radius: 0 };
  const byId = new Map([[positionedCore.id, positionedCore]]);
  for (const universe of positioned) byId.set(universe.id, universe);
  return { core: positionedCore, universes: positioned, byId, count };
}
