import test from "node:test";
import assert from "node:assert/strict";
import { atlasBounds, layoutAtlas } from "../src/features/atlas/layout.js";
import { renderAtlasGraph } from "../src/features/atlas/renderer.js";

const nodes = [
  { id: "a", node_key: "department:BIO", entity_type: "DEPARTMENT", entity_key: "BIO", title: "Biologie" },
  { id: "b", node_key: "domain:BIO-D01", entity_type: "DOMAIN", entity_key: "BIO-D01", title: "Microbiologie" },
  { id: "c", node_key: "content:micro", entity_type: "CONTENT", entity_key: "micro", title: "Culture microbienne" }
];
const edges = [
  { source_node_id: "a", target_node_id: "b", relation_type: "BELONGS_TO" },
  { source_node_id: "b", target_node_id: "c", relation_type: "SUPPORTS" }
];

test("saved Atlas coordinates are preserved", () => {
  const saved = nodes.map((node, index) => ({ ...node, position_x: index * 120, position_y: index * 80 }));
  const result = layoutAtlas(saved, edges);
  assert.equal(result[1].x, 120);
  assert.equal(result[2].y, 160);
});

test("fallback layout is deterministic and finite", () => {
  const first = layoutAtlas(nodes, edges);
  const second = layoutAtlas(nodes, edges);
  assert.deepEqual(first.map(({ x, y }) => [x, y]), second.map(({ x, y }) => [x, y]));
  for (const point of first) {
    assert.ok(Number.isFinite(point.x));
    assert.ok(Number.isFinite(point.y));
  }
});

test("Atlas bounds include all graph points with padding", () => {
  const bounds = atlasBounds([{ x: -200, y: 40 }, { x: 500, y: 640 }]);
  assert.ok(bounds.x < -200);
  assert.ok(bounds.y < 40);
  assert.ok(bounds.width > 700);
  assert.ok(bounds.height > 600);
});

test("SVG renderer connects visible nodes and escapes labels", () => {
  const safeNodes = [
    { ...nodes[0], title: "Biologie <script>" },
    nodes[1]
  ];
  const markup = renderAtlasGraph(safeNodes, edges.slice(0, 1));
  assert.match(markup, /atlas-svg/);
  assert.match(markup, /atlas-edge/);
  assert.match(markup, /Biologie &lt;script&gt;/);
  assert.doesNotMatch(markup, /<script>/);
});
