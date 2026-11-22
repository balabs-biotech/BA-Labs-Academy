import test from "node:test";
import assert from "node:assert/strict";
import { getAtlasConnectionCurveForEdge } from "../src/features/atlas/atlas-connections.js";

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
