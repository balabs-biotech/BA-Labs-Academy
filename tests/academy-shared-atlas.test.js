import test from "node:test";
import assert from "node:assert/strict";
import { catalogueMap } from "../src/catalogue-map.js";
import { cataloguePathways } from "../src/catalogue-pathways.js";
import { buildAcademyCatalogueGraph } from "../src/features/atlas/adapters/academy-catalogue-graph.js";
import { createAcademySharedAtlas } from "../src/features/atlas/adapters/academy-shared-graph.js";

test("Academy adapter uses the shared biological engine with one MYC core and eight universes", () => {
  const graph = buildAcademyCatalogueGraph(catalogueMap, [], cataloguePathways);
  const atlas = createAcademySharedAtlas({ graph });
  assert.equal(atlas.metrics.coreCount, 1);
  assert.equal(atlas.byId.get("department:MYC").r, 42, "MYC keeps its enlarged central-core radius");
  assert.equal(atlas.edges.filter((edge) => edge.academyCoreTrunk).length, 0, "MYC must not create eight artificial radial spokes");
  assert.equal(atlas.metrics.universeCount, 8);
  assert.equal(atlas.metrics.canonicalNodeCount, graph.nodes.length);
  assert.equal(atlas.metrics.renderedNodeCount, graph.nodes.length);
});

test("shared Academy geometry is deterministic and retains every canonical identifier", () => {
  const graph = buildAcademyCatalogueGraph(catalogueMap, [], cataloguePathways);
  const first = createAcademySharedAtlas({ graph, seed: "stable-test" });
  const second = createAcademySharedAtlas({ graph, seed: "stable-test" });
  assert.deepEqual(
    first.nodes.map(({ id, x, y }) => [id, x, y]),
    second.nodes.map(({ id, x, y }) => [id, x, y])
  );
  assert.deepEqual(new Set(first.nodes.map((node) => node.id)), new Set(graph.nodes.map((node) => node.id)));
});

test("Academy entry view is mounted through the shared renderer, not radial V2", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/features/atlas/atlas-v2-view.js", import.meta.url), "utf8");
  assert.ok(source.includes('mountAcademySharedAtlas'));
  assert.ok(!source.includes('from "./adapters/mount-academy-atlas-v2.js"'));
});
