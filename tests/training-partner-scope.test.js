import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const migration=await readFile(new URL("../supabase/migrations/20261122017500_academy_training_partner_scope_integrity_v1.sql",import.meta.url),"utf8");
test("partner training scope validates specialty against approval and agreement",()=>{assert.match(migration,/specialty_code=any\(v_partner\.approved_specialties\)/);assert.match(migration,/specialty_code=any\(v_agreement\.permitted_specialties\)/);});
test("session scope validates venue and delivery mode",()=>{assert.match(migration,/venue_code=any\(v_agreement\.permitted_venues\)/);assert.match(migration,/delivery_mode=any\(v_partner\.approved_delivery_modes\)/);assert.match(migration,/delivery_mode=any\(v_agreement\.permitted_delivery_modes\)/);});
test("session dates must remain inside approval and agreement validity",()=>{assert.match(migration,/approval_valid_until/);assert.match(migration,/valid_until/);assert.match(migration,/Africa\/Algiers/);});
test("scope guards are database triggers and helper is not callable by clients",()=>{assert.match(migration,/academy_training_offering_scope_guard/);assert.match(migration,/academy_training_session_scope_guard/);assert.match(migration,/revoke all on function public\.academy_validate_training_delivery_scope\(\) from public,anon,authenticated/);});
