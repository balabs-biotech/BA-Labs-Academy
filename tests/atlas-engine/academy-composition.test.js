import test from "node:test";
import assert from "node:assert/strict";
import { catalogueMap } from "../../src/catalogue-map.js";
import { cataloguePathways } from "../../src/catalogue-pathways.js";
import { buildAcademyCatalogueGraph } from "../../src/features/atlas/adapters/academy-catalogue-graph.js";
import { createAcademyAtlasV2 } from "../../src/features/atlas/adapters/academy-graph-v2.js";

test("V2 composition maps all canonical Academy nodes without mutating the graph", () => {
  const graph = buildAcademyCatalogueGraph(catalogueMap, [], cataloguePathways);
  const beforeNodes = graph.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, parent: node.parent }));
  const beforeEdges = graph.edges.map((edge) => edge.id);
  const result = createAcademyAtlasV2({
    graph,
    seed: "academy-catalogue-test",
    universeRadius: 720,
    pathwayOrbitRadius: 1280
  });

  assert.equal(result.metrics.canonicalNodeCount, 330);
  assert.equal(result.metrics.renderedNodeCount, 330);
  assert.equal(result.metrics.departmentCount, 9);
  assert.equal(result.metrics.peripheralUniverseCount, 8);
  assert.equal(result.metrics.pathwayAnchorCount, 10);
  assert.equal(result.scene.relationships.length, graph.edges.length);
  assert.ok(result.metrics.semanticRelationshipPathCount > 0);
  assert.equal(new Set(result.scene.nodes.map((node) => node.id)).size, 330);
  assert.deepEqual(graph.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, parent: node.parent })), beforeNodes);
  assert.deepEqual(graph.edges.map((edge) => edge.id), beforeEdges);
});

test("MYC remains central; eight territories occupy an irregular field and ten pathways the outer ring", () => {
  const graph = buildAcademyCatalogueGraph(catalogueMap, [], cataloguePathways);
  const result = createAcademyAtlasV2({ graph, universeRadius: 700, pathwayOrbitRadius: 1400 });
  const core = result.scene.nodes.find((node) => node.id === "department:MYC");
  assert.deepEqual([core.x, core.y], [0, 0]);
  const departments = result.scene.nodes.filter((node) =>
    node.kind === "universe" && node.id.startsWith("department:")
  );
  assert.equal(departments.length, 8);
  const territoryRadii = departments.map((node) => Math.hypot(node.x, node.y));
  assert.ok(territoryRadii.every((radius) => radius >= 700 && radius <= 900));
  assert.ok(Math.max(...territoryRadii) - Math.min(...territoryRadii) >= 150,
    "department anchors must not collapse into a uniform radial ring");
  const pathways = result.scene.nodes.filter((node) => node.id.startsWith("pathway:"));
  assert.equal(pathways.length, 10);
  for (const node of pathways) {
    assert.ok(Math.abs(Math.hypot(node.x, node.y) - 1400) < 1e-6);
  }
});

test("cross-disciplinary visual paths are derived only from canonical cross edges", () => {
  const graph = buildAcademyCatalogueGraph(catalogueMap, [], cataloguePathways);
  const result = createAcademyAtlasV2({ graph });
  const expected = graph.edges.filter((edge) => edge.cross === true);
  assert.equal(result.scene.relationshipPaths.length, expected.length);
  const ids = new Set(result.scene.relationshipPaths.map((path) => path.id));
  assert.ok(expected.every((edge) => ids.has("relationship-path:" + edge.id)));
  assert.ok(result.scene.relationshipPaths.every((path) => path.visualOnly === false));
  assert.ok(result.scene.paths.filter((path) => path.visualOnly).every((path) => path.type === "universe-trunk" || path.type === "anastomosis" || path.type === "hypha"));
});

test("V2 composition rejects missing core and unsupported disconnected roots", () => {
  const graph = buildAcademyCatalogueGraph(catalogueMap, [], cataloguePathways);
  const noCore = { ...graph, nodes: graph.nodes.filter((node) => node.id !== "department:MYC") };
  assert.throws(() => createAcademyAtlasV2({ graph: noCore }), /Missing Atlas parent|unknown source|MYC core/);
  assert.throws(() => createAcademyAtlasV2({ graph, universeRadius: 100, pathwayOrbitRadius: 100 }), /greater than universeRadius/);
});

test("V2 catalogue adapter is spatially neutral and does not depend on the legacy layout", async () => {
  const graph = buildAcademyCatalogueGraph(catalogueMap, [], cataloguePathways);
  assert.ok(graph.nodes.every((node) => node.x === 0 && node.y === 0));
  const result = createAcademyAtlasV2({ graph, seed: "neutral-catalogue-graph" });
  assert.ok(result.scene.nodes.some((node) => Math.hypot(node.x, node.y) > 1));
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../../src/features/atlas/adapters/academy-catalogue-graph.js", import.meta.url), "utf8")
  );
  assert.doesNotMatch(source, /atlas-organic-layout|explorer-2d-network|pixi-renderer/i);
});
