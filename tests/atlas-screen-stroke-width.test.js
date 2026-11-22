import test from "node:test";
import assert from "node:assert/strict";
import { getAtlasScreenStrokeWidth } from "../src/features/atlas/atlas-connections.js";

test("Atlas filament strokes retain a minimum screen-space width at overview scale", () => {
  const width = getAtlasScreenStrokeWidth(1.5, 0.2, 1.05);
  assert.ok(width * 0.2 >= 1.05 - 1e-9);
});

test("Atlas filament strokes preserve native width when already legible", () => {
  assert.equal(getAtlasScreenStrokeWidth(8, 0.5, 1), 8);
});

test("Atlas filament stroke calculation remains bounded at minimum camera scale", () => {
  const width = getAtlasScreenStrokeWidth(0.4, 0, 0.8);
  assert.ok(Number.isFinite(width));
  assert.ok(width * 0.075 >= 0.8 - 1e-9);
});
