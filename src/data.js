import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
import { getAccessToken, getCurrentUser } from "./core/auth.js";

const API = `${SUPABASE_URL}/rest/v1`;
const headers = {
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  Accept: "application/json",
};

async function readTable(table, params, accessToken = null) {
  const query = new URLSearchParams(params);
  const requestHeaders = {
    ...headers,
    Authorization: `Bearer ${accessToken || SUPABASE_PUBLISHABLE_KEY}`
  };
  const response = await fetch(`${API}/${table}?${query}`, { headers: requestHeaders });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Lecture ${table} impossible (HTTP ${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  return response.json();
}

function resolveAtlasTitles(nodes, departments, domains, content, learningPaths, competencies) {
  const titles = new Map();
  for (const item of departments) titles.set(`DEPARTMENT:${item.code}`, item.title);
  for (const item of domains) titles.set(`DOMAIN:${item.code}`, item.title);
  for (const item of learningPaths) {
    titles.set(`PATHWAY:${item.code}`, item.title);
    titles.set(`PATHWAY:${item.slug}`, item.title);
  }
  for (const item of competencies) {
    titles.set(`SKILL:${item.code}`, item.title);
  }
  for (const item of content) {
    titles.set(`CONTENT:${item.business_id}`, item.title);
    titles.set(`MODULE:${item.business_id}`, item.title);
    titles.set(`CONTENT:${item.slug}`, item.title);
    titles.set(`MODULE:${item.slug}`, item.title);
  }
  return nodes.map((node) => ({
    ...node,
    title: titles.get(`${node.entity_type}:${node.entity_key}`) ||
      node.title_override || node.entity_key || node.node_key
  }));
}

export async function loadAcademyData() {
  const accessToken = await getAccessToken();
  const memberData = accessToken
    ? Promise.all([
        readTable("academy_path_enrollments", {
          select: "path_id,enrollment_status,enrolled_at,completed_at",
          order: "enrolled_at.desc"
        }, accessToken),
        readTable("academy_member_progress", {
          select: "content_id,progress_status,progress_percent,started_at,completed_at,last_accessed_at",
          order: "last_accessed_at.desc"
        }, accessToken),
        readTable("academy_memberships", {
          select: "role,membership_status"
        }, accessToken),
        readTable("academy_path_item_progress", {
          select: "path_item_id,progress_status,progress_percent,started_at,completed_at,last_accessed_at",
          order: "last_accessed_at.desc"
        }, accessToken),
        readTable("academy_assessment_attempts", {
          select: "id,assessment_id,attempt_number,assessment_version,status,score,passed,question_count,correct_count,started_at,submitted_at",
          order: "started_at.desc"
        }, accessToken),
        readTable("academy_certificates", {
          select: "id,certificate_code,path_id,path_version,certificate_title,result_snapshot,issued_at,revoked_at",
          order: "issued_at.desc"
        }, accessToken)
      ]).then(([enrollments, progress, memberships, pathItemProgress, assessmentAttempts, certificates]) => ({
        enrollments, progress, pathItemProgress, assessmentAttempts, certificates,
        membership: memberships[0] || null, error: null
      })).catch((error) => ({
        enrollments: [], progress: [], pathItemProgress: [], assessmentAttempts: [], certificates: [], membership: null, error: error.message
      }))
    : Promise.resolve({ enrollments: [], progress: [], pathItemProgress: [], assessmentAttempts: [], certificates: [], membership: null, error: null });
  const [departments, domains, content, departmentLinks, domainLinks, learningPaths, pathItems, pathPrerequisites, competencies, contentCompetencies, rawNodes, edges, memberRecords, assessments, assessmentQuestions, assessmentOptions, pathAssessments] = await Promise.all([
    readTable("departments", {
      select: "code,slug,title,summary,color_token,sort_order",
      status: "eq.PUBLISHED",
      visibility: "eq.PUBLIC",
      order: "sort_order.asc"
    }),
    readTable("domains", {
      select: "code,slug,department_code,title,summary,sort_order",
      status: "eq.PUBLISHED",
      visibility: "eq.PUBLIC",
      order: "sort_order.asc"
    }),
    readTable("content_items", {
      select: "id,business_id,slug,title,summary,resource_type,language_code,learning_level,version_label,published_at,destination_url",
      status: "eq.PUBLISHED",
      editorial_status: "eq.PUBLISHED",
      visibility: "eq.PUBLIC",
      order: "published_at.desc"
    }),
    readTable("content_department_links", {
      select: "content_id,department_code,is_primary"
    }),
    readTable("content_domain_links", {
      select: "content_id,domain_code"
    }),
    readTable("academy_learning_paths", {
      select: "id,code,slug,title,summary,target_audience,difficulty_level,estimated_duration_minutes,version_label,published_at",
      status: "eq.PUBLISHED",
      visibility: "eq.PUBLIC",
      order: "title.asc"
    }),
    readTable("academy_learning_path_items", {
      select: "id,path_id,content_id,sort_order,is_required",
      order: "sort_order.asc"
    }),
    readTable("academy_path_item_prerequisites", {
      select: "path_id,item_id,prerequisite_item_id"
    }),
    readTable("academy_competencies", {
      select: "id,code,title,description,competency_level",
      status: "eq.PUBLISHED",
      visibility: "eq.PUBLIC",
      order: "title.asc"
    }),
    readTable("academy_content_competencies", {
      select: "content_id,competency_id,expected_level,assessment_hint"
    }),
    readTable("atlas_nodes", {
      select: "id,node_key,entity_type,entity_key,title_override,position_x,position_y,layout_version",
      status: "eq.PUBLISHED",
      visibility: "eq.PUBLIC"
    }),
    readTable("atlas_edges", {
      select: "id,source_node_id,target_node_id,relation_type,rationale",
      status: "eq.PUBLISHED"
    }),
    memberData,
    readTable("academy_assessments", { select: "id,code,title,description,pass_score,max_attempts,time_limit_minutes,version_label,published_at", status: "eq.PUBLISHED", visibility: "eq.PUBLIC", order: "title.asc" }),
    readTable("academy_assessment_questions", { select: "id,assessment_id,prompt,sort_order,question_type", order: "sort_order.asc" }),
    readTable("academy_assessment_options", { select: "id,question_id,option_text,sort_order", order: "sort_order.asc" }),
    readTable("academy_path_assessments", { select: "path_id,assessment_id,sort_order,is_required,minimum_score", order: "sort_order.asc" })
  ]);
  const { enrollments, progress, pathItemProgress, assessmentAttempts, certificates, membership, error: memberError } = memberRecords;
  const editorialMembers = accessToken && ['OWNER','ADMIN'].includes(membership?.role) ? await callEditorialRpc('academy_list_members', {}, 'Chargement des membres impossible').catch(() => []) : [];
  const [editorialPaths, editorialDepartments, editorialDomains, editorialCompetencies, editorialContentCompetencies, editorialCompetencyDomains, editorialContent, editorialDepartmentLinks, editorialDomainLinks, editorialContentAssets, editorialAssessments, editorialAssessmentQuestions, editorialAssessmentOptions, editorialPathAssessments, editorialAssessmentAnswerKeys, editorialAssessmentCompetencies, editorialCompetencyPrerequisites, editorialPrograms, editorialProgramDepartments, editorialProgramDomains, editorialProgramNodes, editorialPrograms, editorialProgramDepartments, editorialProgramDomains, editorialProgramNodes] = accessToken
    ? await Promise.all([
        readTable("academy_learning_paths", {
          select: "id,code,slug,title,summary,target_audience,difficulty_level,estimated_duration_minutes,version_label,status,visibility,published_at,updated_at",
          order: "updated_at.desc"
        }, accessToken).catch(() => []),
        readTable("departments", {
          select: "code,slug,title,summary,color_token,sort_order,status,visibility",
          order: "sort_order.asc"
        }, accessToken).catch(() => []),
        readTable("domains", {
          select: "code,slug,department_code,title,summary,sort_order,status,visibility",
          order: "sort_order.asc"
        }, accessToken).catch(() => []),
        readTable("academy_competencies", {
          select: "id,code,title,description,competency_level,status,visibility,updated_at",
          order: "updated_at.desc"
        }, accessToken).catch(() => []),
        readTable("academy_content_competencies", {
          select: "content_id,competency_id,expected_level,assessment_hint"
        }, accessToken).catch(() => []),
        readTable("academy_competency_domains", { select: "competency_id,domain_code,is_primary" }, accessToken).catch(() => []),
        readTable("content_items", { select: "id,business_id,slug,title,summary,resource_type,language_code,learning_level,editorial_status,status,visibility,updated_at", order: "updated_at.desc" }, accessToken).catch(() => []),
        readTable("content_department_links", { select: "content_id,department_code,is_primary" }, accessToken).catch(() => []),
        readTable("content_domain_links", { select: "content_id,domain_code" }, accessToken).catch(() => []),
        readTable("academy_content_assets", { select: "id,content_id,asset_code,asset_kind,delivery_type,title,description,external_url,mime_type,file_name,file_size_bytes,checksum_sha256,language_code,license_code,attribution,asset_version,previous_version_id,sort_order,created_at", order: "created_at.desc" }, accessToken).catch(() => []),
        readTable("academy_assessments", { select: "id,code,title,description,pass_score,max_attempts,time_limit_minutes,version_label,status,visibility,published_at,updated_at", order: "updated_at.desc" }, accessToken).catch(() => []),
        readTable("academy_assessment_questions", { select: "id,assessment_id,prompt,sort_order,question_type", order: "sort_order.asc" }, accessToken).catch(() => []),
        readTable("academy_assessment_options", { select: "id,question_id,option_text,sort_order", order: "sort_order.asc" }, accessToken).catch(() => []),
        readTable("academy_path_assessments", { select: "path_id,assessment_id,sort_order,is_required,minimum_score" }, accessToken).catch(() => []),
        readTable("academy_assessment_answer_keys", { select: "question_id,option_id" }, accessToken).catch(() => []),
        readTable("academy_assessment_competencies", { select: "assessment_id,competency_id,expected_level,minimum_score" }, accessToken).catch(() => []),
        readTable("academy_competency_prerequisites", { select: "competency_id,prerequisite_competency_id" }, accessToken).catch(() => []),
        readTable("academy_programs", { select: "id,code,slug,title,summary,objectives,program_type,target_audience,difficulty_level,estimated_duration_hours,version_label,status,visibility,published_at,updated_at", order: "updated_at.desc" }, accessToken).catch(() => []),
        readTable("academy_program_departments", { select: "program_id,department_code,is_primary" }, accessToken).catch(() => []),
        readTable("academy_program_domains", { select: "program_id,domain_code" }, accessToken).catch(() => []),
        readTable("academy_program_nodes", { select: "id,program_id,parent_node_id,code,node_type,title,summary,sort_order,is_required,estimated_minutes", order: "sort_order.asc" }, accessToken).catch(() => [])
      ])
    : [[], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], [], []];
  const [trainingPartners, trainingAgreements, trainingOfferings, trainingSessions, trainingEnrollments, trainingAttendance, trainingDocuments, trainingBilling] = accessToken
    ? await Promise.all([
        readTable("academy_training_partners", { select: "id,partner_code,legal_name,approval_number,approval_authority,approval_valid_from,approval_valid_until,approved_specialties,approved_delivery_modes,status", order: "legal_name.asc" }, accessToken).catch(() => []),
        readTable("academy_training_agreements", { select: "id,partner_id,agreement_code,agreement_title,status,valid_from,valid_until,permitted_specialties,permitted_venues,permitted_delivery_modes,billing_responsibility,document_issuer,signed_at", order: "agreement_code.asc" }, accessToken).catch(() => []),
        readTable("academy_training_offerings", { select: "id,offering_code,title,description,specialty_code,audience_profile,delivery_regime,partner_id,agreement_id,default_duration_days,default_capacity,status", order: "created_at.desc" }, accessToken).catch(() => []),
        readTable("academy_training_sessions", { select: "id,offering_id,session_code,starts_at,ends_at,venue_code,delivery_mode,capacity,status,registration_opens_at,registration_closes_at", order: "starts_at.desc" }, accessToken).catch(() => []),
        readTable("academy_training_enrollments", { select: "id,session_id,user_id,participant_name,participant_email,participant_category,enrollment_status,contract_reference,invoice_reference,enrolled_at", order: "enrolled_at.desc" }, accessToken).catch(() => []),
        readTable("academy_training_attendance", { select: "id,enrollment_id,training_date,attendance_status,attended_minutes,note,recorded_at", order: "training_date.desc" }, accessToken).catch(() => []),
        readTable("academy_training_documents", { select: "id,enrollment_id,document_code,document_type,issuer_kind,issuer_name,issuer_reference,title,issued_at,revoked_at,revocation_reason,evidence_snapshot", order: "issued_at.desc" }, accessToken).catch(() => []),
        readTable("academy_training_billing_records", { select: "id,enrollment_id,billing_owner,external_invoice_reference,currency_code,amount_minor_units,payment_status,accounting_note,recorded_at", order: "recorded_at.desc" }, accessToken).catch(() => [])
      ])
    : [[], [], [], [], [], [], [], []];
  const [publicTrainingOfferings, publicTrainingSessions] = await Promise.all([
    readTable("academy_training_offerings", { select: "id,offering_code,title,description,specialty_code,audience_profile,delivery_regime,default_duration_days", status: "eq.ACTIVE", order: "title.asc" }).catch(() => []),
    readTable("academy_training_sessions", { select: "id,offering_id,session_code,starts_at,ends_at,delivery_mode,registration_opens_at,registration_closes_at", status: "eq.OPEN", order: "starts_at.asc" }).catch(() => [])
  ]);
  const nodes = resolveAtlasTitles(rawNodes, departments, domains, content, learningPaths, competencies);
  return {
    departments, domains, content, departmentLinks, domainLinks,
    learningPaths, editorialPaths, editorialDepartments, editorialDomains, editorialCompetencies, editorialContentCompetencies, editorialCompetencyDomains, editorialContent, editorialDepartmentLinks, editorialDomainLinks,
    pathItems, pathPrerequisites, competencies, contentCompetencies,
    enrollments, progress, pathItemProgress, assessmentAttempts, certificates, membership, memberError, editorialMembers, nodes, edges,
    assessments, assessmentQuestions, assessmentOptions, pathAssessments,
    editorialAssessments, editorialAssessmentQuestions, editorialAssessmentOptions, editorialPathAssessments, editorialAssessmentCompetencies, editorialCompetencyPrerequisites,
    trainingPartners, trainingAgreements, trainingOfferings, trainingSessions, trainingEnrollments, trainingAttendance, trainingDocuments, trainingBilling
  };
}

async function writeMemberRecord(table, payload, conflictColumns) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("Connecte-toi pour enregistrer ta progression.");
  const response = await fetch(`${API}/${table}?on_conflict=${conflictColumns}`, {
    method: "POST",
    headers: {
      ...headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Enregistrement impossible (HTTP ${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  return response.json();
}

export async function enrollInPath(pathId) {
  const user = await getCurrentUser();
  if (!user?.id) throw new Error("Session apprenant introuvable.");
  return writeMemberRecord("academy_path_enrollments", {
    user_id: user.id,
    path_id: pathId,
    enrollment_status: "ACTIVE",
    completed_at: null,
    updated_at: new Date().toISOString()
  }, "user_id,path_id");
}

export async function saveResourceProgress(contentId, completed = true) {
  const user = await getCurrentUser();
  if (!user?.id) throw new Error("Session apprenant introuvable.");
  const now = new Date().toISOString();
  return writeMemberRecord("academy_member_progress", {
    user_id: user.id,
    content_id: contentId,
    progress_status: completed ? "COMPLETED" : "IN_PROGRESS",
    progress_percent: completed ? 100 : 10,
    started_at: now,
    completed_at: completed ? now : null,
    last_accessed_at: now
  }, "user_id,content_id");
}

export async function savePathItemProgress(pathItemId, completed = true) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("Connecte-toi pour enregistrer ta progression.");
  const response = await fetch(`${API}/rpc/academy_record_path_item_progress`, {
    method: "POST",
    headers: {
      ...headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_path_item_id: pathItemId,
      p_completed: completed
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Validation de l’étape impossible (HTTP ${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  return response.json();
}


async function callEditorialRpc(name, payload, errorLabel) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("Connecte-toi pour effectuer cette opération.");
  const response = await fetch(`${API}/rpc/${name}`, {
    method: "POST",
    headers: { ...headers, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${errorLabel} (HTTP ${response.status})${detail ? `: ${detail.slice(0, 220)}` : ""}`);
  }
  return response.json();
}
export function saveLearningPath(path) {
  return callEditorialRpc("academy_save_learning_path_editorial", {
    p_path_id: path.id || null,
    p_code: path.code,
    p_slug: path.slug,
    p_title: path.title,
    p_summary: path.summary || "",
    p_target_audience: path.targetAudience || "",
    p_difficulty_level: path.difficultyLevel || "FOUNDATION",
    p_estimated_duration_minutes: path.durationMinutes ? Number(path.durationMinutes) : null,
    p_version_label: path.versionLabel || "0.1",
    p_items: path.items || []
  }, "Enregistrement du parcours impossible");
}


export function saveProgramDraft(program) {
  return callEditorialRpc("academy_save_program_draft", {
    p_program_id: program.id || null, p_code: program.code, p_slug: program.slug,
    p_title: program.title, p_summary: program.summary || "", p_objectives: program.objectives || "",
    p_program_type: program.programType, p_target_audience: program.targetAudience || "",
    p_difficulty_level: program.difficultyLevel || "FOUNDATION",
    p_estimated_duration_hours: program.durationHours ? Number(program.durationHours) : null,
    p_version_label: program.versionLabel || "0.1", p_departments: program.departments || [],
    p_domains: program.domains || [], p_nodes: program.nodes || []
  }, "Enregistrement du programme impossible");
}
export function publishProgram(programId) {
  return callEditorialRpc("academy_publish_program", { p_program_id: programId }, "Publication du programme impossible");
}

export function publishDepartment(code, visibility = "PUBLIC", note = "") {
  return callEditorialRpc("academy_publish_department", {
    p_department_code: code, p_visibility: visibility, p_note: note
  }, "Publication du département impossible");
}

export function publishDomain(code, visibility = "PUBLIC", note = "") {
  return callEditorialRpc("academy_publish_domain", {
    p_domain_code: code, p_visibility: visibility, p_note: note
  }, "Publication du domaine impossible");
}

export function saveCompetency(competency) {
  return callEditorialRpc("academy_save_competency_editorial", {
    p_competency_id: competency.id || null,
    p_code: competency.code,
    p_title: competency.title,
    p_description: competency.description || "",
    p_competency_level: competency.level || "FOUNDATION",
    p_mappings: competency.mappings || []
  }, "Enregistrement de la compétence impossible");
}

export function publishCompetency(id, visibility = "PUBLIC", note = "") {
  return callEditorialRpc("academy_publish_competency", {
    p_competency_id: id, p_visibility: visibility, p_note: note
  }, "Publication de la compétence impossible");
}

export function publishLearningPath(pathId, note = "") {
  return callEditorialRpc("academy_publish_learning_path", { p_path_id: pathId, p_note: note },
    "Publication du parcours impossible");
}

export function saveContentEditorial(content) {
 return callEditorialRpc("academy_save_content_editorial", {
  p_content_id:content.id||null,p_business_id:content.businessId,p_slug:content.slug,p_title:content.title,
  p_summary:content.summary||"",p_resource_type:content.resourceType,p_language_code:content.languageCode||"fr",
  p_learning_level:content.learningLevel||null,p_departments:content.departments||[],p_domains:content.domains||[]
 },"Enregistrement de la ressource impossible");
}
export function submitContentForReview(id,note="") { return callEditorialRpc("academy_submit_content_for_review",{p_content_id:id,p_note:note},"Soumission en revue impossible"); }
export function reviewContent(id,decision,note="") { return callEditorialRpc("academy_review_content_item",{p_content_id:id,p_decision:decision,p_note:note},"Décision de revue impossible"); }
export function publishContent(id,visibility="PUBLIC",note="") { return callEditorialRpc("academy_publish_content_item",{p_content_id:id,p_visibility:visibility,p_note:note},"Publication de la ressource impossible"); }

export function manageAcademyMembership(userId, role, status, note = "") {
 return callEditorialRpc("academy_manage_membership", {p_user_id:userId,p_role:role,p_status:status,p_note:note}, "Modification du membre impossible");
}

export function saveAssessment(assessment) {
 return callEditorialRpc("academy_save_assessment_editorial", {
  p_assessment_id:assessment.id||null,p_code:assessment.code,p_title:assessment.title,p_description:assessment.description||"",
  p_pass_score:Number(assessment.passScore??70),p_max_attempts:assessment.maxAttempts?Number(assessment.maxAttempts):null,
  p_time_limit_minutes:assessment.timeLimitMinutes?Number(assessment.timeLimitMinutes):null,p_version_label:assessment.versionLabel||"0.1",
  p_questions:assessment.questions||[]
 },"Enregistrement de l’évaluation impossible");
}
export function publishAssessment(id,note="") {
 return callEditorialRpc("academy_publish_assessment",{p_assessment_id:id,p_note:note},"Publication de l’évaluation impossible");
}
export function startAssessment(id) {
 return callEditorialRpc("academy_start_assessment",{p_assessment_id:id},"Démarrage de l’évaluation impossible");
}
export function submitAssessment(attemptId,answers) {
 return callEditorialRpc("academy_submit_assessment",{p_attempt_id:attemptId,p_answers:answers},"Envoi des réponses impossible");
}
export function savePathAssessments(pathId,requirements) {
 return callEditorialRpc("academy_save_path_assessments",{p_path_id:pathId,p_requirements:requirements},"Configuration des évaluations du parcours impossible");
}
export function issuePathCertificate(pathId) {
 return callEditorialRpc("academy_issue_path_certificate",{p_path_id:pathId},"Émission du certificat impossible");
}
export function verifyCertificate(code) {
 return callEditorialRpc("academy_verify_certificate",{p_certificate_code:code},"Vérification du certificat impossible");
}

export function saveCompetencyDomains(competencyId, domainCodes) {
 return callEditorialRpc("academy_save_competency_domains", {p_competency_id:competencyId,p_domain_codes:domainCodes}, "Enregistrement des ancrages disciplinaires impossible");
}
export function saveAssessmentCompetencies(assessmentId, mappings) {
 return callEditorialRpc("academy_save_assessment_competencies", {p_assessment_id:assessmentId,p_mappings:mappings}, "Enregistrement des compétences évaluées impossible");
}

export function saveCompetencyPrerequisites(competencyId, prerequisiteIds) {
 return callEditorialRpc("academy_save_competency_prerequisites", {p_competency_id:competencyId,p_prerequisite_ids:prerequisiteIds}, "Enregistrement des prérequis de compétence impossible");
}

export function saveContentAssets(contentId, assets) {
  return callEditorialRpc("academy_save_content_assets", {
    p_content_id: contentId,
    p_assets: assets || []
  }, "Enregistrement des supports impossible");
}


export function issueTrainingDocument(enrollmentId, documentType, title, issuerKind = null, issuerReference = null) {
  return callEditorialRpc("academy_issue_training_document", {
    p_enrollment_id: enrollmentId,
    p_document_type: documentType,
    p_title: title,
    p_issuer_kind: issuerKind,
    p_issuer_reference: issuerReference
  }, "Émission du document impossible");
}

export function revokeTrainingDocument(documentId, reason) {
  return callEditorialRpc("academy_revoke_training_document", {
    p_document_id: documentId,
    p_reason: reason
  }, "Révocation du document impossible");
}

export async function verifyTrainingDocument(token) {
  if (!token || !/^[a-f0-9]{64}$/i.test(token.trim())) return null;
  const response = await fetch(`${API}/rpc/academy_verify_training_document`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ p_verification_token: token.trim() })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Vérification du document impossible (HTTP ${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  const rows = await response.json();
  return Array.isArray(rows) ? (rows[0] || null) : rows;
}

export function enrollInTrainingSession(sessionId, participantName, participantEmail, participantCategory = "OTHER") {
  return callEditorialRpc("academy_enroll_training_session", {
    p_session_id: sessionId,
    p_participant_name: participantName,
    p_participant_email: participantEmail,
    p_participant_category: participantCategory
  }, "Inscription à la session impossible");
}
export function saveTrainingOffering(payload) {
  return callEditorialRpc("academy_save_training_offering", { p_payload: payload }, "Enregistrement de la formation impossible");
}
export function saveTrainingSession(payload) {
  return callEditorialRpc("academy_save_training_session", { p_payload: payload }, "Enregistrement de la session impossible");
}
export function setTrainingStatus(entityType, entityId, status, note = "") {
  return callEditorialRpc("academy_set_training_status", { p_entity_type: entityType, p_entity_id: entityId, p_new_status: status, p_note: note }, "Changement de statut impossible");
}
export function recordTrainingAttendance(enrollmentId, date, status, minutes = 0, note = "") {
  return callEditorialRpc("academy_record_training_attendance", { p_enrollment_id: enrollmentId, p_training_date: date, p_status: status, p_minutes: Number(minutes), p_note: note }, "Enregistrement de présence impossible");
}
export function setTrainingEnrollmentStatus(enrollmentId, status, note = "") {
  return callEditorialRpc("academy_set_training_enrollment_status", { p_enrollment_id: enrollmentId, p_new_status: status, p_note: note }, "Changement du statut d'inscription impossible");
}

export function saveTrainingPartner(payload) {
  return callEditorialRpc("academy_save_training_partner", { p_payload: payload }, "Enregistrement du partenaire impossible");
}
export function saveTrainingAgreement(payload) {
  return callEditorialRpc("academy_save_training_agreement", { p_payload: payload }, "Enregistrement de la convention impossible");
}
export function setTrainingReferenceStatus(entityType, entityId, status, note = "") {
  return callEditorialRpc("academy_set_training_reference_status", { p_entity_type: entityType, p_entity_id: entityId, p_new_status: status, p_note: note }, "Changement du statut de référence impossible");
}

export function saveTrainingBillingRecord(payload) {
  return callEditorialRpc("academy_save_training_billing_record", { p_payload: payload }, "Enregistrement de la facturation impossible");
}
