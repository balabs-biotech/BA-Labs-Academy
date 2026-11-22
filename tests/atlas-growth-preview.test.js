import test from "node:test";
import assert from "node:assert/strict";
import { catalogueMap } from "../src/catalogue-map.js";
import { cataloguePathways } from "../src/catalogue-pathways.js";
import { buildAcademyGraph } from "../src/features/atlas/atlas-graph.js";
import { createAtlasGrowthGraph } from "../src/features/atlas/atlas-growth-model.js";

test("growth preview remaps hierarchy and transversal edges to the same visible node objects", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const preview = createAtlasGrowthGraph(graph, { visibleDepth: 1 });
  assert.ok(preview.growthPreview);
  assert.ok(preview.nodes.length < graph.nodes.length);
  assert.ok(preview.nodes.every((node) => preview.byId.get(node.id) === node));
  assert.ok(preview.edges.every((edge) =>
    preview.byId.get(edge.a.id) === edge.a && preview.byId.get(edge.b.id) === edge.b
  ));
  for (const [code, node] of preview.departmentNodes) {
    assert.equal(preview.byId.get(node.id), node);
    assert.equal(node.entity_key, code);
  }
});

test("growth preview reveals modules at the next depth while retaining root and section anchors", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const first = createAtlasGrowthGraph(graph, { visibleDepth: 1 });
  const second = createAtlasGrowthGraph(graph, { visibleDepth: 2 });
  assert.ok(second.nodes.length > first.nodes.length);
  assert.ok(second.edges.length > first.edges.length);
  for (const node of first.nodes) {
    const expanded = second.byId.get(node.id);
    assert.ok(expanded);
    assert.equal(expanded.x, node.x);
    assert.equal(expanded.y, node.y);
  }
});


test("fractal preview remaps all eight visual trunks to its positioned root nodes", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const preview = createAtlasGrowthGraph(graph, { visibleDepth: 1 });
  assert.equal(preview.morphologyBranches.length, 8);
  for (const branch of preview.morphologyBranches) {
    assert.strictEqual(branch.source, preview.byId.get(branch.sourceId));
    assert.strictEqual(branch.target, preview.byId.get(branch.targetId));
    assert.equal(branch.visualOnly, true);
  }
});
