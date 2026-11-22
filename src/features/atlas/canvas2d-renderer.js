import { createAtlasFrameModel } from "./atlas-frame-model.js";
import { createAtlasConnectionCurve } from "./atlas-curve.js";
import { PALETTE } from "./atlas-palette.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const color = (value) => "#" + (value >>> 0).toString(16).padStart(6, "0");

function alphaForLevel(level, scale) {
  const thresholds = [0, 0.10, 0.16, 0.24, 0.4, 0.7, 1.1];
  const threshold = thresholds[Math.min(level, thresholds.length - 1)];
  return level === 0 ? 1 : clamp((scale - threshold * 0.72) / (threshold * 0.42), 0, 1);
}

/**
 * Experimental Canvas 2D backend.
 * It consumes the same neutral frame shape as PixiJS but is not selected by
 * the production Atlas host. Geometry and taxonomy remain backend-agnostic.
 */
export function createCanvas2DRenderer(canvas, {
  context = canvas?.getContext?.("2d", { alpha: true, desynchronized: true }),
  frameModel = createAtlasFrameModel(),
  pixelRatio = () => Math.min(globalThis.devicePixelRatio || 1, 1.75)
} = {}) {
  if (!canvas || !context) {
    throw new Error("Canvas 2D context is unavailable");
  }

  let width = 0;
  let height = 0;
  let ratio = 1;
  let disposed = false;

  function resize(nextWidth, nextHeight) {
    if (disposed) return false;
    width = Math.max(0, Number(nextWidth) || 0);
    height = Math.max(0, Number(nextHeight) || 0);
    ratio = clamp(Number(pixelRatio()) || 1, 1, 1.75);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    if (canvas.style) {
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return true;
  }

  function render(frame) {
    if (disposed) return false;
    const plan = frameModel.prepare({
      ...frame,
      width: frame.width ?? width,
      height: frame.height ?? height
    });
    const {
      nodes = [], edges = [], selected, scale = 1, reduced = false,
      relationFilter = "all", transform, activeBranch, lineage
    } = plan;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(transform.x, transform.y);
    context.scale(transform.scale, transform.scale);

    for (const edge of edges) {
      const pathwayEdge = edge.a.entity_type === "PATHWAY" || edge.b.entity_type === "PATHWAY";
      if (pathwayEdge && selected?.entity_type !== "PATHWAY") continue;
      const knowledge = edge.basis === "academy-knowledge-relation";
      if (knowledge && relationFilter !== "all" && edge.relation_type !== relationFilter) continue;

      const depth = Math.max(edge.a.level, edge.b.level);
      let alpha = alphaForLevel(depth, scale);
      if (alpha < 0.015) continue;
      if (knowledge) alpha *= clamp((scale - 0.12) / 0.55, 0, 1);
      if (edge.cross) {
        const direct = edge.a.id === selected?.id || edge.b.id === selected?.id;
        const inBranch = activeBranch.has(edge.a.id) && activeBranch.has(edge.b.id);
        const pathwaySelected = selected?.entity_type === "PATHWAY" &&
          (edge.pathwayCodes || []).includes(selected.entity_key);
        alpha *= selected ? (direct || inBranch || pathwaySelected ? 1 : 0.14) : 0.38;
      } else if (selected && !edge.verified) {
        alpha *= activeBranch.has(edge.a.id) && activeBranch.has(edge.b.id) ? 1 : 0.16;
      }

      const shared = edge.basis === "academy-pathway-network";
      const curve = createAtlasConnectionCurve(edge.a, edge.b, {
        seed: edge.seed, depth, sharedPathway: shared
      });
      context.beginPath();
      context.moveTo(curve.a.x, curve.a.y);
      context.bezierCurveTo(curve.c1.x, curve.c1.y, curve.c2.x, curve.c2.y, curve.b.x, curve.b.y);
      const relationColors = {
        PREREQUISITE: 0x80aeb8, COMPLEMENTARY: 0xa9a0d4,
        METHOD_TRANSFER: 0xe8c99d, TECHNICAL_DEPENDENCY: 0xc88773,
        APPLIED_IN: 0x79a991, INTERDISCIPLINARY: 0x7eaaa3
      };
      const rootColor = PALETTE[edge.a.rootId] || 0x91a99b;
      context.strokeStyle = color(shared ? 0xb8a9df
        : knowledge ? (relationColors[edge.relation_type] || 0x7eaaa3)
        : edge.basis === "academy-pathway-flow" ? 0xe8c99d
        : edge.verified ? rootColor : edge.cross ? 0xb96b4d : rootColor);
      context.globalAlpha = alpha * (shared ? 0.24 : knowledge ? 0.88 : edge.verified ? 0.82 : edge.cross ? 0.34 : 0.68);
      context.lineWidth = curve.profile.width * (edge.cross ? 1 / 1.618 : 1);
      context.lineCap = "round";
      context.stroke();
      context.globalAlpha = 1;
    }

    for (const node of nodes) {
      if (node.entity_type === "PATHWAY" && node.level === 0 && selected?.entity_type !== "PATHWAY") continue;
      let alpha = alphaForLevel(node.level, scale);
      if (alpha < 0.015) continue;
      if (selected && !activeBranch.has(node.id) && !lineage.has(node.id)) alpha *= 0.34;
      const fill = color(PALETTE[node.rootId] || 0xd1d0c5);
      const radius = Math.max(1.25, node.r || 2);
      context.globalAlpha = alpha;
      context.beginPath();
      context.arc(node.x, node.y, radius, 0, Math.PI * 2);
      context.fillStyle = node.level === 0 ? "#111b1d" : fill;
      context.fill();
      if (node.level === 0 || selected?.id === node.id) {
        context.strokeStyle = fill;
        context.lineWidth = node.isAcademyCore ? 2.8 : 1.5;
        context.stroke();
      }
      if (selected?.id === node.id) {
        context.beginPath();
        context.arc(node.x, node.y, radius + 12 / Math.max(scale, 0.01), 0, Math.PI * 2);
        context.strokeStyle = "#e4e7dd";
        context.lineWidth = 1 / Math.max(scale, 0.01);
        context.stroke();
      }
    }

    if (scale >= 0.58) {
      const labelBudget = Math.min(160, Math.max(20, Math.floor(24 + scale * 18)));
      let drawn = 0;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "12px system-ui, sans-serif";
      for (const node of nodes) {
        if (drawn >= labelBudget) break;
        if (!node.title || alphaForLevel(node.level, scale) < 0.15) continue;
        if (node.entity_type === "PATHWAY" && selected?.entity_type !== "PATHWAY") continue;
        if (selected && !activeBranch.has(node.id) && node.level > 1) continue;
        context.globalAlpha = selected && !activeBranch.has(node.id) ? 0.42 : 0.88;
        context.fillStyle = "#e4e7dd";
        context.fillText(String(node.title), node.x, node.y - Math.max(10, (node.r || 2) + 9));
        drawn += 1;
      }
    }

    context.restore();
    context.globalAlpha = 1;
    return true;
  }

  function dispose() {
    if (disposed) return false;
    disposed = true;
    frameModel.reset();
    context.clearRect(0, 0, width, height);
    return true;
  }

  canvas.dataset.renderer = "canvas-2d-experimental";
  return {
    render,
    resize,
    dispose,
    capabilities: Object.freeze({
      backend: "canvas2d",
      renderer: "canvas-2d",
      interactive: false,
      supportsResize: true,
      supportsReducedMotion: true,
      experimental: true
    })
  };
}
