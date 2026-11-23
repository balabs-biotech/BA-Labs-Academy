import { createAcademyAtlasV2 } from "./academy-graph-v2.js";
import { createAtlasCameraController } from "../engine/presentation/camera-controller.js";
import { attachAtlasPointerInteractions } from "../engine/presentation/pointer-interactions.js";
import { createAtlasRendererSupervisor } from "../engine/rendering/renderer-supervisor.js";
import { createPixiSceneAdapter } from "../engine/rendering/pixi-adapter.js";

function measureCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || canvas.clientWidth || canvas.width || 800));
  const height = Math.max(1, Math.round(rect.height || canvas.clientHeight || canvas.height || 600));
  return { width, height };
}

/** Mount the isolated V2 scene without replacing the published Academy Atlas. */
export async function mountAcademyAtlasV2({
  canvas,
  graph,
  compositionOptions = {},
  cameraOptions = {},
  rendererOptions = {},
  backendFactory = (target) => createPixiSceneAdapter(target, rendererOptions),
  resizeObserverFactory = (callback) => {
    const Observer = globalThis.ResizeObserver;
    return typeof Observer === "function" ? new Observer(callback) : null;
  },
  onSelect = () => {},
  onError = () => {}
} = {}) {
  if (!canvas || typeof canvas.getBoundingClientRect !== "function") {
    throw new TypeError("Academy Atlas V2 mount requires a canvas element");
  }
  if (typeof onSelect !== "function" || typeof onError !== "function") {
    throw new TypeError("Mount callbacks must be functions");
  }
  if (typeof backendFactory !== "function" || typeof resizeObserverFactory !== "function") {
    throw new TypeError("Mount factories must be functions");
  }

  const composition = createAcademyAtlasV2({ graph, ...compositionOptions });
  const initialSize = measureCanvas(canvas);
  const camera = createAtlasCameraController({
    viewportWidth: initialSize.width,
    viewportHeight: initialSize.height,
    bounds: composition.scene.bounds,
    ...cameraOptions
  });
  const renderer = createAtlasRendererSupervisor({ canvas, backendFactory, onError });

  let destroyed = false;
  let interactions = null;
  let resizeObserver = null;

  const render = () => {
    if (destroyed || renderer.state !== "ready") return false;
    return renderer.render(composition.scene, camera.getSnapshot());
  };

  function resize(width, height) {
    if (destroyed) return false;
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      throw new RangeError("Atlas mount dimensions must be positive");
    }
    camera.setViewport(width, height);
    const resized = renderer.resize(width, height);
    if (resized) render();
    return resized;
  }

  function selectNearestNode(point, event) {
    if (destroyed) return;
    const worldPoint = camera.screenToWorld(point);
    let nearest = null;
    let nearestDistance = Infinity;
    for (const node of composition.scene.nodes) {
      const distance = Math.hypot(node.x - worldPoint.x, node.y - worldPoint.y);
      const hitRadius = node.radius + 12 / camera.getSnapshot().scale;
      if (distance <= hitRadius && distance < nearestDistance) {
        nearest = node;
        nearestDistance = distance;
      }
    }
    if (nearest) onSelect(nearest, event);
  }

  try {
    await renderer.initialize();
    renderer.resize(initialSize.width, initialSize.height);
    render();

    interactions = attachAtlasPointerInteractions(canvas, camera, {
      onSelect: selectNearestNode,
      onChange: render
    });

    resizeObserver = resizeObserverFactory(() => {
      if (destroyed) return;
      const size = measureCanvas(canvas);
      if (size.width !== camera.getSnapshot().viewport.width ||
          size.height !== camera.getSnapshot().viewport.height) {
        resize(size.width, size.height);
      }
    });
    if (resizeObserver) {
      if (typeof resizeObserver.observe !== "function" || typeof resizeObserver.disconnect !== "function") {
        throw new TypeError("Resize observer must expose observe and disconnect");
      }
      resizeObserver.observe(canvas.parentElement || canvas);
    }
  } catch (error) {
    interactions?.destroy();
    resizeObserver?.disconnect?.();
    renderer.dispose();
    throw error;
  }

  return Object.freeze({
    composition,
    scene: composition.scene,
    camera,
    renderer,
    resize,
    render,
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      interactions?.destroy();
      resizeObserver?.disconnect?.();
      renderer.dispose();
      return true;
    },
    get destroyed() { return destroyed; }
  });
}
