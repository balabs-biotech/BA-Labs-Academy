import test from "node:test";
import assert from "node:assert/strict";
import { catalogueMap, catalogueTotals } from "../src/catalogue-map.js";
import { catalogueAxes } from "../src/catalogue-axes.js";
import { cataloguePathways } from "../src/catalogue-pathways.js";
import { buildAcademyGraph } from "../src/features/atlas/atlas-graph.js";

const graph = buildAcademyGraph(catalogueMap, catalogueAxes, cataloguePathways);

test("Atlas includes every mapped department and practical pathway", () => {
  assert.equal(graph.stats.departments, catalogueMap.length);
  assert.equal(graph.stats.axes, catalogueAxes.length);
  assert.equal(graph.stats.pathways, cataloguePathways.length);
  assert.equal(graph.nodes.filter((node) => node.entity_type === "DEPARTMENT").length, catalogueMap.length);
  assert.equal(graph.nodes.filter((node) => node.entity_type === "TRANSVERSAL").length, catalogueAxes.length);
  assert.equal(graph.nodes.filter((node) => node.entity_type === "PATHWAY").length, cataloguePathways.length);
  assert.equal(graph.nodes.filter((node) => node.level === 0).length, 20);
});

test("Atlas exposes the full thematic map progressively", () => {
  assert.equal(graph.stats.sections, catalogueTotals.sections);
  assert.equal(graph.stats.modules, catalogueTotals.modules);
  assert.equal(graph.nodes.filter((node) => node.entity_type === "SECTION").length, catalogueTotals.sections);
  assert.equal(graph.nodes.filter((node) => node.entity_type === "MODULE").length, catalogueTotals.modules);
});

test("every pathway has valid department and domain references", () => {
  const departmentCodes = new Set(catalogueMap.map((department) => department.code));
  const sectionCodes = new Set([...catalogueMap, ...catalogueAxes].flatMap((group) => group.sections.map((section) => section.code)));
  const axisCodes = new Set(catalogueAxes.map((axis) => axis.code));
  for (const pathway of cataloguePathways) {
    assert.ok(departmentCodes.has(pathway.departmentCode), pathway.code + " primary department");
    assert.ok(pathway.departmentCodes.every((code) => departmentCodes.has(code)), pathway.code + " linked departments");
    assert.ok(pathway.sectionCodes.every((code) => sectionCodes.has(code)), pathway.code + " linked sections");
  }
});

test("all department roots are connected to at least one pathway", () => {
  const connected = new Set();
  for (const edge of graph.edges) {
    if (edge.relation_type === "APPLIES_TO" && edge.cross) {
      if (edge.a.entity_type === "PATHWAY" && edge.b.entity_type === "DEPARTMENT") connected.add(edge.b.entity_key);
      if (edge.b.entity_type === "PATHWAY" && edge.a.entity_type === "DEPARTMENT") connected.add(edge.a.entity_key);
    }
  }
  assert.deepEqual([...connected].sort(), catalogueMap.filter((department) => department.code !== "ZOO").map((department) => department.code).sort());
});

test("graph identifiers are unique and all coordinates are finite", () => {
  const ids = graph.nodes.map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length);
  const known = new Set(ids);
  for (const node of graph.nodes) {
    assert.ok(Number.isFinite(node.x));
    assert.ok(Number.isFinite(node.y));
  }
  for (const edge of graph.edges) {
    assert.ok(known.has(edge.a.id));
    assert.ok(known.has(edge.b.id));
  }
});
