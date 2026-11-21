import test from "node:test";
import assert from "node:assert/strict";
import { catalogueMap, catalogueTotals } from "../src/catalogue-map.js";
import { buildCatalogueAtlas } from "../src/features/catalogue/atlas.js";

const canonicalSectionCount = catalogueMap.reduce((sum, department) => sum + department.sections.length, 0);

test("overview Atlas keeps the department and section map compact", () => {
  const graph = buildCatalogueAtlas(catalogueMap);
  assert.equal(graph.nodes.filter((node) => node.entity_type === "DEPARTMENT").length, catalogueTotals.departments);
  assert.equal(graph.nodes.filter((node) => node.entity_type === "SECTION").length, canonicalSectionCount);
  assert.equal(graph.nodes.length, catalogueTotals.departments + canonicalSectionCount);
  assert.equal(graph.edges.length, canonicalSectionCount);
  assert.equal(graph.nodes.some((node) => node.entity_type === "MODULE"), false);
});

test("section drill-down exposes only that section and its modules", () => {
  const department = catalogueMap[0];
  const section = department.sections[0];
  const graph = buildCatalogueAtlas(catalogueMap, section.code);
  assert.equal(graph.nodes.length, section.modules.length + 1);
  assert.equal(graph.edges.length, section.modules.length);
  assert.equal(graph.nodes[0].entity_type, "SECTION");
  assert.equal(graph.nodes[0].entity_key, section.code);
  assert.deepEqual(graph.nodes.slice(1).map((node) => node.title), section.modules);
  assert.ok(graph.nodes.slice(1).every((node) => node.entity_type === "MODULE"));
  assert.ok(graph.edges.every((edge) => edge.source_node_id === graph.nodes[0].id));
});

test("unknown section code safely falls back to the overview", () => {
  const graph = buildCatalogueAtlas(catalogueMap, "UNKNOWN");
  assert.equal(graph.nodes.length, catalogueTotals.departments + canonicalSectionCount);
  assert.equal(graph.focus, null);
});
