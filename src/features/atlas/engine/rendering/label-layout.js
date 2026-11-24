function priority(node) {
  if (node.kind === "core") return 0;
  if (node.kind === "universe") return 1;
  if (node.kind === "pathway" || node.generation <= 2) return 2;
  return 3;
}

function zoomThreshold(node) {
  if (node.kind === "core") return 0.04;
  if (node.kind === "universe") return 0.12;
  if (node.kind === "pathway" || node.generation <= 2) return 0.48;
  return 0.78;
}

function angularDistance(a, b) {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(delta, Math.PI * 2 - delta);
}

function overlapsRect(a, b, gap) {
  return a.left < b.right + gap && a.right + gap > b.left
    && a.top < b.bottom + gap && a.bottom + gap > b.top;
}

function intersectsCircle(rect, node, gap) {
  const nearestX = Math.max(rect.left, Math.min(node.x, rect.right));
  const nearestY = Math.max(rect.top, Math.min(node.y, rect.bottom));
  return Math.hypot(nearestX - node.x, nearestY - node.y) < node.radius + gap * 0.5;
}

/** Resolve deterministic label positions from measured text bounds without changing graph nodes. */
export function resolveAtlasLabelLayout({
  nodes,
  measurements,
  scale = 1,
  gap = 8
} = {}) {
  if (!Array.isArray(nodes) || !Array.isArray(measurements)) {
    throw new TypeError("Label layout requires node and measurement arrays");
  }
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("Label layout scale must be positive");
  if (!Number.isFinite(gap) || gap < 0) throw new RangeError("Label layout gap must be non-negative");

  const measurementById = new Map();
  for (const measurement of measurements) {
    if (measurement && typeof measurement.id === "string") measurementById.set(measurement.id, measurement);
  }
  const ordered = [...nodes].sort((a, b) =>
    priority(a) - priority(b)
    || (a.generation ?? 0) - (b.generation ?? 0)
    || String(a.id).localeCompare(String(b.id))
  );
  const accepted = [];
  const placements = [];

  for (const node of ordered) {
    const measurement = measurementById.get(node.id);
    const width = measurement?.width;
    const height = measurement?.height;
    const hidden = (reason) => placements.push({
      id: node.id, x: node.x, y: node.y, width: 0, height: 0, visible: false, reason
    });

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      hidden("invalid-measurement");
      continue;
    }
    if (scale < zoomThreshold(node)) {
      hidden("zoom-level");
      continue;
    }

    const baseAngle = Number.isFinite(node.angle) ? node.angle : -Math.PI / 2;
    const radialLabel = node.kind === "universe" || node.kind === "pathway";
    const radialFirst = [Math.PI, Math.PI / 2, Math.PI * 1.5, Math.PI / 4,
      Math.PI * 1.75, Math.PI * 0.75, Math.PI * 1.25, 0];
    const directions = radialLabel
      ? [...radialFirst, ...Array.from({ length: 16 }, (_, index) => index * Math.PI / 8)
        .filter((angle) => !radialFirst.includes(angle))]
      : Array.from({ length: 16 }, (_, index) => index * Math.PI / 8)
        .sort((a, b) => angularDistance(a, 0) - angularDistance(b, 0));
    const distanceRings = [1, 1.4, 1.85, 2.35];
    let chosen = null;

    if (node.kind === "core") {
      const x = node.x;
      const y = node.y - node.radius - gap - height / 2;
      const rect = {
        left: x - width / 2, right: x + width / 2,
        top: y - height / 2, bottom: y + height / 2
      };
      // MYC is the visual anchor of the entire wheel. Keep its name on the
      // central axis instead of displacing it around nearby decorative hyphae.
      chosen = { id: node.id, x, y, width, height, visible: true, reason: "core-axis", rect };
    }

    for (const distanceFactor of (chosen ? [] : distanceRings)) {
      for (const offset of directions) {
        const angle = baseAngle + offset;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const radialExtent = Math.abs(dx) * width / 2 + Math.abs(dy) * height / 2;
        const distance = (node.radius + gap + radialExtent) * distanceFactor;
        const x = node.x + dx * distance;
        const y = node.y + dy * distance;
        const rect = {
          left: x - width / 2, right: x + width / 2,
          top: y - height / 2, bottom: y + height / 2
        };
        if (accepted.some((entry) => overlapsRect(rect, entry.rect, gap))) continue;
        const hitsOtherNode = nodes.some((other) =>
          other.id !== node.id && intersectsCircle(rect, other, gap)
        );
        if (hitsOtherNode) continue;
        chosen = { id: node.id, x, y, width, height, visible: true, reason: "placed", rect };
        break;
      }
      if (chosen) break;
    }

    if (!chosen) {
      hidden("collision");
      continue;
    }
    accepted.push(chosen);
    placements.push({
      id: chosen.id, x: chosen.x, y: chosen.y,
      width: chosen.width, height: chosen.height,
      visible: true, reason: chosen.reason
    });
  }

  placements.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const visibleCount = placements.filter((placement) => placement.visible).length;
  return Object.freeze({
    placements: Object.freeze(placements.map((placement) => Object.freeze(placement))),
    visibleCount,
    hiddenCount: placements.length - visibleCount
  });
}
