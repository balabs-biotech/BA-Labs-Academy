import test from "node:test";
import assert from "node:assert/strict";
import { createAtlasTopology } from "../../src/features/atlas/engine/core/topology.js";
import { createRadialTopology } from "../../src/features/atlas/engine/spatial/radial-topology.js";
import { createRhizomorphicMorphology } from "../../src/features/atlas/engine/biology/morphogenesis.js";

function fixture() {
  const nodes = [
    { id: "MYC", parent: null, title: "Mycology" },
    { id: "myc-section-a", parent: "MYC" },
    { id: "myc-section-b", parent: "MYC" },
    { id: "BIO", parent: null, title: "Plant sciences" },
    { id: "bio-section", parent: "BIO" },
    { id: "bio-module-a", parent: "bio-section" },
    { id: "bio-module-b", parent: "bio-section" },
    { id: "AGR", parent: null, title: "Soils" },
    { id: "agr-section", parent: "AGR" }
  ];
  const topology = createAtlasTopology({ nodes });
  const radialTopology = createRadialTopology({
    core: { id: "MYC" },
    universes: [
      { id: "BIO", nodeId: "BIO", color: "#5596C8" },
      { id: "AGR", nodeId: "AGR", color: "#A0A85C" }
    ],
    radius: 900
  });
  return { topology, radialTopology };
}

test("morphogenesis builds a central core, radial trunks and recursive territory branches", () => {
  const { topology, radialTopology } = fixture();
  const model = createRhizomorphicMorphology({ topology, radialTopology });
  assert.equal(model.byId.get("MYC").x, 0);
  assert.equal(model.byId.get("BIO").x, radialTopology.byId.get("BIO").x);
  assert.equal(model.byId.get("BIO").y, radialTopology.byId.get("BIO").y);
  assert.equal(model.territories.size, 2);
  assert.equal(model.metrics.nodeCount, 9);
  assert.ok(model.branches.some((branch) => branch.id === "trunk:MYC:BIO" && branch.visualOnly));
  assert.equal(model.byId.get("bio-module-a").territoryId, "BIO");
  assert.ok(model.byId.get("bio-module-a").generation > model.byId.get("BIO").generation);
});

test("morphogenesis is deterministic for the same topology, anchors and seed", () => {
  const input = fixture();
  const first = createRhizomorphicMorphology(input);
  const second = createRhizomorphicMorphology(input);
  assert.deepEqual(first.nodes.map(({ id, x, y, angle, generation }) => ({ id, x, y, angle, generation })),
    second.nodes.map(({ id, x, y, angle, generation }) => ({ id, x, y, angle, generation })));
  assert.deepEqual(first.branches.map(({ id, curve }) => ({ id, curve })),
    second.branches.map(({ id, curve }) => ({ id, curve })));
});

test("morphogenesis preserves independent territory ownership and stable IDs", () => {
  const model = createRhizomorphicMorphology(fixture());
  const owned = model.nodes.filter((node) => node.territoryId === "BIO");
  assert.deepEqual(new Set(owned.map((node) => node.id)), new Set(["BIO", "bio-section", "bio-module-a", "bio-module-b"]));
  assert.equal(new Set(model.nodes.map((node) => node.id)).size, model.nodes.length);
});

test("morphogenesis rejects unknown roots, nested universe roots and invalid parameters", () => {
  const input = fixture();
  assert.throws(() => createRhizomorphicMorphology({ ...input, radialTopology: {
    ...input.radialTopology, universes: [{ id: "MISSING", nodeId: "MISSING", angle: 0, x: 1, y: 1 }]
  } }), /no matching topology node/);
  assert.throws(() => createRhizomorphicMorphology({
    ...input,
    radialTopology: { ...input.radialTopology, universes: [{ id: "nested", nodeId: "bio-section", angle: 0, x: 0, y: 0 }] }
  }), /hierarchy root/);
  assert.throws(() => createRhizomorphicMorphology({ ...input, branchLength: 0 }), /positive/);
});

test("morphogenesis handles deep branches iteratively", () => {
  const nodes = [{ id: "MYC", parent: null }, { id: "BIO", parent: null }];
  for (let index = 0; index < 1500; index += 1) {
    nodes.push({ id: "bio-" + index, parent: index === 0 ? "BIO" : "bio-" + (index - 1) });
  }
  const topology = createAtlasTopology({ nodes });
  const radialTopology = createRadialTopology({ core: { id: "MYC" }, universes: [{ id: "BIO" }] });
  const model = createRhizomorphicMorphology({ topology, radialTopology });
  assert.equal(model.byId.get("bio-1499").generation, 1501);
  assert.equal(model.metrics.nodeCount, 1502);
});
