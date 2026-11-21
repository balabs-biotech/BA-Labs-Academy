import test from "node:test";
import assert from "node:assert/strict";
import { buildPathwayItems } from "../src/features/editorial/pathways.js";

const existingItems = [
  { id: "step-a", content_id: "content-a", is_required: true },
  { id: "step-b", content_id: "content-b", is_required: false },
  { id: "step-c", content_id: "content-c", is_required: true }
];
const existingPrerequisites = [
  { path_id: "path-1", item_id: "step-b", prerequisite_item_id: "step-a" },
  { path_id: "path-1", item_id: "step-c", prerequisite_item_id: "step-b" }
];

test("pathway editor preserves prerequisite links and optional steps", () => {
  assert.deepEqual(
    buildPathwayItems(["content-a", "content-b", "content-c"], existingItems, existingPrerequisites),
    [
      { content_id: "content-a", is_required: true, prerequisites: [] },
      { content_id: "content-b", is_required: false, prerequisites: ["content-a"] },
      { content_id: "content-c", is_required: true, prerequisites: ["content-b"] }
    ]
  );
});

test("removed resources are also removed from prerequisite references", () => {
  assert.deepEqual(
    buildPathwayItems(["content-a", "content-c"], existingItems, existingPrerequisites),
    [
      { content_id: "content-a", is_required: true, prerequisites: [] },
      { content_id: "content-c", is_required: true, prerequisites: [] }
    ]
  );
});

test("new resources default to required and keep the submitted sequence", () => {
  assert.deepEqual(
    buildPathwayItems(["content-z", "content-y"], [], []),
    [
      { content_id: "content-z", is_required: true, prerequisites: [] },
      { content_id: "content-y", is_required: true, prerequisites: [] }
    ]
  );
});
