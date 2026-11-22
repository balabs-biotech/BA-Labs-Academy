import test from "node:test";
import assert from "node:assert/strict";
import { atlasCurveIntersectsViewport } from "../src/features/atlas/atlas-connections.js";

const viewport = { left: -100, top: -80, right: 100, bottom: 80 };

test("keeps a Bezier control hull that intersects the viewport", () => {
  const curve = {
    a: { x: -180, y: 0 }, c1: { x: -40, y: -20 },
    c2: { x: 40, y: 20 }, b: { x: 180, y: 0 }
  };
  assert.equal(atlasCurveIntersectsViewport(curve, viewport), true);
});

test("rejects a Bezier control hull wholly outside the viewport", () => {
  const curve = {
    a: { x: 140, y: 120 }, c1: { x: 180, y: 130 },
    c2: { x: 220, y: 140 }, b: { x: 260, y: 150 }
  };
  assert.equal(atlasCurveIntersectsViewport(curve, viewport), false);
});

test("does not cull when no viewport is supplied", () => {
  const curve = {
    a: { x: 1000, y: 1000 }, c1: { x: 1100, y: 1100 },
    c2: { x: 1200, y: 1200 }, b: { x: 1300, y: 1300 }
  };
  assert.equal(atlasCurveIntersectsViewport(curve, null), true);
});
