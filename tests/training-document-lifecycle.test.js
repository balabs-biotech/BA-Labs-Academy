import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261122016000_academy_training_document_lifecycle_v1.sql", import.meta.url), "utf8");
const data = await readFile(new URL("../src/data.js", import.meta.url), "utf8");

test("document issuance is limited to completed enrollments with validated attendance", () => {
  assert.match(migration, /enrollment_status<>'COMPLETED'/);
  assert.match(migration, /At least one validated attendance record is required/);
});

test("private workshop issuance cannot produce partner or state certificates", () => {
  assert.match(migration, /PRIVATE_WORKSHOP/);
  assert.match(migration, /PARTICIPATION_ATTESTATION/);
  assert.match(migration, /PRACTICAL_COMPLETION_ATTESTATION/);
  assert.match(migration, /Private BA Labs workshops can issue participation or practical completion attestations only/);
});

test("QR token is random, hashed at rest and returned only once", () => {
  assert.match(migration, /extensions\.gen_random_bytes\(32\)/);
  assert.match(migration, /extensions\.digest\(t,'sha256'\)/);
  assert.match(migration, /'verification_token',t/);
  assert.doesNotMatch(migration, /verification_token\s*=\s*t/);
});

test("public verification returns a minimal non-identifying result", () => {
  assert.match(migration, /academy_verify_training_document/);
  assert.match(migration, /verification_status/);
  assert.doesNotMatch(migration, /participant_email/);
  assert.doesNotMatch(migration, /participant_name/);
  assert.match(migration, /to anon,authenticated/);
});

test("revocation is Owner/Admin-only and audited", () => {
  assert.match(migration, /academy_assert_role\(array\['OWNER','ADMIN'\]\)/);
  assert.match(migration, /'REVOKED'/);
  assert.match(migration, /revocation_reason/);
});

test("frontend exposes controlled issue, revoke and public verification calls", () => {
  assert.match(data, /issueTrainingDocument/);
  assert.match(data, /revokeTrainingDocument/);
  assert.match(data, /verifyTrainingDocument/);
  assert.match(data, /academy_verify_training_document/);
});
