import test from "node:test";
import assert from "node:assert/strict";
import { catalogueMap } from "../src/catalogue-map.js";
import { cataloguePathways } from "../src/catalogue-pathways.js";
import { buildAcademyGraph } from "../src/features/atlas/atlas-graph.js";
import { createAtlasGrowthGraph, createAtlasGrowthModel } from "../src/features/atlas/atlas-growth-model.js";
import { ATLAS_GEOMETRY } from "../src/features/atlas/atlas-geometry.js";
import { atlasConnectionCurvesClearance, atlasConnectionCurvesMayBeNear } from "../src/features/atlas/atlas-curve.js";


test("filament clearance measures segment distance rather than sample-point distance", () => {
  const horizontal = {
    a: { x: 0, y: 0 }, c1: { x: 3, y: 0 },
    c2: { x: 7, y: 0 }, b: { x: 10, y: 0 }
  };
  const parallel = {
    a: { x: 0, y: 5 }, c1: { x: 3, y: 5 },
    c2: { x: 7, y: 5 }, b: { x: 10, y: 5 }
  };
  const crossing = {
    a: { x: 5, y: -5 }, c1: { x: 5, y: -2 },
    c2: { x: 5, y: 2 }, b: { x: 5, y: 5 }
  };
  assert.ok(Math.abs(atlasConnectionCurvesClearance(horizontal, parallel, {
    steps: 4, startProgress: 0, endProgress: 1
  }) - 5) < 1e-9);
  assert.equal(atlasConnectionCurvesClearance(horizontal, crossing, {
    steps: 4, startProgress: 0, endProgress: 1
  }), 0);
});

test("curve proximity broad phase retains nearby bounds and rejects distant bounds", () => {
  const first = {
    a: { x: 0, y: 0 }, c1: { x: 3, y: 0 },
    c2: { x: 7, y: 0 }, b: { x: 10, y: 0 }
  };
  const nearby = {
    a: { x: 0, y: 12 }, c1: { x: 3, y: 12 },
    c2: { x: 7, y: 12 }, b: { x: 10, y: 12 }
  };
  const distant = {
    a: { x: 0, y: 40 }, c1: { x: 3, y: 40 },
    c2: { x: 7, y: 40 }, b: { x: 10, y: 40 }
  };
  const options = { steps: 8, startProgress: 0, endProgress: 1 };
  assert.equal(atlasConnectionCurvesMayBeNear(first, nearby, 18, options), true);
  assert.equal(atlasConnectionCurvesMayBeNear(first, distant, 18, options), false);
});

test("growth preview remaps hierarchy and transversal edges to the same visible node objects", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const preview = createAtlasGrowthGraph(graph, { visibleDepth: 1 });
  assert.ok(preview.growthPreview);
  assert.ok(preview.nodes.length < graph.nodes.length);
  assert.ok(preview.nodes.every((node) => preview.byId.get(node.id) === node));
  assert.ok(preview.edges.every((edge) =>
    preview.byId.get(edge.a.id) === edge.a && preview.byId.get(edge.b.id) === edge.b
  ));
  for (const [code, node] of preview.departmentNodes) {
    assert.equal(preview.byId.get(node.id), node);
    assert.equal(node.entity_key, code);
  }
});

test("growth preview reveals modules at the next depth while retaining root and section anchors", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const first = createAtlasGrowthGraph(graph, { visibleDepth: 1 });
  const second = createAtlasGrowthGraph(graph, { visibleDepth: 2 });
  assert.ok(second.nodes.length > first.nodes.length);
  assert.ok(second.edges.length > first.edges.length);
  for (const node of first.nodes) {
    const expanded = second.byId.get(node.id);
    assert.ok(expanded);
    assert.equal(expanded.x, node.x);
    assert.equal(expanded.y, node.y);
  }
});


