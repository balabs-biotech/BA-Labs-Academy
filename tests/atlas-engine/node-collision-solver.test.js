import test from "node:test";
import assert from "node:assert/strict";
import { resolveNodeOverlaps } from "../../src/features/atlas/engine/spatial/node-collision-solver.js";

test("solver separates overlapping nodes without mutating input", () => {
  const nodes = [
    { id: "a", x: 0, y: 0, radius: 20 },
    { id: "b", x: 10, y: 0, radius: 20 },
    { id: "c", x: 200, y: 0, radius: 12 }
  ];
  const before = structuredClone(nodes);
  const result = resolveNodeOverlaps(nodes, { padding: 4, maxIterations: 30 });
  assert.deepEqual(nodes, before);
  assert.equal(result.metrics.initialOverlapCount, 1);
  assert.equal(result.metrics.remainingOverlapCount, 0);
  assert.equal(result.metrics.resolved, true);
  const [a, b] = result.nodes;
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 44 - 1e-6);
});

test("pinned anchors do not move and coincident points separate deterministically", () => {
  const nodes = [
    { id: "anchor", x: 0, y: 0, radius: 24, pinned: true },
    { id: "moving", x: 0, y: 0, radius: 24 }
  ];
  const first = resolveNodeOverlaps(nodes, { maxIterations: 30 });
  const second = resolveNodeOverlaps(nodes, { maxIterations: 30 });
  assert.deepEqual(first, second);
  assert.deepEqual(first.nodes.find((node) => node.id === "anchor"), {
    id: "anchor", x: 0, y: 0, radius: 24, pinned: true
  });
  assert.ok(Math.hypot(first.nodes[1].x, first.nodes[1].y) > 0);
});

test("solver caps per-node movement and reports unresolved pinned collisions", () => {
  const result = resolveNodeOverlaps([
    { id: "a", x: 0, y: 0, radius: 50, pinned: true },
    { id: "b", x: 0, y: 0, radius: 50, pinned: true },
    { id: "c", x: 0, y: 0, radius: 50 }
  ], { maxIterations: 4, maxDisplacement: 10, maxStep: 3 });
  assert.equal(result.metrics.resolved, false);
  assert.equal(result.nodes.find((node) => node.id === "a").x, 0);
  assert.equal(result.nodes.find((node) => node.id === "a").y, 0);
  const moved = result.nodes.find((node) => node.id === "c");
  assert.ok(Math.hypot(moved.x, moved.y) <= 10 + 1e-6);
});

test("solver validates identity, coordinates and computational bounds", () => {
  assert.throws(() => resolveNodeOverlaps([{ id: "x", x: 0, y: 0 }, { id: "x", x: 1, y: 1 }]), /duplicate/);
  assert.throws(() => resolveNodeOverlaps([{ id: "x", x: NaN, y: 0 }]), /finite/);
  assert.throws(() => resolveNodeOverlaps([{ id: "x", x: 0, y: 0, radius: -1 }]), /non-negative/);
  assert.throws(() => resolveNodeOverlaps([{ id: "x", x: 0, y: 0, radius: 10 }], { cellSize: 0.01 }), /excessive/);
});
