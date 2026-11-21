import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const sql=await readFile(new URL("../supabase/migrations/20261122015500_academy_training_lifecycle_controls_v1.sql",import.meta.url),"utf8");
test("training registration email must match authenticated identity",()=>assert.match(sql,/Registration email must match the authenticated account/));
test("only Owner and Admin can activate or close training records",()=>assert.match(sql,/academy_assert_role\(array\['OWNER','ADMIN'\]\)/));
test("partner regime requires current approval before offering activation",()=>assert.match(sql,/Partner approval and agreement must be active and valid to activate offering/));
test("sessions can open only after offering activation",()=>assert.match(sql,/Session requires an active offering/));
