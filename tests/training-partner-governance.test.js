import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const migration=await readFile(new URL("../supabase/migrations/20261122017000_academy_training_partner_agreement_governance_v1.sql",import.meta.url),"utf8");
test("partner and agreement writes are Owner/Admin-only and audited",()=>{assert.match(migration,/academy_assert_role\(array\['OWNER','ADMIN'\]\)/);assert.match(migration,/TRAINING_PARTNER/);assert.match(migration,/TRAINING_AGREEMENT/);});
test("partner activation requires approval evidence and defined scope",()=>{assert.match(migration,/approval_number is null/);assert.match(migration,/cardinality\(approved_specialties\)=0/);assert.match(migration,/approval_valid_until/);});
test("agreement activation requires active partner, signature and permitted scope",()=>{assert.match(migration,/a\.signed_at is not null/);assert.match(migration,/cardinality\(a\.permitted_venues\)>0/);assert.match(migration,/p\.status='ACTIVE'/);});
test("only authenticated clients may invoke partner agreement RPCs",()=>{assert.match(migration,/revoke all on function public\.academy_save_training_partner/);assert.match(migration,/grant execute on function public\.academy_save_training_agreement/);});
