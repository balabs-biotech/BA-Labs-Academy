import test from "node:test";
import assert from "node:assert/strict";
import { buildAcademyGraph } from "../src/features/atlas/atlas-graph.js";
import { ATLAS_GEOMETRY } from "../src/features/atlas/atlas-geometry.js";

test("academy graph exports each department's reserved growth sector without changing its anchor", () => {
  const departments = [
    { code: "MYC", title: "Mycology", sections: [{ code: "MYC-A", title: "A", modules: ["A1", "A2"] }] },
    { code: "BIO", title: "Biology", sections: [{ code: "BIO-A", title: "A", modules: ["A1", "A2", "A3"] }] },
    { code: "AGR", title: "Soils", sections: [{ code: "AGR-A", title: "A", modules: ["A1"] }] }
  ];
  const graph = buildAcademyGraph(departments, [], []);
  const bio = graph.departmentNodes.get("BIO");
  const myc = graph.departmentNodes.get("MYC");
  assert.equal(bio.growthSector.angle, bio.angle);
  assert.ok(bio.growthSector.spread > 0 && bio.growthSector.spread < Math.PI);
  assert.equal(bio.growthSector.fullRing, false);
  assert.equal(myc.growthSector.spread, Math.PI * 2);
  assert.equal(myc.growthSector.fullRing, true);
  assert.ok(Math.abs(bio.x - Math.cos(bio.angle) * ATLAS_GEOMETRY.departmentOrbitRadius) < 1e-9);
  assert.ok(Math.abs(bio.y - Math.sin(bio.angle) * ATLAS_GEOMETRY.departmentOrbitRadius) < 1e-9);
});
