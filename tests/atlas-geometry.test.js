import test from "node:test";
import assert from "node:assert/strict";
import { ATLAS_GEOMETRY, createAtlasDepartmentLayout, getAtlasRootPosition, getAtlasChildPosition } from "../src/features/atlas/atlas-geometry.js";

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
  assert.ok(Math.abs(points[0].angle + Math.PI / 2 - Math.PI / 10) < 1e-10);
});

test("Mycology sections distribute around a complete ring without duplicate endpoint", () => {
  const parent = { x: 0, y: 0 };
  const points = Array.from({ length: 6 }, (_, index) => getAtlasChildPosition({
    parent, index, count: 6, depth: 1, branchAngle: 0, isMycologyCore: true
  }));
  const gaps = points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return (Math.atan2(next.y, next.x) - Math.atan2(point.y, point.x) + Math.PI * 2) % (Math.PI * 2);
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


test("department sectors expand according to real branch complexity", () => {
  const departments = [
    { code: "MIC", sections: Array.from({ length: 5 }, () => ({ modules: Array(5).fill("m") })) },
    { code: "BPR", sections: Array.from({ length: 4 }, () => ({ modules: Array(6).fill("m") })) },
    { code: "GEN", sections: Array.from({ length: 6 }, () => ({ modules: Array(6).fill("m") })) },
    { code: "INF", sections: Array.from({ length: 7 }, () => ({ modules: Array(7).fill("m") })) }
  ];
  const layout = createAtlasDepartmentLayout(departments);
  assert.ok(layout.spreads.GEN > layout.spreads.BPR);
  assert.ok(layout.spreads.INF > layout.spreads.GEN);
  assert.ok(layout.sectorWidths.INF > layout.spreads.INF, "a guard band remains between neighboring sectors");
  const positions = departments.map((department) => getAtlasRootPosition({
    kind: "department",
    code: department.code,
    departmentCodes: departments.map((item) => item.code),
    departmentLayout: layout
  }));
  positions.forEach((position) => {
    assert.ok(Math.abs(Math.hypot(position.x, position.y) - ATLAS_GEOMETRY.departmentOrbitRadius) < 1e-8);
  });
});

test("large terminal module groups receive a wider fan and greater radial separation", () => {
  const parent = { x: 0, y: 0 };
  const points = Array.from({ length: 8 }, (_, index) => getAtlasChildPosition({
    parent, index, count: 8, depth: 2, branchAngle: 0
  }));
  const angles = points.map((point) => Math.atan2(point.y, point.x));
  assert.ok(angles[7] - angles[0] >= 2.2, "terminal modules have a wider lateral spread");
  assert.ok(Math.abs(Math.hypot(points[7].x, points[7].y) - 380) < 1e-8, "terminal orbit radius remains unchanged");
  assert.ok(Math.abs(Math.hypot(points[0].x, points[0].y) - 380) < 1e-8);
});
