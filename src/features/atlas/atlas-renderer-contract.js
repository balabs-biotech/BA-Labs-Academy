/**
 * Backend-neutral lifecycle contract for the Academy Atlas renderer.
 *
 * A backend factory asynchronously creates an implementation exposing:
 * render(frame), resize(width, height), dispose(), and capabilities.
 */
export function createAtlasRendererHost({ backendFactory, canvas }) {
  if (typeof backendFactory !== "function") {
    throw new TypeError("An Atlas renderer backend factory is required");
  }

  let state = "idle";
  let backend = null;
  let initialization = null;

  async function initialize() {
    if (state === "ready") return api;
    if (state === "initializing") return initialization;
    if (state === "disposed") throw new Error("Atlas renderer host is disposed");

    state = "initializing";
    initialization = Promise.resolve()
      .then(() => backendFactory(canvas))
      .then((instance) => {
        if (!instance || typeof instance.render !== "function" ||
            typeof instance.resize !== "function" || typeof instance.dispose !== "function") {
          instance?.dispose?.();
          throw new TypeError("Atlas renderer backend does not satisfy the renderer contract");
        }
        if (state === "disposed") {
          instance.dispose();
          return false;
        }
        backend = instance;
        state = "ready";
        return api;
      })
      .catch((error) => {
        if (state !== "disposed") state = "failed";
        initialization = null;
        throw error;
      });

    return initialization;
  }

  function render(frame) {
    if (state !== "ready") return false;
    backend.render(frame);
    return true;
  }

  function resize(width, height) {
    if (state !== "ready") return false;
    backend.resize(width, height);
    return true;
  }

  function dispose() {
    if (state === "disposed") return false;
    state = "disposed";
    const current = backend;
    backend = null;
    current?.dispose();
    return true;
  }

  const api = {
    initialize,
    render,
    resize,
    dispose,
    get state() { return state; },
    get capabilities() { return backend?.capabilities ?? null; }
  };

  return api;
}
