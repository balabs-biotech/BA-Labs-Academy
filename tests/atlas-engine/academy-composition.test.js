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

test("Academy composition is a radial fractal wheel with MYC at the center", () => {
  const graph = buildAcademyCatalogueGraph(catalogueMap, [], cataloguePathways);
  const result = createAcademyAtlasV2({ graph });
  const core = result.scene.nodes.find((node) => node.id === "department:MYC");
  assert.deepEqual([core.x, core.y], [0, 0], "MYC must be the exact spatial center");
  const departments = result.scene.nodes.filter((node) =>
    node.kind === "universe" && node.id.startsWith("department:")
  );
  assert.equal(departments.length, 8);
  assert.ok(departments.every((node) => node.shortLabel && node.shortLabel.length <= 3),
    "department short codes must be available for compact mobile overview labels");
  const radii = departments.map((node) => Math.hypot(node.x, node.y));
  assert.ok(radii.every((radius) => Math.abs(radius - 760) < 1e-6),
    "all eight universes must occupy one controlled radial ring");
  const angles = departments.map((node) => Math.atan2(node.y, node.x)).sort((a, b) => a - b);
  const gaps = angles.map((angle, index) => {
    const next = angles[(index + 1) % angles.length] + (index === angles.length - 1 ? Math.PI * 2 : 0);
    return next - angle;
  });
  assert.ok(gaps.every((gap) => Math.abs(gap - Math.PI / 4) < 1e-6),
    "universe anchors must have equal angular spacing");
  assert.ok(departments.every((node) => {
    const delta = node.angle - Math.atan2(node.y, node.x);
    return Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))) < 1e-6;
  }), "each department must retain its radial axis for label placement");

  const trunks = result.scene.paths.filter((path) => path.type === "universe-trunk");
  assert.equal(trunks.length, 8);
  assert.ok(trunks.every((path) => path.sourceId === core.id),
    "each peripheral universe must grow from the central MYC hub");
  const pathways = result.scene.nodes.filter((node) => node.id.startsWith("pathway:"));
  assert.equal(pathways.length, 10);
  const pathwayRadii = pathways.map((node) => Math.hypot(node.x, node.y));
  assert.ok(pathwayRadii.every((radius) => Math.abs(radius - 1320) < 1e-6),
    "pathways must occupy a separate controlled outer orbit");
  assert.equal(new Set(pathways.map((node) => node.angle)).size, 10,
    "pathway orbit positions must be unique");
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



test("the eight Academy spokes open into a reticulate mycelial silhouette", () => {
  const graph = buildAcademyCatalogueGraph(catalogueMap, [], cataloguePathways);
  const result = createAcademyAtlasV2({ graph, seed: "open-mycelial-logo" });
  const coreId = result.topology.roots.find((node) => node.entity_key === "MYC").id;
  const departments = result.scene.nodes.filter((node) =>
    node.kind === "universe" && node.id.startsWith("department:")
  );

  assert.equal(departments.length, 8);
  assert.ok(departments.every((node) => Math.abs(Math.hypot(node.x, node.y) - 620) < 1e-6),
    "the eight radial universes must sit on the wider inner orbit");

  for (const department of departments) {
    const children = result.topology.childrenByParent.get(department.id) || [];
    const angles = children.map((child) => result.morphology.byId.get(child.id).angle);
    const offsets = angles.map((angle) => Math.atan2(
      Math.sin(angle - department.angle), Math.cos(angle - department.angle)
    ));
    if (offsets.length > 1) {
      assert.ok(Math.max(...offsets) - Math.min(...offsets) >= 0.68,
        "each department must use a broad radial sector, not a narrow terminal fan");
    }
    const trunkId = "trunk:" + coreId + ":" + department.id;
    const lateralHyphae = result.morphology.hyphae.filter((hypha) =>
      hypha.id.startsWith("hypha:" + trunkId + ":")
    );
    assert.ok(lateralHyphae.length >= 4,
      "each primary spoke must grow lateral hyphae along its length");
  }

  assert.ok(result.anastomoses.links.length >= 120,
    "the eight territories must develop a visible reticulate mesh, not isolated fans");
});
