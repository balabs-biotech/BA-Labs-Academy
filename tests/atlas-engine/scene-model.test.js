import test from "node:test";
import assert from "node:assert/strict";
import { createAtlasTopology } from "../../src/features/atlas/engine/core/topology.js";
import { createRadialTopology } from "../../src/features/atlas/engine/spatial/radial-topology.js";
import { createRhizomorphicMorphology } from "../../src/features/atlas/engine/biology/morphogenesis.js";
import { createVisualAnastomoses } from "../../src/features/atlas/engine/biology/visual-anastomoses.js";
import { createAtlasScene } from "../../src/features/atlas/engine/rendering/scene-model.js";

function fixture() {
  const topology = createAtlasTopology({
    nodes: [
      { id: "MYC", parent: null, title: "Mycology" },
      { id: "myc-a", parent: "MYC" },
      { id: "BIO", parent: null, title: "Biology" },
      { id: "bio-a", parent: "BIO" },
      { id: "AGR", parent: null, title: "Agronomy" },
      { id: "agr-a", parent: "AGR" }
    ],
    edges: [{ id: "semantic", sourceId: "bio-a", targetId: "agr-a", label: "related", cross: true }]
  });
  const radialTopology = createRadialTopology({
    core: { id: "MYC" },
    universes: [{ id: "BIO", nodeId: "BIO" }, { id: "AGR", nodeId: "AGR" }],
    radius: 100
  });
  const morphology = createRhizomorphicMorphology({ topology, radialTopology, branchLength: 480 });
  const anastomoses = createVisualAnastomoses(morphology, { maxDistance: 1500 }).links;
  return { topology, morphology, anastomoses };
}

test("scene model keeps canonical relationships separate from decorative paths", () => {
  const { topology, morphology, anastomoses } = fixture();
  const scene = createAtlasScene({ topology, morphology, anastomoses });
  assert.equal(scene.relationships.length, 1);
  assert.equal(scene.relationships[0].type, "pedagogy");
  assert.equal(scene.relationshipPaths.length, 1);
  assert.equal(scene.relationshipPaths[0].visualOnly, false);
  assert.ok(scene.paths.some((path) => path.type === "hierarchy" && !path.visualOnly));
  assert.ok(scene.paths.filter((path) => path.type !== "hierarchy").every((path) => path.visualOnly));
  assert.ok(scene.paths.some((path) => path.type === "anastomosis"));
  assert.ok(scene.paths.some((path) => path.type === "universe-trunk"));
  assert.equal(scene.metrics.nodeCount, morphology.nodes.length);
  assert.equal(scene.metrics.decorativePathCount, scene.paths.filter((path) => path.visualOnly).length);
  assert.equal(scene.metrics.semanticRelationshipPathCount, 1);
});

test("scene model is renderer-neutral, bounded and does not mutate its sources", () => {
  const input = fixture();
  const nodesBefore = structuredClone(input.morphology.nodes);
  const edgesBefore = structuredClone(input.topology.edges);
  const scene = createAtlasScene(input);
  assert.ok(scene.bounds.minX < scene.bounds.maxX);
  assert.ok(scene.bounds.minY < scene.bounds.maxY);
  assert.equal(scene.nodes.find((node) => node.id === "MYC").kind, "core");
  assert.ok(Object.isFrozen(scene) && Object.isFrozen(scene.nodes) && Object.isFrozen(scene.paths));
  assert.deepEqual(input.morphology.nodes, nodesBefore);
  assert.deepEqual(input.topology.edges, edgesBefore);
});

test("scene model rejects invalid radii and paths with unknown endpoints", () => {
  const { topology, morphology } = fixture();
  assert.throws(() => createAtlasScene({ topology, morphology, defaultNodeRadius: 0 }), /positive/);
  assert.throws(() => createAtlasScene({
    topology, morphology,
    anastomoses: [{ id: "bad", sourceId: "missing", targetId: "MYC", curve: {} }]
  }), /missing node/);
});


test("scene model includes secondary hyphae as decorative paths, never pedagogy", () => {
  const { topology, morphology } = fixture();
  const scene = createAtlasScene({ topology, morphology });
  const hyphaPaths = scene.paths.filter((path) => path.type === "hypha");
  assert.ok(hyphaPaths.length > 0);
  assert.ok(hyphaPaths.every((path) => path.visualOnly && path.width < 2.2));
  assert.ok(hyphaPaths.some((path) => path.generation === 3));
  const hyphaIds = new Set(hyphaPaths.map((path) => path.id));
  assert.ok(hyphaPaths.filter((path) => path.generation > 1)
    .every((path) => hyphaIds.has(path.parentHyphaId)),
  "the scene must preserve parent-child lineage between hyphal generations");
  assert.equal(scene.relationships.length, topology.edges.length);
  assert.equal(scene.nodes.length, topology.nodes.length);
});


test("scene model preserves anastomoses between hyphal tips as visual-only paths", () => {
  const { topology, morphology } = fixture();
  const anastomoses = [{
    id: "hyphal-tip-link",
    sourceId: null,
    targetId: null,
    sourceHyphaId: "hypha-a",
    targetHyphaId: "hypha-b",
    territoryIds: ["BIO", "AGR"],
    visualOnly: true,
    relationshipType: "anastomosis",
    curve: {
      a: { x: 0, y: 0 },
      c1: { x: 10, y: 2 },
      c2: { x: 18, y: 8 },
      b: { x: 24, y: 12 }
    }
  }];
  const scene = createAtlasScene({ topology, morphology, anastomoses });
  const link = scene.paths.find((path) => path.id === "hyphal-tip-link");
  assert.ok(link);
  assert.equal(link.type, "anastomosis");
  assert.equal(link.visualOnly, true);
  assert.equal(link.sourceHyphaId, "hypha-a");
  assert.equal(link.targetHyphaId, "hypha-b");
  assert.equal(link.sourceId, null);
  assert.equal(link.targetId, null);
});
