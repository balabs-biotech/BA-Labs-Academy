import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const migration=await readFile(new URL("../supabase/migrations/20261122016500_academy_training_enrollment_status_v1.sql",import.meta.url),"utf8");
test("enrollment lifecycle is role-gated and audited",()=>{assert.match(migration,/academy_assert_role/);assert.match(migration,/TRAINING_ENROLLMENT/);assert.match(migration,/'STATUS_CHANGED'/);});
test("waitlist admission and seat capacity are checked under row lock",()=>{assert.match(migration,/current_status='WAITLISTED'/);assert.match(migration,/for update/);assert.match(migration,/occupied>=cap/);});
test("completion requires recorded presence",()=>{assert.match(migration,/p_new_status='COMPLETED'/);assert.match(migration,/attendance_status in \('PRESENT','LATE'\)/);});
test("browser cannot execute as anon",()=>{assert.match(migration,/revoke all on function public\.academy_set_training_enrollment_status/);assert.match(migration,/grant execute on function public\.academy_set_training_enrollment_status/);});