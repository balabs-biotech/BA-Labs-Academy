import test from "node:test";
import assert from "node:assert/strict";
import { inspectPublicText } from "../scripts/public-bundle-guard.js";

test("public publishable configuration is not classified as a privileged secret", () => {
  assert.deepEqual(
    inspectPublicText('export const KEY = "sb_publishable_example_value";'),
    []
  );
});

test("service-role environment variable markers are rejected", () => {
  assert.equal(
    inspectPublicText("SUPABASE_SERVICE_ROLE_KEY = process.env.SECRET").length,
    1
  );
});

test("service-role JWT payloads are rejected", () => {
  const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.signaturevalue123456`;
  assert.equal(inspectPublicText(token)[0]?.label, "Supabase service-role JWT");
});

test("private key blocks are rejected", () => {
  assert.equal(
    inspectPublicText("-----BEGIN PRIVATE KEY-----\nredacted\n-----END PRIVATE KEY-----").length,
    1
  );
});
