import test from "node:test";
import assert from "node:assert/strict";
import { catalogueMap, catalogueTotals } from "../src/catalogue-map.js";
import { cataloguePathways } from "../src/catalogue-pathways.js";
import { buildAcademyGraph } from "../src/features/atlas/atlas-graph.js";
import { readFileSync } from "node:fs";

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
  const source = readFileSync(new URL("../src/features/atlas/atlas-view.js", import.meta.url), "utf8");
  for (const [type, label] of [
    ["all", "Tous"],
    ["PREREQUISITE", "Prérequis"],
    ["COMPLEMENTARY", "Complémentarité"],
    ["METHOD_TRANSFER", "Transfert"],
    ["TECHNICAL_DEPENDENCY", "Dépendance"],
    ["APPLIED_IN", "Application"],
    ["INTERDISCIPLINARY", "Interdisciplinaire"]
  ]) {
    assert.ok(source.includes('data-atlas-relation="' + type + '"'), type + " filter control");
    assert.ok(source.includes(label), type + " visible label");
  }
});


test("graph node identifiers are unique and all parent references resolve", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const ids = graph.nodes.map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length, "node IDs must be unique");
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const node of graph.nodes) {
    if (node.parent) {
      assert.ok(byId.has(node.parent), "unresolved parent for " + node.id);
      assert.ok(node.level > byId.get(node.parent).level, "child level must exceed parent level");
    }
  }
});

test("hierarchy edges preserve parent-child identity without dangling endpoints", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const ids = new Set(graph.nodes.map((node) => node.id));
  for (const edge of graph.edges) {
    assert.ok(ids.has(edge.a.id), "unknown source node " + edge.a.id);
    assert.ok(ids.has(edge.b.id), "unknown target node " + edge.b.id);
    if (edge.basis === "academy-hierarchy") {
      assert.equal(edge.b.parent, edge.a.id, "hierarchy edge must match the child's parent");
      assert.equal(edge.cross, false);
    }
  }
});

test("unverified or evidence-free editorial relations never become knowledge edges", () => {
  const relations = [
    { source: "module:MYC-01:01", target: "module:MIC-03:01", type: "PREREQUISITE", evidence: "Pending review", status: "draft" },
    { source: "module:MYC-01:01", target: "module:MIC-03:01", type: "PREREQUISITE", evidence: "", status: "verified" },
    { source: "module:MYC-01:01", target: "module:MIC-03:01", type: "PREREQUISITE", evidence: " ", status: "verified" }
  ];
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways, relations);
  assert.equal(graph.edges.filter((edge) => edge.basis === "academy-knowledge-relation").length, 0);
});


test("Atlas inspector exposes parent and immediate-child navigation for hierarchical drill-down", () => {
  const source = readFileSync(new URL("../src/features/atlas/atlas-view.js", import.meta.url), "utf8");
  assert.ok(source.includes('className = "atlas-branch-navigation"'));
  assert.ok(source.includes('className = "atlas-branch-parent"'));
  assert.ok(source.includes('className = "atlas-branch-children"'));
  assert.ok(source.includes('node.parent === navigation.selected.id'));
  assert.ok(source.includes('focusNode(parentNode)'));
  assert.ok(source.includes('focusNode(child)'));
});


test("Atlas viewport resize preserves the active exploration focus", () => {
  const source = readFileSync(new URL("../src/features/atlas/atlas-view.js", import.meta.url), "utf8");
  assert.ok(source.includes("let hasInitialFit = false;"));
  assert.match(source, /if \(!hasInitialFit\)\s*\{\s*fitOverview\(\);\s*hasInitialFit = true;/);
  assert.ok(source.includes("Subsequent resizes preserve the"));
});


test("Atlas navigation owns selection and bounded history independently of PixiJS", async () => {
  const { createAtlasNavigation } = await import("../src/features/atlas/atlas-navigation.js");
  const nodes = [{ id: "root" }, { id: "child" }, { id: "leaf" }];
  const navigation = createAtlasNavigation(nodes, 2);
  const view = (scale) => ({ scale, offset: { x: scale, y: -scale } });
  assert.equal(navigation.selected, null);
  assert.equal(navigation.canGoBack, false);
  assert.equal(navigation.focus(nodes[0], view(1)), true);
  navigation.focus(nodes[1], view(2));
  navigation.focus(nodes[2], view(3));
  assert.equal(navigation.back().scale, 3);
  assert.equal(navigation.selected.id, "child");
  assert.equal(navigation.back().scale, 2);
  assert.equal(navigation.selected.id, "root");
  assert.equal(navigation.back(), null);
  navigation.reset();
  assert.equal(navigation.selected, null);
  assert.equal(navigation.canGoBack, false);
  assert.equal(navigation.focus({ id: "unknown" }, view(1)), false);
});

test("Atlas view delegates selection and history to the navigation model", () => {
  const source = readFileSync(new URL("../src/features/atlas/atlas-view.js", import.meta.url), "utf8");
  assert.ok(source.includes('import { createAtlasNavigation } from "./atlas-navigation.js";'));
  assert.ok(source.includes("navigation.focus(node"));
  assert.ok(source.includes("navigation.back()"));
  assert.ok(source.includes("navigation.reset()"));
});
