import test from "node:test";
import assert from "node:assert/strict";
import { getAtlasFocusScale } from "../src/features/atlas/atlas-camera.js";

test("focus camera fits a department's immediate fractal generation on mobile and desktop", () => {
  const mobile = getAtlasFocusScale(1250, 390, 600);
  const desktop = getAtlasFocusScale(1250, 1440, 774);
  assert.ok(Math.abs(mobile - (390 * 0.34 / 1250)) < 1e-10);
  assert.ok(Math.abs(desktop - (774 * 0.34 / 1250)) < 1e-10);
  assert.ok(desktop > mobile, "larger stages should expose a proportionally wider branch field");
});

test("focus camera clamps tiny or invalid branch distances safely", () => {
  assert.equal(getAtlasFocusScale(0, 390, 600), 12);
  assert.equal(getAtlasFocusScale(-10, 390, 600), 12);
  assert.equal(getAtlasFocusScale(1e9, 390, 600), 0.075);
});

import { atlasScreenPoint, fitAtlasCamera } from "../src/features/atlas/atlas-camera.js";

test("overview camera fits department anchors and their first-generation branch tips", () => {
  const anchors = [
    { x: -1900, y: -1200 },
    { x: 1900, y: -1200 },
    { x: -1900, y: 1200 },
    { x: 1900, y: 1200 },
    { x: 0, y: 0 }
  ];
  for (const viewport of [{ width: 1440, height: 648 }, { width: 390, height: 560 }]) {
    const camera = fitAtlasCamera(anchors, viewport.width, viewport.height);
    assert.ok(camera, "overview camera should be available");
    for (const node of anchors) {
      const point = atlasScreenPoint(node, { ...viewport, ...camera });
      assert.ok(point.x >= 0 && point.x <= viewport.width,
        "all first-generation branch tips must remain inside the horizontal viewport");
      assert.ok(point.y >= 0 && point.y <= viewport.height,
        "all first-generation branch tips must remain inside the vertical viewport");
    }
  }
});

test("overview camera uses substantially more of the stage without clipping first-generation anchors", () => {
  const anchors = [
    { x: -1900, y: -1200 },
    { x: 1900, y: -1200 },
    { x: -1900, y: 1200 },
    { x: 1900, y: 1200 },
    { x: 0, y: 0 }
  ];
  const legacyFitScale = (width, height) => {
    const mobile = width < 700;
    const padX = mobile ? 26 : Math.min(150, Math.max(72, width * 0.11));
    const padY = mobile ? 42 : Math.min(125, Math.max(70, height * 0.13));
    return Math.min(
      (width - padX * 2) / (3800 + 230),
      (height - padY * 2) / (2400 + 220)
    );
  };
  for (const viewport of [{ width: 1440, height: 648 }, { width: 390, height: 560 }]) {
    const camera = fitAtlasCamera(anchors, viewport.width, viewport.height);
    assert.ok(camera.scale > legacyFitScale(viewport.width, viewport.height) * (viewport.width < 700 ? 1.05 : 1.15),
      "overview must visibly increase constellation occupancy");
    for (const node of anchors) {
      const point = atlasScreenPoint(node, { ...viewport, ...camera });
      assert.ok(point.x >= 0 && point.x <= viewport.width, "anchor must remain horizontally visible");
      assert.ok(point.y >= 0 && point.y <= viewport.height, "anchor must remain vertically visible");
    }
  }
});
