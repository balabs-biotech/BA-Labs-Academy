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

test("MYCOLOGIE grows as a compact central heart without shrinking the eight satellite axes", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const model = createAtlasGrowthGraph(graph);
  const core = model.byId.get("department:MYC");
  const mycologyDescendants = model.nodes.filter((node) =>
    node.rootId === "myc" && node.id !== core.id
  );
  assert.ok(mycologyDescendants.length > 0);
  const coreRadius = Math.max(...mycologyDescendants.map((node) =>
    Math.hypot(node.x - core.x, node.y - core.y)
  ));
  const satelliteRadii = [...model.departmentNodes.entries()]
    .filter(([code]) => code !== "MYC")
    .map(([, node]) => Math.hypot(node.x - core.x, node.y - core.y));
  assert.ok(coreRadius < Math.min(...satelliteRadii) * 0.3);
  assert.equal(model.morphologyBranches.length, 8);
});


test("fractal growth adds bounded deterministic biological irregularity", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const first = createAtlasGrowthGraph(graph);
  const second = createAtlasGrowthGraph(graph);
  const firstById = new Map(first.nodes.map((node) => [node.id, node]));
  const secondById = new Map(second.nodes.map((node) => [node.id, node]));

  assert.equal(first.nodes.length, second.nodes.length);
  for (const node of first.nodes) {
    const repeated = secondById.get(node.id);
    assert.ok(repeated);
    assert.equal(node.x, repeated.x);
    assert.equal(node.y, repeated.y);
  }

  const parent = firstById.get("department:MIC");
  const children = first.nodes.filter((node) => node.parent === parent.id);
  assert.ok(children.length > 1);
  const angles = children.map((node) => node.angle).sort((a, b) => a - b);
  assert.ok(new Set(angles).size === angles.length);
  assert.ok(children.some((node) => Math.abs(node.growthSector.angularOffset) > 0));
  for (const child of children) {
    const { centerAngle, angularOffset, allocatedSpread } = child.growthSector;
    assert.equal(child.angle, centerAngle + angularOffset);
    assert.ok(Math.abs(angularOffset) <= allocatedSpread * 0.09 + 1e-12);
  }
  for (const child of children) {
    const distance = Math.hypot(child.x - parent.x, child.y - parent.y);
    assert.ok(distance >= 760 * 0.94 - 0.001);
    assert.ok(distance <= 760 * 1.06 + 0.001);
  }
});


test("dense secondary fans receive bounded radial spacing without moving primary anchors", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const model = createAtlasGrowthGraph(graph);
  const byId = model.byId;
  const secondary = model.nodes.filter((node) => node.generation === 2);
  assert.ok(secondary.length > 0);
  assert.ok(secondary.some((node) => node.growthSector.densityScale > 1));
  for (const node of secondary) {
    const parent = byId.get(node.parent);
    const siblings = model.nodes.filter((candidate) => candidate.parent === parent.id);
    const expectedScale = Math.min(1.28, 1 + Math.log2(Math.max(1, siblings.length)) * 0.075);
    assert.equal(node.growthSector.densityScale, expectedScale);
    assert.ok(node.growthSector.densityScale <= 1.28);
  }
  const primary = model.nodes.filter((node) => node.generation === 1);
  assert.ok(primary.every((node) => node.growthSector.densityScale === 1));
});
