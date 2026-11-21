import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261122014000_academy_training_operations_schema_v1.sql", import.meta.url), "utf8");

test("training operations are separated from learning paths and content", () => {
  for (const table of ["academy_training_offerings","academy_training_sessions","academy_training_enrollments","academy_training_attendance"]) {
    assert.match(migration, new RegExp("create table if not exists public\\." + table));
  }
  assert.match(migration, /academy_training_offerings[\\s\\S]*delivery_regime/);
});

test("training regimes encode private, partner and approved-establishment routes", () => {
  assert.match(migration, /PRIVATE_WORKSHOP/);
  assert.match(migration, /PARTNER_DELIVERED/);
  assert.match(migration, /APPROVED_ESTABLISHMENT/);
  assert.match(migration, /partner_id is not null and agreement_id is not null/);
});

test("private BA Labs attestations cannot be confused with state-recognized certificates", () => {
  assert.match(migration, /PARTICIPATION_ATTESTATION/);
  assert.match(migration, /PRACTICAL_COMPLETION_ATTESTATION/);
  assert.match(migration, /INTERNAL_ASSESSMENT_RECORD/);
  assert.match(migration, /STATE_RECOGNIZED_CERTIFICATE/);
  assert.match(migration, /document_type='STATE_RECOGNIZED_CERTIFICATE' and issuer_kind in \\('APPROVED_PARTNER','PUBLIC_AUTHORITY'\\)/);
});

test("training records are private and browser writes are revoked", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\\.%I from anon, authenticated/);
  assert.match(migration, /Academy editorial members can read training operations/);
  assert.match(migration, /Learners can read own training enrollment/);
});

test("billing stores accounting references rather than replacing accounting", () => {
  assert.match(migration, /external_invoice_reference/);
  assert.match(migration, /amount_minor_units/);
  assert.match(migration, /currency_code char\\(3\\)/);
});
