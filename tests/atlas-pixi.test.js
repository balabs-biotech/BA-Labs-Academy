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
  const selectionSource = readFileSync(new URL("../src/features/atlas/atlas-selection.js", import.meta.url), "utf8");
  assert.ok(selectionSource.includes('className = "atlas-branch-navigation"'));
  assert.ok(selectionSource.includes('className = "atlas-branch-parent"'));
  assert.ok(selectionSource.includes('className = "atlas-branch-children"'));
  assert.ok(selectionSource.includes('node.parent === selected.id'));
  assert.ok(selectionSource.includes('focusNode(parentNode)'));
  assert.ok(selectionSource.includes('focusNode(child)'));
  assert.ok(source.includes('renderAtlasSelectionPanel({'));
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
  assert.ok(source.includes('import { createAtlasNavigation, getAtlasBreadcrumbPath } from "./atlas-navigation.js";'));
  assert.ok(source.includes("navigation.focus(node"));
  assert.ok(source.includes("navigation.back()"));
  assert.ok(source.includes("navigation.reset()"));
});


test("Atlas breadcrumb paths follow parents and safely stop at missing parents or cycles", async () => {
  const { getAtlasBreadcrumbPath } = await import("../src/features/atlas/atlas-navigation.js");
  const root = { id: "root", title: "Biologie", parent: null };
  const section = { id: "section", title: "Mycologie", parent: "root" };
  const module = { id: "module", title: "Culture", parent: "section" };
  const byId = new Map([[root.id, root], [section.id, section], [module.id, module]]);
  assert.deepEqual(getAtlasBreadcrumbPath(module, byId), ["Biologie", "Mycologie", "Culture"]);
  assert.deepEqual(getAtlasBreadcrumbPath(null, byId), []);
  assert.deepEqual(getAtlasBreadcrumbPath({ id: "orphan", title: "Orphelin", parent: "missing" }, byId), ["Orphelin"]);
  const cyclicA = { id: "a", title: "A", parent: "b" };
  const cyclicB = { id: "b", title: "B", parent: "a" };
  const cyclic = new Map([["a", cyclicA], ["b", cyclicB]]);
  assert.deepEqual(getAtlasBreadcrumbPath(cyclicA, cyclic), ["B", "A"]);
});

test("Atlas view delegates breadcrumb construction to the navigation model", () => {
  const source = readFileSync(new URL("../src/features/atlas/atlas-view.js", import.meta.url), "utf8");
  assert.ok(source.includes("getAtlasBreadcrumbPath(navigation.selected, byId)"));
});


test("Atlas camera projects world coordinates into the viewport", async () => {
  const { atlasScreenPoint } = await import("../src/features/atlas/atlas-camera.js");
  assert.deepEqual(atlasScreenPoint({ x: 10, y: -5 }, {
    width: 800, height: 600, scale: 2, offset: { x: 20, y: -10 }
  }), { x: 440, y: 280 });
});

test("Atlas camera fits the complete root constellation for desktop and mobile", async () => {
  const { fitAtlasCamera } = await import("../src/features/atlas/atlas-camera.js");
  const roots = [{ x: -500, y: -200 }, { x: 500, y: 200 }];
  const desktop = fitAtlasCamera(roots, 1440, 900);
  const mobile = fitAtlasCamera(roots, 390, 780);
  assert.ok(desktop.scale > mobile.scale);
  assert.ok(desktop.scale <= 0.82 && desktop.scale >= 0.075);
  assert.ok(mobile.scale >= 0.075);
  assert.deepEqual(fitAtlasCamera([], 390, 780), null);
});

test("Atlas camera zoom preserves the cursor's world-space anchor and clamps limits", async () => {
  const { zoomAtlasCamera, atlasScreenPoint } = await import("../src/features/atlas/atlas-camera.js");
  const initial = { width: 800, height: 600, scale: 1, offset: { x: 0, y: 0 } };
  const anchor = { x: 620, y: 210 };
  const worldBefore = {
    x: (anchor.x - initial.width / 2 - initial.offset.x) / initial.scale,
    y: (anchor.y - initial.height / 2 - initial.offset.y) / initial.scale
  };
  const next = zoomAtlasCamera(initial, 2, anchor.x, anchor.y);
  const screenAfter = atlasScreenPoint(worldBefore, { ...initial, ...next });
  assert.ok(Math.abs(screenAfter.x - anchor.x) < 1e-9);
  assert.ok(Math.abs(screenAfter.y - anchor.y) < 1e-9);
  assert.equal(zoomAtlasCamera(initial, 100, anchor.x, anchor.y).scale, 12);
});

