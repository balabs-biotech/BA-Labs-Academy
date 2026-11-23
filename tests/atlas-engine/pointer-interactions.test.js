import test from "node:test";
import assert from "node:assert/strict";
import { createAtlasCameraController } from "../../src/features/atlas/engine/presentation/camera-controller.js";
import { attachAtlasPointerInteractions } from "../../src/features/atlas/engine/presentation/pointer-interactions.js";

class FakeElement {
  constructor() {
    this.listeners = new Map();
    this.captures = new Set();
    this.style = { touchAction: "pan-y" };
  }
  getBoundingClientRect() { return { left: 10, top: 20, width: 300, height: 200 }; }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { this.captures.delete(id); }
  dispatch(type, values = {}) {
    const event = { preventDefault() { this.prevented = true; }, ...values };
    for (const callback of this.listeners.get(type) || []) callback(event);
    return event;
  }
}

function setup(options = {}) {
  const element = new FakeElement();
  const camera = createAtlasCameraController({
    viewportWidth: 300,
    viewportHeight: 200,
    bounds: { minX: -1000, minY: -800, maxX: 1000, maxY: 800 }
  });
  const selected = [];
  const changes = [];
  const interactions = attachAtlasPointerInteractions(element, camera, {
    onSelect: (point) => selected.push(point),
    onChange: (snapshot) => changes.push(snapshot),
    ...options
  });
  return { element, camera, selected, changes, interactions };
}

test("single-pointer drag pans camera and does not trigger selection", () => {
  const { element, camera, selected, changes, interactions } = setup();
  const before = camera.getSnapshot();
  element.dispatch("pointerdown", { pointerId: 1, pointerType: "mouse", button: 0, clientX: 100, clientY: 100 });
  element.dispatch("pointermove", { pointerId: 1, pointerType: "mouse", clientX: 125, clientY: 115 });
  element.dispatch("pointerup", { pointerId: 1, pointerType: "mouse", clientX: 125, clientY: 115 });
  const after = camera.getSnapshot();
  assert.equal(after.x, before.x + 25);
  assert.equal(after.y, before.y + 15);
  assert.equal(selected.length, 0);
  assert.ok(changes.length > 0);
  assert.equal(interactions.activePointerCount, 0);
});

test("tap selects once using coordinates local to the interaction surface", () => {
  const { element, selected } = setup();
  element.dispatch("pointerdown", { pointerId: 7, pointerType: "mouse", button: 0, clientX: 90, clientY: 75 });
  element.dispatch("pointerup", { pointerId: 7, pointerType: "mouse", clientX: 91, clientY: 76 });
  assert.deepEqual(selected, [{ x: 81, y: 56 }]);
});

test("pointercancel and lost capture cancel gestures without converting them to taps", () => {
  const first = setup();
  first.element.dispatch("pointerdown", { pointerId: 2, pointerType: "touch", button: 0, clientX: 80, clientY: 80 });
  first.element.dispatch("pointercancel", { pointerId: 2 });
  first.element.dispatch("pointerup", { pointerId: 2, pointerType: "touch", clientX: 80, clientY: 80 });
  assert.equal(first.selected.length, 0);
  assert.equal(first.interactions.activePointerCount, 0);

  const second = setup();
  second.element.dispatch("pointerdown", { pointerId: 3, pointerType: "touch", button: 0, clientX: 80, clientY: 80 });
  second.element.dispatch("lostpointercapture", { pointerId: 3 });
  assert.equal(second.selected.length, 0);
  assert.equal(second.interactions.activePointerCount, 0);
});

test("two-pointer pinch zooms around the midpoint and suppresses tap selection", () => {
  const { element, camera, selected } = setup();
  const before = camera.getSnapshot();
  element.dispatch("pointerdown", { pointerId: 1, pointerType: "touch", button: 0, clientX: 40, clientY: 100 });
  element.dispatch("pointerdown", { pointerId: 2, pointerType: "touch", button: 0, clientX: 100, clientY: 100 });
  element.dispatch("pointermove", { pointerId: 2, pointerType: "touch", clientX: 130, clientY: 100 });
  element.dispatch("pointerup", { pointerId: 2, pointerType: "touch", clientX: 130, clientY: 100 });
  element.dispatch("pointerup", { pointerId: 1, pointerType: "touch", clientX: 40, clientY: 100 });
  assert.ok(camera.getSnapshot().scale > before.scale);
  assert.equal(selected.length, 0);
});

test("wheel zooms at cursor and prevents page scroll", () => {
  const { element, camera } = setup();
  const before = camera.getSnapshot();
  const event = element.dispatch("wheel", { clientX: 110, clientY: 90, deltaY: -120 });
  assert.equal(event.prevented, true);
  assert.ok(camera.getSnapshot().scale > before.scale);
});

test("destroy removes listeners, releases capture and restores touch action", () => {
  const { element, interactions } = setup();
  element.dispatch("pointerdown", { pointerId: 9, pointerType: "touch", button: 0, clientX: 50, clientY: 50 });
  assert.equal(element.style.touchAction, "none");
  assert.equal(interactions.destroy(), true);
  assert.equal(interactions.destroy(), false);
  assert.equal(element.style.touchAction, "pan-y");
  assert.equal(interactions.activePointerCount, 0);
  assert.equal(element.listeners.get("pointerdown").size, 0);
  assert.equal(element.captures.size, 0);
});

test("interaction attachment validates callbacks and camera contracts", () => {
  const element = new FakeElement();
  assert.throws(() => attachAtlasPointerInteractions(element, {}), /camera controller/);
  assert.throws(() => attachAtlasPointerInteractions(element, createAtlasCameraController({
    viewportWidth: 300, viewportHeight: 200
  }), { clickTolerance: -1 }), /non-negative/);
});
