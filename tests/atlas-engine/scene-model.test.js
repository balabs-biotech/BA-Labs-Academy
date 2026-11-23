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
    edges: [{ id: "semantic", sourceId: "bio-a", targetId: "agr-a", label: "related" }]
  });
  const radialTopology = createRadialTopology({
    core: { id: "MYC" },
    universes: [{ id: "BIO", nodeId: "BIO" }, { id: "AGR", nodeId: "AGR" }],
    radius: 100
  });
  const morphology = createRhizomorphicMorphology({ topology, radialTopology, branchLength: 80 });
  const anastomoses = createVisualAnastomoses(morphology, { maxDistance: 500 }).links;
  return { topology, morphology, anastomoses };
}

test("scene model keeps canonical relationships separate from decorative paths", () => {
  const { topology, morphology, anastomoses } = fixture();
  const scene = createAtlasScene({ topology, morphology, anastomoses });
  assert.equal(scene.relationships.length, 1);
  assert.equal(scene.relationships[0].type, "pedagogy");
  assert.ok(scene.paths.every((path) => path.visualOnly));
  assert.ok(scene.paths.some((path) => path.type === "anastomosis"));
  assert.ok(scene.paths.some((path) => path.type === "universe-trunk"));
  assert.equal(scene.metrics.nodeCount, morphology.nodes.length);
  assert.equal(scene.metrics.decorativePathCount, scene.paths.length);
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