test("Atlas camera interpolation converges predictably without mutating inputs", async () => {
  const { interpolateAtlasCamera } = await import("../src/features/atlas/atlas-camera.js");
  const current = { scale: 1, offset: { x: 0, y: 0 } };
  const target = { scale: 3, offset: { x: 100, y: -50 } };
  assert.deepEqual(interpolateAtlasCamera(current, target, 0.5), {
    scale: 2, offset: { x: 50, y: -25 }
  });
  assert.deepEqual(current, { scale: 1, offset: { x: 0, y: 0 } });
});

test("Atlas view delegates projection, fit, zoom and animation interpolation to camera module", () => {
  const source = readFileSync(new URL("../src/features/atlas/atlas-view.js", import.meta.url), "utf8");
  assert.ok(source.includes("atlasScreenPoint(node"));
  assert.ok(source.includes("fitAtlasCamera("));
  assert.ok(source.includes("zoomAtlasCamera("));
  assert.ok(source.includes("interpolateAtlasCamera("));
});


test("Atlas wheel renderer keeps the restrained radial motif", () => {
  const source = readFileSync(new URL("../src/features/atlas/atlas-renderer-stage.js", import.meta.url), "utf8");
  const rendererSource = readFileSync(new URL("../src/features/atlas/pixi-renderer.js", import.meta.url), "utf8");
  const nodesSource = readFileSync(new URL("../src/features/atlas/atlas-nodes.js", import.meta.url), "utf8");
  assert.ok(source.includes("filaments.circle(0, 0, 820)"));
  assert.ok(source.includes("filaments.circle(0, 0, 1600)"));
  assert.ok(source.includes(".bezierCurveTo("));
  assert.ok(source.includes("const roots = nodes.filter"));
  assert.ok(rendererSource.includes("stage.drawBackdrop({nodes,width,height})"));
  assert.ok(!source.includes('field.moveTo(x,y).quadraticCurveTo'));
  assert.ok(nodesSource.includes("Three arms echo the BA Labs Y mark"));
});

test("Atlas connection layer hides pathway roots outside pathway focus", async () => {
  const source = readFileSync(new URL("../src/features/atlas/atlas-connections.js", import.meta.url), "utf8");
  assert.ok(source.includes('selected?.entity_type !== "PATHWAY"'));
  assert.ok(source.includes('e.basis==="academy-pathway-network"'));
  assert.ok(source.includes('const sharedPathway=e.basis==="academy-pathway-network"'));
});


test("Atlas lifecycle disposes resources once in reverse registration order", async () => {
  const { createAtlasLifecycle } = await import("../src/features/atlas/atlas-lifecycle.js");
  const lifecycle = createAtlasLifecycle();
  const calls = [];
  lifecycle.add(() => calls.push("renderer"));
  lifecycle.add(() => calls.push("observer"));
  lifecycle.add(() => calls.push("animation"));
  lifecycle.dispose(); lifecycle.dispose();
  assert.equal(lifecycle.disposed, true);
  assert.deepEqual(calls, ["animation", "observer", "renderer"]);
});

test("Atlas lifecycle removes event listeners with their original options", async () => {
  const { createAtlasLifecycle } = await import("../src/features/atlas/atlas-lifecycle.js");
  const lifecycle = createAtlasLifecycle();
  const calls = [];
  const target = { addEventListener: (...args) => calls.push(["add", ...args]), removeEventListener: (...args) => calls.push(["remove", ...args]) };
  const handler = () => {};
  const options = { passive: false };
  lifecycle.listen(target, "wheel", handler, options); lifecycle.dispose();
  assert.deepEqual(calls, [["add", "wheel", handler, options], ["remove", "wheel", handler, options]]);
});

test("Atlas lifecycle immediately releases resources registered after disposal", async () => {
  const { createAtlasLifecycle } = await import("../src/features/atlas/atlas-lifecycle.js");
  const lifecycle = createAtlasLifecycle(); lifecycle.dispose();
  let released = false; lifecycle.add(() => { released = true; });
  assert.equal(released, true);
});

