import { performance } from "node:perf_hooks";
import { catalogueMap } from "../src/catalogue-map.js";
import { cataloguePathways } from "../src/catalogue-pathways.js";
import { buildAcademyGraph } from "../src/features/atlas/atlas-graph.js";
import { createAtlasGrowthModel, createAtlasGrowthGraph } from "../src/features/atlas/atlas-growth-model.js";

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

const graphResult = measure(() => buildAcademyGraph(catalogueMap, [], cataloguePathways));
const graph = graphResult.result;
const growthResult = measure(() => createAtlasGrowthModel({ nodes: graph.nodes }));
const previewResult = measure(() => createAtlasGrowthGraph(graph, { visibleDepth: 2 }));
const growth = growthResult.result;
const preview = previewResult.result;

const report = {
  benchmark: "BA Labs Academy Atlas 2D",
  environment: {
    runtime: process.version,
    platform: process.platform,
    architecture: process.arch,
    warmupRuns: WARMUP_RUNS,
    measuredRuns: MEASURED_RUNS,
    note: "Node-side deterministic model benchmark; excludes browser, PixiJS, WebGL, GPU and network costs."
  },
  dataset: {
    nodes: graph.nodes.length,
    academicEdges: graph.edges.length,
    morphologyBranches: graph.morphologyBranches?.length || 0,
    previewDepth: 2,
    previewNodes: preview.nodes.length,
    previewEdges: preview.edges.length
  },
  timings: {
    graphConstruction: graphResult.timing,
    fullGrowthGeometry: growthResult.timing,
    depthTwoPreviewPipeline: previewResult.timing
  },
  collisionCandidates: growth.collisionCandidateDiagnostics,
  crossGenerationDiagnostics: growth.crossGenerationDiagnostics
};

process.stdout.write(JSON.stringify(report, null, 2) + "\n");
