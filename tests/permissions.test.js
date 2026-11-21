import test from "node:test";
import assert from "node:assert/strict";
import { getRoleCapabilities, hasEditorialAccess } from "../src/core/permissions.js";

test("only active Academy memberships unlock editorial access", () => {
  assert.equal(hasEditorialAccess({ role: "EDITOR", membership_status: "ACTIVE" }), true);
  assert.equal(hasEditorialAccess({ role: "EDITOR", membership_status: "SUSPENDED" }), false);
  assert.equal(hasEditorialAccess(null), false);
});

test("editorial capabilities match the database role guards", () => {
  assert.deepEqual(getRoleCapabilities("EDITOR"), ["CREATE_CONTENT", "EDIT_CONTENT", "SUBMIT_REVIEW"]);
  assert.deepEqual(getRoleCapabilities("REVIEWER"), ["REVIEW_CONTENT"]);
  assert.equal(getRoleCapabilities("ADMIN").includes("PUBLISH_CONTENT"), true);
  assert.equal(getRoleCapabilities("OWNER").includes("MANAGE_MEMBERS"), true);
});

test("unknown roles receive no capabilities", () => {
  assert.deepEqual(getRoleCapabilities("SUPERUSER"), []);
  assert.equal(hasEditorialAccess({ role: "SUPERUSER", membership_status: "ACTIVE" }), false);
});
