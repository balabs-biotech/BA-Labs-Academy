import test from "node:test";
import assert from "node:assert/strict";
import { buildAcademyGraph } from "../src/features/atlas/atlas-graph.js";
import { ATLAS_GEOMETRY } from "../src/features/atlas/atlas-geometry.js";

test("academy graph retains growth metadata while using organic department anchors", () => {
  const departments = [
    { code: "MYC", title: "Mycology", sections: [{ code: "MYC-A", title: "A", modules: ["A1", "A2"] }] },
    { code: "BIO", title: "Biology", sections: [{ code: "BIO-A", title: "A", modules: ["A1", "A2", "A3"] }] },
    { code: "AGR", title: "Soils", sections: [{ code: "AGR-A", title: "A", modules: ["A1"] }] }
  ];
  const graph = buildAcademyGraph(departments, [], []);
  const bio = graph.departmentNodes.get("BIO");
  const myc = graph.departmentNodes.get("MYC");
  assert.ok(Number.isFinite(bio.growthSector.angle));
  assert.ok(Number.isFinite(bio.angle));
  assert.ok(bio.growthSector.spread > 0 && bio.growthSector.spread < Math.PI * 2);
  assert.equal(bio.growthSector.fullRing, false);
  assert.equal(myc.growthSector.spread, Math.PI * 2);
  assert.equal(myc.growthSector.fullRing, true);
  assert.ok(Number.isFinite(bio.x) && Number.isFinite(bio.y));
  assert.ok(Math.hypot(bio.x, bio.y) > 100, "organic engine positions the department in the biological field");
});
