import test from "node:test";
import assert from "node:assert/strict";
import { getAtlasNodeScreenRadius } from "../src/features/atlas/atlas-nodes.js";

test("fractal junctions retain a minimum screen-space radius at overview scale", () => {
  const scale = 0.15;
  const expected = new Map([[1, 3.4], [2, 2.6], [3, 2], [4, 1.5], [5, 1.2]]);
  for (const [level, pixels] of expected) {
    const radius = getAtlasNodeScreenRadius(level, 2, scale);
    assert.ok(Math.abs(radius * scale - pixels) < 1e-9,
      `generation ${level} should occupy at least ${pixels}px`);
  }
});

test("node radii preserve natural geometry when zoomed in", () => {
  assert.equal(getAtlasNodeScreenRadius(2, 8, 1), 8);
  assert.equal(getAtlasNodeScreenRadius(3, 12, 2), 12);
});

test("node screen radius is finite and protected against invalid camera scales", () => {
  assert.equal(getAtlasNodeScreenRadius(2, 0, 0), 2.6 / 0.075);
  assert.equal(getAtlasNodeScreenRadius(-1, 4, 0.5), 4);
  assert.ok(Number.isFinite(getAtlasNodeScreenRadius(99, 0, 0.2)));
});
