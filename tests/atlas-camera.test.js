import test from "node:test";
import assert from "node:assert/strict";
import { getAtlasFocusScale } from "../src/features/atlas/atlas-camera.js";

test("focus camera fits a department's immediate fractal generation on mobile and desktop", () => {
  const mobile = getAtlasFocusScale(1250, 390, 600);
  const desktop = getAtlasFocusScale(1250, 1440, 774);
  assert.ok(Math.abs(mobile - (390 * 0.34 / 1250)) < 1e-10);
  assert.ok(Math.abs(desktop - (774 * 0.34 / 1250)) < 1e-10);
  assert.ok(desktop > mobile, "larger stages should expose a proportionally wider branch field");
});

test("focus camera clamps tiny or invalid branch distances safely", () => {
  assert.equal(getAtlasFocusScale(0, 390, 600), 12);
  assert.equal(getAtlasFocusScale(-10, 390, 600), 12);
  assert.equal(getAtlasFocusScale(1e9, 390, 600), 0.075);
});
