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
    universeRadius: 1050,
    pathwayOrbitRadius: 1650
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
  assert.ok(radii.every((radius) => Math.abs(radius - 1050) < 1e-6),
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

  const fronts = result.scene.paths.filter((path) => path.style === "colony-front");
  assert.ok(fronts.length >= 48 && fronts.length <= 80,
    "the shared colony must have many independent growth fronts, not eight spokes");
  assert.equal(new Set(fronts.map((path) => path.territoryId)).size, 8,
    "all eight sectors must be represented in the common growth field");
  assert.ok(fronts.every((path) => path.sourceId === null && path.targetId === null && path.visualOnly),
    "colony fronts are biological geometry, not pedagogical relationships");
  assert.equal(result.scene.paths.some((path) => path.style === "mycelial-trunk"), false);
  assert.equal(result.scene.paths.some((path) => path.style?.startsWith("emblem-")), false,
    "the biological colony must not retain fixed Y-emblem geometry");

  for (const department of departments) {
    const lateralHyphae = result.morphology.hyphae.filter((hypha) =>
      hypha.territoryId === department.id && hypha.generation === 1 &&
      hypha.parentBranchId?.startsWith("colony-front:")
    );
    assert.ok(lateralHyphae.length >= 3,
      department.id + " must have multiple lateral explorers in the shared colony");
    const anchor = result.morphology.byId.get(department.id);
    const nearestFront = fronts
      .filter((path) => path.territoryId === department.id)
      .map((path) => result.morphology.branches.find((branch) => branch.id === path.id))
      .sort((a, b) =>
        Math.hypot(a.target.x - anchor.x, a.target.y - anchor.y)
        - Math.hypot(b.target.x - anchor.x, b.target.y - anchor.y)
      )[0];
    assert.ok(Math.hypot(nearestFront.target.x - anchor.x, nearestFront.target.y - anchor.y) < 180,
      department.id + " must meet the shared colony frontier instead of floating beyond a gap");
  }

  const spines = result.scene.paths.filter((path) => path.style === "primary-spine");
  const lateralBranches = result.scene.paths.filter((path) => path.style === "lateral-hypha");
  assert.ok(spines.length >= 8,
    "each multi-child universe must continue as a primary hyphal spine");
  assert.ok(lateralBranches.length >= 24,
    "disciplinary descendants must branch laterally from the spine at staggered depths");
  assert.ok(spines.every((path) => path.targetId === null),
    "primary spines must use derived split geometry, not artificial canonical nodes");
  assert.ok(lateralBranches.every((path) => path.sourceId === null && path.targetId),
    "lateral hyphae must connect virtual branch origins to real learning nodes");
  const pathways = result.scene.nodes.filter((node) => node.id.startsWith("pathway:"));
  assert.equal(pathways.length, 10);
  const pathwayRadii = pathways.map((node) => Math.hypot(node.x, node.y));
  assert.ok(pathwayRadii.every((radius) => Math.abs(radius - 1650) < 1e-6),
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



test("the eight radial Academy territories share continuous segmented hyphal paths", () => {
  const graph = buildAcademyCatalogueGraph(catalogueMap, [], cataloguePathways);
  const result = createAcademyAtlasV2({ graph, seed: "open-mycelial-logo" });
  const coreId = result.topology.roots.find((node) => node.entity_key === "MYC").id;
  const departments = result.scene.nodes.filter((node) =>
    node.kind === "universe" && node.id.startsWith("department:")
  );

  assert.equal(departments.length, 8);
  assert.ok(departments.every((node) => Math.abs(Math.hypot(node.x, node.y) - 1050) < 1e-6),
    "the eight radial universes must sit on the wider inner orbit");

  for (const department of departments) {
    const children = result.topology.childrenByParent.get(department.id) || [];
    const angles = children.map((child) => result.morphology.byId.get(child.id).angle);
    const offsets = angles.map((angle) => Math.atan2(
      Math.sin(angle - department.angle), Math.cos(angle - department.angle)
    ));
    if (offsets.length > 1) {
      assert.ok(Math.max(...offsets) - Math.min(...offsets)  >= 0.56,
        "each department must use a broad radial sector, not a narrow terminal fan");
    }
    const territoryFronts = result.morphology.branches.filter((branch) =>
      branch.style === "colony-front" && branch.territoryId === department.id
    ).sort((a, b) => a.id.localeCompare(b.id));
    assert.equal(territoryFronts.length, 8,
      "each angular sector must contain two four-segment growth trajectories");
    for (let index = 0; index < territoryFronts.length; index += 1) {
      const branch = territoryFronts[index];
      assert.ok(Math.hypot(branch.source.x, branch.source.y) < 70 || index % 4 !== 0,
        "each trajectory must begin in the MYC inoculation zone");
      if (index % 4 > 0) {
        const previous = territoryFronts[index - 1];
        assert.ok(Math.hypot(previous.target.x - branch.source.x, previous.target.y - branch.source.y) < 1e-8,
          "successive hyphal segments must be geometrically continuous");
      }
    }
    const anchor = result.morphology.byId.get(department.id);
    assert.ok(Math.hypot(
      territoryFronts[3].target.x - anchor.x,
      territoryFronts[3].target.y - anchor.y
    ) < 1e-8, "the outermost hyphal segment must meet its universe anchor");
  }

  assert.ok(result.anastomoses.links.length > 0,
    "nearby filaments should form proximity-based anastomoses");
  assert.ok(result.anastomoses.links.every((link) => link.visualOnly),
    "anastomoses must remain decorative and never mutate pedagogy");

  const staggeredTerritories = departments.filter((department) => {
    const children = result.topology.childrenByParent.get(department.id) || [];
    const radii = children.map((child) => {
      const node = result.morphology.byId.get(child.id);
      return Math.hypot(node.x, node.y);
    });
    return radii.length >= 3 && Math.max(...radii) - Math.min(...radii) >= 90;
  });
  assert.ok(staggeredTerritories.length >= 6,
    "branches must advance at staggered radial depths instead of ending on one fan-shaped arc");

});
