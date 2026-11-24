import test from "node:test";
import assert from "node:assert/strict";
import { resolveAtlasLabelLayout } from "../../src/features/atlas/engine/rendering/label-layout.js";

const nodes = [
  { id: "core", x: 0, y: 0, radius: 12, kind: "core", generation: 0 },
  { id: "universe", x: 160, y: 0, radius: 10, kind: "universe", generation: 1, angle: 0 },
  { id: "leaf", x: 320, y: 0, radius: 8, kind: "knowledge", generation: 5, angle: 0 }
];
const measurements = nodes.map((node) => ({ id: node.id, width: 54, height: 14 }));

test("label layout separates visible text rectangles", () => {
  const result = resolveAtlasLabelLayout({ nodes, measurements, scale: 1, gap: 8 });
  const visible = result.placements.filter((placement) => placement.visible);
  for (let i = 0; i < visible.length; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      const a = visible[i], b = visible[j];
      assert.ok(a.x + a.width / 2 + 8 <= b.x - b.width / 2
        || b.x + b.width / 2 + 8 <= a.x - a.width / 2
        || a.y + a.height / 2 + 8 <= b.y - b.height / 2
        || b.y + b.height / 2 + 8 <= a.y - a.height / 2);
    }
  }
});

test("label layout avoids non-associated node exclusion circles", () => {
  const crowded = [
    { id: "a", x: 0, y: 0, radius: 10, kind: "universe", generation: 1 },
    { id: "b", x: 0, y: 35, radius: 10, kind: "knowledge", generation: 3 }
  ];
  const result = resolveAtlasLabelLayout({
    nodes: crowded,
    measurements: crowded.map((node) => ({ id: node.id, width: 48, height: 14 })),
    scale: 1, gap: 8
  });
  for (const placement of result.placements.filter((item) => item.visible)) {
    const rect = {
      left: placement.x - placement.width / 2,
      right: placement.x + placement.width / 2,
      top: placement.y - placement.height / 2,
      bottom: placement.y + placement.height / 2
    };
    for (const node of crowded.filter((item) => item.id !== placement.id)) {
      const nearestX = Math.max(rect.left, Math.min(node.x, rect.right));
      const nearestY = Math.max(rect.top, Math.min(node.y, rect.bottom));
      assert.ok(Math.hypot(nearestX - node.x, nearestY - node.y) >= node.radius + 4);
    }
  }
});

test("label layout applies zoom LOD while retaining every node placement", () => {
  const low = resolveAtlasLabelLayout({ nodes, measurements, scale: 0.1 });
  const high = resolveAtlasLabelLayout({ nodes, measurements, scale: 1 });
  assert.equal(low.placements.length, nodes.length);
  assert.equal(low.placements.find((item) => item.id === "core").visible, true);
  assert.equal(low.placements.find((item) => item.id === "leaf").visible, false);
  assert.equal(high.placements.find((item) => item.id === "leaf").visible, true);
});

test("label layout is deterministic regardless of input order", () => {
  const first = resolveAtlasLabelLayout({ nodes, measurements, scale: 1 });
  const second = resolveAtlasLabelLayout({
    nodes: [...nodes].reverse(),
    measurements: [...measurements].reverse(),
    scale: 1
  });
  assert.deepEqual(first, second);
});

test("invalid text measurements hide only the affected label", () => {
  const result = resolveAtlasLabelLayout({
    nodes,
    measurements: [
      { id: "core", width: 0, height: 12 },
      { id: "universe", width: 50, height: 14 },
      { id: "leaf", width: 54, height: 14 }
    ],
    scale: 1
  });
  assert.equal(result.placements.find((item) => item.id === "core").reason, "invalid-measurement");
  assert.equal(result.placements.find((item) => item.id === "universe").visible, true);
});


test("radial department labels prefer a tangential offset to preserve mobile viewport width", () => {
  const radialNode = { id: "bio", x: 760, y: 0, radius: 18, kind: "universe", generation: 1, angle: 0 };
  const result = resolveAtlasLabelLayout({
    nodes: [radialNode],
    measurements: [{ id: "bio", width: 220, height: 14 }],
    scale: 0.2,
    gap: 8
  });
  const placement = result.placements[0];
  assert.equal(placement.visible, true);
  assert.ok(Math.abs(placement.x - radialNode.x) < 1e-6,
    "a right-facing radial anchor should place its long label tangentially, not farther right");
  assert.ok(Math.abs(placement.y - radialNode.y) > 100,
    "the label should move above or below the radial axis");
});
