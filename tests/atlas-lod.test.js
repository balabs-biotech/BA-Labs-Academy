import test from "node:test";
import assert from "node:assert/strict";
import { getAtlasLevelAlpha } from "../src/features/atlas/atlas-lod.js";

test("overview LOD reveals secondary and tertiary hierarchy generations", () => {
  const overviewScale = 0.15;
  assert.equal(getAtlasLevelAlpha(0, overviewScale), 1);
  assert.ok(getAtlasLevelAlpha(2, overviewScale) > 0.9,
    "secondary branches must be visible at overview scale");
  assert.ok(getAtlasLevelAlpha(3, overviewScale) > 0.5,
    "tertiary branches must remain visible at overview scale");
  assert.ok(getAtlasLevelAlpha(4, overviewScale) > 0,
    "fourth-generation structure should begin to emerge");
  assert.equal(getAtlasLevelAlpha(5, overviewScale), 0,
    "deep detail must remain suppressed until zoomed in");
});

test("overview LOD is monotonic with zoom and fades deeper generations progressively", () => {
  const overview = [1, 2, 3, 4, 5].map((level) => getAtlasLevelAlpha(level, 0.15));
  const zoomed = [1, 2, 3, 4, 5].map((level) => getAtlasLevelAlpha(level, 0.6));
  assert.ok(overview.every((alpha, index) => index === 0 || alpha <= overview[index - 1]));
  assert.ok(zoomed.every((alpha, index) => index === 0 || alpha <= zoomed[index - 1]));
  assert.ok(zoomed.every((alpha, index) => alpha >= overview[index]));
});
