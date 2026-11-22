import test from "node:test";
import assert from "node:assert/strict";
import { createAtlasGrowthModel, ATLAS_GROWTH_DEFAULTS } from "../src/features/atlas/atlas-growth-model.js";

const fixture = () => [
  { id: "root", entity_type: "DEPARTMENT", entity_key: "BIO", parent: null, x: 0, y: 0, angle: 0, level: 0 },
  { id: "section-a", parent: "root", level: 1, title: "A" },
  { id: "section-b", parent: "root", level: 1, title: "B" },
  { id: "module-a1", parent: "section-a", level: 2, title: "A1" },
  { id: "module-a2", parent: "section-a", level: 2, title: "A2" },
  { id: "detail-a1", parent: "module-a1", level: 3, title: "A1.1" }
];

test("growth model recursively generates one stable branch generation per hierarchy level", () => {
  const model = createAtlasGrowthModel({ nodes: fixture() });
  assert.equal(model.maxDepth, 3);
  assert.equal(model.branches.length, 5);
  assert.deepEqual(
    model.nodes.map((node) => node.generation).sort((a, b) => a - b),
    [0, 1, 1, 2, 2, 3]
  );
  for (const branch of model.branches) {
    assert.equal(branch.target.parent, branch.sourceId);
    assert.equal(branch.targetId, branch.target.id);
    assert.ok(Number.isFinite(branch.curve.c1.x) && Number.isFinite(branch.curve.c2.y));
  }
});

test("revealing deeper generations does not move previously visible nodes", () => {
  const nodes = fixture();
  const shallow = createAtlasGrowthModel({ nodes, visibleDepth: 1 });
  const deep = createAtlasGrowthModel({ nodes, visibleDepth: 3 });
  assert.equal(shallow.visibleNodes.length, 3);
  assert.equal(shallow.visibleBranches.length, 2);
  for (const node of shallow.visibleNodes) {
    const expanded = deep.byId.get(node.id);
    assert.equal(expanded.x, node.x);
    assert.equal(expanded.y, node.y);
    assert.equal(expanded.angle, node.angle);
  }
});

test("growth positions and branch identities are deterministic", () => {
  const first = createAtlasGrowthModel({ nodes: fixture() });
  const second = createAtlasGrowthModel({ nodes: fixture() });
  assert.deepEqual(first.nodes.map(({ id, x, y, angle }) => ({ id, x, y, angle })),
    second.nodes.map(({ id, x, y, angle }) => ({ id, x, y, angle })));
  assert.deepEqual(first.branches.map((branch) => branch.id), second.branches.map((branch) => branch.id));
});

test("mycology root grows a full-ring first generation", () => {
  const nodes = fixture();
  nodes[0] = { ...nodes[0], entity_key: "MYC" };
  const model = createAtlasGrowthModel({ nodes });
  const firstGeneration = model.nodes.filter((node) => node.generation === 1);
  const angles = firstGeneration.map((node) => node.angle).sort((a, b) => a - b);
  assert.equal(angles.length, 2);
  assert.ok(angles[1] - angles[0] >= Math.PI - 1e-10);
});

test("growth occupancy preserves a deliberate guard between child sectors", () => {
  assert.ok(ATLAS_GROWTH_DEFAULTS.occupancy > 0.75);
  assert.ok(ATLAS_GROWTH_DEFAULTS.occupancy < 1);
  assert.throws(() => createAtlasGrowthModel({ nodes: fixture(), occupancy: 0 }), /occupancy/);
});

test("invalid hierarchy cycles are rejected rather than recursed indefinitely", () => {
  const nodes = fixture();
  nodes[0] = { ...nodes[0], parent: "detail-a1" };
  assert.throws(() => createAtlasGrowthModel({ nodes }), /cycle/);
});


test("department root growth preserves its preallocated geographic sector", () => {
  const nodes = fixture();
  nodes[0] = {
    ...nodes[0],
    angle: 1.2,
    growthSector: { angle: 1.2, spread: 0.42, fullRing: false }
  };
  const model = createAtlasGrowthModel({ nodes });
  const child = model.byId.get("section-a");
  assert.ok(Math.abs(child.angle - 1.2) <= 0.42 / 2);
  assert.ok(Math.abs(child.growthSector.spread - 0.28) < 1e-10);
  const moduleA1 = model.byId.get("module-a1");
  const moduleA2 = model.byId.get("module-a2");
  const terminalFanWidth = child.growthSector.spread * ATLAS_GROWTH_DEFAULTS.occupancy;
  assert.ok(Math.abs(moduleA1.angle - child.angle) <= terminalFanWidth / 2);
  assert.ok(Math.abs(moduleA2.angle - child.angle) <= terminalFanWidth / 2);
});

test("explicit full-ring root sectors are honored without changing root anchors", () => {
  const nodes = fixture();
  nodes[0] = {
    ...nodes[0],
    x: 120,
    y: -80,
    growthSector: { angle: 0.7, spread: Math.PI * 2, fullRing: true }
  };
  const model = createAtlasGrowthModel({ nodes });
  assert.equal(model.byId.get("root").x, 120);
  assert.equal(model.byId.get("root").y, -80);
  assert.equal(model.byId.get("section-a").generation, 1);
  assert.equal(model.byId.get("section-b").generation, 1);
  assert.ok(Math.abs(model.byId.get("section-a").angle - model.byId.get("section-b").angle) >= Math.PI - 1e-10);
});

test("terminal siblings are packed closer without shortening their parent branches", () => {
  const nodes = [
    { id: "root", parent: null, level: 0, x: 0, y: 0, angle: 0,
      growthSector: { angle: 0, spread: 1.2, fullRing: false } },
    { id: "leaf-a", parent: "root", level: 1 },
    { id: "leaf-b", parent: "root", level: 1 },
    { id: "leaf-c", parent: "root", level: 1 },
    { id: "leaf-d", parent: "root", level: 1 }
  ];
  const model = createAtlasGrowthModel({ nodes });
  const terminals = model.nodes.filter((node) => node.parent === "root");
  const angles = terminals.map((node) => node.angle);
  const angularSpan = Math.max(...angles) - Math.min(...angles);
  assert.ok(angularSpan < 0.8,
    "terminal angular span must contract independently of parent-child radius");
  for (const terminal of terminals) {
    const distance = Math.hypot(terminal.x, terminal.y);
    assert.ok(distance >= ATLAS_GROWTH_DEFAULTS.generationLengthBase * 0.94);
    assert.ok(distance <= ATLAS_GROWTH_DEFAULTS.generationLengthBase * 1.06);
  }
});
