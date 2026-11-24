import test from "node:test";
import assert from "node:assert/strict";
import { createAtlasTopology } from "../../src/features/atlas/engine/core/topology.js";

const fixture = () => ({
  nodes: [
    { id: "core", parent: null }, { id: "bio", parent: "core" },
    { id: "section", parent: "bio" }, { id: "module", parent: "section" }
  ],
  edges: [
    { id: "e1", sourceId: "core", targetId: "bio" },
    { id: "e2", sourceId: "bio", targetId: "section" }
  ]
});

test("topology indexes hierarchy and edges without mutating input", () => {
  const input = fixture();
  const original = structuredClone(input);
  const topology = createAtlasTopology(input);
  assert.equal(topology.byId.get("module").id, "module");
  assert.deepEqual(topology.roots.map(({ id }) => id), ["core"]);
  assert.deepEqual(topology.childrenByParent.get("bio").map(({ id }) => id), ["section"]);
  assert.equal(topology.depthById.get("module"), 3);
  assert.equal(topology.maxDepth, 3);
  assert.equal(topology.edgeById.get("e1").sourceId, "core");
  assert.deepEqual(input, original);
});

test("topology accepts Academy edge endpoint objects", () => {
  const nodes = [{ id: "a", parent: null }, { id: "b", parent: "a" }];
  const topology = createAtlasTopology({ nodes, edges: [{ id: "ab", a: nodes[0], b: nodes[1] }] });
  assert.equal(topology.edges[0].sourceId, "a");
  assert.equal(topology.edges[0].targetId, "b");
});

test("topology rejects empty and duplicate node identities", () => {
  assert.throws(() => createAtlasTopology({ nodes: [{ id: "" }] }), /non-empty string id/);
  assert.throws(() => createAtlasTopology({ nodes: [{ id: "x" }, { id: "x" }] }), /duplicate node id/);
});

test("topology rejects missing parents, self-parenting and hierarchy cycles", () => {
  assert.throws(() => createAtlasTopology({ nodes: [{ id: "a", parent: "missing" }] }), /Missing Atlas parent/);
  assert.throws(() => createAtlasTopology({ nodes: [{ id: "a", parent: "a" }] }), /cycle/);
  assert.throws(() => createAtlasTopology({ nodes: [{ id: "a", parent: "b" }, { id: "b", parent: "a" }] }), /cycle/);
});

test("topology rejects unknown edge endpoints and duplicate edge IDs", () => {
  const nodes = [{ id: "a" }, { id: "b" }];
  assert.throws(() => createAtlasTopology({ nodes, edges: [{ id: "bad", sourceId: "x", targetId: "b" }] }), /unknown source/);
  assert.throws(() => createAtlasTopology({ nodes, edges: [
    { id: "same", sourceId: "a", targetId: "b" },
    { id: "same", sourceId: "b", targetId: "a" }
  ] }), /duplicate edge id/);
});

test("topology handles deep hierarchies without recursive traversal", () => {
  const nodes = Array.from({ length: 12000 }, (_, index) => ({
    id: "n" + index, parent: index === 0 ? null : "n" + (index - 1)
  }));
  const topology = createAtlasTopology({ nodes });
  assert.equal(topology.maxDepth, 11999);
});
