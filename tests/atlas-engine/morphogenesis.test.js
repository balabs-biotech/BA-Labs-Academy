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


test("morphogenesis reserves angular gaps at core and nested hierarchy levels", () => {
  const { topology, radialTopology } = fixture();
  const model = createRhizomorphicMorphology({
    topology, radialTopology, minimumAngularGap: 0.12
  });
  for (const parentId of ["MYC", "bio-section"]) {
    const children = topology.childrenByParent.get(parentId);
    const sectors = children.map((child) => model.byId.get(child.id).sector);
    assert.ok(sectors.every((sector) => sector && Number.isFinite(sector.start) && Number.isFinite(sector.end)));
    const ordered = [...sectors].sort((a, b) => a.start - b.start);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      assert.ok(ordered[index].end < ordered[index + 1].start, "sibling sectors must not overlap");
      assert.ok(ordered[index + 1].start - ordered[index].end >= 0.119, "a reserved angular gap must separate siblings");
    }
    if (parentId === "MYC") {
      const wrapGap = Math.PI * 2 - (ordered.at(-1).end - ordered[0].start);
      assert.ok(wrapGap >= 0.119, "the full-ring allocation must reserve a wrap gap");
    }
  }
});

test("morphogenesis keeps every child angle inside its assigned sector", () => {
  const { topology, radialTopology } = fixture();
  const model = createRhizomorphicMorphology({
    topology, radialTopology, minimumAngularGap: 0.1
  });
  for (const node of model.nodes) {
    if (!node.sector) continue;
    assert.ok(node.angle >= node.sector.start && node.angle <= node.sector.end);
    assert.ok(node.sector.end > node.sector.start);
  }
});

test("morphogenesis adapts angular gaps safely for crowded sibling sets", () => {
  const nodes = [{ id: "MYC", parent: null }, { id: "BIO", parent: null }];
  for (let index = 0; index < 80; index += 1) {
    nodes.push({ id: "bio-child-" + index, parent: "BIO" });
  }
  const topology = createAtlasTopology({ nodes });
  const radialTopology = createRadialTopology({ core: { id: "MYC" }, universes: [{ id: "BIO" }] });
  const model = createRhizomorphicMorphology({
    topology, radialTopology, minimumAngularGap: 0.2
  });
  const sectors = nodes.slice(2).map((node) => model.byId.get(node.id).sector);
  assert.ok(sectors.every((sector) => Number.isFinite(sector.start) && Number.isFinite(sector.end)));
  assert.ok(sectors.every((sector) => sector.end > sector.start));
  assert.ok(sectors.every((sector) => Number.isFinite(sector.gapAfter) && sector.gapAfter >= 0));
});


test("morphogenesis creates asymmetric primary cords and bounded secondary hyphae", () => {
  const { topology, radialTopology } = fixture();
  const input = { topology, radialTopology, seed: "hypha-fixture" };
  const first = createRhizomorphicMorphology(input);
  const second = createRhizomorphicMorphology(input);
  assert.ok(first.branches.every((branch) => Number.isFinite(branch.width) && branch.width > 0));
  assert.ok(first.branches.some((branch) => branch.style === "rhizomorph"));
  assert.ok(first.hyphae.length > 0);
  assert.ok(first.hyphae.length <= 1200);
  assert.equal(new Set(first.hyphae.map((hypha) => hypha.id)).size, first.hyphae.length);
  assert.ok(first.hyphae.every((hypha) => hypha.style === "secondary-hypha" && hypha.width < 1.5));
  assert.ok(first.hyphae.every((hypha) => Object.values(hypha.curve).every((point) =>
    Number.isFinite(point.x) && Number.isFinite(point.y))));
  assert.deepEqual(first.hyphae, second.hyphae);
  const curved = first.branches.find((branch) => branch.style === "rhizomorph");
  const dx = curved.target.x - curved.source.x;
  const dy = curved.target.y - curved.source.y;
  const normal = { x: -dy / Math.hypot(dx, dy), y: dx / Math.hypot(dx, dy) };
  const bend1 = (curved.curve.c1.x - (curved.source.x + dx / 3)) * normal.x
    + (curved.curve.c1.y - (curved.source.y + dy / 3)) * normal.y;
  const bend2 = (curved.curve.c2.x - (curved.source.x + 2 * dx / 3)) * normal.x
    + (curved.curve.c2.y - (curved.source.y + 2 * dy / 3)) * normal.y;
  assert.notEqual(bend1, bend2, "primary cord control bends must be asymmetric");
});


test("morphogenesis reports no trailing gap for a non-circular final sibling", () => {
  const { topology, radialTopology } = fixture();
  const model = createRhizomorphicMorphology({ topology, radialTopology });
  const children = topology.childrenByParent.get("bio-section");
  assert.equal(model.byId.get(children.at(-1).id).sector.gapAfter, 0);
});

test("morphogenesis rejects a disabled angular gap configuration", () => {
  const input = fixture();
  assert.throws(() => createRhizomorphicMorphology({ ...input, minimumAngularGap: 0 }), /must be positive/);
});
