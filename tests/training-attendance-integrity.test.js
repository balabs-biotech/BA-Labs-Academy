import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const migration=await readFile(new URL("../supabase/migrations/20261122017500_academy_training_attendance_evidence_integrity_v1.sql",import.meta.url),"utf8");
test("completion requires presence on every calendar day",()=>{assert.match(migration,/generate_series\(first_day,last_day,interval '1 day'\)/);assert.match(migration,/count\\(\\*\\) from expected/);assert.match(migration,/count\\(\\*\\) from validated/);});
test("documents cannot be issued without complete attendance evidence",()=>{assert.match(migration,/academy_training_document_evidence_guard/);assert.match(migration,/academy_training_attendance_complete\(new\.enrollment_id\)/);});
test("attendance is immutable after completion or active document issuance",()=>{assert.match(migration,/academy_training_attendance_immutability_guard/);assert.match(migration,/v_old_status='COMPLETED'/);assert.match(migration,/revoked_at is null/);});
test("integrity helpers are not directly executable by browser roles",()=>{assert.match(migration,/revoke all on function public\.academy_training_attendance_complete\(uuid\) from public,anon,authenticated/);});