test("fractal preview remaps all eight visual trunks to its positioned root nodes", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const preview = createAtlasGrowthGraph(graph, { visibleDepth: 1 });
  assert.equal(preview.morphologyBranches.length, 8);
  for (const branch of preview.morphologyBranches) {
    assert.strictEqual(branch.source, preview.byId.get(branch.sourceId));
    assert.strictEqual(branch.target, preview.byId.get(branch.targetId));
    assert.equal(branch.visualOnly, true);
  }
});

test("Academy roots use the shared irregular biological field instead of a radial orbit", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const model = createAtlasGrowthGraph(graph);
  const roots = model.nodes.filter((node) => node.level === 0 && node.entity_type !== "PATHWAY");
  assert.equal(roots.length, 9);
  const centroid = roots.reduce((sum, node) => ({ x: sum.x + node.x / roots.length, y: sum.y + node.y / roots.length }), { x: 0, y: 0 });
  const radii = roots.map((node) => Math.hypot(node.x - centroid.x, node.y - centroid.y));
  assert.ok(Math.max(...radii) - Math.min(...radii) > 100);
  assert.ok(roots.some((node) => Math.abs(node.x) > 100 && Math.abs(node.y) > 100));
  assert.equal(model.byId.get("department:MYC").entity_key, "MYC");
});

test("global branch expansion propagates through every recursive generation", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const model = createAtlasGrowthGraph(graph);
  const root = model.byId.get("department:MIC");
  const generations = Array.from({ length: model.growthPreview.maxDepth }, (_, index) => index + 1);
  for (const generation of generations) {
    const sample = model.nodes.find((node) => node.rootId === "mic" && node.generation === generation);
    assert.ok(sample, `missing generation ${generation}`);
    const parent = model.byId.get(sample.parent);
    const distance = Math.hypot(sample.x - parent.x, sample.y - parent.y);
    assert.ok(Number.isFinite(distance) && distance > 0,
      `generation ${generation} has a finite, non-zero organic branch`);
    assert.ok(Number.isFinite(sample.growthSector.densityScale));
    assert.ok(sample.growthSector.densityScale >= 1);
  }
  assert.ok(root);
  assert.equal(ATLAS_GEOMETRY.branchOccupancy, 0.82);
});

test("MYCOLOGIE and the eight disciplinary axes retain their identities in the organic field", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const model = createAtlasGrowthGraph(graph);
  const core = model.byId.get("department:MYC");
  const mycologyDescendants = model.nodes.filter((node) =>
    node.rootId === "myc" && node.id !== core.id
  );
  assert.ok(mycologyDescendants.length > 0);
  assert.equal([...model.departmentNodes.keys()].filter((code) => code !== "MYC").length, 8);
  assert.equal(model.morphologyBranches.length, 8);
  assert.ok(Number.isFinite(core.x) && Number.isFinite(core.y));
});


test("fractal growth adds bounded deterministic biological irregularity", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const first = createAtlasGrowthGraph(graph);
  const second = createAtlasGrowthGraph(graph);
  const firstById = new Map(first.nodes.map((node) => [node.id, node]));
  const secondById = new Map(second.nodes.map((node) => [node.id, node]));

  assert.equal(first.nodes.length, second.nodes.length);
  for (const node of first.nodes) {
    const repeated = secondById.get(node.id);
    assert.ok(repeated);
    assert.equal(node.x, repeated.x);
    assert.equal(node.y, repeated.y);
  }

  const parent = firstById.get("department:MIC");
  const children = first.nodes.filter((node) => node.parent === parent.id);
  assert.ok(children.length > 1);
  const angles = children.map((node) => node.angle).sort((a, b) => a - b);
  assert.ok(new Set(angles).size === angles.length);
  assert.ok(children.some((node) => Math.abs(node.growthSector.angularOffset) > 0));
  for (const child of children) {
    const { centerAngle, angularOffset, allocatedSpread } = child.growthSector;
    assert.equal(child.angle, centerAngle + angularOffset);
    assert.ok(Math.abs(angularOffset) <= allocatedSpread * 0.14 + child.growthSector.endpointAdjustment * 0.06 + 1e-12);
  }
  for (const child of children) {
    const distance = Math.hypot(child.x - parent.x, child.y - parent.y);
    assert.ok(Number.isFinite(distance) && distance > 0);
  }
});


