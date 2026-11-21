import test from "node:test";
import assert from "node:assert/strict";
import { catalogueMap, catalogueTotals } from "../src/catalogue-map.js";
import { cataloguePathways } from "../src/catalogue-pathways.js";
import { buildAcademyGraph } from "../src/features/atlas/atlas-graph.js";

const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);

test("Atlas overview contains all nine disciplinary departments", () => {
  const departments = graph.nodes.filter((node) => node.entity_type === "DEPARTMENT" && node.level === 0);
  assert.equal(departments.length, 9);
  assert.deepEqual(new Set(departments.map((node) => node.entity_key)), new Set(["MYC","MIC","BIO","AGR","BPR","BMT","PHY","INF","GEN"]));
});

test("Atlas overview contains all ten practical pathways", () => {
  const pathways = graph.nodes.filter((node) => node.entity_type === "PATHWAY" && node.level === 0);
  assert.equal(pathways.length, 10);
  assert.equal(new Set(pathways.map((node) => node.entity_key)).size, 10);
});

test("Every pathway is visibly connected to its declared departments", () => {
  for (const pathway of cataloguePathways) {
    for (const departmentCode of pathway.departmentCodes || [pathway.departmentCode]) {
      assert.ok(graph.edges.some((edge) =>
        edge.relation_type === "APPLIES_TO" &&
        edge.a.entity_key === pathway.code &&
        edge.b.entity_key === departmentCode
      ), `Missing ${pathway.code} → ${departmentCode} link`);
    }
  }
});

test("Every department has its sections and modules in the connected graph", () => {
  for (const department of catalogueMap) {
    const root = graph.nodes.find((node) => node.entity_type === "DEPARTMENT" && node.entity_key === department.code);
    assert.ok(root, `Missing department ${department.code}`);
    for (const section of department.sections) {
      assert.ok(graph.nodes.some((node) => node.entity_type === "SECTION" && node.entity_key === section.code));
      assert.ok(graph.edges.some((edge) => edge.a.id === root.id && edge.b.entity_key === section.code));
    }
  }
});


test("Mycology is the spatial core and carries the BA Labs Y marker", () => {
  const core = graph.nodes.find((node) => node.entity_type === "DEPARTMENT" && node.entity_key === "MYC");
  assert.ok(core);
  assert.equal(core.isAcademyCore, true);
  assert.equal(core.x, 0);
  assert.equal(core.y, 0);
  assert.ok(core.r > 20);
  const satellites = graph.nodes.filter((node) => node.parent === core.id);
  assert.ok(satellites.length > 0, "Mycology must expose its own satellite branches");
});

test("Other departments and pathways occupy separate orbital bands", () => {
  const departments = graph.nodes.filter((node) => node.entity_type === "DEPARTMENT" && node.entity_key !== "MYC");
  const pathways = graph.nodes.filter((node) => node.entity_type === "PATHWAY");
  const meanDepartmentRadius = departments.reduce((sum, node) => sum + Math.hypot(node.x, node.y), 0) / departments.length;
  const meanPathwayRadius = pathways.reduce((sum, node) => sum + Math.hypot(node.x, node.y), 0) / pathways.length;
  assert.ok(meanDepartmentRadius > 600 && meanDepartmentRadius < 720);
  assert.ok(meanPathwayRadius > 1050 && meanPathwayRadius < 1170);
});


test("Every module node has a stable route and canonical section identity", () => {
  const moduleNodes = graph.nodes.filter((node) => node.entity_type === "MODULE");
  assert.equal(moduleNodes.length, catalogueTotals.modules);
  for (const node of moduleNodes) {
    assert.match(node.data.route, /^#\/modules\/[a-z0-9-]+\/\d{2}$/);
    assert.ok(node.data.sectionCode);
    assert.ok(node.data.departmentCode);
    assert.ok(node.data.moduleIndex > 0);
  }
});
