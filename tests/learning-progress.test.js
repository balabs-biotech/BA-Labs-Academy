import test from "node:test";
import assert from "node:assert/strict";
import { buildPathProgress, resolvePathItems } from "../src/features/learning/progress.js";

const items = [
  { id: "item-a", content_id: "content-a", sort_order: 1, is_required: true },
  { id: "item-b", content_id: "content-b", sort_order: 2, is_required: true },
  { id: "item-c", content_id: "content-c", sort_order: 3, is_required: false }
];

test("path progress counts completed required resources only", () => {
  const progress = buildPathProgress(items, [
    { path_item_id: "item-a", progress_status: "COMPLETED", progress_percent: 100 },
    { path_item_id: "item-c", progress_status: "COMPLETED", progress_percent: 100 }
  ]);
  assert.deepEqual(progress, {
    completedRequired: 1,
    totalRequired: 2,
    percent: 50,
    isComplete: false
  });
});

test("path is complete only when every required item is completed", () => {
  const progress = buildPathProgress(items, [
    { path_item_id: "item-a", progress_status: "COMPLETED" },
    { path_item_id: "item-b", progress_status: "COMPLETED" }
  ]);
  assert.equal(progress.percent, 100);
  assert.equal(progress.isComplete, true);
});

test("path with no required items is not falsely reported complete", () => {
  const progress = buildPathProgress(items.filter((item) => !item.is_required), []);
  assert.deepEqual(progress, {
    completedRequired: 0,
    totalRequired: 0,
    percent: 0,
    isComplete: false
  });
});

test("sequence resolves prerequisites and locks inaccessible items", () => {
  const prerequisites = [
    { item_id: "item-b", prerequisite_item_id: "item-a" },
    { item_id: "item-c", prerequisite_item_id: "item-b" }
  ];
  const result = resolvePathItems(items, prerequisites, []);
  assert.equal(result[0].isLocked, false);
  assert.equal(result[1].isLocked, true);
  assert.deepEqual(result[1].missingPrerequisiteIds, ["item-a"]);
  assert.equal(result[2].isLocked, true);
  assert.deepEqual(result[2].missingPrerequisiteIds, ["item-b"]);
});

test("completed prerequisites unlock the next item", () => {
  const prerequisites = [{ item_id: "item-b", prerequisite_item_id: "item-a" }];
  const result = resolvePathItems(items, prerequisites, [
    { path_item_id: "item-a", progress_status: "COMPLETED" }
  ]);
  assert.equal(result[1].isLocked, false);
  assert.deepEqual(result[1].missingPrerequisiteIds, []);
});

test("sequence order is stable and missing progress defaults to not started", () => {
  const unordered = [items[2], items[0], items[1]];
  const result = resolvePathItems(unordered, [], []);
  assert.deepEqual(result.map((item) => item.id), ["item-a", "item-b", "item-c"]);
  assert.equal(result[0].progressStatus, "NOT_STARTED");
});
