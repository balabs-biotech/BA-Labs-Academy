import { createAcademySharedAtlas } from "./academy-shared-graph.js";
import { createPixiRenderer } from "../shared/explorer-2d-pixi.js";
import { createAtlasCameraController } from "../engine/presentation/camera-controller.js";
import { attachAtlasPointerInteractions } from "../engine/presentation/pointer-interactions.js";

function measure(canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    width: Math.max(1, Math.round(rect.width || canvas.clientWidth || 800)),
    height: Math.max(1, Math.round(rect.height || canvas.clientHeight || 600))
  };
}

/** Academy-specific data and navigation on the shared BA Labs 2D biological engine. */
export async function mountAcademySharedAtlas({
  canvas, graph, seed, onSelect = () => {}, onError = () => {},
  resizeObserverFactory = (callback) => typeof ResizeObserver === "function" ? new ResizeObserver(callback) : null
} = {}) {
  if (!canvas?.getBoundingClientRect) throw new TypeError("Shared Academy Atlas requires a canvas");
  const composition = createAcademySharedAtlas({ graph, seed });
  const size = measure(canvas);
  const camera = createAtlasCameraController({
    viewportWidth: size.width, viewportHeight: size.height, bounds: composition.bounds,
    minScale: 0.012, maxScale: 4, fitPadding: 0.08, minVisibleRatio: 0.08
  });
  const renderer = await createPixiRenderer(canvas);
  let destroyed = false;
  let interactions;
  let observer;
  let frameId = null;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const render = () => {
    if (destroyed) return false;
    const state = camera.getSnapshot();
    const rendered = renderer.render({
      nodes: composition.nodes, edges: composition.edges, selected,
      scale: state.scale,
      offset: { x: state.x - state.viewport.width / 2, y: state.y - state.viewport.height / 2 },
      width: state.viewport.width, height: state.viewport.height, reduced, lang: "fr"
    });
    canvas.dataset.sceneNodeCount = String(composition.nodes.length);
    canvas.dataset.secondaryHyphaCount = String(composition.edges.filter((edge) => !edge.cross).length);
    canvas.dataset.visibleLabelCount = canvas.dataset.labelLiveCount || "0";
    canvas.dataset.hiddenLabelCount = String(Math.max(0, composition.nodes.length - Number(canvas.dataset.visibleLabelCount)));
    return rendered;
  };
  let selected = null;
  const selectAt = (point, event) => {
    const world = camera.screenToWorld(point);
    let nearest = null;
    let distance = Infinity;
    for (const node of composition.nodes) {
      const d = Math.hypot(node.x - world.x, node.y - world.y);
      const hit = Math.max(node.r, 10 / camera.getSnapshot().scale);
      if (d <= hit && d < distance) { nearest = node; distance = d; }
    }
    if (nearest) { selected = nearest; render(); onSelect(nearest, event); }
  };
  try {
    renderer.resize(size.width, size.height);
    render();
    interactions = attachAtlasPointerInteractions(canvas, camera, { onSelect: selectAt, onChange: render });
    if (!reduced) {
      const animate = () => {
        if (destroyed) return;
        render();
        frameId = requestAnimationFrame(animate);
      };
      frameId = requestAnimationFrame(animate);
    }
    observer = resizeObserverFactory(() => {
      if (destroyed) return;
      const next = measure(canvas);
      camera.setViewport(next.width, next.height);
      renderer.resize(next.width, next.height);
      render();
    });
    observer?.observe?.(canvas.parentElement || canvas);
  } catch (error) {
    interactions?.destroy();
    observer?.disconnect?.();
    renderer.destroy();
    onError(error);
    throw error;
  }
  return Object.freeze({
    composition,
    scene: { nodes: composition.nodes, edges: composition.edges, bounds: composition.bounds },
    camera, renderer, render,
    select(id) {
      const node = composition.byId.get(id);
      if (!node) return false;
      selected = node;
      render();
      onSelect(node);
      return true;
    },
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      interactions?.destroy();
      observer?.disconnect?.();
      if (frameId !== null) cancelAnimationFrame(frameId);
      renderer.destroy();
      return true;
    }
  });
}
