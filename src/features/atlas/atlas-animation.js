/**
 * Owns the requestAnimationFrame lifecycle for the Atlas camera/render loop.
 * Camera interpolation and drawing are injected so scheduling can be tested
 * without a browser, canvas, or PixiJS runtime.
 */
export function createAtlasAnimation({
  enabled = true,
  requestFrame,
  cancelFrame,
  onFrame
}) {
  if (typeof requestFrame !== "function") throw new TypeError("Atlas animation requires requestFrame");
  if (typeof cancelFrame !== "function") throw new TypeError("Atlas animation requires cancelFrame");
  if (typeof onFrame !== "function") throw new TypeError("Atlas animation requires onFrame");

  let running = false;
  let disposed = false;
  let frameId = null;

  const tick = () => {
    frameId = null;
    if (!running || disposed) return;
    const shouldContinue = onFrame();
    if (!running || disposed) return;
    if (shouldContinue === false) {
      stop();
      return;
    }
    frameId = requestFrame(tick);
  };

  function stop() {
    if (!running) return false;
    running = false;
    if (frameId !== null) cancelFrame(frameId);
    frameId = null;
    return true;
  }

  return {
    get running() { return running; },
    get disposed() { return disposed; },
    start() {
      if (!enabled || running || disposed) return false;
      running = true;
      frameId = requestFrame(tick);
      return true;
    },
    stop,
    dispose() {
      if (disposed) return;
      stop();
      disposed = true;
    }
  };
}
