import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const engine=await readFile(new URL("../supabase/migrations/20261121223000_academy_assessment_certification_engine_v1.sql",import.meta.url),"utf8");
const hardening=await readFile(new URL("../supabase/migrations/20261121230000_academy_assessment_rpc_hardening_v1.sql",import.meta.url),"utf8");
const main=await readFile(new URL("../src/main.js",import.meta.url),"utf8");
const data=await readFile(new URL("../src/data.js",import.meta.url),"utf8");
test("assessment answer keys are not readable from browser roles",()=>{
 assert.match(engine,/revoke all on public\.academy_assessment_answer_keys from public,anon,authenticated/i);
 assert.match(engine,/academy_submit_assessment/);
 assert.match(engine,/academy_assessment_answer_keys k/);
});
test("assessment attempts are server-graded and versioned",()=>{
 assert.match(engine,/assessment_version/);
 assert.match(engine,/academy_start_assessment/);
 assert.match(hardening,/v_score:=round/);
 assert.match(hardening,/v_passed:=v_score>=v_assessment\.pass_score/);
 assert.match(hardening,/status='EXPIRED'/);
});
test("assessment payload validation rejects null, duplicate and foreign answers",()=>{
 assert.match(hardening,/coalesce\\(jsonb_typeof\\(p_answers\\),''\\)<>'array'/);
 assert.match(hardening,/Duplicate question answer/);
 assert.match(hardening,/option outside its question/);
});
test("path certificates require completed mandatory steps and passed required assessments",()=>{
 assert.match(engine,/academy_issue_path_certificate/);
 assert.match(engine,/Required learning steps remain incomplete/);
 assert.match(engine,/Required assessment results are missing or below threshold/);
 assert.match(engine,/academy_verify_certificate/);
});
test("learner UI starts assessments, submits answers and verifies certificates",()=>{
 assert.match(main,/function assessmentDetail/);
 assert.match(main,/submitAssessment\(/);
 assert.match(main,/issuePathCertificate\(/);
 assert.match(main,/verifyCertificate\(/);
 assert.match(data,/export function startAssessment/);
 assert.match(data,/export function submitAssessment/);
});
