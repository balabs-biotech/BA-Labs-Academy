import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261122014500_academy_training_document_issuer_guard_v1.sql", import.meta.url), "utf8");

test("document issuer is validated against the actual training regime", () => {
  assert.match(migration, /academy_validate_training_document_issuer/);
  assert.match(migration, /PRIVATE_WORKSHOP/);
  assert.match(migration, /BA_LABS_PRIVATE/);
  assert.match(migration, /PARTNER_DELIVERED/);
  assert.match(migration, /APPROVED_ESTABLISHMENT/);
});

test("partner documents require active approval, agreement, specialty, venue and delivery mode scope", () => {
  for (const rule of ["v_partner_status<>'ACTIVE'","v_agreement_status<>'ACTIVE'","v_partner_approval is null","v_specialty=any","v_venue=any","v_mode=any"]) {
    assert.ok(migration.includes(rule), "Missing issuer safeguard: " + rule);
  }
  assert.match(migration, /outside the approved agreement scope/);
  assert.match(migration, /Training venue is not authorized/);
});

test("document issuer guard is enforced by a database trigger", () => {
  assert.match(migration, /before insert or update of enrollment_id,document_type,issuer_kind,issuer_reference/i);
  assert.match(migration, /academy_training_document_issuer_guard/);
});
