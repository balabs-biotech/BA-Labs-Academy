import test from "node:test";
import assert from "node:assert/strict";
import { catalogueMap } from "../src/catalogue-map.js";
import { cataloguePathways } from "../src/catalogue-pathways.js";
import { buildAcademyGraph } from "../src/features/atlas/atlas-graph.js";
import { createAtlasGrowthModel } from "../src/features/atlas/atlas-growth-model.js";

test("full Academy catalogue maps only hierarchy edges to stable growth branches", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const growth = createAtlasGrowthModel({ nodes: graph.nodes, visibleDepth: 2 });
  const hierarchyEdgeCount = graph.edges.filter((edge) => !edge.cross).length;
  assert.equal(growth.nodes.length, graph.nodes.length);
  assert.equal(growth.branches.length, hierarchyEdgeCount);
  assert.equal(growth.visibleBranches.length, hierarchyEdgeCount);
  assert.ok(growth.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
  for (const root of graph.nodes.filter((node) => node.level === 0)) {
    const positioned = growth.byId.get(root.id);
    assert.equal(positioned.x, root.x);
    assert.equal(positioned.y, root.y);
  }
  assert.ok(growth.branches.every((branch) => branch.sourceId !== branch.targetId));
});

test("deeper catalogue generation reveals modules without moving section anchors", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const shallow = createAtlasGrowthModel({ nodes: graph.nodes, visibleDepth: 1 });
  const deep = createAtlasGrowthModel({ nodes: graph.nodes, visibleDepth: 2 });
  assert.ok(shallow.visibleNodes.length < deep.visibleNodes.length);
  for (const node of shallow.visibleNodes) {
    const expanded = deep.byId.get(node.id);
    assert.equal(expanded.x, node.x);
    assert.equal(expanded.y, node.y);
  }
});
