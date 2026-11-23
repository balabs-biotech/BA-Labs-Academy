import test from "node:test";
import assert from "node:assert/strict";
import * as engine from "../../src/features/atlas/engine/index.js";

test("V2 public entry point exposes the first stable engine contracts", () => {
  assert.equal(typeof engine.createAtlasTopology, "function");
  assert.equal(typeof engine.createRadialTopology, "function");
  assert.equal(typeof engine.createRhizomorphicMorphology, "function");
  assert.equal(typeof engine.createCurveSpatialIndex, "function");
  assert.equal(typeof engine.getConservativeBezierBounds, "function");
  assert.equal(typeof engine.createVisualAnastomoses, "function");
  assert.equal(typeof engine.createGeometryTransaction, "function");
  assert.equal(typeof engine.createAtlasScene, "function");
  assert.equal(typeof engine.resolveNodeOverlaps, "function");
  assert.equal(typeof engine.createAtlasRendererSupervisor, "function");
  assert.equal(typeof engine.createPixiSceneAdapter, "function");
});
