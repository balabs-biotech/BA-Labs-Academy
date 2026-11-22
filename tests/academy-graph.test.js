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
  assert.ok(meanDepartmentRadius > 1430 && meanDepartmentRadius < 1530);
  assert.ok(meanPathwayRadius > 2030 && meanPathwayRadius < 2130);
});


test("Terminal module nodes have expanded spacing and label visibility threshold", async () => {
  const { ATLAS_GEOMETRY } = await import("../src/features/atlas/atlas-geometry.js");
  assert.deepEqual(ATLAS_GEOMETRY.childDistances, { 1: 520, 2: 460 });
  assert.equal(ATLAS_GEOMETRY.departmentPetalSpread, 1.95);
  assert.equal(ATLAS_GEOMETRY.sectionSpread, 3.4);
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


test("The Academy universe separates disciplinary territories and pathway transfers", () => {
  const departments = graph.nodes.filter((node) => node.entity_type === "DEPARTMENT" && node.entity_key !== "MYC");
  const pathways = graph.nodes.filter((node) => node.entity_type === "PATHWAY");
  const meanDepartmentRadius = departments.reduce((sum, node) => sum + Math.hypot(node.x, node.y), 0) / departments.length;
  const meanPathwayRadius = pathways.reduce((sum, node) => sum + Math.hypot(node.x, node.y), 0) / pathways.length;
  assert.ok(meanDepartmentRadius > 1430 && meanDepartmentRadius < 1530);
  assert.ok(meanPathwayRadius > 2030 && meanPathwayRadius < 2130);
  const transfers = graph.edges.filter((edge) => edge.relation_type === "TRANSFERS_TO");
  assert.ok(transfers.length > 0);
  assert.ok(transfers.every((edge) => edge.verified && edge.basis === "academy-pathway-flow"));
  for (const edge of transfers) {
    assert.equal(edge.a.entity_type, "SECTION");
    assert.equal(edge.b.entity_type, "SECTION");
  }
});


test("The graph accepts explicit, typed module-to-module knowledge relations", () => {
  const relation = {
    source: "module:MYC-01:01",
    target: "module:MIC-03:01",
    type: "METHOD_TRANSFER",
    evidence: "Validated editorial relation",
    status: "verified"
  };
  const linked = buildAcademyGraph(catalogueMap, [], cataloguePathways, [relation]);
  const edge = linked.edges.find((item) => item.id === "knowledge:module:MYC-01:01:METHOD_TRANSFER:module:MIC-03:01");
  assert.ok(edge, "explicit module relation should be represented as a graph edge");
  assert.equal(edge.a.id, relation.source);
  assert.equal(edge.b.id, relation.target);
  assert.equal(edge.relation_type, "METHOD_TRANSFER");
  assert.equal(edge.verified, true);
  assert.equal(edge.basis, "academy-knowledge-relation");
});

test("Unknown relation types and unresolved endpoints are excluded from the graph", () => {
  const linked = buildAcademyGraph(catalogueMap, [], cataloguePathways, [
    { source: "module:MYC-01:01", target: "module:MIC-03:01", type: "MADE_UP", status: "verified" },
    { source: "module:MYC-01:01", target: "module:DOES-NOT-EXIST:01", type: "PREREQUISITE", status: "verified" }
  ]);
  assert.equal(linked.edges.filter((edge) => edge.basis === "academy-knowledge-relation").length, 0);
});


test("The overview geometry follows an eight-spoke wheel around the Mycology hub", () => {
  const departments = graph.nodes.filter((node) => node.entity_type === "DEPARTMENT" && node.entity_key !== "MYC");
  assert.equal(departments.length, 8);
  const radii = departments.map((node) => Math.hypot(node.x, node.y));
  assert.ok(radii.every((radius) => Math.abs(radius - 1480) < 1e-8));
  const angles = departments.map((node) => (Math.atan2(node.y, node.x) + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
  const gaps = angles.map((angle, index) => ((angles[(index + 1) % angles.length] - angle + Math.PI * 2) % (Math.PI * 2)));
  assert.ok(gaps.every((gap) => gap > 0.35 && gap < 1.2));
  assert.ok(Math.max(...gaps) - Math.min(...gaps) > 0.08, "complex departments must receive wider angular sectors");
});

test("Department sections fill their allocated radial fan without crossing its sector", async () => {
  const { createAtlasDepartmentLayout } = await import("../src/features/atlas/atlas-geometry.js");
  const layout = createAtlasDepartmentLayout(catalogueMap.filter((item) => item.code !== "MYC"));
  for (const department of catalogueMap.filter((item) => item.code !== "MYC")) {
    const root = graph.nodes.find((node) => node.entity_type === "DEPARTMENT" && node.entity_key === department.code);
    const sections = graph.nodes.filter((node) => node.parent === root.id && node.entity_type === "SECTION");
    const rootAngle = Math.atan2(root.y, root.x);
    for (const section of sections) {
      const angle = Math.atan2(section.y - root.y, section.x - root.x);
      const delta = Math.atan2(Math.sin(angle - rootAngle), Math.cos(angle - rootAngle));
      assert.ok(Math.abs(delta) <= layout.spreads[department.code] / 2 + 1e-8, `${department.code} section escaped its allocated fan`);
    }
  }
});


test("Mycology sections form a complete inner ring without a duplicate end point", () => {
  const core = graph.nodes.find((node) => node.entity_type === "DEPARTMENT" && node.entity_key === "MYC");
  const sections = graph.nodes.filter((node) => node.parent === core.id && node.entity_type === "SECTION");
  const angles = sections.map((node) => (Math.atan2(node.y, node.x) + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
  assert.equal(sections.length, 6);
  const gaps = angles.map((angle, index) => ((angles[(index + 1) % angles.length] - angle + Math.PI * 2) % (Math.PI * 2)));
  assert.ok(gaps.every((gap) => Math.abs(gap - Math.PI / 3) < 1e-8));
});



test("Shared pathway participation creates deduplicated, explicit bridges between departments", () => {
  const bridges = graph.edges.filter((edge) => edge.basis === "academy-pathway-network");
  assert.ok(bridges.length > 0);
  const keys = bridges.map((edge) => [edge.a.id, edge.b.id].sort().join("|"));
  assert.equal(new Set(keys).size, keys.length);
  for (const edge of bridges) {
    assert.equal(edge.a.entity_type, "DEPARTMENT");
    assert.equal(edge.b.entity_type, "DEPARTMENT");
    assert.equal(edge.cross, true);
    assert.equal(edge.verified, true);
    assert.ok(edge.pathwayCodes.length > 0);
    assert.ok(edge.pathwayCodes.every((code) => cataloguePathways.some((pathway) => pathway.code === code)));
  }
});

test("Graph edges never infer scientific relations from spatial proximity", () => {
  const synthetic = graph.edges.filter((edge) =>
    edge.basis === "local-anastomosis" || edge.relation_type === "RELATED_TO"
  );
  assert.equal(synthetic.length, 0);
  const allowedBases = new Set([
    "academy-hierarchy",
    "academy-pathway",
    "academy-domain",
    "academy-pathway-flow",
    "academy-pathway-network",
    "academy-knowledge-relation"
  ]);
  assert.ok(graph.edges.every((edge) => allowedBases.has(edge.basis)));
});

test("Cross-module relations exist only when explicitly verified and evidenced", () => {
  const crossModule = graph.edges.filter((edge) =>
    edge.a.entity_type === "MODULE" && edge.b.entity_type === "MODULE"
  );
  assert.equal(crossModule.length, 0);
  const explicit = buildAcademyGraph(catalogueMap, [], cataloguePathways, [{
    source: "module:MYC-01:01",
    target: "module:MIC-03:01",
    type: "METHOD_TRANSFER",
    evidence: "Validated editorial relation",
    status: "verified"
  }]);
  const verified = explicit.edges.filter((edge) => edge.basis === "academy-knowledge-relation");
  assert.equal(verified.length, 1);
  assert.ok(verified[0].evidence);
});
