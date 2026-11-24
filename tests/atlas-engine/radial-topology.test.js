import test from "node:test";
import assert from "node:assert/strict";
import { createRadialTopology } from "../../src/features/atlas/engine/spatial/radial-topology.js";

const universes = (count) => Array.from({ length: count }, (_, index) => ({
  id: "universe-" + index, color: "#" + String(index).padStart(6, "0")
}));

test("radial topology supports current and future universe counts", () => {
  for (const count of [1, 8, 14, 32]) {
    const model = createRadialTopology({ core: { id: "MYC" }, universes: universes(count) });
    assert.equal(model.count, count);
    assert.equal(model.byId.size, count + 1);
    assert.deepEqual([model.core.x, model.core.y], [0, 0]);
    assert.equal(new Set(model.universes.map(({ id }) => id)).size, count);
    for (const universe of model.universes) {
      assert.ok(Number.isFinite(universe.x));
      assert.ok(Number.isFinite(universe.y));
      assert.ok(Math.abs(Math.hypot(universe.x, universe.y) - 1000) < 1e-8);
    }
  }
});

test("radial positions are deterministic and evenly distributed", () => {
  const first = createRadialTopology({ core: { id: "MYC" }, universes: universes(8) });
  const second = createRadialTopology({ core: { id: "MYC" }, universes: universes(8) });
  assert.deepEqual(first.universes.map(({ id, angle, x, y }) => ({ id, angle, x, y })),
    second.universes.map(({ id, angle, x, y }) => ({ id, angle, x, y })));
  assert.ok(Math.abs(first.universes[0].angle - (-Math.PI / 2)) < 1e-10);
  assert.ok(Math.abs(first.universes[1].angle - first.universes[0].angle - Math.PI / 4) < 1e-10);
});

test("radial topology preserves explicit positions and universe metadata", () => {
  const model = createRadialTopology({
    core: { id: "MYC", label: "Mycology" },
    universes: [{ id: "bio", color: "#5596C8", angle: 0, radius: 500 }]
  });
  assert.equal(model.core.label, "Mycology");
  assert.equal(model.universes[0].color, "#5596C8");
  assert.equal(model.universes[0].x, 500);
  assert.equal(model.universes[0].y, 0);
});

test("radial topology rejects duplicate identities and invalid geometry", () => {
  assert.throws(() => createRadialTopology({ core: { id: "MYC" }, universes: [{ id: "MYC" }] }), /duplicate identity/);
  assert.throws(() => createRadialTopology({ core: { id: "MYC" }, universes: [{ id: "x" }, { id: "x" }] }), /duplicate identity/);
  assert.throws(() => createRadialTopology({ core: { id: "MYC" }, universes: [], startAngle: Infinity }), /startAngle/);
  assert.throws(() => createRadialTopology({ core: { id: "MYC" }, universes: [], radius: 0 }), /radius/);
  assert.throws(() => createRadialTopology({ core: { id: "MYC" }, universes: [], direction: 0 }), /direction/);
});
