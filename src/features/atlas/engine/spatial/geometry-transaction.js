function assertFunction(value, name) {
  if (typeof value !== "function") throw new TypeError(name + " must be a function");
}

/**
 * Synchronous atomic publication of derived geometry.
 * Failed builds/validation never replace the last valid snapshot.
 */
export function createGeometryTransaction({
  initialState = null,
  build,
  validate = () => true
} = {}) {
  assertFunction(build, "build");
  assertFunction(validate, "validate");

  let state = initialState;
  let revision = initialState === null ? 0 : 1;
  let dirty = initialState === null;
  let destroyed = false;
  let building = false;
  let invalidationReason = initialState === null ? "uninitialized" : null;

  const snapshot = () => Object.freeze({
    state,
    revision,
    dirty,
    invalidationReason,
    destroyed
  });

  return {
    getSnapshot: snapshot,

    invalidate(reason = "unspecified") {
      if (destroyed) return snapshot();
      dirty = true;
      invalidationReason = String(reason);
      return snapshot();
    },

    recalculate(input) {
      if (destroyed) return { ok: false, reason: "destroyed", snapshot: snapshot() };
      if (building) return { ok: false, reason: "reentrant-build", snapshot: snapshot() };

      building = true;
      try {
        const candidate = build(input, state);
        if (candidate === undefined) throw new TypeError("Geometry builder returned undefined");
        const accepted = validate(candidate, input, state);
        if (accepted !== true) {
          throw new Error(typeof accepted === "string" ? accepted : "Geometry validation rejected candidate");
        }

        if (destroyed) return { ok: false, reason: "destroyed", snapshot: snapshot() };

        // Commit only after the complete candidate has passed validation.
        state = candidate;
        revision += 1;
        dirty = false;
        invalidationReason = null;
        return { ok: true, snapshot: snapshot() };
      } catch (error) {
        dirty = true;
        invalidationReason = "recalculation-failed";
        return { ok: false, reason: "recalculation-failed", error, snapshot: snapshot() };
      } finally {
        building = false;
      }
    },

    destroy() {
      if (destroyed) return snapshot();
      destroyed = true;
      dirty = false;
      invalidationReason = null;
      return snapshot();
    }
  };
}
