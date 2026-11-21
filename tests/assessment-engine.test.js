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
 assert.match(answerKeyPolicy,/grant select on public\.academy_assessment_answer_keys to authenticated/);
 assert.match(auditMigration,/MEMBER_CREATED/);
 assert.match(auditMigration,/ASSESSMENT_PUBLISHED/);
 assert.match(auditMigration,/CERTIFICATE_ISSUED/);
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

const competencyGraph=await readFile(new URL("../supabase/migrations/20261122010000_academy_competency_evidence_graph_v1.sql",import.meta.url),"utf8");
const competencyAtlas=await readFile(new URL("../supabase/migrations/20261122011000_academy_competency_atlas_anchor_integrity_v1.sql",import.meta.url),"utf8");
const competencyPrerequisites=await readFile(new URL("../supabase/migrations/20261122012000_academy_competency_prerequisite_graph_v1.sql",import.meta.url),"utf8");
test("competencies can be anchored to multiple domains and assessments",()=>{
 assert.match(competencyGraph,/academy_competency_domains/);
 assert.match(competencyGraph,/academy_save_competency_domains/);
 assert.match(competencyGraph,/academy_assessment_competencies/);
 assert.match(competencyGraph,/academy_save_assessment_competencies/);
});
test("assessment submission creates append-only learner competency evidence",()=>{
 assert.match(competencyGraph,/academy_competency_evidence/);
 assert.match(competencyGraph,/evidence_status/);
 assert.match(competencyGraph,/insert into public\.academy_competency_evidence/);
 assert.match(competencyGraph,/security_invoker=true/);
});
test("editorial UI configures disciplinary anchors and assessment competency thresholds",()=>{
 assert.match(main,/data-competency-domain/);
 assert.match(main,/saveCompetencyDomains\(id, domainCodes\)/);
 assert.match(main,/data-assessment-competency/);
 assert.match(main,/saveAssessmentCompetencies\(id,competencyMappings\)/);
 assert.match(data,/export function saveCompetencyDomains/);
 assert.match(data,/export function saveAssessmentCompetencies/);
});

test("competency disciplinary anchors synchronize to Atlas and are required for publication",()=>{
 assert.match(competencyAtlas,/relation_type=''BELONGS_TO''/);
 assert.match(competencyAtlas,/At least one disciplinary domain anchor is required/);
});

test("competency prerequisites are cycle-checked and represented in Atlas",()=>{
 assert.match(competencyPrerequisites,/academy_competency_prerequisites/);
 assert.match(competencyPrerequisites,/Competency prerequisite cycle detected/);
 assert.match(competencyPrerequisites,/relation_type='REQUIRES'/);
 assert.match(competencyPrerequisites,/All competency prerequisites must be published first/);
 assert.match(main,/data-competency-prerequisite/);
 assert.match(main,/saveCompetencyPrerequisites\(id, prerequisiteIds\)/);
 assert.match(data,/export function saveCompetencyPrerequisites/);
});
