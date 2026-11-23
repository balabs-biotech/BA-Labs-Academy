import { createPixiSceneAdapter } from "../src/features/atlas/engine/rendering/pixi-adapter.js";
import { createAtlasRendererSupervisor } from "../src/features/atlas/engine/rendering/renderer-supervisor.js";

window.runAtlasV2BrowserSmoke = async () => {
  const canvas = document.querySelector("#atlas-v2-canvas");
  const supervisor = createAtlasRendererSupervisor({
    canvas,
    backendFactory: (target) => createPixiSceneAdapter(target, {
      resolutionCap: 1.5,
      backgroundAlpha: 0,
      antialias: true
    }),
    onError: (error) => {
      document.querySelector("#atlas-v2-status").textContent = "ERROR: " + error.message;
    }
  });

  await supervisor.initialize();
  const scene = {
    version: 1,
    nodes: [
      { id: "MYC", x: 0, y: 0, radius: 28, label: "MYC", kind: "core", color: "#e5b85c" },
      { id: "BIO", x: 150, y: -70, radius: 16, label: "Biologie", kind: "universe", color: "#55a78c" },
      { id: "bio-1", x: 280, y: -105, radius: 10, label: "Sous-domaine", kind: "knowledge", color: "#55a78c" }
    ],
    paths: [
      { id: "trunk", sourceId: "MYC", targetId: "BIO", type: "universe-trunk", curve: {
        a: { x: 0, y: 0 }, c1: { x: 55, y: -15 }, c2: { x: 95, y: -55 }, b: { x: 150, y: -70 }
      }},
      { id: "branch", sourceId: "BIO", targetId: "bio-1", type: "hierarchy", curve: {
        a: { x: 150, y: -70 }, c1: { x: 195, y: -75 }, c2: { x: 235, y: -95 }, b: { x: 280, y: -105 }
      }},
      { id: "anastomosis", sourceId: "MYC", targetId: "bio-1", type: "anastomosis", curve: {
        a: { x: 0, y: 0 }, c1: { x: 65, y: 110 }, c2: { x: 210, y: 75 }, b: { x: 280, y: -105 }
      }}
    ]
  };

  const firstRender = supervisor.render(scene, { x: 320, y: 240, scale: 1 });
  const firstResize = supervisor.resize(960, 640);
  const secondRender = supervisor.render(scene, { x: 320, y: 240, scale: 1.1 });
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) throw new Error("PixiJS did not create a WebGL context");
  gl.finish();
  const pixels = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  let nonTransparentPixels = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] > 0) nonTransparentPixels += 1;
  }
  const result = {
    state: supervisor.state,
    nonTransparentPixels,
    renderer: canvas.dataset.renderer,
    width: canvas.width,
    height: canvas.height,
    firstRender,
    firstResize,
    secondRender,
    capabilities: supervisor.capabilities
  };
  document.querySelector("#atlas-v2-status").textContent = "READY " + JSON.stringify(result);
  window.__atlasV2Supervisor = supervisor;
  return result;
};
