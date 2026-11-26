import { performance } from "node:perf_hooks";
import { catalogueMap } from "../src/catalogue-map.js";
import { cataloguePathways } from "../src/catalogue-pathways.js";
import { buildAcademyCatalogueGraph } from "../src/features/atlas/adapters/academy-catalogue-graph.js";
import { createAcademySharedAtlas } from "../src/features/atlas/adapters/academy-shared-graph.js";

const WARMUP_RUNS = 3;
const MEASURED_RUNS = 20;
function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}
function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return {
    runs: samples.length,
    medianMs: Number(percentile(sorted, 0.5).toFixed(3)),
    p95Ms: Number(percentile(sorted, 0.95).toFixed(3)),
    meanMs: Number(mean.toFixed(3)),
    minMs: Number(sorted[0].toFixed(3)),
    maxMs: Number(sorted.at(-1).toFixed(3))
  };
}
function measure(operation) {
  for (let index = 0; index < WARMUP_RUNS; index += 1) operation();
  const samples = [];
  let result;
  for (let index = 0; index < MEASURED_RUNS; index += 1) {
    const start = performance.now();
    result = operation();
    samples.push(performance.now() - start);
  }
  return { timing: summarize(samples), result };
}
const graph = buildAcademyCatalogueGraph(catalogueMap, [], cataloguePathways);
const atlasResult = measure(() => createAcademySharedAtlas({ graph, seed: "academy-benchmark" }));
const atlas = atlasResult.result;
const report = {
  benchmark: "BA Labs Academy — shared BA Labs 2D biological engine",
  environment: {
    runtime: process.version,
    platform: process.platform,
    architecture: process.arch,
    warmupRuns: WARMUP_RUNS,
    measuredRuns: MEASURED_RUNS,
    note: "Node-side deterministic graph geometry benchmark; excludes browser, PixiJS, WebGL, GPU and network costs."
  },
  dataset: {
    canonicalNodes: graph.nodes.length,
    canonicalRelationships: graph.edges.length,
    renderedNodes: atlas.nodes.length,
    renderedEdges: atlas.edges.length,
    universes: atlas.metrics.universeCount,
    mycologyCore: atlas.metrics.coreCount,
    localAnastomoses: atlas.metrics.localAnastomoses
  },
  timings: { sharedBiologicalGeometry: atlasResult.timing }
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
