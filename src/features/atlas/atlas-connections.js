import { ATLAS_GOLDEN_RATIO } from "./atlas-geometry.js";
import { createAtlasConnectionCurve, getAtlasConnectionCurvePoint } from "./atlas-curve.js";
import { PALETTE } from "./atlas-palette.js";

/**
 * Draws the Atlas connection layer independently from node and label rendering.
 * Hierarchy, pathway transfers, shared-pathway bridges and evidence-backed
 * knowledge relations retain distinct visibility and styling rules.
 */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Keep fine hierarchy filaments legible after the world-space camera transform. */
export function getAtlasScreenStrokeWidth(worldWidth, scale, minimumPixels = 0.8) {
  const safeScale = Math.max(0.075, Number(scale) || 0.075);
  return Math.max(Number(worldWidth) || 0, minimumPixels / safeScale);
}

const RELATION_COLORS = Object.freeze({
  PREREQUISITE: 0x80aeb8,
  COMPLEMENTARY: 0xa9a0d4,
  METHOD_TRANSFER: 0xe8c99d,
  TECHNICAL_DEPENDENCY: 0xc88773,
  APPLIED_IN: 0x79a991,
  INTERDISCIPLINARY: 0x7eaaa3
});

const connectionCurveCache = new WeakMap();

/**
 * Conservative viewport test using the cubic Bezier control hull. A cubic
 * curve cannot leave the convex hull of its four control points, so rejecting
 * a disjoint hull cannot hide a curve that crosses the visible world-space
 * rectangle.
 */
export function atlasCurveIntersectsViewport(curve, viewport) {
  if (!viewport) return true;
  const points = [curve.a, curve.c1, curve.c2, curve.b];
  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));
  return !(right < viewport.left || left > viewport.right ||
    bottom < viewport.top || top > viewport.bottom);
}

/**
 * Reuse world-space curve geometry while an edge's geometric inputs remain
 * unchanged. Compare cached fields directly to avoid allocating a signature
 * array for every edge on every animation frame.
 */
export function getAtlasConnectionCurveForEdge(edge, depth, sharedPathway) {
  const a = edge.a;
  const b = edge.b;
  const cached = connectionCurveCache.get(edge);
  if (cached &&
      cached.a === a && cached.b === b &&
      Object.is(cached.aX, a.x) && Object.is(cached.aY, a.y) &&
      Object.is(cached.aId, a.id) &&
      Object.is(cached.bX, b.x) && Object.is(cached.bY, b.y) &&
      Object.is(cached.bId, b.id) &&
      Object.is(cached.seed, edge.seed) &&
      Object.is(cached.depth, depth) &&
      Object.is(cached.sharedPathway, sharedPathway)) {
    return cached.curve;
  }
  const curve = createAtlasConnectionCurve(a, b, {
    seed: edge.seed, depth, sharedPathway
  });
  connectionCurveCache.set(edge, {
    a, b,
    aX: a.x, aY: a.y, aId: a.id,
    bX: b.x, bY: b.y, bId: b.id,
    seed: edge.seed, depth, sharedPathway, curve
  });
  return curve;
}

