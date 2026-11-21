import test from "node:test";
import assert from "node:assert/strict";
import { catalogueMap } from "../src/catalogue-map.js";
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