test("dense secondary fans receive bounded radial spacing without moving primary anchors", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const model = createAtlasGrowthGraph(graph);
  const byId = model.byId;
  const secondary = model.nodes.filter((node) => node.generation === 2);
  assert.ok(secondary.length > 0);
  assert.ok(secondary.some((node) => node.growthSector.densityScale > 1));
  assert.ok(secondary.some((node) => node.growthSector.angularCrowding > 0));
  for (const node of secondary) {
    const parent = byId.get(node.parent);
    const siblings = model.nodes.filter((candidate) => candidate.parent === parent.id);
    const populationScale = 1 + Math.log2(Math.max(1, siblings.length)) * 0.11;
    const expectedCrowding = Math.max(0, Math.min(1,
      (0.72 - node.growthSector.allocatedSpread) / 0.72
    )) * 0.14;
    const expectedScale = Math.min(1.48, populationScale + expectedCrowding);
    assert.equal(node.growthSector.angularCrowding, expectedCrowding);
    assert.equal(node.growthSector.densityScale, expectedScale);
    assert.ok(node.growthSector.densityScale <= 1.48);
  }
  const primary = model.nodes.filter((node) => node.generation === 1);
  assert.ok(primary.every((node) => node.growthSector.densityScale === 1));
});

test("terminal branch fans expand their angular spread beyond the parent sector", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const model = createAtlasGrowthGraph(graph);
  const byParent = new Map();
  for (const node of model.nodes) {
    if (!node.parent || node.generation < 2 || node.rootId === "myc") continue;
    if (!byParent.has(node.parent)) byParent.set(node.parent, []);
    byParent.get(node.parent).push(node);
  }
  const terminalFans = [...byParent.entries()].filter(([parentId, children]) =>
    children.length >= 3 && children.every((child) =>
      !model.nodes.some((candidate) => candidate.parent === child.id)
    )
  );
  assert.ok(terminalFans.length > 0, "expected at least one terminal fan");
  const expandedFans = terminalFans.filter(([parentId, children]) => {
    const parent = model.byId.get(parentId);
    const angles = children.map((child) => child.angle).sort((a, b) => a - b);
    const span = angles[angles.length - 1] - angles[0];
    return span >= parent.growthSector.allocatedSpread * 1.15;
  });
  assert.equal(expandedFans.length, terminalFans.length,
    "every terminal fan should occupy a visibly wider angular envelope");
});

test("spatial collision candidate indexing is deterministic and prunes distant branches", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const first = createAtlasGrowthModel({ nodes: graph.nodes });
  const second = createAtlasGrowthModel({ nodes: graph.nodes });
  assert.deepEqual(first.collisionCandidateDiagnostics, second.collisionCandidateDiagnostics);
  const metrics = first.collisionCandidateDiagnostics;
  assert.ok(metrics.possibleChecks > 0);
  assert.ok(metrics.candidateChecks >= 0);
  assert.ok(metrics.candidateChecks <= metrics.possibleChecks);
  assert.equal(metrics.excludedChecks, metrics.possibleChecks - metrics.candidateChecks);
  assert.ok(metrics.candidateRatio >= 0 && metrics.candidateRatio <= 1);
  assert.ok(metrics.candidateChecks < metrics.possibleChecks);
});

test("growth model exposes deterministic sibling filament fan diagnostics", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const first = createAtlasGrowthGraph(graph);
  const second = createAtlasGrowthGraph(graph);
  assert.ok(first.fanDiagnostics.length > 0);
  assert.deepEqual(first.fanDiagnostics, second.fanDiagnostics);
  for (const fan of first.fanDiagnostics) {
    assert.ok(fan.siblingCount >= 1);
    assert.ok(Number.isInteger(fan.crossingCount));
    assert.ok(fan.crossingCount >= 0);
    if (fan.siblingCount > 1) {
      assert.ok(Number.isFinite(fan.minimumClearance));
      // A zero minimum is valid when the separate crossing diagnostic records an intersection.
      assert.ok(fan.minimumClearance >= 0);
    } else {
      assert.equal(fan.minimumClearance, null);
    }
  }
});

