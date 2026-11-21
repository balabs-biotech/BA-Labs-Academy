import test from "node:test";
import assert from "node:assert/strict";
import { catalogueMap, catalogueTotals } from "../src/catalogue-map.js";
import { cataloguePathways } from "../src/catalogue-pathways.js";
import { buildAcademyGraph } from "../src/features/atlas/atlas-graph.js";
import { renderAcademyAtlas } from "../src/features/atlas/atlas-view.js";

test("Academy graph contains the nine departments, ten pathways, sections and modules", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  assert.equal(graph.stats.departments, 9);
  assert.equal(graph.stats.pathways, 10);
  assert.equal(graph.stats.sections, catalogueTotals.sections);
  assert.equal(graph.stats.modules, catalogueTotals.modules);
  assert.equal(graph.nodes.length, 9 + 10 + catalogueTotals.sections + catalogueTotals.modules);
  assert.equal(graph.nodes.filter((node) => node.level === 0).length, 19);
  assert.equal(graph.nodes.filter((node) => node.entity_type === "DEPARTMENT").length, 9);
  assert.equal(graph.nodes.filter((node) => node.entity_type === "PATHWAY").length, 10);
  assert.equal(graph.nodes.some((node) => node.entity_type === "DOMAIN"), false);
});

test("every pathway references existing departments and thematic sections", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const departmentCodes = new Set(catalogueMap.map((department) => department.code));
  const sectionCodes = new Set(catalogueMap.flatMap((department) => department.sections.map((section) => section.code)));
  for (const pathway of cataloguePathways) {
    assert.ok(departmentCodes.has(pathway.departmentCode), pathway.code + " primary department");
    assert.ok(pathway.departmentCodes.every((code) => departmentCodes.has(code)), pathway.code + " linked departments");
    assert.ok(pathway.sectionCodes.every((code) => sectionCodes.has(code)), pathway.code + " linked sections");
  }
  const connected = new Set(graph.edges.filter((edge) => edge.relation_type === "APPLIES_TO").map((edge) => edge.b.entity_key));
  assert.deepEqual([...connected].sort(), catalogueMap.map((department) => department.code).sort());
});

test("all graph coordinates are finite and all edge endpoints belong to the graph", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const ids = new Set(graph.nodes.map((node) => node.id));
  for (const node of graph.nodes) {
    assert.ok(Number.isFinite(node.x));
    assert.ok(Number.isFinite(node.y));
  }
  for (const edge of graph.edges) {
    assert.ok(ids.has(edge.a.id));
    assert.ok(ids.has(edge.b.id));
  }
});


test("published domains are nested under their department instead of becoming new roots", () => {
  const department = catalogueMap[0];
  const domain = {
    code: "TEST-DOM",
    slug: "test-domain",
    department_code: department.code,
    title: "Domaine test",
    summary: "Domaine publié de test"
  };
  const graph = buildAcademyGraph(catalogueMap, [domain], cataloguePathways);
  const node = graph.nodes.find((item) => item.entity_type === "DOMAIN");
  assert.ok(node);
  assert.equal(node.parent, graph.departmentNodes.get(department.code).id);
  assert.equal(node.data.route, "#/domaines/test-domain");
  assert.equal(graph.stats.domains, 1);
  assert.equal(graph.nodes.filter((item) => item.level === 0).length, 19);
});


test("Atlas exposes accessible filters for typed pedagogical flows", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const markup = renderAcademyAtlas(graph);
  for (const [type, label] of [
    ["all", "Tous"],
    ["PREREQUISITE", "Prérequis"],
    ["COMPLEMENTARY", "Complémentarité"],
    ["METHOD_TRANSFER", "Transfert"],
    ["TECHNICAL_DEPENDENCY", "Dépendance"],
    ["APPLIED_IN", "Application"],
    ["INTERDISCIPLINARY", "Interdisciplinaire"]
  ]) {
    assert.match(markup, new RegExp('data-atlas-relation="' + type + '"'));
    assert.ok(markup.includes(label));
  }
});
