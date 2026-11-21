/** Owns browser resources created by one Atlas mount. */
export function createAtlasLifecycle() {
  let disposed = false;
  const cleanups = [];
  const add = (cleanup) => {
    if (typeof cleanup !== "function") throw new TypeError("Atlas cleanup must be a function");
    if (disposed) { cleanup(); return cleanup; }
    cleanups.push(cleanup);
    return cleanup;
  };
  return {
    get disposed() { return disposed; },
    add,
    listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      return add(() => target.removeEventListener(type, handler, options));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const errors = [];
      while (cleanups.length) {
        try { cleanups.pop()(); } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, "One or more Atlas resources failed to clean up");
    }
  };
}
