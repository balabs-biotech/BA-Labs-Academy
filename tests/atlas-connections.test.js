import test from "node:test";
import assert from "node:assert/strict";
import { getAtlasConnectionCurveForEdge } from "../src/features/atlas/atlas-connections.js";
import { createAtlasConnectionCurve } from "../src/features/atlas/atlas-curve.js";

function makeEdge() {
  return {
    a: { id: "node-a", x: 10, y: 20, level: 1 },
    b: { id: "node-b", x: 210, y: 120, level: 2 },
    seed: 12345,
    basis: "academy-pathway-flow"
  };
}

test("connection curve geometry is reused while edge inputs remain stable", () => {
  const edge = makeEdge();
  const first = getAtlasConnectionCurveForEdge(edge, 2, false);
  const second = getAtlasConnectionCurveForEdge(edge, 2, false);
  assert.strictEqual(second, first);
});

test("connection curve cache invalidates when endpoint coordinates change", () => {
  const edge = makeEdge();
  const first = getAtlasConnectionCurveForEdge(edge, 2, false);
  edge.b.x += 25;
  const second = getAtlasConnectionCurveForEdge(edge, 2, false);
  assert.notStrictEqual(second, first);
  assert.equal(second.b.x, edge.b.x);
});

test("connection curve cache invalidates when endpoint objects are replaced", () => {
  const edge = makeEdge();
  const first = getAtlasConnectionCurveForEdge(edge, 2, false);
  edge.a = { ...edge.a };
  const second = getAtlasConnectionCurveForEdge(edge, 2, false);
  assert.notStrictEqual(second, first);
  assert.strictEqual(second.a, edge.a);
});

test("connection curve cache invalidates when endpoint identifiers change", () => {
  const edge = makeEdge();
  const first = getAtlasConnectionCurveForEdge(edge, 2, false);
  edge.a.id = "renamed-node";
  const second = getAtlasConnectionCurveForEdge(edge, 2, false);
  assert.notStrictEqual(second, first);
});

test("connection curve cache invalidates when seed, depth or pathway profile changes", () => {
  const edge = makeEdge();
  const first = getAtlasConnectionCurveForEdge(edge, 2, false);
  edge.seed += 1;
  const seeded = getAtlasConnectionCurveForEdge(edge, 2, false);
  const deeper = getAtlasConnectionCurveForEdge(edge, 3, false);
  const pathway = getAtlasConnectionCurveForEdge(edge, 3, true);
  assert.notStrictEqual(seeded, first);
  assert.notStrictEqual(deeper, seeded);
  assert.notStrictEqual(pathway, deeper);
});


test("recursive branch curvature tapers with hierarchy depth", () => {
  const a = { id: "parent", x: 0, y: 0 };
  const b = { id: "child", x: 300, y: 0 };
  const primary = createAtlasConnectionCurve(a, b, { seed: 17, depth: 1 });
  const secondary = createAtlasConnectionCurve(a, b, { seed: 17, depth: 2 });
  const tertiary = createAtlasConnectionCurve(a, b, { seed: 17, depth: 3 });
  const primaryBend = Math.abs(primary.c1.y);
  const secondaryBend = Math.abs(secondary.c1.y);
  const tertiaryBend = Math.abs(tertiary.c1.y);
  assert.ok(primaryBend > secondaryBend);
  assert.ok(secondaryBend > tertiaryBend);
  assert.ok(Math.abs(secondaryBend / primaryBend - 1 / Math.sqrt(2)) < 0.001);
  assert.ok(Math.abs(tertiaryBend / primaryBend - 1 / Math.sqrt(3)) < 0.001);
});


test("narrow hierarchy sectors constrain lateral curve excursions", () => {
  const a = { id: "parent", x: 0, y: 0 };
  const b = { id: "child", x: 300, y: 0 };
  const broad = createAtlasConnectionCurve(a, b, { seed: 17, bendScale: 1 });
  const narrow = createAtlasConnectionCurve(a, b, { seed: 17, bendScale: 0.35 });
  assert.ok(Math.abs(narrow.c1.y) < Math.abs(broad.c1.y));
  assert.ok(Math.abs(narrow.c2.y) < Math.abs(broad.c2.y));
  assert.ok(Math.abs(narrow.c1.y / broad.c1.y - 0.35) < 0.001);
});
