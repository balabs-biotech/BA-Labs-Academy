import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const engine=await readFile(new URL("../supabase/migrations/20261121223000_academy_assessment_certification_engine_v1.sql",import.meta.url),"utf8");
const hardening=await readFile(new URL("../supabase/migrations/20261121230000_academy_assessment_rpc_hardening_v1.sql",import.meta.url),"utf8");
const linkHardening=await readFile(new URL("../supabase/migrations/20261121233000_academy_path_assessment_link_validation_v1.sql",import.meta.url),"utf8");
const answerKeyPolicy=await readFile(new URL("../supabase/migrations/20261121231500_academy_assessment_editor_answer_key_access_v1.sql",import.meta.url),"utf8");
const auditMigration=await readFile(new URL("../supabase/migrations/20261121234500_academy_audit_vocabulary_and_certificate_events_v1.sql",import.meta.url),"utf8");
const main=await readFile(new URL("../src/main.js",import.meta.url),"utf8");
const data=await readFile(new URL("../src/data.js",import.meta.url),"utf8");
test("assessment answer keys are hidden from learners and visible only to editorial members",()=>{
 assert.match(engine,/revoke all on public\.academy_assessment_answer_keys from public,anon,authenticated/i);
 assert.match(answerKeyPolicy,/academy_is_editorial_member/);
 assert.match(answerKeyPolicy,/grant select on public\.academy_assessment_answer_keys to authenticated/);\n assert.match(auditMigration,/MEMBER_CREATED/);\n assert.match(auditMigration,/ASSESSMENT_PUBLISHED/);\n assert.match(auditMigration,/CERTIFICATE_ISSUED/);
});
test("assessment attempts are server-graded and versioned",()=>{
 assert.match(engine,/assessment_version/);
 assert.match(engine,/academy_start_assessment/);
 assert.match(hardening,/v_score:=round/);
 assert.match(hardening,/v_passed:=v_score>=v_assessment\.pass_score/);
 assert.match(hardening,/status='EXPIRED'/);
});
test("assessment payload validation rejects null, duplicate and foreign answers",()=>{
 assert.match(hardening,/coalesce\(jsonb_typeof\(p_answers\),''\)<>'array'/);
 assert.match(hardening,/Duplicate question answer/);
 assert.match(hardening,/option outside its question/);
});
test("path certificates require completed mandatory steps and passed required assessments",()=>{
 assert.match(engine,/academy_issue_path_certificate/);
 assert.match(engine,/Required learning steps remain incomplete/);
 assert.match(engine,/Required assessment results are missing or below threshold/);
 assert.match(engine,/academy_verify_certificate/);
 assert.match(linkHardening,/visibility='PUBLIC'/);
 assert.match(linkHardening,/coalesce\(jsonb_typeof\(p_requirements\),''\)<>'array'/);
});
test("learner and editorial UIs manage assessments and certificates",()=>{
 assert.match(main,/function assessmentDetail/);
 assert.match(main,/submitAssessment\(/);
 assert.match(main,/issuePathCertificate\(/);
 assert.match(main,/verifyCertificate\(/);
 assert.match(main,/function assessmentEditorView/);
 assert.match(main,/savePathAssessments\(pathId,requirements\)/);
 assert.match(data,/export function startAssessment/);
 assert.match(data,/export function submitAssessment/);
 assert.match(data,/academy_assessment_answer_keys/);
});
