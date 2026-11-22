/**
 * Owns the lifetime of Pixi label display objects.
 * The pool is stable across frames; visibility is reconciled per frame.
 */
export function createAtlasLabelResources({ container, createLabel }) {
  if (!container || typeof container.addChild !== "function") {
    throw new TypeError("A label container is required");
  }
  if (typeof createLabel !== "function") {
    throw new TypeError("A label factory is required");
  }

  const pool = new Map();
  const live = new Set();
  let disposed = false;

  function get(id, node, style) {
    if (disposed) throw new Error("Atlas label resources are disposed");
    let label = pool.get(id);
    if (!label) {
      label = createLabel(node, style);
      pool.set(id, label);
      container.addChild(label);
    }
    return label;
  }

  function beginFrame() {
    if (disposed) return;
    live.clear();
  }

  function markVisible(id) {
    if (!disposed) live.add(id);
  }

  function endFrame() {
    if (disposed) return;
    for (const [id, label] of pool) {
      label.visible = live.has(id);
    }
  }

  function clear() {
    if (disposed) return;
    disposed = true;
    live.clear();
    for (const label of pool.values()) {
      if (label.parent === container && typeof container.removeChild === "function") {
        container.removeChild(label);
      }
      if (typeof label.destroy === "function") label.destroy();
    }
    pool.clear();
  }

  return {
    get size() { return pool.size; },
    get disposed() { return disposed; },
    get,
    beginFrame,
    markVisible,
    endFrame,
    clear
  };
}