test("Atlas view centralizes cleanup and observes stage resizing", () => {
  const source = readFileSync(new URL("../src/features/atlas/atlas-view.js", import.meta.url), "utf8");
  assert.ok(source.includes("createAtlasLifecycle()"));
  assert.ok(source.includes("new ResizeObserver(resize)"));
  assert.ok(source.includes('lifecycle.listen(canvas, "pointerdown", pointerController.onPointerDown)'));
  assert.ok(source.includes("return () => lifecycle.dispose()"));
});


test("Atlas pointer controller pans with one pointer and selects on tap", async () => {
  const { createAtlasPointerController } = await import("../src/features/atlas/atlas-interaction.js");
  const classes = new Set();
  const canvas = {
    setPointerCapture() {},
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
    getBoundingClientRect: () => ({ left: 10, top: 20 })
  };
  let offset = { x: 4, y: 8 };
  const selected = [];
  const controller = createAtlasPointerController({
    canvas, getOffset: () => offset, setOffset: (next) => { offset = next; },
    zoom() {}, hit: (x, y) => x === 5 && y === 6 ? { id: "node" } : null,
    focusNode: (node) => selected.push(node.id)
  });
  controller.onPointerDown({ pointerId: 1, clientX: 30, clientY: 40 });
  controller.onPointerMove({ pointerId: 1, clientX: 50, clientY: 55 });
  assert.deepEqual(offset, { x: 24, y: 23 });
  controller.onPointerUp({ pointerId: 1, clientX: 50, clientY: 55 });
  assert.deepEqual(selected, []);
  controller.onPointerDown({ pointerId: 2, clientX: 15, clientY: 26 });
  controller.onPointerUp({ pointerId: 2, clientX: 15, clientY: 26 });
  assert.deepEqual(selected, ["node"]);
  assert.equal(classes.has("is-dragging"), false);
});

test("Atlas pointer controller zooms around the midpoint of a two-pointer pinch", async () => {
  const { createAtlasPointerController } = await import("../src/features/atlas/atlas-interaction.js");
  const canvas = { setPointerCapture() {}, classList: { add() {}, remove() {} }, getBoundingClientRect: () => ({ left: 10, top: 20 }) };
  const zooms = [];
  const controller = createAtlasPointerController({
    canvas, getOffset: () => ({ x: 0, y: 0 }), setOffset() {},
    zoom: (...args) => zooms.push(args), hit: () => null, focusNode() {}
  });
  controller.onPointerDown({ pointerId: 1, clientX: 30, clientY: 40 });
  controller.onPointerDown({ pointerId: 2, clientX: 50, clientY: 40 });
  controller.onPointerMove({ pointerId: 2, clientX: 50, clientY: 40 });
  controller.onPointerMove({ pointerId: 2, clientX: 70, clientY: 40 });
  assert.equal(zooms.length, 1);
  assert.deepEqual(zooms[0], [2, 40, 20]);
});


test("Atlas accessible node index is rendered by its own view adapter", async () => {
  const { renderAtlasAccessibleNodes } = await import("../src/features/atlas/atlas-accessibility.js");
  assert.equal(typeof renderAtlasAccessibleNodes, "function");
  const source = readFileSync(new URL("../src/features/atlas/atlas-view.js", import.meta.url), "utf8");
  assert.ok(source.includes("renderAtlasAccessibleNodes({"));
  assert.ok(source.includes('nav: container.querySelector("#academy-atlas-accessible")'));
});


test("Atlas selection panel has a dedicated rendering module", async () => {
  const { renderAtlasSelectionPanel } = await import("../src/features/atlas/atlas-selection.js");
  assert.equal(typeof renderAtlasSelectionPanel, "function");
  const source = readFileSync(new URL("../src/features/atlas/atlas-view.js", import.meta.url), "utf8");
  assert.ok(source.includes("renderAtlasSelectionPanel({"));
  assert.ok(source.includes('selected: navigation.selected'));
});


