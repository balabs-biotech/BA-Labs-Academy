import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const main=await readFile(new URL("../src/main.js",import.meta.url),"utf8");
const data=await readFile(new URL("../src/data.js",import.meta.url),"utf8");
const migration=await readFile(new URL("../supabase/migrations/20261122017000_academy_training_partner_agreement_governance_v1.sql",import.meta.url),"utf8");
test("Owner/Admin can draft partner and agreement references",()=>{assert.match(main,/training-partner-form/);assert.match(main,/training-agreement-form/);assert.match(data,/saveTrainingPartner/);assert.match(data,/saveTrainingAgreement/);});
test("partner and agreement activation is explicit and role-gated in SQL",()=>{assert.match(main,/data-training-reference-status/);assert.match(migration,/academy_assert_role\(array\['OWNER','ADMIN'\]\)/);assert.match(migration,/Partner approval evidence, validity and scope are required/);});
test("agreement scope includes venues, specialties and delivery modes",()=>{assert.match(main,/permitted_specialties/);assert.match(main,/permitted_venues/);assert.match(main,/permitted_delivery_modes/);assert.match(migration,/cardinality\(a\.permitted_specialties\)>0/);});
