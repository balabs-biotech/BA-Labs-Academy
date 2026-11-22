import test from "node:test";
import assert from "node:assert/strict";
import { ATLAS_GEOMETRY, ATLAS_GOLDEN_RATIO, createAtlasDepartmentLayout, createAtlasChildSectors, getAtlasRootPosition, getAtlasChildPosition, getAtlasNestedBranchSpread, getAtlasGoldenConnectionProfile } from "../src/features/atlas/atlas-geometry.js";

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
    parent: { x: 1450, y: 0 }, index: 0, count: 5, depth: 1,
    branchAngle: 0, isDepartmentRoot: true
  });
  assert.ok(point.x > 1450);
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
  assert.ok(layout.spreads.INF / layout.sectorWidths.INF >= 0.97);
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
  assert.ok(angles[7] - angles[0] >= 5.7, "terminal modules have a substantially wider lateral spread");
  assert.ok(Math.abs(Math.hypot(points[7].x, points[7].y) - ATLAS_GEOMETRY.childDistances[2]) < 1e-8, "terminal radius follows the golden ratio");
  assert.ok(Math.abs(Math.hypot(points[0].x, points[0].y) - ATLAS_GEOMETRY.childDistances[2]) < 1e-8);
});

test("intermediate and terminal fans use wider angular spacing", () => {
  const parent = { x: 0, y: 0 };
  const intermediate = Array.from({ length: 5 }, (_, index) => getAtlasChildPosition({
    parent, index, count: 5, depth: 1, branchAngle: 0
  }));
  const terminal = Array.from({ length: 6 }, (_, index) => getAtlasChildPosition({
    parent, index, count: 6, depth: 2, branchAngle: 0
  }));
  const spreadOf = (points) => Math.atan2(points.at(-1).y, points.at(-1).x) -
    Math.atan2(points[0].y, points[0].x);
  assert.ok(spreadOf(intermediate) >= 3.4);
  assert.ok(spreadOf(terminal) >= 4.8);
  assert.ok(Math.abs(ATLAS_GEOMETRY.childDistances[2] - ATLAS_GEOMETRY.childDistances[1] / ATLAS_GOLDEN_RATIO) < 1e-8);
  assert.equal(ATLAS_GEOMETRY.departmentOrbitRadius, 1450);
  assert.equal(ATLAS_GEOMETRY.pathwayOrbitRadius, 1650);
});


test("nested branch fans inherit the angular sector of their parent", () => {
  const spread = getAtlasNestedBranchSpread(3.2, 6);
  assert.ok(spread > 0.35 && spread < 0.7, "a section receives only its local share of the department sector");
  const parent = { x: 0, y: 0 };
  const points = Array.from({ length: 8 }, (_, index) => getAtlasChildPosition({
    parent, index, count: 8, depth: 2, branchAngle: 0, branchSpread: spread
  }));
  const angles = points.map((point) => Math.atan2(point.y, point.x));
  assert.ok(angles.at(-1) - angles[0] <= spread + 1e-10);
});

test("Mycology full-ring children receive separate downstream wedges", () => {
  const spread = getAtlasNestedBranchSpread(Math.PI * 2, 8, true);
  assert.ok(Math.abs(spread - (Math.PI * 2 / 8) / ATLAS_GOLDEN_RATIO) < 1e-10);
});


test("intermediate branch levels are separated by expanded radial distances", () => {
  const parent = { x: 0, y: 0 };
  const section = getAtlasChildPosition({
    parent, index: 0, count: 4, depth: 1, branchAngle: 0, branchSpread: 2.4
  });
  const module = getAtlasChildPosition({
    parent: section, index: 0, count: 5, depth: 2, branchAngle: section.angle, branchSpread: 0.5
  });
  assert.equal(Math.hypot(section.x, section.y), ATLAS_GEOMETRY.childDistances[1]);
  assert.ok(Math.abs(Math.hypot(module.x - section.x, module.y - section.y) - ATLAS_GEOMETRY.childDistances[2]) < 1e-8);
  assert.equal(ATLAS_GEOMETRY.childDistances[1], 820);
  assert.ok(Math.abs(ATLAS_GEOMETRY.childDistances[2] - ATLAS_GEOMETRY.childDistances[1] / ATLAS_GOLDEN_RATIO) < 1e-8);
});

test("Atlas branch sectors use the golden ratio to preserve visible guard space", () => {
  const sectors = createAtlasChildSectors([
    { children: Array(8).fill({}) },
    { children: Array(3).fill({}) },
    { children: Array(1).fill({}) }
  ], 3.6, 0, false);
  assert.equal(sectors.length, 3);
  const totalAllocated = sectors.reduce((sum, sector) => sum + sector.spread, 0);
  assert.ok(Math.abs(totalAllocated / 3.6 - 1 / ATLAS_GOLDEN_RATIO) < 1e-10);
  assert.ok(sectors[0].spread > sectors[1].spread);
  assert.ok(sectors[1].spread > sectors[2].spread);
});


test("branch curve control points advance source-to-target and do not create a reversed S bend", async () => {
  const { createAtlasConnectionCurve, getAtlasConnectionCurvePoint } = await import("../src/features/atlas/atlas-curve.js");
  const a = { id: "section", x: 0, y: 0 };
  const b = { id: "module", x: 470, y: 120 };
  for (let seed = 0; seed < 32; seed += 1) {
    const curve = createAtlasConnectionCurve(a, b, { seed, depth: 2 });
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    const tx = dx / length, ty = dy / length;
    const nx = -ty, ny = tx;
    const c1Progress = ((curve.c1.x - a.x) * tx + (curve.c1.y - a.y) * ty) / length;
    const c2Progress = ((curve.c2.x - a.x) * tx + (curve.c2.y - a.y) * ty) / length;
    assert.ok(c1Progress < c2Progress, "first control point must precede the second");
    const firstSide = (curve.c1.x - a.x) * nx + (curve.c1.y - a.y) * ny;
    const secondSide = (curve.c2.x - a.x) * nx + (curve.c2.y - a.y) * ny;
    assert.ok(firstSide * secondSide > 0, "both controls must remain on the same side of the branch");
    let previous = 0;
    for (let step = 1; step <= 20; step += 1) {
      const point = getAtlasConnectionCurvePoint(curve, step / 20);
      const progress = ((point.x - a.x) * tx + (point.y - a.y) * ty) / length;
      assert.ok(progress > previous, "curve must not reverse along its branch");
      previous = progress;
    }
  }
});

test("branch connections follow golden-ratio control points, curvature and stroke hierarchy", () => {
  const profile = getAtlasGoldenConnectionProfile(1000, 2);
  assert.ok(Math.abs(profile.controlPointRatio - 1 / ATLAS_GOLDEN_RATIO) < 1e-10);
  assert.ok(Math.abs(profile.bend - 1000 / (ATLAS_GOLDEN_RATIO ** 2)) < 1e-10);
  assert.ok(Math.abs(profile.width - 1.5 / ATLAS_GOLDEN_RATIO) < 1e-10);
});