test("Atlas view preserves cursor-centered wheel zoom", () => {
  const source = readFileSync(new URL("../src/features/atlas/atlas-view.js", import.meta.url), "utf8");
  assert.match(source, /const onWheel = \(event\) => \{[\s\S]*?event\.preventDefault\(\)[\s\S]*?zoom\(event\.deltaY < 0 \? 1\.16 : 0\.86, event\.clientX - rect\.left, event\.clientY - rect\.top\)/);
});


test("Atlas connection rendering is isolated from Pixi node rendering", async () => {
  const { renderAtlasConnections } = await import("../src/features/atlas/atlas-connections.js");
  assert.equal(typeof renderAtlasConnections, "function");
  const source = readFileSync(new URL("../src/features/atlas/pixi-renderer.js", import.meta.url), "utf8");
  assert.ok(source.includes("renderAtlasConnections({"));
  const connections = readFileSync(new URL("../src/features/atlas/atlas-connections.js", import.meta.url), "utf8");
  for (const basis of ["academy-hierarchy", "academy-pathway-flow", "academy-pathway-network", "academy-knowledge-relation"]) {
    assert.ok(connections.includes(basis), `Missing connection basis: ${basis}`);
  }
});


test("Atlas node geometry is isolated from Pixi renderer orchestration", () => {
  const source = readFileSync(new URL("../src/features/atlas/pixi-renderer.js", import.meta.url), "utf8");
  const nodesSource = readFileSync(new URL("../src/features/atlas/atlas-nodes.js", import.meta.url), "utf8");
  assert.ok(source.includes('import { renderAtlasNodes } from "./atlas-nodes.js";'));
  assert.ok(source.includes("renderAtlasNodes({ junctions, nodes, selected, scale, alphaFor, activeBranch, lineage })"));
  assert.ok(!source.includes("junctions.circle(n.x,n.y,r*1.9)"));
  assert.ok(nodesSource.includes("junctions.circle(n.x,n.y,r*1.9)"));
  assert.ok(nodesSource.includes("export function renderAtlasNodes"));
  assert.ok(nodesSource.includes("if(n.isAcademyCore)"));
  assert.ok(nodesSource.includes("Three arms echo the BA Labs Y mark"));
});

test("Atlas connection renderer resolves edge endpoints after extraction", async () => {
  const { renderAtlasConnections } = await import("../src/features/atlas/atlas-connections.js");
  const calls = [];
  const path = { quadraticCurveTo: (...args) => { calls.push(["curve", ...args]); return path; }, bezierCurveTo: (...args) => { calls.push(["bezier", ...args]); return path; }, stroke: (...args) => { calls.push(["stroke", ...args]); return path; } };
  const filaments = { moveTo: (...args) => { calls.push(["move", ...args]); return path; }, circle: () => path };
  const a = { id: "a", x: 0, y: 0, level: 1, entity_type: "SECTION", rootId: "myc" };
  const b = { id: "b", x: 100, y: 0, level: 2, entity_type: "MODULE", rootId: "myc" };
  renderAtlasConnections({ filaments, junctions: { circle: () => path }, edges: [{ a, b, basis: "academy-hierarchy", cross: false, depth: 2 }], selected: null, scale: 1, reduced: true, relationFilter: "all", time: 0, alphaFor: () => 1, activeBranch: new Set() });
  assert.ok(calls.some(([kind]) => kind === "move"));
  assert.ok(calls.some(([kind]) => kind === "bezier"), "connection paths use cubic Bézier curves");
});


test("Atlas render context pre-indexes hierarchy and caches selected branch sets", async () => {
  const { createAtlasRenderContext } = await import("../src/features/atlas/atlas-render-context.js");
  const root = { id: "root", parent: null };
  const section = { id: "section", parent: "root" };
  const moduleA = { id: "module-a", parent: "section" };
  const moduleB = { id: "module-b", parent: "section" };
  const unrelated = { id: "unrelated", parent: null };
  const context = createAtlasRenderContext([root, section, moduleA, moduleB, unrelated]);

  assert.equal(context.byId.get("section"), section);
  assert.deepEqual(context.childrenByParent.get("section"), [moduleA, moduleB]);

  const first = context.resolveSelection(moduleA);
  assert.deepEqual([...first.lineage], ["module-a", "section", "root"]);
  assert.deepEqual([...first.activeBranch].sort(), ["module-a"]);
  assert.equal(context.resolveSelection(moduleA), first, "same selection reuses the cached context");

  const next = context.resolveSelection(section);
  assert.notEqual(next, first);
  assert.deepEqual([...next.lineage], ["section", "root"]);
  assert.deepEqual([...next.activeBranch].sort(), ["module-a", "module-b", "section"]);
  assert.deepEqual([...context.resolveSelection(null).lineage], []);
  assert.deepEqual([...context.resolveSelection(null).activeBranch], []);
});

test("Atlas render context safely stops at malformed parent cycles", async () => {
  const { createAtlasRenderContext } = await import("../src/features/atlas/atlas-render-context.js");
  const a = { id: "a", parent: "b" };
  const b = { id: "b", parent: "a" };
  const context = createAtlasRenderContext([a, b]);
  const result = context.resolveSelection(a);
  assert.deepEqual([...result.lineage], ["a", "b"]);
  assert.deepEqual([...result.activeBranch].sort(), ["a", "b"]);
});

test("Atlas renderer stage owns Pixi layer composition and non-semantic backdrop", async () => {
  const { createAtlasRenderStage } = await import("../src/features/atlas/atlas-renderer-stage.js");
  const calls = [];
  const makeLayer = (name) => ({
    name,
    clear() { calls.push([name, "clear"]); return this; },
    rect(...args) { calls.push([name, "rect", ...args]); return this; },
    circle(...args) { calls.push([name, "circle", ...args]); return this; },
    moveTo(...args) { calls.push([name, "moveTo", ...args]); return this; },
    bezierCurveTo(...args) { calls.push([name, "bezierCurveTo", ...args]); return this; },
    fill(...args) { calls.push([name, "fill", ...args]); return this; },
    stroke(...args) { calls.push([name, "stroke", ...args]); return this; }
  });
  class FakeGraphics { constructor() { return makeLayer("graphics-" + calls.length); } }
  class FakeContainer { constructor() { return makeLayer("labels"); } }
  class FakeTextStyle { constructor(options) { this.options = options; } }
  const app = { stage: { addChild(...layers) { calls.push(["stage", "addChild", ...layers]); } } };
  const stage = createAtlasRenderStage(app, {
    Graphics: FakeGraphics,
    Container: FakeContainer,
    TextStyle: FakeTextStyle
  });
  assert.equal(typeof stage.drawBackdrop, "function");
  assert.ok(calls.some(([owner, action]) => owner === "stage" && action === "addChild"));
  stage.drawBackdrop({
    width: 800,
    height: 600,
    nodes: [{ level: 0, entity_type: "DEPARTMENT", entity_key: "BIO", rootId: "BIO", x: 100, y: 0 }]
  });
  assert.ok(calls.some(([owner, action]) => owner.startsWith("graphics-") && action === "bezierCurveTo"));
  assert.equal(calls.filter(([owner, action]) => owner.startsWith("graphics-") && action === "circle").length, 3);
});

test("Module labels become eligible earlier and the zoom label budget expands", () => {
  const source = readFileSync(new URL("../src/features/atlas/atlas-labels.js", import.meta.url), "utf8");
  assert.ok(source.includes("n.level===1?.58:n.level===2?.84"));
  assert.ok(source.includes("Math.min(96,Math.max(18"));
  assert.ok(source.includes("11.1+Math.log2"));
});

test("Atlas renderer delegates label layout to its dedicated layer", () => {
  const source = readFileSync(new URL("../src/features/atlas/pixi-renderer.js", import.meta.url), "utf8");
  const labelsSource = readFileSync(new URL("../src/features/atlas/atlas-labels.js", import.meta.url), "utf8");
  assert.ok(source.includes('import { renderAtlasLabels } from "./atlas-labels.js";'));
  assert.ok(source.includes("renderAtlasLabels({ canvas, labels, labelPool, style"));
  assert.ok(!source.includes("const shortRoots="));
  assert.ok(labelsSource.includes("export function renderAtlasLabels"));
  assert.ok(labelsSource.includes("const collides=occupied.some"));
  assert.ok(labelsSource.includes("canvas.dataset.visibleNodeHitBoxes"));
});

test("Atlas department palette is a single shared rendering contract", () => {
  const paletteSource = readFileSync(new URL("../src/features/atlas/atlas-palette.js", import.meta.url), "utf8");
  const stageSource = readFileSync(new URL("../src/features/atlas/atlas-renderer-stage.js", import.meta.url), "utf8");
  const nodesSource = readFileSync(new URL("../src/features/atlas/atlas-nodes.js", import.meta.url), "utf8");
  assert.ok(paletteSource.includes("export const PALETTE="));
  assert.ok(stageSource.includes('import { PALETTE } from "./atlas-palette.js";'));
  assert.ok(nodesSource.includes('import { PALETTE } from "./atlas-palette.js";'));
});


test("Atlas label renderer owns a safe live-node set when not injected", async () => {
  const { renderAtlasLabels } = await import("../src/features/atlas/atlas-labels.js");
  const canvas = { dataset: {} };
  const label = { style: {}, anchor: { set() {} }, position: { set() {} }, visible: false };
  const pool = new Map();
  const labels = { addChild() {} };
  renderAtlasLabels({ canvas, labels, labelPool: pool, style: {}, createLabel: () => label, nodes: [], selected: null, scale: 1, offset: { x: 0, y: 0 }, width: 400, height: 700, alphaFor: () => 1, activeBranch: new Set(), lineage: new Set(), lang: "fr" });
  assert.equal(canvas.dataset.visibleNodeIds, "[]");
  assert.equal(canvas.dataset.visibleNodeHitBoxes, "{}");
});


test("Atlas animation scheduler owns one frame loop and supports clean stop and restart", async () => {
  const { createAtlasAnimation } = await import("../src/features/atlas/atlas-animation.js");
  const callbacks = new Map();
  const canceled = [];
  let nextId = 0;
  let frames = 0;
  const animation = createAtlasAnimation({
    requestFrame(callback) {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    },
    cancelFrame(id) {
      canceled.push(id);
      callbacks.delete(id);
    },
    onFrame() { frames += 1; }
  });

  assert.equal(animation.start(), true);
  assert.equal(animation.start(), false, "starting twice must not create parallel loops");
  const firstId = nextId;
  const firstFrame = callbacks.get(firstId);
  callbacks.delete(firstId);
  firstFrame();
  assert.equal(frames, 1);
  assert.equal(callbacks.size, 1, "each frame schedules exactly one successor");

  assert.equal(animation.stop(), true);
  assert.equal(animation.stop(), false);
  assert.deepEqual(canceled, [nextId]);
  assert.equal(callbacks.size, 0);

  const stoppedFrameId = nextId;
  assert.equal(animation.start(), true, "a stopped scheduler can restart");
  const pendingId = nextId;
  animation.dispose();
  assert.deepEqual(canceled, [stoppedFrameId, pendingId]);
  assert.equal(animation.running, false);
  assert.equal(animation.disposed, true);
  assert.equal(callbacks.size, 0);
  assert.equal(animation.start(), false);
});

test("Atlas animation respects reduced-motion mode and releases pending frames on disposal", async () => {
  const { createAtlasAnimation } = await import("../src/features/atlas/atlas-animation.js");
  let requested = 0;
  let canceled = 0;
  let frames = 0;
  const disabled = createAtlasAnimation({
    enabled: false,
    requestFrame() { requested += 1; return requested; },
    cancelFrame() { canceled += 1; },
    onFrame() { frames += 1; }
  });
  assert.equal(disabled.start(), false);
  assert.equal(requested, 0);
  disabled.dispose();

  let callback;
  const active = createAtlasAnimation({
    requestFrame(next) { callback = next; return 7; },
    cancelFrame(id) { assert.equal(id, 7); canceled += 1; },
    onFrame() { frames += 1; }
  });
  active.start();
  active.dispose();
  callback();
  assert.equal(frames, 0, "a canceled callback must not render after disposal");
  assert.equal(canceled, 1);
});

test("Atlas view delegates frame scheduling to the independent animation module", () => {
  const source = readFileSync(new URL("../src/features/atlas/atlas-view.js", import.meta.url), "utf8");
  assert.ok(source.includes('import { createAtlasAnimation } from "./atlas-animation.js";'));
  assert.ok(source.includes("animation.start()"));
  assert.ok(source.includes("animation.dispose()"));
  assert.ok(!source.includes("requestAnimationFrame(animate)"));
  assert.ok(!source.includes("cancelAnimationFrame(frame)"));
});
