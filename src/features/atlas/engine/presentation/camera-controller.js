function assertPositive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(name + " must be positive");
}

function validateBounds(bounds) {
  if (bounds === null) return null;
  if (!bounds || !["minX", "minY", "maxX", "maxY"].every((key) => Number.isFinite(bounds[key]))) {
    throw new TypeError("Camera bounds must contain finite minX, minY, maxX and maxY");
  }
  if (bounds.maxX < bounds.minX || bounds.maxY < bounds.minY) {
    throw new RangeError("Camera bounds must have non-negative dimensions");
  }
  return Object.freeze({ minX: bounds.minX, minY: bounds.minY, maxX: bounds.maxX, maxY: bounds.maxY });
}

/** Renderer-independent camera with cursor-anchored zoom and bounded panning. */
export function createAtlasCameraController({
  viewportWidth,
  viewportHeight,
  bounds = null,
  minScale = 0.08,
  maxScale = 4,
  fitPadding = 0.12,
  minVisibleRatio = 0.18
} = {}) {
  assertPositive(viewportWidth, "viewportWidth");
  assertPositive(viewportHeight, "viewportHeight");
  assertPositive(minScale, "minScale");
  assertPositive(maxScale, "maxScale");
  if (maxScale < minScale) throw new RangeError("maxScale must be greater than or equal to minScale");
  if (!Number.isFinite(fitPadding) || fitPadding < 0 || fitPadding >= 0.5) {
    throw new RangeError("fitPadding must be in [0, 0.5)");
  }
  if (!Number.isFinite(minVisibleRatio) || minVisibleRatio <= 0 || minVisibleRatio > 1) {
    throw new RangeError("minVisibleRatio must be in (0, 1]");
  }

  let viewport = { width: viewportWidth, height: viewportHeight };
  let worldBounds = validateBounds(bounds);
  let x = 0;
  let y = 0;
  let scale = 1;

  function constrain() {
    if (!worldBounds) return;
    const minVisibleX = viewport.width * minVisibleRatio;
    const minVisibleY = viewport.height * minVisibleRatio;
    const lowX = minVisibleX - worldBounds.maxX * scale;
    const highX = viewport.width - minVisibleX - worldBounds.minX * scale;
    const lowY = minVisibleY - worldBounds.maxY * scale;
    const highY = viewport.height - minVisibleY - worldBounds.minY * scale;
    x = lowX <= highX ? Math.min(highX, Math.max(lowX, x)) : (lowX + highX) / 2;
    y = lowY <= highY ? Math.min(highY, Math.max(lowY, y)) : (lowY + highY) / 2;
  }

  function snapshot() {
    return Object.freeze({
      x, y, scale,
      viewport: Object.freeze({ ...viewport }),
      bounds: worldBounds ? Object.freeze({ ...worldBounds }) : null,
      minScale,
      maxScale
    });
  }

  function fit(padding = fitPadding) {
    if (!Number.isFinite(padding) || padding < 0 || padding >= 0.5) {
      throw new RangeError("fit padding must be in [0, 0.5)");
    }
    if (!worldBounds) {
      x = viewport.width / 2;
      y = viewport.height / 2;
      scale = 1;
      return snapshot();
    }
    const width = Math.max(1e-6, worldBounds.maxX - worldBounds.minX);
    const height = Math.max(1e-6, worldBounds.maxY - worldBounds.minY);
    const availableWidth = viewport.width * (1 - 2 * padding);
    const availableHeight = viewport.height * (1 - 2 * padding);
    scale = Math.min(maxScale, Math.max(minScale, Math.min(availableWidth / width, availableHeight / height)));
    x = viewport.width / 2 - ((worldBounds.minX + worldBounds.maxX) / 2) * scale;
    y = viewport.height / 2 - ((worldBounds.minY + worldBounds.maxY) / 2) * scale;
    constrain();
    return snapshot();
  }

  function setViewport(width, height) {
    assertPositive(width, "viewport width");
    assertPositive(height, "viewport height");
    viewport = { width, height };
    constrain();
    return snapshot();
  }

  function setBounds(nextBounds, { refit = false } = {}) {
    worldBounds = validateBounds(nextBounds);
    if (refit) return fit();
    constrain();
    return snapshot();
  }

  function panBy(deltaX, deltaY) {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
      throw new TypeError("Camera pan deltas must be finite");
    }
    x += deltaX;
    y += deltaY;
    constrain();
    return snapshot();
  }

  function zoomAt(factor, point) {
    assertPositive(factor, "zoom factor");
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new TypeError("Zoom anchor must be a finite screen point");
    }
    const nextScale = Math.min(maxScale, Math.max(minScale, scale * factor));
    const worldX = (point.x - x) / scale;
    const worldY = (point.y - y) / scale;
    scale = nextScale;
    x = point.x - worldX * scale;
    y = point.y - worldY * scale;
    constrain();
    return snapshot();
  }

  function worldToScreen(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new TypeError("World point must be finite");
    }
    return Object.freeze({ x: point.x * scale + x, y: point.y * scale + y });
  }

  function screenToWorld(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new TypeError("Screen point must be finite");
    }
    return Object.freeze({ x: (point.x - x) / scale, y: (point.y - y) / scale });
  }

  function reset() {
    return fit();
  }

  fit();
  return Object.freeze({
    getSnapshot: snapshot,
    setViewport,
    setBounds,
    fit,
    panBy,
    zoomAt,
    worldToScreen,
    screenToWorld,
    reset
  });
}
