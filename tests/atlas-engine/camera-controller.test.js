import test from "node:test";
import assert from "node:assert/strict";
import { createAtlasCameraController } from "../../src/features/atlas/engine/presentation/camera-controller.js";

const bounds = { minX: -200, minY: -100, maxX: 200, maxY: 100 };

test("camera fit centers world bounds and preserves immutable snapshots", () => {
  const camera = createAtlasCameraController({ viewportWidth: 1000, viewportHeight: 600, bounds });
  const state = camera.getSnapshot();
  assert.equal(state.scale, 1.9);
  const center = camera.worldToScreen({ x: 0, y: 0 });
  assert.deepEqual(center, { x: 500, y: 300 });
  assert.ok(Object.isFrozen(state) && Object.isFrozen(state.viewport) && Object.isFrozen(state.bounds));
});

test("cursor-anchored zoom preserves the world point under the pointer", () => {
  const camera = createAtlasCameraController({ viewportWidth: 1000, viewportHeight: 600, bounds });
  const anchor = { x: 620, y: 240 };
  const worldBefore = camera.screenToWorld(anchor);
  camera.zoomAt(1.6, anchor);
  const worldAfter = camera.screenToWorld(anchor);
  assert.ok(Math.abs(worldBefore.x - worldAfter.x) < 1e-9);
  assert.ok(Math.abs(worldBefore.y - worldAfter.y) < 1e-9);
});

test("camera pan and zoom remain inside configured scale and visibility bounds", () => {
  const camera = createAtlasCameraController({
    viewportWidth: 800, viewportHeight: 500, bounds,
    minScale: 0.25, maxScale: 2, minVisibleRatio: 0.2
  });
  camera.zoomAt(100, { x: 400, y: 250 });
  assert.equal(camera.getSnapshot().scale, 2);
  camera.zoomAt(0.00001, { x: 400, y: 250 });
  assert.equal(camera.getSnapshot().scale, 0.25);
  camera.panBy(100000, -100000);
  const state = camera.getSnapshot();
  const left = bounds.minX * state.scale + state.x;
  const right = bounds.maxX * state.scale + state.x;
  const top = bounds.minY * state.scale + state.y;
  const bottom = bounds.maxY * state.scale + state.y;
  assert.ok(right >= 160 - 1e-6 && left <= 640 + 1e-6);
  assert.ok(bottom >= 100 - 1e-6 && top <= 400 + 1e-6);
});

test("viewport changes preserve scale and constrain translation; bounds can refit", () => {
  const camera = createAtlasCameraController({ viewportWidth: 1000, viewportHeight: 600, bounds });
  camera.panBy(-80, 30);
  const previousScale = camera.getSnapshot().scale;
  camera.setViewport(500, 700);
  assert.equal(camera.getSnapshot().scale, previousScale);
  camera.setBounds({ minX: -500, minY: -300, maxX: 500, maxY: 300 }, { refit: true });
  const state = camera.getSnapshot();
  assert.deepEqual(camera.worldToScreen({ x: 0, y: 0 }), { x: 250, y: 350 });
  assert.ok(state.scale > 0);
});

test("coordinate conversion round-trips and invalid operations are rejected", () => {
  const camera = createAtlasCameraController({ viewportWidth: 900, viewportHeight: 600, bounds });
  const world = { x: 42, y: -17 };
  const roundTrip = camera.screenToWorld(camera.worldToScreen(world));
  assert.ok(Math.abs(roundTrip.x - world.x) < 1e-9);
  assert.ok(Math.abs(roundTrip.y - world.y) < 1e-9);
  assert.throws(() => camera.zoomAt(0, { x: 0, y: 0 }), /positive/);
  assert.throws(() => camera.panBy(NaN, 0), /finite/);
  assert.throws(() => camera.setViewport(0, 100), /positive/);
  assert.throws(() => createAtlasCameraController({ viewportWidth: 100, viewportHeight: 100, minScale: 2, maxScale: 1 }), /greater than/);
});

test("camera reset refits the current viewport and bounds", () => {
  const camera = createAtlasCameraController({ viewportWidth: 1000, viewportHeight: 600, bounds });
  camera.zoomAt(1.8, { x: 200, y: 200 });
  camera.panBy(30, -20);
  camera.reset();
  assert.deepEqual(camera.worldToScreen({ x: 0, y: 0 }), { x: 500, y: 300 });
});
