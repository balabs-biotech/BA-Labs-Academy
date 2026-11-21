import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const sql=await readFile(new URL("../supabase/migrations/20261122015000_academy_training_operations_rpc_v1.sql",import.meta.url),"utf8");
test("training offering and session changes require editorial roles and active partner scope",()=>{
 assert.match(sql,/academy_assert_role\(array\['OWNER','ADMIN','EDITOR'\]\)/);
 assert.match(sql,/Active matching partner and agreement required/);
 assert.match(sql,/Partner approval and agreement must be active and in date/);
});
test("self-enrollment is authenticated, capacity-aware and serialized on the session row",()=>{
 assert.match(sql,/academy_enroll_training_session/);
 assert.match(sql,/for update/);
 assert.match(sql,/WAITLISTED/);
 assert.match(sql,/Registration is closed/);
});
test("attendance changes are role-gated and restricted to session dates",()=>{
 assert.match(sql,/academy_record_training_attendance/);
 assert.match(sql,/Attendance date is outside the session/);
 assert.match(sql,/on conflict\(enrollment_id,training_date\) do update/);
});
test("RPC access is revoked from anonymous users",()=>{
 assert.equal((sql.match(/from public,anon/g)||[]).length,4);
});