test("sibling curve correction remains bounded and deterministic", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const first = createAtlasGrowthModel({ nodes: graph.nodes });
  const second = createAtlasGrowthModel({ nodes: graph.nodes });
  const branchesById = new Map(first.branches.map((branch) => [branch.id, branch]));
  const repeatedById = new Map(second.branches.map((branch) => [branch.id, branch]));
  assert.equal(first.branches.length, second.branches.length);
  for (const branch of first.branches) {
    const repeated = repeatedById.get(branch.id);
    assert.ok(repeated);
    assert.equal(branch.bendScale, repeated.bendScale);
    assert.equal(branch.curveAdjustmentAttempts, repeated.curveAdjustmentAttempts);
    assert.equal(branch.crowdingAdjustmentAttempts, repeated.crowdingAdjustmentAttempts);
    assert.ok(branch.bendScale >= 0.2 && branch.bendScale <= 1);
    assert.ok(branch.curveAdjustmentAttempts >= 0 && branch.curveAdjustmentAttempts <= 8);
    assert.ok(branch.crowdingAdjustmentAttempts >= 0 &&
      branch.crowdingAdjustmentAttempts <= branch.curveAdjustmentAttempts);
    assert.equal(branch.crossGenerationChecked, true);
    assert.ok(branchesById.has(branch.id));
  }
  for (const fan of first.fanDiagnostics) {
    assert.ok(Number.isInteger(fan.adjustedBranchCount));
    assert.ok(fan.adjustedBranchCount >= 0 && fan.adjustedBranchCount <= fan.siblingCount);
  }
  assert.deepEqual(first.crossGenerationDiagnostics, second.crossGenerationDiagnostics);
  assert.ok(Number.isInteger(first.crossGenerationDiagnostics.comparedPairs));
  assert.ok(Number.isInteger(first.crossGenerationDiagnostics.broadPhaseRejectedPairs));
  assert.ok(Number.isInteger(first.crossGenerationDiagnostics.narrowPhasePairs));
  assert.equal(
    first.crossGenerationDiagnostics.comparedPairs,
    first.crossGenerationDiagnostics.broadPhaseRejectedPairs +
      first.crossGenerationDiagnostics.narrowPhasePairs
  );
  assert.ok(first.crossGenerationDiagnostics.broadPhaseRejectedPairs >= 0);
  assert.ok(Number.isInteger(first.crossGenerationDiagnostics.crossingCount));
  assert.ok(first.crossGenerationDiagnostics.crossingCount >= 0);
  assert.ok(Number.isInteger(first.crossGenerationDiagnostics.nearMissCount));
  assert.ok(first.crossGenerationDiagnostics.nearMissCount >= 0);
  assert.equal(first.crossGenerationDiagnostics.clearanceThreshold, 18);
  assert.ok(
    first.crossGenerationDiagnostics.minimumClearance === null ||
    (Number.isFinite(first.crossGenerationDiagnostics.minimumClearance) &&
      first.crossGenerationDiagnostics.minimumClearance >= 0)
  );
});


test("growth model rejects duplicate node identities before parent indexing", () => {
  const graph = buildAcademyGraph(catalogueMap, [], cataloguePathways);
  const duplicate = { ...graph.nodes[0], name: "duplicate identity" };
  assert.throws(
    () => createAtlasGrowthModel({ nodes: [...graph.nodes, duplicate] }),
    /duplicate node id/
  );
});

test("growth model rejects missing or non-string node identities", () => {
  assert.throws(
    () => createAtlasGrowthModel({ nodes: [{ parent: null }] }),
    /non-empty string id/
  );
  assert.throws(
    () => createAtlasGrowthModel({ nodes: [{ id: 42, parent: null }] }),
    /non-empty string id/
  );
});