export function renderAtlasConnections({
  filaments, junctions, edges, selected, scale, reduced, relationFilter,
  time, alphaFor, activeBranch, morphologyBranches = [], viewport = null
}) {
  // Morphology trunks are a separate visual layer, never academic graph edges.
  for (const branch of morphologyBranches) {
    const { source, target } = branch;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const start = {
      id: branch.id + ":start",
      x: source.x + ux * (source.r + 18),
      y: source.y + uy * (source.r + 18)
    };
    const end = {
      id: branch.id + ":end",
      x: target.x - ux * (target.r + 5),
      y: target.y - uy * (target.r + 5)
    };
    const curve = createAtlasConnectionCurve(start, end, {
      seed: branch.seed, depth: 1
    });
    if (!atlasCurveIntersectsViewport(curve, viewport)) continue;
    const color = PALETTE[branch.rootId] || 0x91a99b;
    const drawTrunk = () => filaments.moveTo(curve.a.x, curve.a.y)
      .bezierCurveTo(curve.c1.x, curve.c1.y, curve.c2.x, curve.c2.y, curve.b.x, curve.b.y);
    const focusAlpha = selected ? (selected.id === source.id || selected.id === target.id ? 1 : 0.34) : 0.78;
    drawTrunk().stroke({
      color, alpha: focusAlpha * 0.13,
      width: getAtlasScreenStrokeWidth(curve.profile.width * 4.2, scale, 2.4), cap: "round"
    });
    drawTrunk().stroke({
      color, alpha: focusAlpha * 0.72,
      width: getAtlasScreenStrokeWidth(curve.profile.width * 1.9, scale, 1.05), cap: "round"
    });
  }

  for (const edge of edges) {
    if ((edge.a.entity_type === "PATHWAY" || edge.b.entity_type === "PATHWAY") &&
        selected?.entity_type !== "PATHWAY") continue;

    const knowledge = edge.basis === "academy-knowledge-relation";
    if (knowledge && relationFilter !== "all" && edge.relation_type !== relationFilter) continue;

    const depth = Math.max(edge.a.level, edge.b.level);
    let alpha = alphaFor(depth);
    if (alpha < 0.015) continue;
    if (knowledge) alpha *= clamp((scale - 0.12) / 0.55, 0, 1);

    if (edge.cross) {
      const directlySelected = edge.a.id === selected?.id || edge.b.id === selected?.id;
      const insideSelection = activeBranch.has(edge.a.id) && activeBranch.has(edge.b.id);
      const pathwaySelected = selected?.entity_type === "PATHWAY" &&
        (edge.pathwayCodes || []).includes(selected.entity_key);
      const relevantToSelection = directlySelected || insideSelection || pathwaySelected;
      alpha *= selected ? (relevantToSelection ? 1 : 0.14) : 0.38;
    } else if (selected && !edge.verified) {
      alpha *= activeBranch.has(edge.a.id) && activeBranch.has(edge.b.id) ? 1 : 0.16;
    }

    // Pure curve geometry is shared by strokes, junctions and animated particles.
    const sharedPathway = edge.basis === "academy-pathway-network";
    const curve = getAtlasConnectionCurveForEdge(edge, depth, sharedPathway);
    if (!atlasCurveIntersectsViewport(curve, viewport)) continue;
    const { a, b, c1, c2, seed } = curve;
    const length = curve.length;
    const color = PALETTE[edge.a.rootId] || 0x91a99b;
    const widthScale = sharedPathway ? 1.25 / 1.5
      : knowledge ? 1.35 / 1.5
      : edge.basis === "academy-pathway-flow" ? 1.05 / 1.5 : 1;
    const widthBase = getAtlasScreenStrokeWidth(
      curve.profile.width * widthScale * (edge.cross ? 1 / ATLAS_GOLDEN_RATIO : 1),
      scale,
      depth <= 1 ? 0.95 : depth === 2 ? 0.78 : 0.58
    );
    const drawCurve = () => filaments.moveTo(a.x, a.y)
      .bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);

    if ((!edge.cross && depth <= 2 && length > 34) || sharedPathway) {
      drawCurve().stroke({
        color,
        alpha: alpha * (sharedPathway ? 0.08 : 0.105),
        width: widthBase * (sharedPathway ? 2.6 : 3),
        cap: "round"
      });
    }

    drawCurve().stroke({
      color: sharedPathway ? 0xb8a9df
        : knowledge ? (RELATION_COLORS[edge.relation_type] || 0x7eaaa3)
        : edge.basis === "academy-pathway-flow" ? 0xe8c99d
        : edge.verified
          ? (edge.basis === "notion-link" ? 0xb96b4d
            : edge.basis === "academy-pathway" ? 0xa9a0d4
            : edge.basis === "academy-domain" ? 0xb5b58d
            : edge.basis === "academy-hierarchy" ? color : 0x7eaaa3)
          : edge.cross ? 0xb96b4d : color,
      alpha: alpha * (sharedPathway ? 0.24
        : knowledge ? 0.88
        : edge.basis === "academy-pathway-flow" ? 0.72
        : edge.verified ? 0.82
        : edge.cross ? 0.34
        : depth >= 3 ? 0.42 : depth === 2 ? 0.68 : 0.82),
      width: widthBase,
      cap: "round"
    });

    const midpoint = getAtlasConnectionCurvePoint(curve, 0.5);
    if (edge.verified && !sharedPathway) {
      junctions.circle(midpoint.x, midpoint.y, Math.max(1.25, 1.8 / Math.sqrt(scale)))
        .fill({
          color: edge.basis === "notion-link" ? 0xb96b4d
            : edge.basis === "academy-pathway" ? 0xa9a0d4
            : edge.basis === "academy-axis" ? 0xc88773 : 0x7eaaa3,
          alpha: 0.9
        });
    }

    // Motion is reserved for explicit pedagogical transfers, never hierarchy.
    const transfer = edge.basis === "academy-pathway-flow" ||
      edge.basis === "academy-knowledge-relation";
    if (!reduced && alpha > 0.2 && transfer) {
      const particleCount = 3;
      for (let particle = 0; particle < particleCount; particle += 1) {
        const phase = time * 0.000085 + (seed % 100) * 0.013 + particle / particleCount;
        const { x, y } = getAtlasConnectionCurvePoint(curve, (phase * 0.34) % 1);
        const particleColor = knowledge
          ? (RELATION_COLORS[edge.relation_type] || 0x7eaaa3) : 0xe8c99d;
        const radius = Math.max(1.15, 1.65 * scale ** 0.12);
        filaments.circle(x, y, radius * 2.1).fill({ color: particleColor, alpha: 0.16 });
        filaments.circle(x, y, radius).fill({ color: particleColor, alpha: 0.94 });
      }
    }
  }
}
