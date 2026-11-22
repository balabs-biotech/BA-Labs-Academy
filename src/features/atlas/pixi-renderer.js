import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { createAtlasRenderStage } from "./atlas-renderer-stage.js";
import { renderAtlasConnections } from "./atlas-connections.js";
import { renderAtlasNodes } from "./atlas-nodes.js";
import { renderAtlasLabels } from "./atlas-labels.js";
import { createAtlasPixiFrameRenderer } from "./atlas-pixi-frame-renderer.js";
import { createAtlasLabelResources } from "./atlas-label-resources.js";
import { getAtlasLevelAlpha } from "./atlas-lod.js";

export async function createPixiRenderer(canvas) {
  const app = new Application();
  await app.init({
    canvas,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 1.75),
    powerPreference: "high-performance",
    preference: "webgl",
    clearBeforeRender: true,
    autoStart: false
  });
  app.stage.eventMode = "none";
  canvas.dataset.renderer = "pixijs-webgl";

  const stage = createAtlasRenderStage(app, { Container, Graphics, TextStyle });
  const createLabel = (node, labelStyle) => new Text({ text: node.title, style: labelStyle.clone() });
  const labelResources = createAtlasLabelResources({
    container: stage.labels,
    createLabel
  });

  const alphaFor = (level) => getAtlasLevelAlpha(level, cameraScale);
  let cameraScale = 1;

  const frameRenderer = createAtlasPixiFrameRenderer({
    stage,
    canvas,
    labelResources,
    createLabel,
    connections: renderAtlasConnections,
    nodesLayer: renderAtlasNodes,
    labelsLayer: renderAtlasLabels
  });

  function render(frame) {
    cameraScale = frame.scale;
    frameRenderer.render({ ...frame, alphaFor }, () => app.render());
  }

  function resize(width, height) {
    app.renderer.resize(width, height);
  }

  function dispose() {
    frameRenderer.reset();
    app.destroy({ removeView: false, children: true });
  }

  return {
    render,
    resize,
    dispose,
    capabilities: Object.freeze({
      backend: "pixijs",
      renderer: "webgl",
      interactive: true,
      supportsResize: true,
      supportsReducedMotion: true
    })
  };
}
