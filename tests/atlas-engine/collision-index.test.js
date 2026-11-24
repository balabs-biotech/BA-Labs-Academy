import test from "node:test";
import assert from "node:assert/strict";
import { createCurveSpatialIndex, getConservativeBezierBounds } from "../../src/features/atlas/engine/spatial/collision-index.js";

const curve = (a, c1, c2, b) => ({ a, c1, c2, b });
const branch = (id, curveValue) => ({ id, curve: curveValue });

test("Bezier bounds include control-point excursions beyond the endpoint rectangle", () => {
  const arch = curve({ x: 0, y: 0 }, { x: 20, y: 300 }, { x: 80, y: 300 }, { x: 100, y: 0 });
  assert.deepEqual(getConservativeBezierBounds(arch), { minX: 0, minY: 0, maxX: 100, maxY: 300 });
});

test("spatial index finds curves whose conservative envelopes overlap", () => {
  const tall = branch("tall", curve({ x: 0, y: 0 }, { x: 30, y: 300 }, { x: 70, y: 300 }, { x: 100, y: 0 }));
  const crossing = curve({ x: 45, y: 250 }, { x: 45, y: 220 }, { x: 55, y: 180 }, { x: 55, y: 150 });
  const index = createCurveSpatialIndex([tall], { cellSize: 64 });
  assert.deepEqual(index.queryCurve(crossing).map(({ id }) => id), ["tall"]);
});

test("spatial index deduplicates candidates and supports explicit exclusions", () => {
  const item = branch("multi-cell", curve({ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 50 }, { x: 150, y: 0 }));
  const index = createCurveSpatialIndex([item], { cellSize: 16 });
  const query = curve({ x: 20, y: 20 }, { x: 30, y: 30 }, { x: 40, y: 30 }, { x: 50, y: 20 });
  assert.equal(index.queryCurve(query).length, 1);
  assert.equal(index.queryCurve(query, 0, ["multi-cell"]).length, 0);
});

test("spatial index rejects malformed curves, duplicate IDs and pathological cell spans", () => {
  assert.throws(() => getConservativeBezierBounds({ a: { x: 0, y: 0 } }), /four finite control points/);
  const valid = curve({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 0 });
  assert.throws(() => createCurveSpatialIndex([branch("x", valid), branch("x", valid)]), /duplicate branch id/);
  assert.throws(() => createCurveSpatialIndex([branch("wide", curve(
    { x: 0, y: 0 }, { x: 1000, y: 1000 }, { x: 2000, y: 1000 }, { x: 3000, y: 0 }
  ))], { cellSize: 1, maxCellsPerBranch: 20 }), /too many spatial cells/);
});
