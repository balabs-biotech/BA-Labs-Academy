function report(onError, error, state) {
  try { onError(error, { state }); } catch { /* Error reporting must not break renderer recovery. */ }
}

function validateBackend(instance) {
  if (!instance || typeof instance.render !== "function" ||
      typeof instance.resize !== "function" || typeof instance.dispose !== "function") {
    instance?.dispose?.();
    throw new TypeError("Renderer backend must expose render, resize and dispose");
  }
}

/** Supervises backend lifecycle and converts runtime failures into an explicit failed state. */
export function createAtlasRendererSupervisor({ backendFactory, canvas, onError = () => {} } = {}) {
  if (typeof backendFactory !== "function") throw new TypeError("A renderer backend factory is required");
  if (typeof onError !== "function") throw new TypeError("onError must be a function");

  let state = "idle";
  let backend = null;
  let initialization = null;
  let generation = 0;
  let lastScene = null;
  let lastError = null;

  function fail(error) {
    lastError = error;
    state = "failed";
    const current = backend;
    backend = null;
    try { current?.dispose(); } catch (disposeError) { report(onError, disposeError, state); }
    report(onError, error, state);
  }

  function initialize() {
    if (state === "ready") return Promise.resolve(api);
    if (state === "initializing") return initialization;
    if (state === "disposed") return Promise.reject(new Error("Renderer supervisor is disposed"));

    state = "initializing";
    const ticket = ++generation;
    initialization = Promise.resolve()
      .then(() => backendFactory(canvas))
      .then((instance) => {
        validateBackend(instance);
        if (state === "disposed" || ticket !== generation) {
          instance.dispose();
          return false;
        }
        backend = instance;
        state = "ready";
        lastError = null;
        return api;
      })
      .catch((error) => {
        if (state !== "disposed" && ticket === generation) fail(error);
        throw error;
      })
      .finally(() => {
        if (ticket === generation) initialization = null;
      });
    return initialization;
  }

  function render(scene, camera) {
    if (state !== "ready") return false;
    try {
      backend.render(scene, camera);
      lastScene = scene;
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  function resize(width, height) {
    if (state !== "ready") return false;
    try {
      backend.resize(width, height);
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  function dispose() {
    if (state === "disposed") return false;
    state = "disposed";
    generation += 1;
    const current = backend;
    backend = null;
    try { current?.dispose(); } catch (error) { report(onError, error, state); }
    return true;
  }

  const api = {
    initialize,
    render,
    resize,
    dispose,
    get state() { return state; },
    get capabilities() { return backend?.capabilities ?? null; },
    get lastScene() { return lastScene; },
    get lastError() { return lastError; }
  };
  return api;
}
