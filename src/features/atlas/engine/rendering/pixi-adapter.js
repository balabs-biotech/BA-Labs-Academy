import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";

function positive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(name + " must be positive");
}

function colorValue(value, fallback = 0x8b9aa5) {
  if (Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^#?[0-9a-f]{6}$/i.test(value)) {
    return Number.parseInt(value.replace("#", ""), 16);
  }
  return fallback;
}

/** PixiJS adapter for the renderer-neutral Atlas scene contract. */
export async function createPixiSceneAdapter(canvas, {
  resolutionCap = 1.75,
  backgroundAlpha = 0,
  antialias = true
} = {}) {
  if (!canvas) throw new TypeError("Pixi scene adapter requires a canvas");
  positive(resolutionCap, "resolutionCap");
  if (!Number.isFinite(backgroundAlpha) || backgroundAlpha < 0 || backgroundAlpha > 1) {
    throw new RangeError("backgroundAlpha must be between 0 and 1");
  }

  const app = new Application();
  try {
    const pixelRatio = globalThis.window?.devicePixelRatio || 1;
    await app.init({
      canvas,
      backgroundAlpha,
      antialias,
      autoDensity: true,
      resolution: Math.min(pixelRatio, resolutionCap),
      powerPreference: "high-performance",
      preference: "webgl",
      clearBeforeRender: true,
      autoStart: false
    });
  } catch (error) {
    try { app.destroy({ removeView: false, children: true }); } catch { /* Preserve initialization error. */ }
    throw error;
  }

  const world = new Container();
  const paths = new Graphics();
  const nodes = new Graphics();
  const labels = new Container();
  world.addChild(paths, nodes, labels);
  app.stage.addChild(world);
  app.stage.eventMode = "none";
  if (canvas.dataset) canvas.dataset.renderer = "academy-atlas-v2-pixijs";

  const labelStyle = new TextStyle({
    fontFamily: "Arial, sans-serif",
    fontSize: 14,
    fill: 0xe8edf0,
    align: "center"
  });
  let disposed = false;

  function render(scene, camera = {}) {
    if (disposed) return false;
    if (!scene || !Array.isArray(scene.nodes) || !Array.isArray(scene.paths)) {
      throw new TypeError("Pixi adapter requires a valid Atlas scene");
    }
    const x = camera.x ?? 0;
    const y = camera.y ?? 0;
    const scale = camera.scale ?? 1;
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError("Camera translation must be finite");
    positive(scale, "camera scale");

    const nodeById = new Map(scene.nodes.map((node) => [node.id, node]));
    paths.clear();
    nodes.clear();
    for (const label of labels.removeChildren()) label.destroy();

    for (const path of scene.paths) {
      const source = nodeById.get(path.sourceId);
      const target = nodeById.get(path.targetId);
      if (!source || !target) continue;
      const curve = path.curve;
      const decorative = path.type === "anastomosis";
      paths.moveTo(curve.a.x, curve.a.y);
      paths.bezierCurveTo(
        curve.c1.x, curve.c1.y,
        curve.c2.x, curve.c2.y,
        curve.b.x, curve.b.y
      );
      paths.stroke({
        color: colorValue(target.color ?? source.color),
        width: decorative ? 1.2 : 2,
        alpha: decorative ? 0.34 : path.type === "universe-trunk" ? 0.72 : 0.9
      });
    }

    for (const node of scene.nodes) {
      const fill = colorValue(node.color, node.kind === "core" ? 0xe5b85c : 0x718491);
      nodes.circle(node.x, node.y, node.radius).fill({ color: fill, alpha: node.kind === "core" ? 1 : 0.9 });
      if (node.kind === "core") {
        nodes.circle(node.x, node.y, node.radius + 5).stroke({ color: fill, width: 1.5, alpha: 0.72 });
      }
      const label = new Text({ text: node.label, style: labelStyle });
      label.anchor.set(0.5, 0);
      label.position.set(node.x, node.y + node.radius + 8);
      labels.addChild(label);
    }

    world.position.set(x, y);
    world.scale.set(scale);
    app.render();
    return true;
  }

  function resize(width, height) {
    if (disposed) return false;
    positive(width, "width");
    positive(height, "height");
    app.renderer.resize(width, height);
    return true;
  }

  function dispose() {
    if (disposed) return false;
    disposed = true;
    for (const label of labels.removeChildren()) label.destroy();
    app.destroy({ removeView: false, children: true });
    return true;
  }

  return {
    render,
    resize,
    dispose,
    capabilities: Object.freeze({
      backend: "pixijs",
      renderer: "webgl",
      interactive: false,
      supportsResize: true,
      supportsReducedMotion: true,
      sceneContractVersion: 1
    })
  };
}
