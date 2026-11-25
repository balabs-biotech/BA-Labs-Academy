import test from "node:test";
import assert from "node:assert/strict";
import { createAtlasTopology } from "../../src/features/atlas/engine/core/topology.js";
import { createRadialTopology } from "../../src/features/atlas/engine/spatial/radial-topology.js";
import { createRhizomorphicMorphology } from "../../src/features/atlas/engine/biology/morphogenesis.js";
import { createVisualAnastomoses } from "../../src/features/atlas/engine/biology/visual-anastomoses.js";

function fixture() {
  const nodes = [
    { id: "MYC", parent: null },
    { id: "myc-a", parent: "MYC" },
    { id: "BIO", parent: null },
    { id: "bio-a", parent: "BIO" },
    { id: "bio-b", parent: "BIO" },
    { id: "AGR", parent: null },
    { id: "agr-a", parent: "AGR" }
  ];
  const topology = createAtlasTopology({ nodes, edges: [
    { id: "pedagogy-1", sourceId: "bio-a", targetId: "bio-b" }
  ] });
  const radialTopology = createRadialTopology({
    core: { id: "MYC" },
    universes: [
      { id: "BIO", nodeId: "BIO", angle: 0, radius: 120 },
      { id: "AGR", nodeId: "AGR", angle: 0.08, radius: 125 }
    ]
  });
  return { topology, radialTopology };
}

test("anastomoses derive cross-territory links without mutating pedagogy or morphology", () => {
  const { topology, radialTopology } = fixture();
  const morphology = createRhizomorphicMorphology({ topology, radialTopology, branchLength: 90 });
  const edgesBefore = structuredClone(topology.edges);
  const branchesBefore = structuredClone(morphology.branches);
  const result = createVisualAnastomoses(morphology, { maxDistance: 500, maxLinks: 8 });
  assert.ok(result.links.length > 0);
  assert.ok(result.links.every((link) => link.visualOnly && link.relationshipType === "anastomosis"));
  assert.ok(result.links.every((link) => link.territoryIds.length === 2 && link.territoryIds[0] !== link.territoryIds[1]));
  assert.deepEqual(topology.edges, edgesBefore);
  assert.deepEqual(morphology.branches, branchesBefore);
});

test("anastomoses are deterministic, bounded and exclude core-level nodes by default", () => {
  const { topology, radialTopology } = fixture();
  const morphology = createRhizomorphicMorphology({ topology, radialTopology, branchLength: 90 });
  const options = { maxDistance: 500, maxLinks: 3, maxDegree: 1 };
  const first = createVisualAnastomoses(morphology, options);
  const second = createVisualAnastomoses(morphology, options);
  assert.deepEqual(first, second);
  assert.ok(first.links.length <= 3);
  assert.ok(first.links.every((link) => morphology.byId.get(link.sourceId).generation > 1));
  const used = first.links.flatMap((link) => [link.sourceId, link.targetId]);
  assert.equal(new Set(used).size, used.length);
});

test("anastomoses validate limits and handle empty results", () => {
  const { topology, radialTopology } = fixture();
  const morphology = createRhizomorphicMorphology({ topology, radialTopology });
  assert.deepEqual(createVisualAnastomoses(morphology, { maxLinks: 0 }).links, []);
  assert.throws(() => createVisualAnastomoses(morphology, { maxDistance: 0 }), /maxDistance/);
  assert.throws(() => createVisualAnastomoses(morphology, { cellSize: 0.001 }), /excessive neighborhood/);
  assert.throws(() => createVisualAnastomoses(null), /morphology/);
});


test("intra-territory anastomoses create local loops without joining direct parent-child pairs", () => {
  const { topology, radialTopology } = fixture();
  const morphology = createRhizomorphicMorphology({ topology, radialTopology, branchLength: 90 });
  const result = createVisualAnastomoses(morphology, {
    maxDistance: 500, maxLinks: 40, maxDegree: 4, includeSameTerritory: true
  });
  const byId = morphology.byId;
  const localLoops = result.links.filter((link) => link.territoryIds.length === 1);
  assert.ok(localLoops.length > 0, "nearby branches in one territory should form anastomoses");
  assert.ok(result.links.every((link) => {
    const a = byId.get(link.sourceId);
    const b = byId.get(link.targetId);
    return a.parent !== b.id && b.parent !== a.id;
  }), "anastomoses must not duplicate direct hierarchy edges");
  assert.ok(result.links.every((link) => link.territoryIds.length <= 2));
});


test("anastomoses connect every peripheral territory into one mycelial network", () => {
  const territories = new Map(Array.from({ length: 8 }, (_, index) => [
    "zone-" + index, { id: "zone-" + index, nodeId: "zone-" + index }
  ]));
  const nodes = [...territories.keys()].map((territoryId, index) => ({
    id: "hypha-" + index,
    territoryId,
    generation: 2,
    x: Math.cos(index * Math.PI / 4) * 100,
    y: Math.sin(index * Math.PI / 4) * 100
  }));
  const result = createVisualAnastomoses({ nodes, branches: [], territories }, {
    maxDistance: 1000,
    maxLinks: 7,
    maxDegree: 1,
    cellSize: 300
  });
  const adjacency = new Map([...territories.keys()].map((id) => [id, new Set()]));
  for (const link of result.links) {
    const [a, b] = link.territoryIds;
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  }
  const visited = new Set();
  const queue = ["zone-0"];
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    queue.push(...adjacency.get(current));
  }
  assert.equal(result.links.length, 7, "eight zones need at least seven bridges");
  assert.equal(visited.size, 8, "all peripheral zones must belong to one connected network");
});


test("hyphal anastomoses join nearby filament tips without inventing node relationships", () => {
  const territories = new Map([
    ["BIO", { id: "BIO", nodeId: "BIO" }],
    ["AGR", { id: "AGR", nodeId: "AGR" }]
  ]);
  const morphology = {
    nodes: [],
    branches: [],
    territories,
    hyphae: [
      { id: "bio-tip", territoryId: "BIO", generation: 2, parentHyphaId: "bio-parent", curve: { b: { x: 0, y: 0 } } },
      { id: "agr-tip", territoryId: "AGR", generation: 2, parentHyphaId: "agr-parent", curve: { b: { x: 24, y: 12 } } }
    ]
  };
  const result = createVisualAnastomoses(morphology, {
    includeHyphae: true, maxDistance: 100, maxLinks: 1
  });
  assert.equal(result.links.length, 1);
  assert.equal(result.links[0].sourceId, null);
  assert.equal(result.links[0].targetId, null);
  assert.ok(result.links[0].sourceHyphaId);
  assert.ok(result.links[0].targetHyphaId);
  assert.equal(result.links[0].visualOnly, true);
  assert.equal(result.links[0].relationshipType, "anastomosis");
});
