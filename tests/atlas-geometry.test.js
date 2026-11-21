import test from "node:test";
import assert from "node:assert/strict";
import { ATLAS_GEOMETRY, getAtlasRootPosition, getAtlasChildPosition } from "../src/features/atlas/atlas-geometry.js";

test("Mycology is fixed at the Atlas origin", () => {
  assert.deepEqual(getAtlasRootPosition({ kind: "department", code: "MYC" }), {
    x: 0, y: 0, angle: -Math.PI / 2
  });
});

test("eight satellite departments occupy equal 45-degree intervals", () => {
  const codes = ["MIC", "BIO", "AGR", "BPR", "BMT", "PHY", "INF", "GEN"];
  const points = codes.map((code) => getAtlasRootPosition({
    kind: "department", code, departmentCodes: codes
  }));
  points.forEach((point) => {
    assert.ok(Math.abs(Math.hypot(point.x, point.y) - ATLAS_GEOMETRY.departmentOrbitRadius) < 1e-8);
  });
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const gap = (next.angle - point.angle + Math.PI * 2) % (Math.PI * 2);
    assert.ok(Math.abs(gap - Math.PI / 4) < 1e-10);
  });
});

test("pathways occupy a distinct orbit and interleave department anchors", () => {
  const codes = Array.from({ length: 10 }, (_, index) => `PATH-${index}`);
  const points = codes.map((code) => getAtlasRootPosition({
    kind: "pathway", code, pathwayCodes: codes
  }));
  points.forEach((point) => {
    assert.ok(Math.abs(Math.hypot(point.x, point.y) - ATLAS_GEOMETRY.pathwayOrbitRadius) < 1e-8);
  });
  assert.ok(Math.abs(points[0].angle + Math.PI / 2 + Math.PI / 10) < 1e-10);
});

test("Mycology sections distribute around a complete ring without duplicate endpoint", () => {
  const parent = { x: 0, y: 0 };
  const points = Array.from({ length: 6 }, (_, index) => getAtlasChildPosition({
    parent, index, count: 6, depth: 1, branchAngle: 0, isMycologyCore: true
  }));
  const gaps = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return Math.atan2(next.y, next.x) - Math.atan2(point.y, point.x);
  });
  gaps.forEach((gap) => assert.ok(Math.abs(gap - Math.PI / 3) < 1e-10));
});

test("department petals remain narrow and point outward", () => {
  const point = getAtlasChildPosition({
    parent: { x: 1850, y: 0 }, index: 0, count: 5, depth: 1,
    branchAngle: 0, isDepartmentRoot: true
  });
  assert.ok(point.x > 1850);
  assert.ok(Math.abs(point.angle) <= ATLAS_GEOMETRY.departmentPetalSpread / 2);
});
