import { catalogueMap } from "../../../catalogue-map.js";
import { cataloguePathways } from "../../../catalogue-pathways.js";
import { buildAcademyGraph } from "../../atlas-graph.js";
import { createAcademyAtlasV2 } from "../../adapters/academy-graph-v2.js";
import { createPixiSceneAdapter } from "../rendering/pixi-adapter.js";
import { createAtlasCameraController } from "../presentation/camera-controller.js";
import { attachAtlasPointerInteractions } from "../presentation/pointer-interactions.js";

const canvas = document.querySelector("#atlas-v2");
const status = document.querySelector("#status");
const setStatus = (message) => { status.textContent = message; };
let renderer;
let interactions;
let resizeObserver;
let disposed = false;

function fail(error) {
  console.error("[Academy Atlas V2]", error);
  setStatus("Erreur V2 : " + (error?.message || String(error)));
}

async function start() {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const result = createAcademyAtlasV2({
    graph,
    seed: "ba-labs-academy-v2-preview",
    universeRadius: 760,
    pathwayOrbitRadius: 1320
  });

  document.querySelector("#node-count").textContent = String(result.metrics.renderedNodeCount);
  document.querySelector("#department-count").textContent = String(result.metrics.departmentCount);
  document.querySelector("#pathway-count").textContent = String(result.metrics.pathwayAnchorCount);
  document.querySelector("#link-count").textContent = String(result.metrics.canonicalRelationshipCount);

  renderer = await createPixiSceneAdapter(canvas, { resolutionCap: 1.5 });
  if (disposed) { renderer.dispose(); return; }

  const bounds = result.scene.bounds;
  const camera = createAtlasCameraController({
    viewportWidth: canvas.clientWidth,
    viewportHeight: canvas.clientHeight,
    bounds,
    minScale: 0.045,
    maxScale: 2.8,
    fitPadding: window.innerWidth < 680 ? 0.08 : 0.1,
    minVisibleRatio: 0.08
  });

  const render = () => {
    if (disposed) return;
    renderer.render(result.scene, camera.getSnapshot());
  };
  renderer.resize(canvas.clientWidth, canvas.clientHeight);
  render();

  interactions = attachAtlasPointerInteractions(canvas, camera, {
    onSelect(point) {
      const world = camera.screenToWorld(point);
      let nearest = null;
      let nearestDistance = Infinity;
      for (const node of result.scene.nodes) {
        const distance = Math.hypot(node.x - world.x, node.y - world.y);
        const threshold = Math.max(20, node.radius + 8);
        if (distance <= threshold && distance < nearestDistance) {
          nearest = node;
          nearestDistance = distance;
        }
      }
      setStatus(nearest ? nearest.label + " · " + nearest.id : "Atlas V2 · " + result.metrics.renderedNodeCount + " nœuds");
    },
    onChange: render
  });

  document.querySelector("#zoom-in").addEventListener("click", () => {
    camera.zoomAt(1.25, { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 });
    render();
  });
  document.querySelector("#zoom-out").addEventListener("click", () => {
    camera.zoomAt(0.8, { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 });
    render();
  });
  document.querySelector("#fit").addEventListener("click", () => { camera.fit(); render(); });

  resizeObserver = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect;
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    renderer.resize(rect.width, rect.height);
    camera.setViewport(rect.width, rect.height);
    render();
  });
  resizeObserver.observe(canvas.parentElement);
  setStatus("V2 actif · " + result.metrics.renderedNodeCount + " nœuds · glisser pour déplacer · pincer pour zoomer");
  window.addEventListener("pagehide", destroy, { once: true });
}

function destroy() {
  if (disposed) return;
  disposed = true;
  resizeObserver?.disconnect();
  interactions?.destroy();
  renderer?.dispose();
}

start().catch(fail);
