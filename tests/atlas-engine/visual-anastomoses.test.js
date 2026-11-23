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
  assert.throws(() => createVisualAnastomoses(null), /morphology/);
});
