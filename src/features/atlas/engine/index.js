// Stable public API for the shared BA Labs biological engine and Academy adapters.
export { createVernpixiNetwork } from "../shared/explorer-2d-network.js";
export { createPixiRenderer } from "../shared/explorer-2d-pixi.js";
export { createAcademySharedAtlas } from "../adapters/academy-shared-graph.js";
export { mountAcademySharedAtlas } from "../adapters/mount-academy-shared-atlas.js";
export { createAtlasCameraController } from "./presentation/camera-controller.js";
export { attachAtlasPointerInteractions } from "./presentation/pointer-interactions.js";
