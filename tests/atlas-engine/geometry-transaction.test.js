import test from "node:test";
import assert from "node:assert/strict";
import { createGeometryTransaction } from "../../src/features/atlas/engine/spatial/geometry-transaction.js";

test("geometry commits only fully built and validated candidates", () => {
  const transaction = createGeometryTransaction({
    build: (input) => ({ points: input.points }),
    validate: (candidate) => candidate.points.length > 0
  });
  const first = transaction.recalculate({ points: [1, 2] });
  assert.equal(first.ok, true);
  assert.equal(first.snapshot.revision, 1);
  assert.deepEqual(first.snapshot.state, { points: [1, 2] });

  const failed = transaction.recalculate({ points: [] });
  assert.equal(failed.ok, false);
  assert.equal(failed.snapshot.revision, 1);
  assert.deepEqual(failed.snapshot.state, { points: [1, 2] });
  assert.equal(failed.snapshot.dirty, true);
});

test("build exceptions retain the last valid snapshot and can recover", () => {
  const transaction = createGeometryTransaction({
    build: (input) => {
      if (input.fail) throw new Error("synthetic geometry failure");
      return { version: input.version };
    }
  });
  assert.equal(transaction.recalculate({ version: 1 }).ok, true);
  const failed = transaction.recalculate({ fail: true });
  assert.equal(failed.ok, false);
  assert.match(failed.error.message, /synthetic/);
  assert.deepEqual(failed.snapshot.state, { version: 1 });
  const recovered = transaction.recalculate({ version: 2 });
  assert.equal(recovered.ok, true);
  assert.deepEqual(recovered.snapshot.state, { version: 2 });
  assert.equal(recovered.snapshot.revision, 2);
});

test("invalidation is explicit and destroy is idempotent and terminal", () => {
  const transaction = createGeometryTransaction({
    initialState: { stable: true },
    build: (input) => input
  });
  assert.equal(transaction.getSnapshot().dirty, false);
  assert.equal(transaction.invalidate("camera-independent topology changed").dirty, true);
  assert.equal(transaction.destroy().destroyed, true);
  assert.equal(transaction.destroy().destroyed, true);
  assert.equal(transaction.recalculate({ stable: false }).reason, "destroyed");
  assert.deepEqual(transaction.getSnapshot().state, { stable: true });
});

test("reentrant geometry builds are rejected without replacing the current state", () => {
  let transaction;
  transaction = createGeometryTransaction({
    initialState: { version: 0 },
    build: (input) => {
      if (input.reenter) {
        assert.equal(transaction.recalculate({ version: 99 }).reason, "reentrant-build");
      }
      return { version: input.version };
    }
  });
  const result = transaction.recalculate({ version: 1, reenter: true });
  assert.equal(result.ok, true);
  assert.deepEqual(result.snapshot.state, { version: 1 });
});
