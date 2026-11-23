import test from "node:test";
import assert from "node:assert/strict";
import { createAtlasRendererSupervisor } from "../../src/features/atlas/engine/rendering/renderer-supervisor.js";

function backend(overrides = {}) {
  const calls = { render: 0, resize: 0, dispose: 0 };
  return {
    calls,
    capabilities: { backend: "fake" },
    render() { calls.render += 1; },
    resize() { calls.resize += 1; },
    dispose() { calls.dispose += 1; },
    ...overrides
  };
}

test("supervisor coalesces initialization and exposes backend capabilities", async () => {
  let factories = 0;
  const instance = backend();
  const supervisor = createAtlasRendererSupervisor({
    backendFactory: async () => { factories += 1; await Promise.resolve(); return instance; }
  });
  const [first, second] = await Promise.all([supervisor.initialize(), supervisor.initialize()]);
  assert.equal(first, supervisor);
  assert.equal(second, supervisor);
  assert.equal(factories, 1);
  assert.equal(supervisor.state, "ready");
  assert.deepEqual(supervisor.capabilities, { backend: "fake" });
});

test("runtime render and resize failures dispose backend and preserve last good scene", async () => {
  const errors = [];
  const instance = backend({
    render() { this.calls.render += 1; if (this.calls.render > 1) throw new Error("render crash"); },
    resize() { throw new Error("resize crash"); }
  });
  const supervisor = createAtlasRendererSupervisor({
    backendFactory: () => instance,
    onError: (error) => errors.push(error.message)
  });
  await supervisor.initialize();
  const scene = { version: 1 };
  assert.equal(supervisor.render(scene, { scale: 1 }), true);
  assert.equal(supervisor.lastScene, scene);
  assert.equal(supervisor.render({ version: 2 }), false);
  assert.equal(supervisor.state, "failed");
  assert.equal(supervisor.lastScene, scene);
  assert.equal(instance.calls.dispose, 1);
  assert.deepEqual(errors, ["render crash"]);
});

test("failed initialization can be retried and resize failure is supervised", async () => {
  let attempts = 0;
  const errors = [];
  const good = backend({ resize() { throw new Error("resize crash"); } });
  const supervisor = createAtlasRendererSupervisor({
    backendFactory: () => {
      attempts += 1;
      if (attempts === 1) throw new Error("init crash");
      return good;
    },
    onError: (error) => errors.push(error.message)
  });
  await assert.rejects(supervisor.initialize(), /init crash/);
  assert.equal(supervisor.state, "failed");
  await supervisor.initialize();
  assert.equal(supervisor.resize(800, 600), false);
  assert.equal(supervisor.state, "failed");
  assert.equal(good.calls.dispose, 1);
  assert.deepEqual(errors, ["init crash", "resize crash"]);
});

test("dispose during asynchronous initialization tears down the late backend", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const instance = backend();
  const supervisor = createAtlasRendererSupervisor({ backendFactory: () => pending });
  const initializing = supervisor.initialize();
  assert.equal(supervisor.state, "initializing");
  supervisor.dispose();
  release(instance);
  assert.equal(await initializing, false);
  assert.equal(supervisor.state, "disposed");
  assert.equal(instance.calls.dispose, 1);
  assert.equal(supervisor.dispose(), false);
});

test("supervisor rejects malformed contracts and calls after disposal", async () => {
  const supervisor = createAtlasRendererSupervisor({ backendFactory: () => ({ render() {} }) });
  await assert.rejects(supervisor.initialize(), /render, resize and dispose/);
  assert.equal(supervisor.state, "failed");
  supervisor.dispose();
  await assert.rejects(supervisor.initialize(), /disposed/);
  assert.equal(supervisor.render({}), false);
});
