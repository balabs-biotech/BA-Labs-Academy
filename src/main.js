import { loadAcademyData, enrollInPath, saveResourceProgress, savePathItemProgress, saveLearningPath, publishLearningPath, saveProgramDraft, publishProgram, publishDepartment, publishDomain, saveCompetency, saveCompetencyDomains, saveCompetencyPrerequisites, publishCompetency, saveContentEditorial, saveContentAssets, submitContentForReview, reviewContent, publishContent, manageAcademyMembership, enrollInTrainingSession, saveTrainingOffering, saveTrainingSession, setTrainingStatus, recordTrainingAttendance, setTrainingEnrollmentStatus, issueTrainingDocument, revokeTrainingDocument, verifyTrainingDocument, saveTrainingPartner, saveTrainingAgreement, setTrainingReferenceStatus, saveTrainingBillingRecord, startAssessment, submitAssessment, issuePathCertificate, verifyCertificate, saveAssessment, saveAssessmentCompetencies, publishAssessment, savePathAssessments } from "./data.js";
import { escapeHtml } from "./core/dom.js";
import { bindAtlasGraph, renderAtlasGraph } from "./features/atlas/renderer.js";
import { buildPathProgress, resolvePathItems } from "./features/learning/progress.js";
import { getSession, signInWithPassword, signOut } from "./core/auth.js";
import { getRoleCapabilities, hasEditorialAccess } from "./core/permissions.js";
import { searchAcademy, searchTypeLabel } from "./features/search/index.js";

const root = document.querySelector("#app");
const connection = document.querySelector("#connection-state");
let data = {
  departments: [], domains: [], content: [], departmentLinks: [], domainLinks: [],
  learningPaths: [], editorialPaths: [], editorialCompetencies: [], editorialContentCompetencies: [], editorialCompetencyDomains: [], editorialAssessmentCompetencies: [], editorialCompetencyPrerequisites: [], editorialContent: [], editorialDepartmentLinks: [], editorialDomainLinks: [], pathItems: [], pathPrerequisites: [], competencies: [], contentCompetencies: [],
  enrollments: [], progress: [], pathItemProgress: [], nodes: [], edges: []
};
let loadError = null;
let unbindAtlas = () => {};
let currentSession = null;

function emptyState(title, description) {
  return `<div class="empty-state"><span class="empty-symbol">＋</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div>`;
}

function departmentCard(item) {
  const count = data.domains.filter((domain) => domain.department_code === item.code).length;
  return `<a class="department-card" href="#/departements/${encodeURIComponent(item.slug)}">
    <span class="card-index">${escapeHtml(item.code)}</span>
    <h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.summary || "Présentation en préparation.")}</p>
    <span class="card-meta">${count} domaine${count > 1 ? "s" : ""} <b>↗</b></span>
  </a>`;
}

function homeView() {
  return `<section class="hero">
    <div class="hero-copy">
      <span class="eyebrow"><i></i> SCIENCE · TRANSMISSION · EXPLORATION</span>
      <h1>Comprendre.<br><em>Expérimenter.</em><br>Construire.</h1>
      <p>Une plateforme de formation et d’exploration scientifique appliquée, structurée autour des disciplines, des savoir-faire et des ressources BA Labs.</p>
      <div class="hero-actions"><a class="button button-primary" href="#/departements">Explorer les départements <span>↗</span></a><a class="text-link" href="#/atlas">Ouvrir l’Atlas <span>→</span></a></div>
    </div>
    <div class="hero-visual" aria-hidden="true">
      <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
      <div class="core"><span>BA</span><small>ACADEMY</small></div>
      <span class="orbit-node node-a">BIO</span><span class="orbit-node node-b">DATA</span><span class="orbit-node node-c">LAB</span>
      <div class="visual-caption">KNOWLEDGE SYSTEM <span>01 / 04</span></div>
    </div>
  </section>
  <section class="section-block">
    <div class="section-heading"><div><span class="eyebrow">STRUCTURE ACADÉMIQUE</span><h2>Départements</h2></div><a class="text-link" href="#/departements">Voir la structure <span>→</span></a></div>
    ${data.departments.length ? `<div class="card-grid">${data.departments.slice(0, 4).map(departmentCard).join("")}</div>` : emptyState("Les départements seront bientôt ouverts", "La structure académique est configurée. Les fiches publiques apparaîtront après validation éditoriale.")}
  </section>
  <section class="section-block">
    <div class="section-heading"><div><span class="eyebrow">APPRENTISSAGE STRUCTURÉ</span><h2>Parcours pédagogiques</h2></div><a class="text-link" href="#/parcours">Voir les parcours <span>→</span></a></div>
    ${data.learningPaths.length ? `<div class="pathway-grid">${data.learningPaths.slice(0, 3).map(pathwayCard).join("")}</div>` : emptyState("Parcours en préparation", "Les séquences, prérequis et compétences sont prêts à accueillir les futurs parcours validés.")}
  </section>
  <section class="section-block feature-strip"><div><span class="eyebrow">EXPLORATION TRANSVERSALE</span><h2>L’Atlas des connaissances</h2><p>Visualiser les liens entre disciplines, domaines, ressources et parcours.</p></div><a class="button button-outline" href="#/atlas">Explorer l’Atlas <span>↗</span></a></section>`;
}

function departmentsView() {
  return `<section class="page-intro"><span class="eyebrow">ORGANISATION DES SAVOIRS</span><h1>Départements</h1><p>Les grands pôles scientifiques de BA Labs Academy.</p></section>
  ${data.departments.length ? `<div class="card-grid">${data.departments.map(departmentCard).join("")}</div>` : emptyState("Aucun département publié", "Les départements existent dans le référentiel interne, mais aucun n’est encore publié pour le public.")}`;
}

function departmentDetail(slug) {
  const department = data.departments.find((item) => item.slug === slug);
  if (!department) return notFound("Département indisponible", "Ce département n’est pas publié ou n’existe pas dans le catalogue public.");
  const domains = data.domains.filter((item) => item.department_code === department.code);
  const contentIds = new Set(data.departmentLinks.filter((link) => link.department_code === department.code).map((link) => link.content_id));
  const resources = data.content.filter((item) => contentIds.has(item.id));
  return `<section class="page-intro"><span class="eyebrow"><a href="#/departements">DÉPARTEMENTS</a> / ${escapeHtml(department.code)}</span><h1>${escapeHtml(department.title)}</h1><p>${escapeHtml(department.summary)}</p></section>
  <section class="section-block"><div class="section-heading"><div><span class="eyebrow">STRUCTURE DISCIPLINAIRE</span><h2>Domaines associés</h2></div><span class="resource-level">${domains.length} domaine(s) publié(s)</span></div>
  <div class="domain-list">${domains.length ? domains.map((domain) => `<a class="domain-row domain-link" href="#/domaines/${encodeURIComponent(domain.slug)}"><span>${escapeHtml(domain.code)}</span><div><h3>${escapeHtml(domain.title)}</h3><p>${escapeHtml(domain.summary)}</p></div><b>↗</b></a>`).join("") : emptyState("Domaines en préparation", "Les domaines de ce département ne sont pas encore publiés.")}</div>
  <div class="section-heading"><div><span class="eyebrow">RESSOURCES PUBLIÉES</span><h2>Pour approfondir</h2></div></div>
  <div class="resource-list">${resources.length ? resourceCards(resources) : emptyState("Aucune ressource associée", "Les ressources validées seront reliées à ce département au fil des publications.")}</div></section>`;
}

function resourceCards(items) {
  return items.map((item) => `<a class="resource-row resource-link" href="#/ressource/${encodeURIComponent(item.slug)}"><div><span class="eyebrow">${escapeHtml((item.resource_type || "RESSOURCE").toUpperCase())} · ${escapeHtml((item.language_code || "fr").toUpperCase())}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></div><span class="resource-level">${escapeHtml(item.learning_level || "Tous niveaux")} <b>↗</b></span></a>`).join("");
}

function searchResultsView(query) {
  const results = searchAcademy(query, data);
  const cards = results.map((item) => `<a class="search-result" href="${item.href}">
    <span class="eyebrow">${escapeHtml(searchTypeLabel(item.type))}</span>
    <h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.summary || "Fiche académique publiée.")}</p>
    <span class="search-result-link">Ouvrir la fiche ↗</span>
  </a>`).join("");
  return `<section class="page-intro"><span class="eyebrow">EXPLORATION TRANSVERSALE</span><h1>Recherche</h1><p>Explorer les départements, domaines, ressources, parcours et compétences publiés.</p></section>
    <form class="academy-search-form" id="academy-search-form">
      <label for="academy-search-input">Recherche dans l’Academy</label>
      <div><input id="academy-search-input" name="q" type="search" value="${escapeHtml(query)}" placeholder="Ex. mycologie, culture, microbiologie…" autocomplete="off"><button class="button button-primary" type="submit">Rechercher ↗</button></div>
      <span class="search-count">${query ? `${results.length} résultat(s)` : "Saisis un terme pour lancer la recherche."}</span>
    </form>
    <section class="search-results" id="academy-search-results">${query ? cards || emptyState("Aucun résultat", "Essaie un autre terme ou une formulation plus courte.") : emptyState("Recherche multi-domaines", "Les résultats couvrent les cinq types de fiches publiques de l’Academy.")}</section>`;
}

function catalogueView() {
  return `<section class="page-intro"><span class="eyebrow">RESSOURCES PÉDAGOGIQUES</span><h1>Catalogue</h1><p>Modules, cours, protocoles et ressources validés pour diffusion.</p></section>
  <div class="catalogue-tools"><label for="resource-search">Rechercher une ressource</label><input id="resource-search" type="search" placeholder="Titre, thème, type de ressource…" autocomplete="off"><span id="resource-count">${data.content.length} ressource(s) publiée(s)</span></div>
  <div class="resource-list" id="resource-results">${data.content.length ? resourceCards(data.content) : emptyState("Le catalogue est en préparation", "Aucune ressource n’est actuellement publiée. Les contenus internes ne sont pas exposés avant validation.")}</div>`;
}

function filterCatalogue(query) {
  const normalized = query.trim().toLocaleLowerCase("fr");
  const filtered = data.content.filter((item) => {
    const linkedDomainCodes = data.domainLinks.filter((link) => link.content_id === item.id).map((link) => link.domain_code);
    const linkedDepartmentCodes = data.departmentLinks.filter((link) => link.content_id === item.id).map((link) => link.department_code);
    const linkedLabels = [
      ...data.domains.filter((domain) => linkedDomainCodes.includes(domain.code)).map((domain) => domain.title),
      ...data.departments.filter((department) => linkedDepartmentCodes.includes(department.code)).map((department) => department.title)
    ];
    return [item.title, item.summary, item.resource_type, item.learning_level, item.language_code, ...linkedLabels]
      .some((value) => String(value || "").toLocaleLowerCase("fr").includes(normalized));
  });
  const results = document.querySelector("#resource-results");
  const count = document.querySelector("#resource-count");
  if (results) results.innerHTML = filtered.length
    ? resourceCards(filtered)
    : emptyState("Aucun résultat", "Essaie avec un autre terme ou un type de ressource différent.");
  if (count) count.textContent = `${filtered.length} / ${data.content.length} ressource(s)`;
}

function resourceDetail(slug, pathItemId = "") {
  const item = data.content.find((entry) => entry.slug === slug);
  if (!item) return notFound("Ressource indisponible", "Cette ressource n’est pas publiée ou n’existe pas dans le catalogue public.");
  const destination = safeExternalUrl(item.destination_url);
  const progress = data.progress.find((record) => record.content_id === item.id);
  const pathItem = pathItemId
    ? data.pathItems.find((entry) => entry.id === pathItemId && entry.content_id === item.id)
    : null;
  const stepProgress = pathItem
    ? data.pathItemProgress.find((record) => record.path_item_id === pathItem.id)
    : null;
  const parentPath = pathItem ? data.learningPaths.find((entry) => entry.id === pathItem.path_id) : null;
  const isEnrolled = pathItem && data.enrollments.some((entry) => entry.path_id === pathItem.path_id);
  const completed = pathItem ? stepProgress?.progress_status === "COMPLETED" : progress?.progress_status === "COMPLETED";
  const learnerAction = pathItem
    ? isEnrolled
      ? `<div class="learner-action"><span class="progress-state">${completed ? "Étape terminée" : "Étape du parcours"}</span><button class="button button-outline" id="complete-resource" data-path-item-id="${escapeHtml(pathItem.id)}" ${completed ? "disabled" : ""}>${completed ? "Acquis ✓" : "Valider cette étape"}</button></div>`
      : `<p class="progress-note">Inscris-toi au parcours ${parentPath ? `<a href="#/parcours/${encodeURIComponent(parentPath.slug)}">${escapeHtml(parentPath.title)}</a>` : "associé"} pour enregistrer cette étape.</p>`
    : `<div class="learner-action"><span class="progress-state">${completed ? "Ressource terminée" : "Suivre cette ressource"}</span><button class="button button-outline" id="complete-resource" data-content-id="${escapeHtml(item.id)}" ${completed ? "disabled" : ""}>${completed ? "Acquis ✓" : "Marquer comme terminée"}</button></div>`;
  return `<section class="page-intro"><span class="eyebrow"><a href="#/catalogue">CATALOGUE</a> / ${escapeHtml((item.resource_type || "RESSOURCE").toUpperCase())}</span><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.summary)}</p></section>
  <section class="resource-detail"><div class="detail-meta"><span>${escapeHtml((item.language_code || "fr").toUpperCase())}</span><span>${escapeHtml(item.learning_level || "Tous niveaux")}</span><span>Version ${escapeHtml(item.version_label || "—")}</span></div>
  <p class="detail-note">Cette fiche présente les informations publiques validées pour cette ressource.</p>
  ${destination ? `<a class="button button-primary" href="${escapeHtml(destination)}" target="_blank" rel="noopener noreferrer">Accéder à la ressource ↗</a>` : ""}
  ${currentSession ? learnerAction : `<p class="progress-note"><a href="#/espace">Connecte-toi à l’espace apprenant</a> pour enregistrer ta progression.</p>`}
  </section>`;
}

function safeExternalUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function domainDetail(slug) {
  const domain = data.domains.find((item) => item.slug === slug);
  if (!domain) return notFound("Domaine indisponible", "Ce domaine n’est pas publié ou n’existe pas dans le catalogue public.");
  const department = data.departments.find((item) => item.code === domain.department_code);
  const contentIds = new Set(data.domainLinks.filter((link) => link.domain_code === domain.code).map((link) => link.content_id));
  const resources = data.content.filter((item) => contentIds.has(item.id));
  return `<section class="page-intro"><span class="eyebrow"><a href="#/departements">DÉPARTEMENTS</a> / DOMAINE</span><h1>${escapeHtml(domain.title)}</h1><p>${escapeHtml(domain.summary)}</p></section>
  <div class="detail-meta"><span>${escapeHtml(domain.code)}</span>${department ? `<a href="#/departements/${encodeURIComponent(department.slug)}">${escapeHtml(department.title)} ↗</a>` : ""}</div>
  <section class="section-block"><div class="section-heading"><div><span class="eyebrow">RESSOURCES ASSOCIÉES</span><h2>Pour approfondir</h2></div></div>
  <div class="resource-list">${resources.length ? resourceCards(resources) : emptyState("Aucune ressource associée", "Les ressources validées seront reliées à ce domaine au fil des publications.")}</div></section>`;
}

function pathwayCard(path) {
  const itemCount = data.pathItems.filter((item) => item.path_id === path.id).length;
  const difficulty = {
    INTRODUCTORY: "Initiation",
    FOUNDATION: "Fondamental",
    INTERMEDIATE: "Intermédiaire",
    ADVANCED: "Avancé"
  }[path.difficulty_level] || path.difficulty_level;
  const duration = path.estimated_duration_minutes
    ? `${path.estimated_duration_minutes} min`
    : "Durée à définir";
  return `<a class="pathway-card" href="#/parcours/${encodeURIComponent(path.slug)}">
    <span class="eyebrow">PARCOURS · ${escapeHtml(difficulty)}</span>
    <h3>${escapeHtml(path.title)}</h3>
    <p>${escapeHtml(path.summary || "Présentation en préparation.")}</p>
    <span class="pathway-meta">${itemCount} étape(s) · ${escapeHtml(duration)} <b>↗</b></span>
  </a>`;
}

function learningPathsView() {
  return `<section class="page-intro"><span class="eyebrow">PROGRESSION PÉDAGOGIQUE</span><h1>Parcours</h1><p>Des séquences structurées avec objectifs, ressources et prérequis explicites.</p></section>
  ${data.learningPaths.length
    ? `<div class="pathway-grid">${data.learningPaths.map(pathwayCard).join("")}</div>`
    : emptyState("Les parcours sont en préparation", "Le moteur de parcours, les prérequis et le modèle de progression sont configurés. Les parcours seront visibles après leur validation éditoriale.")}`;
}


function assessmentDetail(assessmentId, attemptId = "") {
  if (!currentSession?.user) return loginView();
  const assessment = (data.assessments || []).find((item) => item.id === assessmentId);
  if (!assessment) return notFound("Évaluation indisponible", "Cette évaluation n’est pas publiée ou n’existe pas.");
  const attempt = (data.assessmentAttempts || []).find((item) => item.id === attemptId && item.assessment_id === assessmentId);
  const questions = (data.assessmentQuestions || []).filter((item) => item.assessment_id === assessmentId).sort((a,b)=>a.sort_order-b.sort_order);
  const options = data.assessmentOptions || [];
  if (attempt?.status === "SUBMITTED" || attempt?.status === "EXPIRED") {
    return `<section class="page-intro"><span class="eyebrow">ÉVALUATION · RÉSULTAT</span><h1>${escapeHtml(assessment.title)}</h1><p>Tentative ${attempt.attempt_number} · version ${escapeHtml(attempt.assessment_version)}</p></section>
      <section class="assessment-result ${attempt.passed ? "is-passed" : "is-failed"}"><span class="eyebrow">${attempt.status === "EXPIRED" ? "TEMPS ÉCOULÉ" : attempt.passed ? "SEUIL ATTEINT" : "SEUIL NON ATTEINT"}</span><strong>${attempt.status === "EXPIRED" ? "0 %" : `${Number(attempt.score).toFixed(1)} %`}</strong><p>${attempt.status === "EXPIRED" ? "La durée autorisée a été dépassée." : `${attempt.correct_count}/${attempt.question_count} réponse(s) correcte(s) · seuil requis : ${assessment.pass_score}%`}</p><a class="button button-outline" href="#/parcours">Retour aux parcours</a></section>`;
  }
  if (attempt?.status === "IN_PROGRESS") {
    return `<section class="page-intro"><span class="eyebrow">ÉVALUATION · TENTATIVE ${attempt.attempt_number}</span><h1>${escapeHtml(assessment.title)}</h1><p>${escapeHtml(assessment.description || "Réponds à chaque question puis soumets ta tentative.")}</p><div class="pathway-overview"><span>Seuil : ${assessment.pass_score}%</span><span>${questions.length} question(s)</span><span>${assessment.time_limit_minutes ? `${assessment.time_limit_minutes} min` : "Sans limite de temps"}</span></div></section>
      <form id="assessment-answer-form" class="assessment-form" data-attempt-id="${escapeHtml(attempt.id)}">
        ${questions.map((question,index)=>`<fieldset class="assessment-question"><legend><span class="eyebrow">QUESTION ${String(index+1).padStart(2,"0")}</span><b>${escapeHtml(question.prompt)}</b></legend><div class="assessment-options">${options.filter((option)=>option.question_id===question.id).sort((a,b)=>a.sort_order-b.sort_order).map((option)=>`<label><input type="radio" name="question_${escapeHtml(question.id)}" value="${escapeHtml(option.id)}" required><span>${escapeHtml(option.option_text)}</span></label>`).join("")}</div></fieldset>`).join("")}
        <button class="button button-primary" type="submit">Soumettre mes réponses ↗</button><p id="assessment-feedback" class="auth-feedback" role="status" aria-live="polite"></p>
      </form>`;
  }
  const attempts = (data.assessmentAttempts || []).filter((item)=>item.assessment_id===assessmentId);
  return `<section class="page-intro"><span class="eyebrow">ÉVALUATION</span><h1>${escapeHtml(assessment.title)}</h1><p>${escapeHtml(assessment.description || "Évaluation des acquis.")}</p></section>
    <section class="assessment-start"><div class="pathway-overview"><span>Seuil de réussite : ${assessment.pass_score}%</span><span>${questions.length} question(s)</span><span>${assessment.time_limit_minutes ? `${assessment.time_limit_minutes} min` : "Sans limite de temps"}</span><span>${assessment.max_attempts ? `${Math.max(0,assessment.max_attempts-attempts.length)} tentative(s) restante(s)` : "Tentatives illimitées"}</span></div>
    <p>La correction est effectuée côté serveur. Les réponses correctes ne sont jamais transmises au navigateur.</p>
    ${assessment.max_attempts && attempts.length>=assessment.max_attempts ? '<p class="progress-note">Nombre maximal de tentatives atteint.</p>' : '<button class="button button-primary" id="start-assessment" data-assessment-id="'+escapeHtml(assessmentId)+'">Commencer l’évaluation ↗</button>'}</section>`;
}

function certificateView(code = "") {
  return `<section class="page-intro"><span class="eyebrow">REGISTRE DE CERTIFICATION</span><h1>Vérifier un certificat</h1><p>Vérification publique de l’authenticité et du statut d’un certificat BA Labs Academy.</p></section>
    <form id="certificate-verify-form" class="certificate-verify-form"><label for="certificate-code">Code du certificat</label><input id="certificate-code" name="code" value="${escapeHtml(code)}" required maxlength="40" placeholder="CODE-CERTIFICAT"><button class="button button-primary" type="submit">Vérifier ↗</button></form>
    <div id="certificate-verification-result" aria-live="polite"></div>`;
}

function learningPathDetail(slug) {
  const path = data.learningPaths.find((item) => item.slug === slug);
  if (!path) return notFound("Parcours indisponible", "Ce parcours n’est pas publié ou n’existe pas dans le catalogue public.");
  const rawItems = data.pathItems.filter((item) => item.path_id === path.id);
  const sequence = resolvePathItems(
    rawItems,
    data.pathPrerequisites.filter((relation) => relation.path_id === path.id),
    data.pathItemProgress
  );
  const contentById = new Map(data.content.map((item) => [item.id, item]));
  const competencyIds = new Set(
    data.contentCompetencies
      .filter((relation) => rawItems.some((item) => item.content_id === relation.content_id))
      .map((relation) => relation.competency_id)
  );
  const competencies = data.competencies.filter((item) => competencyIds.has(item.id));
  const pathProgress = buildPathProgress(rawItems, data.pathItemProgress);
  const requiredAssessments = (data.pathAssessments || []).filter((item)=>item.path_id===path.id);
  const assessmentsComplete = requiredAssessments.filter((item)=>item.is_required).every((item)=>(data.assessmentAttempts||[]).some((attempt)=>attempt.assessment_id===item.assessment_id && attempt.status==="SUBMITTED" && attempt.passed && Number(attempt.score)>=Number(item.minimum_score)));
  const certificateReady = currentSession && enrolled && pathProgress.percent>=100 && assessmentsComplete;
  const certificate = (data.certificates||[]).find((item)=>item.path_id===path.id && !item.revoked_at);
  const difficulty = {
    INTRODUCTORY: "Initiation",
    FOUNDATION: "Fondamental",
    INTERMEDIATE: "Intermédiaire",
    ADVANCED: "Avancé"
  }[path.difficulty_level] || path.difficulty_level;
  const enrolled = data.enrollments.some((record) => record.path_id === path.id);
  const steps = sequence.map((step, index) => {
    const resource = contentById.get(step.content_id);
    const title = resource?.title || "Ressource indisponible";
    const description = resource?.summary || "Description à compléter.";
    const state = step.progressStatus === "COMPLETED" ? "Validée" : step.isLocked ? "Prérequis à valider" : "Accessible";
    const body = `<span class="path-step-index">${String(index + 1).padStart(2, "0")}</span>
      <div class="path-step-copy"><span class="eyebrow">${step.is_required ? "ÉTAPE OBLIGATOIRE" : "ÉTAPE COMPLÉMENTAIRE"} · ${escapeHtml(state)}</span>
      <h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div>
      <span class="path-step-status">${step.progressStatus === "COMPLETED" ? "Acquis ✓" : step.isLocked ? "Verrouillé ⌑" : "Ouvrir ↗"}</span>`;
    return step.isLocked || !resource
      ? `<div class="path-step is-locked">${body}</div>`
      : `<a class="path-step" href="#/ressource/${encodeURIComponent(resource.slug)}?pathItem=${encodeURIComponent(step.id)}">${body}</a>`;
  }).join("");
  return `<section class="page-intro"><span class="eyebrow"><a href="#/parcours">PARCOURS</a> / ${escapeHtml(path.code)}</span><h1>${escapeHtml(path.title)}</h1><p>${escapeHtml(path.summary)}</p></section>
    <div class="pathway-overview"><span>${escapeHtml(difficulty)}</span><span>${sequence.length} étape(s)</span><span>${path.estimated_duration_minutes ? `${path.estimated_duration_minutes} minutes estimées` : "Durée à définir"}</span>${currentSession && enrolled ? `<span>${pathProgress.percent}% acquis</span>` : ""}</div>
    ${currentSession
      ? enrolled ? `<p class="enrollment-state">Inscription active à ce parcours.</p>` : `<button class="button button-primary" id="enroll-path" data-path-id="${escapeHtml(path.id)}">S’inscrire à ce parcours ↗</button>`
      : `<p class="progress-note"><a href="#/espace">Connecte-toi</a> pour t’inscrire et suivre tes acquis.</p>`}
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">SÉQUENCE D’APPRENTISSAGE</span><h2>Étapes et prérequis</h2></div></div>
    <div class="path-sequence">${steps || emptyState("Séquence en préparation", "Les ressources seront ajoutées au parcours après validation.")}</div></section>
    ${requiredAssessments.length ? `<section class="section-block"><div class="section-heading"><div><span class="eyebrow">CONTRÔLE DES ACQUIS</span><h2>Évaluations du parcours</h2></div></div><div class="assessment-path-list">${requiredAssessments.map((item)=>{const assessment=(data.assessments||[]).find((entry)=>entry.id===item.assessment_id);const attempt=(data.assessmentAttempts||[]).filter((entry)=>entry.assessment_id===item.assessment_id&&entry.status==="SUBMITTED").sort((a,b)=>b.attempt_number-a.attempt_number)[0];return assessment?`<article class="assessment-path-row"><div><b>${escapeHtml(assessment.title)}</b><small>${item.is_required?"OBLIGATOIRE":"COMPLÉMENTAIRE"} · Seuil ${item.minimum_score}%</small></div><span>${attempt?.passed&&Number(attempt.score)>=Number(item.minimum_score)?"Validée ✓":attempt?`${Number(attempt.score).toFixed(0)} % · à repasser`:"À effectuer"}</span><a class="text-link" href="#/evaluations/${encodeURIComponent(assessment.id)}">Ouvrir ↗</a></article>`:''}).join("")}</div></section>` : ""}
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">RÉSULTATS D’APPRENTISSAGE</span><h2>Compétences visées</h2></div></div>
    ${competencies.length ? `<div class="competency-list">${competencies.map((item) => `<div class="competency-chip"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.competency_level)}</span></div>`).join("")}</div>` : emptyState("Compétences en cours de définition", "Les compétences seront associées aux ressources du parcours.")}</section>
    ${certificate ? `<section class="certificate-issued"><span class="eyebrow">CERTIFICATION OBTENUE</span><b>${escapeHtml(certificate.certificate_title)}</b><a class="text-link" href="#/certificat/${encodeURIComponent(certificate.certificate_code)}">Consulter le certificat · ${escapeHtml(certificate.certificate_code)} ↗</a></section>` : certificateReady ? `<section class="certificate-ready"><span class="eyebrow">PARCOURS VALIDÉ</span><h2>Conditions de certification remplies</h2><button class="button button-primary" id="issue-path-certificate" data-path-id="${escapeHtml(path.id)}">Émettre mon certificat ↗</button></section>` : ""}
    <p class="progress-note">${currentSession ? "Ta progression est synchronisée avec ton compte apprenant." : "Connecte-toi à l’espace apprenant pour enregistrer tes acquis et déverrouiller les étapes suivantes."}</p>`;
}

function atlasView() {
  return `<section class="page-intro"><span class="eyebrow">CARTOGRAPHIE DES CONNAISSANCES</span><h1>Atlas</h1><p>Explorer les relations entre départements, domaines et ressources. Déplace la carte par glisser-déposer et utilise la molette ou les contrôles pour zoomer.</p></section>
  <div class="atlas-panel"><div class="atlas-toolbar"><span><b>${data.nodes.length}</b> nœud(s) public(s)</span><span>${data.edges.length} relation(s) publique(s)</span></div>
  ${data.nodes.length ? renderAtlasGraph(data.nodes, data.edges) : emptyState("L’Atlas public est encore vide", "Le moteur 2D est en place. Les nœuds et relations apparaîtront ici après leur publication éditoriale.")}</div>
  <div class="atlas-legend"><span class="legend-department">Département</span><span class="legend-domain">Domaine</span><span class="legend-content">Ressource</span><span class="legend-pathway">Parcours</span></div>`;
}

function loginView() {
  return `<section class="page-intro"><span class="eyebrow">ESPACE PERSONNEL</span><h1>Espace apprenant</h1><p>Connecte-toi pour t’inscrire aux parcours et conserver ton historique d’apprentissage.</p></section>
    <section class="auth-panel"><form id="login-form" class="auth-form">
      <label for="login-email">Adresse e-mail</label><input id="login-email" name="email" type="email" autocomplete="username" required>
      <label for="login-password">Mot de passe</label><input id="login-password" name="password" type="password" autocomplete="current-password" required>
      <button class="button button-primary" type="submit">Se connecter <span>↗</span></button>
      <p id="auth-feedback" class="auth-feedback" role="status" aria-live="polite"></p>
      <p class="auth-footnote">Les comptes apprenants sont gérés par l’administration de l’Academy. La création publique de comptes n’est pas activée dans cette interface.</p>
    </form></section>`;
}

function learnerPathCard(path) {
  const items = data.pathItems.filter((item) => item.path_id === path.id);
  const progress = buildPathProgress(items, data.pathItemProgress);
  return `<a class="pathway-card learner-path-card" href="#/parcours/${encodeURIComponent(path.slug)}">
    <span class="eyebrow">PARCOURS · ${escapeHtml(path.difficulty_level || "FORMATION")}</span>
    <h3>${escapeHtml(path.title)}</h3>
    <p>${escapeHtml(path.summary || "Parcours pédagogique.")}</p>
    <div class="learner-progress-track" role="progressbar" aria-valuenow="${progress.percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Progression du parcours">
      <span style="width:${progress.percent}%"></span>
    </div>
    <span class="pathway-meta">${progress.completedRequired}/${progress.totalRequired} étape(s) obligatoires <b>${progress.percent}%</b></span>
  </a>`;
}

function learnerDashboardView() {
  const user = currentSession?.user;
  const enrolledPaths = data.enrollments.map((record) => ({
    ...record,
    path: data.learningPaths.find((path) => path.id === record.path_id)
  })).filter((record) => record.path);
  const completed = data.progress.filter((record) => record.progress_status === "COMPLETED").length;
  const inProgress = data.progress.filter((record) => record.progress_status === "IN_PROGRESS").length;
  return `<section class="page-intro"><span class="eyebrow">ESPACE PERSONNEL</span><h1>Tableau de bord</h1><p>${escapeHtml(user?.email || "Apprenant")} · suivi individuel des apprentissages.</p></section>
    <div class="learner-stats"><article><strong>${enrolledPaths.length}</strong><span>Parcours suivis</span></article><article><strong>${completed}</strong><span>Ressources acquises</span></article><article><strong>${inProgress}</strong><span>En cours</span></article></div>
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">MES APPRENTISSAGES</span><h2>Mes parcours</h2></div><a class="text-link" href="#/parcours">Explorer les parcours →</a></div>
    ${data.memberError ? `<p class="progress-note">Synchronisation du suivi momentanément indisponible : ${escapeHtml(data.memberError)}</p>` : ""}
    ${enrolledPaths.length ? `<div class="pathway-grid">${enrolledPaths.map((record) => learnerPathCard(record.path)).join("")}</div>` : emptyState("Aucun parcours suivi", "Inscris-toi à un parcours publié pour retrouver ici tes étapes et tes ressources.")}</section>
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">ACTIVITÉ INDIVIDUELLE</span><h2>Ressources acquises</h2></div></div>
    ${completed ? `<div class="resource-list">${data.progress.filter((record) => record.progress_status === "COMPLETED").map((record) => {
      const resource = data.content.find((item) => item.id === record.content_id);
      return resource ? resourceCards([resource]) : "";
    }).join("")}</div>` : emptyState("Aucun acquis enregistré", "Les ressources que tu valides apparaîtront dans cet espace.")}</section>
    ${hasEditorialAccess(data.membership) ? `<a class="button button-outline" href="#/administration">Ouvrir l’espace éditorial ↗</a>` : ""}
    <button class="button button-outline" id="logout">Se déconnecter</button>`;
}

function trainingCatalogView() {
  const offerings=data.publicTrainingOfferings||[];
  const sessions=data.publicTrainingSessions||[];
  const enrollments=data.trainingEnrollments||[];
  const account=currentSession?.user||null;
  const email=account?.email||"";
  const profile=account?.user_metadata||{};
  const suggestedName=profile.full_name||profile.name||"";
  const labels={PRIVATE_WORKSHOP:"Atelier BA Labs",PARTNER_DELIVERED:"Programme opéré avec partenaire",APPROVED_ESTABLISHMENT:"Programme via établissement partenaire"};
  const modes={IN_PERSON:"Présentiel",HYBRID:"Hybride",DISTANCE:"À distance",ALTERNATING:"Alterné"};
  const statusLabels={PENDING:"Demande reçue · en attente de confirmation",CONFIRMED:"Inscription confirmée",WAITLISTED:"Liste d’attente",COMPLETED:"Participation terminée",NO_SHOW:"Absence enregistrée"};
  const sessionMarkup=(session)=>{
    const existing=account?enrollments.find(item=>item.session_id===session.id&&item.user_id===account.id&&item.enrollment_status!=="CANCELLED"):null;
    const opens=session.registration_opens_at?new Date(session.registration_opens_at):null;
    const closes=session.registration_closes_at?new Date(session.registration_closes_at):null;
    const now=Date.now();
    const notOpen=opens&&opens.getTime()>now;
    const closed=closes&&closes.getTime()<now;
    const windowNote=notOpen?`Ouverture des inscriptions : ${opens.toLocaleString("fr-FR")}`:closed?"Les inscriptions sont closes.":"";
    const registration=existing
      ? `<p class="training-enrollment-state" role="status">${escapeHtml(statusLabels[existing.enrollment_status]||existing.enrollment_status)}</p>`
      : notOpen||closed
        ? `<p class="progress-note">${escapeHtml(windowNote)}</p>`
        : !account
          ? '<a class="button button-outline training-enroll-login" href="#/espace">Se connecter pour s’inscrire ↗</a>'
          : !email
            ? '<p class="progress-note">Une adresse e-mail vérifiée est nécessaire pour l’inscription.</p>'
            : `<form class="training-public-enroll-form" data-training-enroll="${escapeHtml(session.id)}">
                <label>Nom et prénom<input name="participant_name" required maxlength="120" value="${escapeHtml(suggestedName)}" placeholder="Nom complet"></label>
                <label>Profil<select name="participant_category"><option value="OTHER">Autre</option><option value="STUDENT">Étudiant</option><option value="EMPLOYEE">Salarié</option><option value="SELF_EMPLOYED">Indépendant</option><option value="JOB_SEEKER">Demandeur d’emploi</option></select></label>
                <p class="training-account-email">Compte utilisé : ${escapeHtml(email)}</p>
                <button class="button button-primary" type="submit">Demander mon inscription ↗</button>
                <p class="training-enroll-feedback" role="status" aria-live="polite"></p>
              </form>`;
    return `<div class="training-public-session"><div><span>${new Date(session.starts_at).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"})} – ${new Date(session.ends_at).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"})}</span><small>${escapeHtml(modes[session.delivery_mode]||session.delivery_mode)}</small></div>${registration}</div>`;
  };
  return `<section class="page-intro"><span class="eyebrow">BA LABS ACADEMY · FORMATIONS COURTES</span><h1>Formations & ateliers</h1><p>Catalogue public des offres activées et des prochaines sessions ouvertes. L’inscription est réservée aux comptes apprenants connectés ; la capacité et les délais sont contrôlés par le serveur.</p></section>
  ${offerings.length?`<div class="training-public-grid">${offerings.map(o=>{
    const upcoming=sessions.filter(s=>s.offering_id===o.id);
    return `<article class="training-public-card"><span class="eyebrow">${escapeHtml(o.specialty_code)} · ${escapeHtml(o.audience_profile==="MIXED"?"Public mixte":o.audience_profile==="PROFESSIONAL"?"Professionnels":"Tout public")}</span><h2>${escapeHtml(o.title)}</h2><p>${escapeHtml(o.description||"Présentation détaillée à venir.")}</p><div class="training-public-meta"><span>${escapeHtml(labels[o.delivery_regime]||"Formation")}</span><span>${Number(o.default_duration_days||0)} jour(s)</span></div>${upcoming.length?`<div class="training-public-sessions"><b>Sessions ouvertes</b>${upcoming.map(sessionMarkup).join("")}</div>`:'<p class="progress-note">Aucune session ouverte pour le moment.</p>'}</article>`;
  }).join("")}</div>`:emptyState("Le catalogue de formations est en préparation","Les offres seront affichées ici après leur validation et leur activation dans l’espace Academy.")}`;
}
function trainingOperationsView(membership) {
  const canEdit = ["OWNER","ADMIN","EDITOR"].includes(membership.role);
  const canManage = ["OWNER","ADMIN"].includes(membership.role);
  const partners = data.trainingPartners || [];
  const agreements = data.trainingAgreements || [];
  const offerings = data.trainingOfferings || [];
  const sessions = data.trainingSessions || [];
  const enrollments = data.trainingEnrollments || [];
  const attendance = data.trainingAttendance || [];
  const documents = data.trainingDocuments || [];
  const offeringOptions = offerings.filter(x=>x.status==="ACTIVE").map(x=>'<option value="'+escapeHtml(x.id)+'">'+escapeHtml(x.offering_code+' · '+x.title)+'</option>').join("");
  const partnerSummary = partners.map(p=>'<article class="training-mini-row"><div><b>'+escapeHtml(p.legal_name)+'</b><small>'+escapeHtml(p.partner_code)+' · '+escapeHtml(p.approval_authority||"Autorité non renseignée")+' · '+escapeHtml(p.status)+'</small></div><span>'+escapeHtml(p.approval_number||"Agrément à documenter")+'</span>'+(canManage&&p.status==="DRAFT"?'<button class="button button-outline" data-training-reference-status="PARTNER" data-id="'+escapeHtml(p.id)+'" data-next="ACTIVE">Valider</button>':'')+'</article>').join("") || emptyState("Aucun partenaire référencé","Les partenaires agréés seront ajoutés après vérification de leurs pièces et de leur périmètre d'autorisation.");
  const agreementSummary = agreements.map(a=>'<article class="training-mini-row"><div><b>'+escapeHtml(a.agreement_title)+'</b><small>'+escapeHtml(a.agreement_code)+' · '+escapeHtml(a.status)+' · Émetteur : '+escapeHtml(a.document_issuer)+'</small></div><span>'+escapeHtml(a.billing_responsibility)+'</span>'+(canManage&&a.status==="DRAFT"?'<button class="button button-outline" data-training-reference-status="AGREEMENT" data-id="'+escapeHtml(a.id)+'" data-next="ACTIVE">Activer</button>':'')+'</article>').join("") || emptyState("Aucune convention enregistrée","Aucune convention partenaire n'est présumée active.");
  const offeringRows = offerings.map(o=>{
    const partner=partners.find(p=>p.id===o.partner_id);
    const agreement=agreements.find(a=>a.id===o.agreement_id);
    return '<article class="training-operation-row"><div><span class="eyebrow">'+escapeHtml(o.offering_code)+' · '+escapeHtml(o.status)+'</span><b>'+escapeHtml(o.title)+'</b><small>'+escapeHtml(o.specialty_code)+' · '+escapeHtml(o.audience_profile)+' · '+escapeHtml(o.delivery_regime)+' · '+Number(o.default_duration_days||0)+' j · capacité '+o.default_capacity+'</small><small>'+(partner?escapeHtml(partner.legal_name)+' / '+escapeHtml(agreement?.agreement_code||"Convention inconnue"):"Régime interne BA Labs")+'</small></div><div class="training-operation-actions">'+(canManage&&o.status==="DRAFT"?'<button class="button button-outline" data-training-status="OFFERING" data-id="'+escapeHtml(o.id)+'" data-next="ACTIVE">Activer</button>': '<span class="taxonomy-state">'+escapeHtml(o.status)+'</span>')+'</div></article>';
  }).join("") || emptyState("Catalogue de formations vide","Le modèle est prêt. Les premières offres seront créées après validation de leur régime.");
  const sessionRows = sessions.map(s=>{
    const o=offerings.find(x=>x.id===s.offering_id);
    const enrolled=enrollments.filter(e=>e.session_id===s.id);
    const occupied=enrolled.filter(e=>["PENDING","CONFIRMED","COMPLETED"].includes(e.enrollment_status)).length;
    return '<article class="training-session-card"><div class="training-session-head"><div><span class="eyebrow">'+escapeHtml(s.session_code)+' · '+escapeHtml(s.status)+'</span><h3>'+escapeHtml(o?.title||"Offre indisponible")+'</h3><p>'+new Date(s.starts_at).toLocaleString("fr-FR")+' — '+new Date(s.ends_at).toLocaleString("fr-FR")+'</p><small>'+escapeHtml(s.venue_code)+' · '+escapeHtml(s.delivery_mode)+' · '+occupied+'/'+s.capacity+' places occupées</small></div>'+(canManage&&s.status==="DRAFT"?'<button class="button button-outline" data-training-status="SESSION" data-id="'+escapeHtml(s.id)+'" data-next="OPEN">Ouvrir inscriptions</button>': '<span class="taxonomy-state">'+escapeHtml(s.status)+'</span>')+'</div>'+
    (enrolled.length?'<div class="training-participant-list">'+enrolled.map(e=>{
      const attendanceRows=attendance.filter(a=>a.enrollment_id===e.id);
      const docRows=documents.filter(d=>d.enrollment_id===e.id);
      const billingRows=(data.trainingBilling||[]).filter(x=>x.enrollment_id===e.id);
      const privateRoute=o?.delivery_regime==="PRIVATE_WORKSHOP";
      const agreement=agreements.find(a=>a.id===o?.agreement_id);
      const docOptions=privateRoute?'<option value="PARTICIPATION_ATTESTATION">Attestation de participation</option><option value="PRACTICAL_COMPLETION_ATTESTATION">Attestation de réalisation pratique</option>':(agreement?.document_issuer==="PARTNER"?'<option value="PARTNER_CERTIFICATE">Certificat partenaire</option><option value="STATE_RECOGNIZED_CERTIFICATE">Certificat reconnu (partenaire)</option>':'<option value="STATE_RECOGNIZED_CERTIFICATE">Certificat reconnu (autorité)</option>');
      const issuerOptions=privateRoute?'<input type="hidden" name="issuer_kind" value="BA_LABS_PRIVATE">':(agreement?.document_issuer==="PARTNER"?'<select name="issuer_kind" required><option value="APPROVED_PARTNER">Partenaire agréé</option><option value="PUBLIC_AUTHORITY">Autorité publique</option></select>':'<select name="issuer_kind" required><option value="PUBLIC_AUTHORITY">Autorité publique</option></select>');
      const issuerReference=privateRoute?'':'<input name="issuer_reference" required maxlength="160" placeholder="Référence d’émission / décision">';
      const billingOwners=privateRoute?["BA_LABS"]:agreement?.billing_responsibility==="SPLIT"?["BA_LABS","PARTNER"]:agreement?.billing_responsibility==="BA_LABS"?["BA_LABS"]:agreement?.billing_responsibility==="PARTNER"?["PARTNER"]:[];
      const billingOwnerOptions=billingOwners.map(owner=>'<option value="'+owner+'">'+(owner==="BA_LABS"?"BA Labs":"Partenaire")+'</option>').join("");
      const billingUi=(billingRows.length?'<div class="training-document-list training-billing-list">'+billingRows.map(b=>'<div><span>'+escapeHtml(b.external_invoice_reference)+' · '+(Number(b.amount_minor_units)/100).toLocaleString("fr-FR",{minimumFractionDigits:2})+' '+escapeHtml(b.currency_code)+' · '+escapeHtml(b.payment_status)+'</span>'+(canManage?'<form class="training-inline-form" data-training-billing-update="'+escapeHtml(b.id)+'"><input type="hidden" name="enrollment_id" value="'+escapeHtml(e.id)+'"><input type="hidden" name="billing_owner" value="'+escapeHtml(b.billing_owner)+'"><input type="hidden" name="external_invoice_reference" value="'+escapeHtml(b.external_invoice_reference)+'"><input type="hidden" name="currency_code" value="'+escapeHtml(b.currency_code)+'"><input type="hidden" name="amount_minor_units" value="'+escapeHtml(b.amount_minor_units)+'"><select name="payment_status"><option value="UNPAID" '+(b.payment_status==="UNPAID"?"selected":"")+ '>Impayé</option><option value="PARTIALLY_PAID" '+(b.payment_status==="PARTIALLY_PAID"?"selected":"")+ '>Partiel</option><option value="PAID" '+(b.payment_status==="PAID"?"selected":"")+ '>Payé</option><option value="REFUNDED" '+(b.payment_status==="REFUNDED"?"selected":"")+ '>Remboursé</option><option value="CANCELLED" '+(b.payment_status==="CANCELLED"?"selected":"")+ '>Annulé</option></select><input name="accounting_note" required placeholder="Note d’audit"><button class="button button-outline" type="submit">Mettre à jour</button></form>':'')+'</div>').join("")+'</div>':'')+(canManage&&billingOwners.length?'<form class="training-inline-form" data-training-billing="'+escapeHtml(e.id)+'"><select name="billing_owner">'+billingOwnerOptions+'</select><input name="external_invoice_reference" required maxlength="120" placeholder="Référence facture"><input name="amount_da" type="number" min="0" step="0.01" required placeholder="Montant DA"><select name="payment_status"><option value="UNPAID">Impayé</option><option value="PARTIALLY_PAID">Partiel</option><option value="PAID">Payé</option></select><input name="accounting_note" placeholder="Note comptable"><button class="button button-outline" type="submit">Facturation</button></form>':'');

      return '<article class="training-participant-row"><div class="training-participant-meta"><b>'+escapeHtml(e.participant_name)+'</b><small>'+escapeHtml(e.participant_email)+' · '+escapeHtml(e.participant_category)+' · '+escapeHtml(e.enrollment_status)+'</small><small>'+attendanceRows.length+' présence(s) · '+docRows.length+' document(s)</small></div><div class="training-participant-controls">'+(canEdit?'<form class="training-inline-form" data-training-enrollment-status="'+escapeHtml(e.id)+'"><select name="status">'+(e.enrollment_status==="WAITLISTED"?'<option value="PENDING">Admettre</option><option value="CANCELLED">Annuler</option>':'<option value="CONFIRMED">Confirmer</option><option value="COMPLETED">Terminer</option><option value="NO_SHOW">Absent</option><option value="CANCELLED">Annuler</option><option value="PENDING">En attente</option>')+'</select><button class="button button-outline" type="submit">Appliquer</button></form>'+
      (["PENDING","CONFIRMED","COMPLETED"].includes(e.enrollment_status)?'<form class="training-inline-form" data-training-attendance="'+escapeHtml(e.id)+'"><input name="date" type="date" required value="'+escapeHtml((s.starts_at||"").slice(0,10))+'"><select name="status"><option value="PRESENT">Présent</option><option value="LATE">En retard</option><option value="ABSENT">Absent</option><option value="EXCUSED">Excusé</option></select><input name="minutes" type="number" min="0" max="1440" value="0" aria-label="Minutes"><button class="button button-outline" type="submit">Présence</button></form>':'')+
      (canManage&&e.enrollment_status==="COMPLETED"&&!docRows.some(d=>!d.revoked_at)?'<form class="training-inline-form" data-training-issue="'+escapeHtml(e.id)+'"><select name="document_type">'+docOptions+'</select>'+issuerOptions+issuerReference+'<input name="title" required maxlength="200" placeholder="Intitulé du document"><button class="button button-primary" type="submit">Émettre</button></form>':''):'')+
      (docRows.length?'<div class="training-document-list">'+docRows.map(d=>'<div><span>'+escapeHtml(d.document_code)+' · '+escapeHtml(d.document_type)+' · '+(d.revoked_at?"RÉVOQUÉ":"ACTIF")+'</span>'+(canManage&&!d.revoked_at?'<button class="text-link" data-training-revoke="'+escapeHtml(d.id)+'">Révoquer</button>':'')+'</div>').join("")+'</div>':'')+billingUi+'</div></article>';
    }).join("")+'</div>':emptyState("Aucune inscription","Les participants apparaîtront ici lorsque les inscriptions seront ouvertes."))+'</article>';
  }).join("") || emptyState("Aucune session programmée","Crée une session à partir d'une offre activée.");
  return '<section class="section-block training-operations" id="training-operations"><div class="section-heading"><div><span class="eyebrow">FORMATION CONTINUE · OPÉRATIONS</span><h2>Gestion des formations</h2></div><span class="resource-level">'+offerings.length+' offre(s) · '+sessions.length+' session(s) · '+enrollments.length+' inscription(s)</span></div>'+
    '<p class="taxonomy-intro">Cette console gère les ateliers internes et les parcours opérés avec partenaire. Les statuts d’agrément et conventions sont affichés comme données documentaires ; aucune reconnaissance réglementaire n’est déduite automatiquement.</p>'+
    '<div class="training-reference-grid"><section><h3>Partenaires référencés</h3>'+partnerSummary+(canManage?'<form id="training-partner-form" class="training-form"><h3>Référencer un partenaire — brouillon</h3><input name="partner_code" required placeholder="Code partenaire"><input name="legal_name" required placeholder="Dénomination légale"><input name="approval_number" placeholder="Numéro d’agrément"><input name="approval_authority" placeholder="Autorité d’agrément"><div class="training-form-grid"><label>Valide à partir du<input type="date" name="approval_valid_from"></label><label>Valide jusqu’au<input type="date" name="approval_valid_until"></label></div><label>Spécialités autorisées (codes séparés par virgule)<input name="approved_specialties" placeholder="MYCOLOGY, MICROBIOLOGY"></label><label>Modes autorisés<select name="approved_delivery_modes" multiple size="4"><option value="IN_PERSON">Présentiel</option><option value="HYBRID">Hybride</option><option value="DISTANCE">À distance</option><option value="ALTERNATING">Alterné</option></select></label><button class="button button-outline" type="submit">Enregistrer le brouillon</button><p id="training-partner-feedback" class="auth-feedback"></p></form>':'')+'</section><section><h3>Conventions</h3>'+agreementSummary+(canManage?'<form id="training-agreement-form" class="training-form"><h3>Créer une convention — brouillon</h3><label>Partenaire actif<select name="partner_id" required>'+partners.filter(p=>p.status==="ACTIVE").map(p=>'<option value="'+escapeHtml(p.id)+'">'+escapeHtml(p.legal_name)+'</option>').join("")+'</select></label><input name="agreement_code" required placeholder="Code convention"><input name="agreement_title" required placeholder="Intitulé de la convention"><div class="training-form-grid"><label>Début validité<input type="date" name="valid_from"></label><label>Fin validité<input type="date" name="valid_until"></label><label>Date de signature<input type="date" name="signed_at"></label><label>Facturation<select name="billing_responsibility"><option value="UNDECIDED">À définir</option><option value="BA_LABS">BA Labs</option><option value="PARTNER">Partenaire</option><option value="SPLIT">Partagée</option></select></label><label>Émetteur des documents<select name="document_issuer"><option value="UNDECIDED">À définir</option><option value="PARTNER">Partenaire</option><option value="BA_LABS_PRIVATE">BA Labs (attestation privée)</option></select></label></div><label>Spécialités couvertes (codes séparés par virgule)<input name="permitted_specialties" required placeholder="MYCOLOGY"></label><label>Lieux autorisés (codes séparés par virgule)<input name="permitted_venues" required placeholder="LAB-SETIF"></label><label>Modes autorisés<select name="permitted_delivery_modes" multiple size="4"><option value="IN_PERSON">Présentiel</option><option value="HYBRID">Hybride</option><option value="DISTANCE">À distance</option><option value="ALTERNATING">Alterné</option></select></label><button class="button button-outline" type="submit" '+(!partners.some(p=>p.status==="ACTIVE")?'disabled':'')+'>Enregistrer le brouillon</button><p id="training-agreement-feedback" class="auth-feedback"></p></form>':'')+'</section></div>'+
    '<section class="training-subsection"><div class="section-heading"><div><span class="eyebrow">01 · CATALOGUE</span><h3>Offres de formation</h3></div></div>'+offeringRows+
    (canEdit?'<form id="training-offering-form" class="training-form"><h3>Créer une offre interne</h3><input name="offering_code" required maxlength="60" placeholder="Code offre · ex. BA-MYC-001"><input name="title" required maxlength="200" placeholder="Intitulé de la formation"><input name="specialty_code" required placeholder="Code spécialité"><textarea name="description" placeholder="Description opérationnelle"></textarea><div class="training-form-grid"><label>Public<select name="audience_profile"><option value="MIXED">Mixte</option><option value="PUBLIC">Public</option><option value="PROFESSIONAL">Professionnels</option></select></label><label>Régime<select name="delivery_regime"><option value="PRIVATE_WORKSHOP">Atelier privé BA Labs</option><option value="PARTNER_DELIVERED">Opéré avec partenaire</option><option value="APPROVED_ESTABLISHMENT">Établissement agréé</option></select></label><label>Partenaire<select name="partner_id"><option value="">Non applicable</option>'+partners.map(p=>'<option value="'+escapeHtml(p.id)+'">'+escapeHtml(p.legal_name)+'</option>').join("")+'</select></label><label>Convention<select name="agreement_id"><option value="">Non applicable</option>'+agreements.map(a=>'<option value="'+escapeHtml(a.id)+'">'+escapeHtml(a.agreement_code)+'</option>').join("")+'</select></label><label>Durée (jours)<input name="default_duration_days" type="number" min="0.5" max="90" step="0.5" value="2"></label><label>Capacité<input name="default_capacity" type="number" min="1" max="100" value="10"></label></div><button class="button button-primary" type="submit">Enregistrer le brouillon ↗</button><p class="auth-feedback" id="training-offering-feedback" role="status"></p></form>':'')+'</section>'+
    '<section class="training-subsection"><div class="section-heading"><div><span class="eyebrow">02 · CALENDRIER</span><h3>Sessions</h3></div></div>'+sessionRows+
    (canEdit?'<form id="training-session-form" class="training-form"><h3>Programmer une session</h3><label>Offre active<select name="offering_id" required>'+offeringOptions+'</select></label><div class="training-form-grid"><label>Code session<input name="session_code" required maxlength="80" placeholder="BA-MYC-001-2027-01"></label><label>Lieu / code du site<input name="venue_code" required placeholder="LAB-SETIF"></label><label>Début<input name="starts_at" type="datetime-local" required></label><label>Fin<input name="ends_at" type="datetime-local" required></label><label>Mode<select name="delivery_mode"><option value="IN_PERSON">Présentiel</option><option value="HYBRID">Hybride</option><option value="DISTANCE">À distance</option><option value="ALTERNATING">Alterné</option></select></label><label>Capacité<input name="capacity" type="number" min="1" max="100" value="10"></label><label>Ouverture inscriptions<input name="registration_opens_at" type="datetime-local"></label><label>Clôture inscriptions<input name="registration_closes_at" type="datetime-local"></label></div><button class="button button-primary" type="submit" '+(!offeringOptions?'disabled':'')+'>Enregistrer la session brouillon ↗</button><p class="auth-feedback" id="training-session-feedback" role="status"></p></form>':'')+'</section>'+
    '<section class="training-subsection"><div class="section-heading"><div><span class="eyebrow">03 · DOCUMENTS</span><h3>Registre des attestations et certificats</h3></div></div>'+
    (documents.length?'<div class="training-document-register">'+documents.map(d=>{const e=enrollments.find(x=>x.id===d.enrollment_id);return '<article><div><b>'+escapeHtml(d.document_code)+'</b><small>'+escapeHtml(e?.participant_name||"Participant")+' · '+escapeHtml(d.title)+' · '+escapeHtml(d.issuer_name)+'</small></div><span class="'+(d.revoked_at?"is-revoked":"is-valid")+'">'+(d.revoked_at?"RÉVOQUÉ":"ACTIF")+'</span></article>';}).join("")+'</div>':emptyState("Aucun document émis","Les documents apparaîtront après validation de la présence et clôture de l’inscription."))+
    '<form id="training-document-verify-form" class="certificate-verify-form"><label>Vérifier un jeton de document</label><input name="token" maxlength="64" pattern="[a-fA-F0-9]{64}" placeholder="Jeton QR (64 caractères)" required><button class="button button-outline" type="submit">Vérifier</button></form><div id="training-document-verify-result" aria-live="polite"></div></section></section>';
}

function trainingVerificationView(token="") {
 return '<section class="page-intro"><span class="eyebrow">REGISTRE PUBLIC · DOCUMENTS DE FORMATION</span><h1>Vérification d’une attestation</h1><p>Le registre confirme uniquement le statut et les métadonnées minimales du document. Aucune donnée personnelle du participant n’est publiée.</p></section><form id="training-public-verify-form" class="certificate-verify-form"><label>Jeton de vérification</label><input name="token" maxlength="64" pattern="[a-fA-F0-9]{64}" value="'+escapeHtml(token)+'" required><button class="button button-primary" type="submit">Vérifier ↗</button></form><div id="training-public-verify-result" aria-live="polite"></div>';
}

function programmeAdministrationSectionView() {
 const programs=(data.editorialPrograms||[]).filter(item=>item.status==="DRAFT");
 return '<section class="section-block pathway-editorial"><div class="section-heading"><div><span class="eyebrow">ARCHITECTURE DES CURSUS</span><h2>Programmes pédagogiques</h2></div><a class="button button-primary" href="#/administration/programmes/nouveau">Structurer un programme ↗</a></div>'+
 '<p class="taxonomy-intro">Définir les cursus, leur ancrage disciplinaire et leur hiérarchie de cycles, années, semestres, blocs, modules et unités. Cette étape ne crée aucun cours ni support pédagogique.</p>'+
 '<div class="editorial-path-list">'+(programs.map(program=>{
  const nodeCount=(data.editorialProgramNodes||[]).filter(node=>node.program_id===program.id).length;
  const departmentCount=(data.editorialProgramDepartments||[]).filter(link=>link.program_id===program.id).length;
  return '<a class="editorial-path-row" href="#/administration/programmes/'+encodeURIComponent(program.id)+'"><div><span class="eyebrow">'+escapeHtml(program.code)+' · '+escapeHtml(program.program_type)+' · BROUILLON</span><h3>'+escapeHtml(program.title)+'</h3><p>'+nodeCount+' niveau(x) structurel(s) · '+departmentCount+' département(s) associé(s)</p></div><b>Modifier ↗</b></a>';
 }).join('')||'<div class="empty-state"><h3>Aucun programme structuré</h3><p>Crée les premiers squelettes de cursus après validation de leur périmètre disciplinaire.</p></div>')+'</div></section>';
}

function administrationView() {
  if (!currentSession?.user) return loginView();
  const membership = data.membership;
  if (!hasEditorialAccess(membership)) {
    return `<section class="page-intro"><span class="eyebrow">CONTRÔLE D’ACCÈS</span><h1>Espace éditorial</h1><p>Cette zone est réservée aux membres actifs de l’équipe Academy.</p></section>
      ${emptyState("Accès non attribué", "Ton compte est authentifié, mais aucune fonction éditoriale ne lui est associée. L’accès est contrôlé côté base de données.")}`;
  }
  const roleDetails = {
    OWNER: ["Propriétaire", "Pilotage complet et contrôle des publications."],
    ADMIN: ["Administration", "Gestion éditoriale et validation des publications."],
    EDITOR: ["Édition", "Création, modification et soumission des contenus pour revue."],
    REVIEWER: ["Révision", "Examen des contenus soumis et décisions de revue."]
  };
  const [roleTitle, roleDescription] = roleDetails[membership.role] || ["Membre", "Accès limité."];
  const capabilityLabels = {
    CREATE_CONTENT: "Créer des brouillons",
    EDIT_CONTENT: "Modifier les contenus",
    SUBMIT_REVIEW: "Soumettre à la revue",
    REVIEW_CONTENT: "Examiner les contenus",
    PUBLISH_CONTENT: "Publier les contenus"
  };
  const capabilities = getRoleCapabilities(membership.role);
  return `<section class="page-intro"><span class="eyebrow">GOUVERNANCE ACADÉMIQUE</span><h1>Espace éditorial</h1><p>Console de travail réservée aux membres actifs de BA Labs Academy.</p></section>
    <div class="editorial-role"><span class="eyebrow">RÔLE ACTIF</span><h2>${escapeHtml(roleTitle)}</h2><p>${escapeHtml(roleDescription)}</p>
      <div class="capability-list">${capabilities.map((capability) => `<span>${escapeHtml(capabilityLabels[capability] || capability)}</span>`).join("")}</div>
    </div>
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">WORKFLOW ÉDITORIAL</span><h2>Chaîne de publication</h2></div></div>
    <div class="editorial-stages"><article><b>01</b><h3>Brouillon</h3><p>Préparation et structuration d’un contenu.</p></article><article><b>02</b><h3>Revue</h3><p>Soumission et examen par les rôles autorisés.</p></article><article><b>03</b><h3>Publication</h3><p>Validation finale et diffusion publique contrôlée.</p></article></div></section>
    ${["OWNER","ADMIN","EDITOR"].includes(membership.role) ? programmeAdministrationSectionView() : ""}
    ${["OWNER","ADMIN","EDITOR"].includes(membership.role) ? `
    <section class="section-block assessment-editorial">
      <div class="section-heading"><div><span class="eyebrow">ÉVALUATIONS ET CONTRÔLE DES ACQUIS</span><h2>Banque d’évaluations</h2></div><a class="button button-primary" href="#/administration/evaluations/nouveau">Créer une évaluation ↗</a></div>
      <p class="taxonomy-intro">Les évaluations sont versionnées, réutilisables dans plusieurs parcours et corrigées côté serveur. Les clés de réponse ne sont pas exposées aux apprenants.</p>
      <div class="editorial-path-list">${(data.editorialAssessments||[]).map((item)=>`<article class="resource-editorial-row"><div class="resource-editorial-info"><span class="eyebrow">${escapeHtml(item.code)} · ${escapeHtml(item.status)} · v${escapeHtml(item.version_label)}</span><b>${escapeHtml(item.title)}</b><small>Seuil ${item.pass_score}% · ${item.max_attempts?item.max_attempts+" tentative(s)":"Tentatives illimitées"}</small></div><div class="resource-editorial-actions">${item.status==="DRAFT"?`<a class="button button-outline" href="#/administration/evaluations/${encodeURIComponent(item.id)}">Modifier</a>`:"<span class='taxonomy-state'>"+escapeHtml(item.status)+"</span>"}</div></article>`).join("")||emptyState("Aucune évaluation","La banque est prête. Crée des évaluations lorsque les objectifs pédagogiques seront définis.")}</div>
    </section>
    <section class="section-block pathway-editorial">
      <div class="section-heading"><div><span class="eyebrow">GESTION DES PARCOURS</span><h2>Parcours pédagogiques</h2></div><a class="button button-primary" href="#/administration/parcours/nouveau">Créer un parcours ↗</a></div>
      <div class="editorial-path-list">${(data.editorialPaths || []).filter((path) => path.status === "DRAFT").map((path) => `<a class="editorial-path-row" href="#/administration/parcours/${encodeURIComponent(path.id)}"><div><span class="eyebrow">${escapeHtml(path.code)} · ${escapeHtml(path.status)}</span><h3>${escapeHtml(path.title)}</h3><p>${escapeHtml(path.summary || "Aucun résumé.")}</p></div><b>Modifier ↗</b></a>`).join("") || emptyState("Aucun parcours", "Crée le premier brouillon pédagogique.")}</div>
    </section>` : ""}



    ${["OWNER","ADMIN"].includes(membership.role) ? `
    <section class="section-block membership-governance">
      <div class="section-heading"><div><span class="eyebrow">GOUVERNANCE DES ACCÈS</span><h2>Membres Academy</h2></div></div>
      <p class="taxonomy-intro">Seuls les comptes déjà créés dans Supabase Auth peuvent recevoir un rôle Academy. Les changements sont journalisés. Un administrateur ne peut attribuer que les rôles Editor et Reviewer.</p>
      <form id="membership-form" class="membership-form">
        <label>UUID du compte Supabase<input name="user_id" required minlength="36" maxlength="36" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"></label>
        <label>Rôle<select name="role">${(membership.role==="OWNER"?["OWNER","ADMIN","EDITOR","REVIEWER"]:["EDITOR","REVIEWER"]).map((role)=>'<option value="'+role+'">'+role+'</option>').join("")}</select></label>
        <label>Statut<select name="status"><option value="ACTIVE">ACTIF</option><option value="SUSPENDED">SUSPENDU</option></select></label>
        <label class="wide">Note d’audit<input name="note" maxlength="1000" placeholder="Motif de l’attribution ou du changement"></label>
        <button class="button button-primary" type="submit">Enregistrer le rôle ↗</button>
        <p id="membership-feedback" class="auth-feedback" role="status" aria-live="polite"></p>
      </form>
      <div class="membership-table">
        <div class="membership-table-head"><span>Compte / UUID</span><span>Rôle</span><span>Statut</span></div>
        ${(data.editorialMembers||[]).map((member)=>'<div class="membership-table-row"><span><b>'+escapeHtml(member.email||"Compte sans e-mail")+'</b><small>'+escapeHtml(member.user_id)+'</small></span><span>'+escapeHtml(member.role)+'</span><span class="membership-status '+(member.membership_status==="ACTIVE"?"is-active":"is-suspended")+'">'+escapeHtml(member.membership_status)+'</span></div>').join("") || emptyState("Aucun membre attribué","Le premier Owner doit être provisionné via la procédure sécurisée de bootstrap serveur.")}
      </div>
    </section>` : ""}
    ${trainingOperationsView(membership)}
    <section class="section-block resource-editorial">
      <div class="section-heading"><div><span class="eyebrow">CATALOGUE ÉDITORIAL</span><h2>Ressources pédagogiques</h2></div><a class="button button-primary" href="#/administration/ressources/nouveau">Créer une ressource ↗</a></div>
      <p class="taxonomy-intro">Cycle : brouillon, revue, approbation, publication. La classification disciplinaire alimente l’Atlas.</p>
      <div class="resource-editorial-queue">
        ${(data.editorialContent || []).map((item) => {
          const canEdit = ["OWNER","ADMIN","EDITOR"].includes(membership.role) && item.status === "DRAFT" && ["PLANNED","OUTLINE","DRAFT"].includes(item.editorial_status);
          const canReview = ["OWNER","ADMIN","REVIEWER"].includes(membership.role) && item.status === "DRAFT" && item.editorial_status === "REVIEW";
          const canPublish = ["OWNER","ADMIN"].includes(membership.role) && item.status === "DRAFT" && item.editorial_status === "APPROVED";
          return '<article class="resource-editorial-row"><div class="resource-editorial-info"><span class="eyebrow">' + escapeHtml(item.business_id) + ' · ' + escapeHtml(item.editorial_status) + '</span><b>' + escapeHtml(item.title) + '</b><small>' + escapeHtml(item.resource_type) + ' · ' + escapeHtml(item.language_code) + '</small></div><div class="resource-editorial-actions">' +
            (canEdit ? '<a class="button button-outline" href="#/administration/ressources/' + encodeURIComponent(item.id) + '">Modifier</a><button class="button button-outline" data-content-submit="' + escapeHtml(item.id) + '">Soumettre</button>' : '') +
            (canReview ? '<button class="button button-outline" data-content-review="APPROVE" data-content-id="' + escapeHtml(item.id) + '">Approuver</button><button class="button button-outline" data-content-review="REQUEST_CHANGES" data-content-id="' + escapeHtml(item.id) + '">À corriger</button>' : '') +
            (canPublish ? '<button class="button button-primary" data-content-publish="' + escapeHtml(item.id) + '">Publier</button>' : '') + '</div></article>';
        }).join("") || emptyState("Aucune ressource éditoriale", "Le circuit de création est prêt. Les contenus pourront être ajoutés progressivement.")}
      </div>
    </section>
    <section class="section-block competency-editorial">
      <div class="section-heading"><div><span class="eyebrow">RÉFÉRENTIEL DES COMPÉTENCES</span><h2>Compétences et acquis visés</h2></div>${["OWNER","ADMIN","EDITOR"].includes(membership.role) ? `<a class="button button-primary" href="#/administration/competences/nouveau">Créer une compétence ↗</a>` : ""}</div>
      <p class="taxonomy-intro">Chaque compétence est une entité du référentiel. Ses liens aux ressources alimentent l’Atlas ; la publication reste réservée aux rôles Owner et Admin.</p>
      <div class="competency-queue">
        ${(data.editorialCompetencies || []).map((item) => {
          const mappings = (data.editorialContentCompetencies || []).filter((link) => link.competency_id === item.id).length;
          const editable = ["OWNER","ADMIN","EDITOR"].includes(membership.role) && item.status === "DRAFT";
          const canPublish = ["OWNER","ADMIN"].includes(membership.role) && item.status === "DRAFT";
          return `<article class="taxonomy-row"><div><span class="eyebrow">${escapeHtml(item.code)} · ${escapeHtml(item.status)} · ${escapeHtml(item.competency_level)}</span><b>${escapeHtml(item.title)}</b><small>${mappings} ressource(s) associée(s)</small></div><div class="competency-row-actions">${editable ? `<a class="button button-outline" href="#/administration/competences/${encodeURIComponent(item.id)}">Modifier</a>` : ""}${canPublish ? `<button class="button button-primary" data-competency-publish="${escapeHtml(item.id)}">Publier</button>` : `<span class="taxonomy-state">${escapeHtml(item.visibility)}</span>`}</div></article>`;
        }).join("") || emptyState("Aucune compétence", "Le référentiel est prêt. Crée les premières compétences à partir des acquis réellement visés par les ressources.")}
      </div>
    </section>
    <section class="section-block taxonomy-editorial">
      <div class="section-heading"><div><span class="eyebrow">STRUCTURE ACADÉMIQUE</span><h2>Départements et domaines</h2></div><span class="resource-level">${(data.editorialDepartments || []).length} départements · ${(data.editorialDomains || []).length} domaines</span></div>
      <p class="taxonomy-intro">Référentiel disciplinaire préconfiguré. Les brouillons restent internes ; chaque publication synchronise les nœuds et relations déjà préparés dans l’Atlas.</p>
      <div class="taxonomy-queue">
        <h3>Départements</h3>
        ${(data.editorialDepartments || []).map((item) => `<article class="taxonomy-row"><div><span class="eyebrow">${escapeHtml(item.code)} · ${escapeHtml(item.status)}</span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.slug)}</small></div>${item.status === "DRAFT" && ["OWNER","ADMIN"].includes(membership.role) ? `<button class="button button-outline" data-taxonomy-publish="department" data-code="${escapeHtml(item.code)}">Publier</button>` : `<span class="taxonomy-state">${escapeHtml(item.visibility)}</span>`}</article>`).join("") || emptyState("Aucun département", "Le référentiel ne contient pas de département.")}
      </div>
      <div class="taxonomy-queue">
        <h3>Domaines</h3>
        ${(data.editorialDomains || []).map((item) => {
          const parent = (data.editorialDepartments || []).find((department) => department.code === item.department_code);
          const ready = parent?.status === "PUBLISHED";
          const canPublish = ["OWNER","ADMIN"].includes(membership.role) && item.status === "DRAFT" && ready;
          return `<article class="taxonomy-row"><div><span class="eyebrow">${escapeHtml(item.code)} · ${escapeHtml(item.status)} · ${escapeHtml(item.department_code)}</span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.slug)}</small></div>${canPublish ? `<button class="button button-outline" data-taxonomy-publish="domain" data-code="${escapeHtml(item.code)}">Publier</button>` : `<span class="taxonomy-state">${item.status === "DRAFT" && !ready ? "Département parent requis" : escapeHtml(item.visibility)}</span>`}</article>`;
        }).join("") || emptyState("Aucun domaine", "Le référentiel ne contient pas de domaine.")}
      </div>
    </section>
    <p class="progress-note">Le contrôle d’accès de cette interface est indicatif. Chaque opération éditoriale reste protégée par les contrôles de rôle des fonctions PostgreSQL ; aucun droit n’est accordé par le frontend seul.</p>`;
}


function contentEditorView(contentId = "nouveau") {
 if (!currentSession?.user) return loginView();
 const membership=data.membership;
 if (!["OWNER","ADMIN","EDITOR"].includes(membership?.role) || membership.membership_status!=="ACTIVE") return notFound("Édition non autorisée","La création de ressources exige un rôle éditorial actif.");
 const isNew=!contentId || contentId==="nouveau";
 const item=isNew?null:(data.editorialContent||[]).find((entry)=>entry.id===contentId);
 if (!isNew && (!item || item.status!=="DRAFT" || !["PLANNED","OUTLINE","DRAFT"].includes(item.editorial_status))) return notFound("Brouillon indisponible","Cette ressource n’est pas modifiable.");
 const deps=(data.editorialDepartmentLinks||[]).filter((x)=>x.content_id===item?.id);
 const doms=(data.editorialDomainLinks||[]).filter((x)=>x.content_id===item?.id).map((x)=>x.domain_code);
 const assets=(data.editorialContentAssets||[]).filter((x)=>x.content_id===item?.id);
 const types=["learning_module","ARTICLE","COURSE","VIDEO","DOCUMENT","PODCAST","INTERACTIVE","EXERCISE","LAB_PROTOCOL","EXTERNAL_RESOURCE"];
 const levels=["INTRODUCTORY","FOUNDATION","INTERMEDIATE","ADVANCED","EXPERT"];
 return '<section class="page-intro"><span class="eyebrow"><a href="#/administration">ESPACE ÉDITORIAL</a> / RESSOURCES</span><h1>'+(isNew?"Nouvelle ressource":escapeHtml(item.title))+'</h1><p>Fiche de référence et classification disciplinaire.</p></section>' +
 '<form class="content-editor-form" id="content-editor-form" data-content-id="'+escapeHtml(item?.id||'')+'"><div class="editor-form-grid">' +
 '<label>Identifiant métier<input name="business_id" required maxlength="80" value="'+escapeHtml(item?.business_id||'')+'"></label>' +
 '<label>Slug<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value="'+escapeHtml(item?.slug||'')+'"></label>' +
 '<label class="wide">Titre<input name="title" required maxlength="200" value="'+escapeHtml(item?.title||'')+'"></label>' +
 '<label>Type<select name="resource_type">'+types.map((v)=>'<option value="'+v+'" '+((item?.resource_type||"ARTICLE")===v?"selected":"")+'>'+v+'</option>').join('')+'</select></label>' +
 '<label>Langue<input name="language_code" required maxlength="8" value="'+escapeHtml(item?.language_code||'fr')+'"></label>' +
 '<label>Niveau<select name="learning_level"><option value="">Non défini</option>'+levels.map((v)=>'<option value="'+v+'" '+(item?.learning_level===v?"selected":"")+'>'+v+'</option>').join('')+'</select></label>' +
 '<label class="wide">Résumé<textarea name="summary" rows="3">'+escapeHtml(item?.summary||'')+'</textarea></label></div>' +
 '<section class="content-classification"><span class="eyebrow">CLASSIFICATION DISCIPLINAIRE</span><h2>Départements</h2><p>Un seul département principal est requis pour publier.</p><div class="content-taxonomy-list">' +
 (data.editorialDepartments||[]).map((dep)=>{const selected=deps.find((x)=>x.department_code===dep.code);return '<label class="content-taxonomy-option"><input type="checkbox" data-content-department value="'+escapeHtml(dep.code)+'" '+(selected?'checked':'')+'><span>'+escapeHtml(dep.title)+' <small>'+escapeHtml(dep.code)+'</small></span><span class="primary-choice"><input type="radio" name="primary_department" value="'+escapeHtml(dep.code)+'" '+(selected?.is_primary?'checked':'')+'> Principal</span></label>';}).join('') +
 '</div><h2>Domaines</h2><p>Les domaines sont filtrés selon les départements sélectionnés.</p><div class="content-taxonomy-list" id="content-domain-list">' +
 (data.editorialDomains||[]).map((dom)=>'<label class="content-taxonomy-option" data-domain-parent="'+escapeHtml(dom.department_code)+'"><input type="checkbox" data-content-domain value="'+escapeHtml(dom.code)+'" '+(doms.includes(dom.code)?'checked':'')+'><span>'+escapeHtml(dom.title)+' <small>'+escapeHtml(dom.code)+'</small></span></label>').join('') +
 '</div></section><div class="pathway-editor-actions"><a class="text-link" href="#/administration">Retour</a><button class="button button-primary" type="submit">Enregistrer le brouillon ↗</button></div><p id="content-editor-feedback" class="auth-feedback" role="status"></p></form>' +
 (isNew ? "" : '<section class="section-block content-assets-editor"><span class="eyebrow">MÉDIAS ET SUPPORTS</span><h2>Fichiers associés</h2><p>Chaque ajout crée une nouvelle version ; les versions précédentes restent traçables.</p><div class="content-asset-list">' + (assets.map((asset)=>'<article class="content-asset-row"><div><b>'+escapeHtml(asset.title)+'</b><small>'+escapeHtml(asset.asset_kind)+' · v'+asset.asset_version+' · '+escapeHtml(asset.language_code)+'</small>'+(asset.external_url?'<a href="'+escapeHtml(asset.external_url)+'" target="_blank" rel="noopener noreferrer">Ouvrir le support ↗</a>':'')+'</div><span>'+escapeHtml(asset.license_code||'Licence non précisée')+'</span></article>').join('') || '<p class="empty-state">Aucun support associé.</p>') + '</div><form id="content-asset-form" class="content-asset-form" data-content-id="'+escapeHtml(item?.id||'')+'"><h3>Ajouter une version de support</h3><div class="editor-form-grid"><label>Code stable<input name="asset_code" required maxlength="80" placeholder="ex: protocole-principal"></label><label>Nature<select name="asset_kind">'+["DOCUMENT","VIDEO","AUDIO","IMAGE","DATASET","PROTOCOL","SIMULATION","PRACTICAL_ACTIVITY","PRESENTATION","EXTERNAL_LINK","OTHER"].map((v)=>'<option>'+v+'</option>').join('')+'</select></label><label class="wide">Titre<input name="title" required maxlength="200"></label><label class="wide">URL HTTP(S)<input name="external_url" type="url" required placeholder="https://…"></label><label>Type MIME<input name="mime_type" maxlength="120" placeholder="application/pdf"></label><label>Langue<input name="language_code" maxlength="8" value="fr"></label><label>Licence<input name="license_code" maxlength="80" placeholder="CC BY 4.0"></label><label>Attribution<input name="attribution" maxlength="300"></label><label class="wide">Description<textarea name="description" rows="2"></textarea></label></div><button class="button button-outline" type="submit">Ajouter la version ↗</button><p id="content-asset-feedback" class="auth-feedback" role="status"></p></form></section>');
}


function assessmentQuestionMarkup(question,index) {
  const options=question.options||["",""];
  return `<article class="assessment-editor-question" data-assessment-question data-question-index="${index}">
    <div class="assessment-editor-question-head"><span class="eyebrow">QUESTION ${String(index+1).padStart(2,"0")}</span><button type="button" class="button button-outline" data-assessment-action="remove-question">Retirer</button></div>
    <label>Énoncé<textarea data-question-prompt rows="2" required maxlength="1200">${escapeHtml(question.prompt||"")}</textarea></label>
    <div class="assessment-editor-options" data-assessment-options>
      ${options.map((option,i)=>`<div class="assessment-editor-option" data-assessment-option><label><input type="radio" name="correct_${index}" value="${i}" ${i===(question.correctIndex??0)?"checked":""} aria-label="Bonne réponse ${i+1}"><input type="text" data-option-text value="${escapeHtml(option.text??option??"")}" required maxlength="500" placeholder="Texte de la réponse"></label><button type="button" data-assessment-action="remove-option" aria-label="Retirer la réponse" ${options.length<=2?"disabled":""}>×</button></div>`).join("")}
    </div>
    <button type="button" class="button button-outline" data-assessment-action="add-option">Ajouter une réponse</button>
  </article>`;
}

function assessmentEditorView(assessmentId="nouveau") {
  if(!currentSession?.user)return loginView();
  const membership=data.membership;
  if(!["OWNER","ADMIN","EDITOR"].includes(membership?.role)||membership.membership_status!=="ACTIVE")return notFound("Édition non autorisée","La création d’évaluations est réservée aux rôles Owner, Admin et Editor.");
  const isNew=!assessmentId||assessmentId==="nouveau";
  const assessment=isNew?null:(data.editorialAssessments||[]).find((item)=>item.id===assessmentId);
  if(!isNew&&(!assessment||assessment.status!=="DRAFT"))return notFound("Brouillon indisponible","Seules les évaluations au statut DRAFT peuvent être modifiées.");
  const questions=(data.editorialAssessmentQuestions||[]).filter((item)=>item.assessment_id===assessment?.id).sort((a,b)=>a.sort_order-b.sort_order).map((question)=>{
    const options=(data.editorialAssessmentOptions||[]).filter((item)=>item.question_id===question.id).sort((a,b)=>a.sort_order-b.sort_order);
    const correct=(data.editorialAssessmentAnswerKeys||[]).find((item)=>item.question_id===question.id)?.option_id;
    return {prompt:question.prompt,options:options.map((option)=>({text:option.option_text,id:option.id})),correctIndex:Math.max(0,options.findIndex((option)=>option.id===correct))};
  });
  const canPublish=["OWNER","ADMIN"].includes(membership.role);
  return `<section class="page-intro"><span class="eyebrow"><a href="#/administration">ESPACE ÉDITORIAL</a> / ÉVALUATIONS</span><h1>${isNew?"Nouvelle évaluation":escapeHtml(assessment.title)}</h1><p>Créer un questionnaire versionné. La correction reste privée et s’effectue exclusivement côté serveur.</p></section>
    <form id="assessment-editor-form" class="assessment-editor-form" data-assessment-id="${escapeHtml(assessment?.id||"")}" >
      <div class="editor-form-grid">
        <label>Code interne<input name="code" required maxlength="48" value="${escapeHtml(assessment?.code||"")}" placeholder="MYCO-QCM-01"></label>
        <label>Version<input name="version_label" maxlength="24" value="${escapeHtml(assessment?.version_label||"0.1")}"></label>
        <label class="wide">Titre<input name="title" required maxlength="180" value="${escapeHtml(assessment?.title||"")}"></label>
        <label class="wide">Description<textarea name="description" rows="3">${escapeHtml(assessment?.description||"")}</textarea></label>
        <label>Seuil de réussite (%)<input name="pass_score" type="number" min="0" max="100" step="1" required value="${assessment?.pass_score??70}"></label>
        <label>Nombre maximal de tentatives<input name="max_attempts" type="number" min="1" max="100" value="${assessment?.max_attempts??""}" placeholder="Illimité"></label>
        <label>Durée (minutes)<input name="time_limit_minutes" type="number" min="1" max="1440" value="${assessment?.time_limit_minutes??""}" placeholder="Sans limite"></label>
      </div>
      <section class="assessment-question-builder"><div class="section-heading"><div><span class="eyebrow">CONSTRUCTION DU QUESTIONNAIRE</span><h2>Questions à choix unique</h2></div><button type="button" id="add-assessment-question" class="button button-outline">Ajouter une question +</button></div><div id="assessment-question-list">${questions.map((question,index)=>assessmentQuestionMarkup(question,index)).join("")||assessmentQuestionMarkup({prompt:"",options:["",""],correctIndex:0},0)}</div></section>

      <section class="assessment-question-builder"><span class="eyebrow">RÉFÉRENTIEL DES COMPÉTENCES</span><h2>Compétences évaluées</h2><p>Associe chaque évaluation aux compétences réellement mesurées. Le niveau et le seuil sont propres à chaque compétence.</p>
        <div class="assessment-competency-list">\${(data.editorialCompetencies||[]).filter((item)=>item.status==="PUBLISHED").map((item)=>{const link=(data.editorialAssessmentCompetencies||[]).find((mapping)=>mapping.assessment_id===assessment?.id&&mapping.competency_id===item.id);return \`<article class="assessment-competency-row"><label><input type="checkbox" data-assessment-competency value="\${escapeHtml(item.id)}" \${link?"checked":""}><span><b>\${escapeHtml(item.title)}</b><small>\${escapeHtml(item.code)}</small></span></label><label>Niveau attendu<select data-assessment-competency-level \${link?"":"disabled"}>\${["INTRODUCTORY","FOUNDATION","INTERMEDIATE","ADVANCED","EXPERT"].map((level)=>\`<option value="\${level}" \${(link?.expected_level||"FOUNDATION")===level?"selected":""}>\${level}</option>\`).join("")}</select></label><label>Seuil (%)<input data-assessment-competency-score type="number" min="0" max="100" step="1" value="\${link?.minimum_score??assessment?.pass_score??70}" \${link?"":"disabled"}></label></article>\`}).join("")||emptyState("Aucune compétence publiée","Publie d’abord les compétences du référentiel pour pouvoir les associer à une évaluation.")}</div>
      </section>
      <div class="pathway-editor-actions"><a class="text-link" href="#/administration">Retour à l’espace éditorial</a><button class="button button-primary" type="submit">Enregistrer le brouillon ↗</button></div>
      <p id="assessment-editor-feedback" class="auth-feedback" role="status" aria-live="polite"></p>
    </form>
    ${!isNew&&canPublish?`<section class="pathway-publish-panel"><div><span class="eyebrow">VALIDATION FINALE</span><h2>Publier cette évaluation</h2><p>Les questions et clés de correction sont vérifiées avant publication.</p></div><button class="button button-outline" id="publish-assessment" data-assessment-id="${escapeHtml(assessment.id)}">Publier ↗</button></section>`:""}`;
}

function competencyEditorView(competencyId = "nouveau") {
  if (!currentSession?.user) return loginView();
  const membership = data.membership;
  if (!["OWNER","ADMIN","EDITOR"].includes(membership?.role) || membership.membership_status !== "ACTIVE") return notFound("Édition non autorisée", "La gestion des compétences est réservée aux rôles Owner, Admin et Editor.");
  const isNew = !competencyId || competencyId === "nouveau";
  const competency = isNew ? null : (data.editorialCompetencies || []).find((item) => item.id === competencyId);
  if (!isNew && (!competency || competency.status !== "DRAFT")) return notFound("Brouillon indisponible", "Seules les compétences au statut DRAFT peuvent être modifiées.");
  const mappings = (data.editorialContentCompetencies || []).filter((item) => item.competency_id === competency?.id);
  const mapped = new Map(mappings.map((item) => [item.content_id, item]));
  const levels = ["INTRODUCTORY","FOUNDATION","INTERMEDIATE","ADVANCED","EXPERT"];
  return `<section class="page-intro"><span class="eyebrow"><a href="#/administration">ESPACE ÉDITORIAL</a> / COMPÉTENCES</span><h1>${isNew ? "Nouvelle compétence" : escapeHtml(competency.title)}</h1><p>Définir un acquis observable, son niveau de maîtrise attendu et les ressources qui contribuent à son développement.</p></section>
    <form class="competency-editor-form" id="competency-editor-form" data-competency-id="${escapeHtml(competency?.id || "")}">
      <div class="editor-form-grid">
        <label>Code interne<input name="code" required maxlength="48" pattern="[A-Z0-9_-]{2,48}" value="${escapeHtml(competency?.code || "")}" placeholder="MYCO-IDENTIFICATION"></label>
        <label>Niveau de référence<select name="level">${levels.map((level) => `<option value="${level}" ${(competency?.competency_level || "FOUNDATION") === level ? "selected" : ""}>${level}</option>`).join("")}</select></label>
        <label class="wide">Intitulé<input name="title" required maxlength="180" value="${escapeHtml(competency?.title || "")}" placeholder="Identifier les principaux groupes de champignons"></label>
        <label class="wide">Description opérationnelle<textarea name="description" rows="3" maxlength="2000">${escapeHtml(competency?.description || "")}</textarea></label>
      </div>
      <section class="competency-mapping-panel"><span class="eyebrow">CARTOGRAPHIE DES ACQUIS</span><h2>Ressources contributives</h2><p>Associe uniquement les ressources qui enseignent, entraînent ou évaluent effectivement cette compétence.</p>
        <div class="competency-resource-list">${data.content.map((resource) => {
          const link = mapped.get(resource.id);
          return `<article class="competency-resource-row"><label><input type="checkbox" data-competency-content value="${escapeHtml(resource.id)}" ${link ? "checked" : ""}><span><b>${escapeHtml(resource.title)}</b><small>${escapeHtml(resource.resource_type || "RESSOURCE")}</small></span></label><div class="competency-resource-settings"><select data-expected-level aria-label="Niveau attendu pour ${escapeHtml(resource.title)}">${levels.map((level) => `<option value="${level}" ${(link?.expected_level || competency?.competency_level || "FOUNDATION") === level ? "selected" : ""}>${level}</option>`).join("")}</select><input data-assessment-hint maxlength="300" aria-label="Indice d’évaluation" placeholder="Indice d’évaluation (facultatif)" value="${escapeHtml(link?.assessment_hint || "")}"></div></article>`;
        }).join("") || emptyState("Aucune ressource publiée", "Les associations pourront être configurées dès que le catalogue contiendra des ressources.")}</div>
      </section>

      <section class="competency-mapping-panel"><span class="eyebrow">ANCRAGE DISCIPLINAIRE</span><h2>Domaines de rattachement</h2><p>Une compétence peut être transversale. Sélectionne un ou plusieurs domaines ; le premier sélectionné devient son ancrage principal.</p>
        <div class="competency-domain-grid">\${data.editorialDepartments.filter((department)=>department.status!=="ARCHIVED").map((department)=>{const domains=data.editorialDomains.filter((domain)=>domain.department_code===department.code&&domain.status!=="ARCHIVED");return domains.length?\`<fieldset class="competency-domain-group"><legend>\${escapeHtml(department.title)}</legend>\${domains.map((domain)=>{const link=(data.editorialCompetencyDomains||[]).find((item)=>item.competency_id===competency?.id&&item.domain_code===domain.code);return \`<label><input type="checkbox" data-competency-domain value="\${escapeHtml(domain.code)}" \${link?"checked":""}><span>\${escapeHtml(domain.title)}</span></label>\`}).join("")}</fieldset>\`:""}).join("")}</div>
      </section>

      <section class="competency-mapping-panel"><span class="eyebrow">PROGRESSION DES COMPÉTENCES</span><h2>Prérequis</h2><p>Déclare les compétences dont la maîtrise doit précéder celle-ci. Les dépendances sont contrôlées contre les cycles et intégrées à l’Atlas.</p>
        <div class="competency-prerequisite-list">\${(data.editorialCompetencies||[]).filter((item)=>item.status==="PUBLISHED"&&item.id!==competency?.id).map((item)=>{const link=(data.editorialCompetencyPrerequisites||[]).some((edge)=>edge.competency_id===competency?.id&&edge.prerequisite_competency_id===item.id);return \`<label><input type="checkbox" data-competency-prerequisite value="\${escapeHtml(item.id)}" \${link?"checked":""}><span><b>\${escapeHtml(item.title)}</b><small>\${escapeHtml(item.code)} · \${escapeHtml(item.competency_level)}</small></span></label>\`}).join("")||emptyState("Aucun prérequis disponible","Les compétences publiées pourront être sélectionnées ici.")}</div>
      </section>
      <div class="pathway-editor-actions"><a class="text-link" href="#/administration">Retour à l’espace éditorial</a><button class="button button-primary" type="submit">Enregistrer le brouillon ↗</button></div>
      <p id="competency-editor-feedback" class="auth-feedback" role="status" aria-live="polite"></p>
    </form>
    ${!isNew && ["OWNER","ADMIN"].includes(membership.role) ? `<section class="pathway-publish-panel"><div><span class="eyebrow">VALIDATION FINALE</span><h2>Publier cette compétence</h2><p>La publication rend la compétence visible et synchronise les relations éligibles dans l’Atlas.</p></div><button class="button button-outline" id="publish-competency" data-competency-id="${escapeHtml(competency.id)}">Publier ↗</button></section>` : ""}`;
}

function readPathwaySequence(panel) {
  return [...panel.querySelectorAll(".pathway-sequence-row")].map((row) => ({
    contentId: row.dataset.contentId,
    isRequired: row.querySelector('[data-field="required"]').checked,
    prerequisites: [...row.querySelector('[data-field="prerequisites"]').selectedOptions].map((option) => option.value)
  }));
}

function renderPathwaySequence(panel, resources, sequence) {
  const selectedIds = new Set(sequence.map((item) => item.contentId));
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  panel.innerHTML = `
    <div class="pathway-resource-add">
      <div><span class="eyebrow">BIBLIOTHÈQUE</span><h3>Ajouter une ressource</h3></div>
      <div class="pathway-resource-options">${resources.filter((resource) => !selectedIds.has(resource.id)).map((resource) => `
        <label><input type="checkbox" data-action="add" value="${escapeHtml(resource.id)}"><span>${escapeHtml(resource.title)}</span><small>${escapeHtml(resource.resource_type || "RESSOURCE")}</small></label>
      `).join("") || '<p class="search-count">Toutes les ressources disponibles sont déjà dans la séquence.</p>'}</div>
    </div>
    <div class="pathway-sequence-list">
      ${sequence.map((item,index) => {
        const resource = byId.get(item.contentId);
        if (!resource) return "";
        const prerequisites = new Set(item.prerequisites || []);
        const candidates = sequence.filter((candidate) => candidate.contentId !== item.contentId);
        return `
          <article class="pathway-sequence-row" data-content-id="${escapeHtml(item.contentId)}">
            <div class="sequence-row-head">
              <span class="sequence-position">${String(index+1).padStart(2,"0")}</span>
              <div class="sequence-row-title"><b>${escapeHtml(resource.title)}</b><small>${escapeHtml(resource.resource_type || "RESSOURCE")}</small></div>
              <div class="sequence-row-actions">
                <button type="button" data-action="up" aria-label="Monter" ${index===0?"disabled":""}>↑</button>
                <button type="button" data-action="down" aria-label="Descendre" ${index===sequence.length-1?"disabled":""}>↓</button>
                <button type="button" data-action="remove" aria-label="Retirer">×</button>
              </div>
            </div>
            <div class="sequence-row-settings">
              <label class="sequence-required"><input type="checkbox" data-field="required" ${item.isRequired?"checked":""}> Étape obligatoire</label>
              <label class="sequence-prerequisites">Prérequis
                <select data-field="prerequisites" multiple size="2" aria-label="Prérequis de ${escapeHtml(resource.title)}">
                  ${candidates.map((candidate) => `<option value="${escapeHtml(candidate.contentId)}" ${prerequisites.has(candidate.contentId)?"selected":""}>${escapeHtml(byId.get(candidate.contentId)?.title || "Ressource")}</option>`).join("")}
                </select>
              </label>
            </div>
          </article>`;
      }).join("") || '<p class="search-count">Aucune étape. Ajoute des ressources depuis la bibliothèque.</p>'}
    </div>
    <p class="search-count">L’ordre affiché définit la progression. Les prérequis peuvent être multiples ; les cycles sont refusés par le backend.</p>`;
}

function programmeNodeRowMarkup(node,index,nodes) {
 const types=[["CYCLE","Cycle"],["YEAR","Année"],["SEMESTER","Semestre"],["BLOCK","Bloc pédagogique"],["MODULE","Module"],["UNIT","Unité d’enseignement"],["CHAPTER","Chapitre"],["SEQUENCE","Séquence"],["LESSON","Leçon"],["ACTIVITY","Activité pédagogique"]];
 const rank={CYCLE:1,YEAR:2,SEMESTER:3,BLOCK:4,MODULE:5,UNIT:6,CHAPTER:7,SEQUENCE:8,LESSON:9,ACTIVITY:10};
 const parentOptions=nodes.filter(x=>x.code&&x.code!==node.code&&(rank[x.node_type]||0)<(rank[node.node_type]||99));
 return '<article class="programme-node-row" data-program-node-row>'+
  '<div class="programme-node-heading"><span class="eyebrow">NIVEAU STRUCTUREL '+String(index+1).padStart(2,"0")+'</span><button type="button" class="button button-outline" data-program-node-remove>Retirer</button></div>'+
  '<div class="editor-form-grid">'+
  '<label>Code<input data-program-node-code required maxlength="48" value="'+escapeHtml(node.code||'')+'" placeholder="CYCLE-01"></label>'+
  '<label>Type<select data-program-node-type>'+types.map(type=>'<option value="'+type[0]+'" '+((node.node_type||"CYCLE")===type[0]?'selected':'')+'>'+type[1]+'</option>').join('')+'</select></label>'+
  '<label class="wide">Intitulé<input data-program-node-title required maxlength="180" value="'+escapeHtml(node.title||'')+'" placeholder="Cycle fondamental"></label>'+
  '<label>Parent<select data-program-node-parent><option value="">Racine du programme</option>'+parentOptions.map(x=>'<option value="'+escapeHtml(x.code)+'" '+(node.parent_code===x.code?'selected':'')+'>'+escapeHtml(x.code)+' · '+escapeHtml(x.title)+'</option>').join('')+'</select></label>'+
  '<label>Ordre<input data-program-node-order type="number" min="1" step="1" required value="'+(node.sort_order||index+1)+'"></label>'+
  '<label>Durée indicative (minutes)<input data-program-node-duration type="number" min="1" step="1" value="'+(node.estimated_minutes||'')+'" placeholder="Facultatif"></label>'+
  '<label class="wide">Résumé structurel<textarea data-program-node-summary rows="2" maxlength="500">'+escapeHtml(node.summary||'')+'</textarea></label>'+
  '<label class="programme-node-required"><input data-program-node-required type="checkbox" '+(node.is_required===false?'':'checked')+'> Niveau obligatoire dans le programme</label>'+
  '</div></article>';
}

function programmeEditorView(programId="nouveau") {
 if(!currentSession?.user)return loginView();
 const membership=data.membership;
 if(!["OWNER","ADMIN","EDITOR"].includes(membership?.role)||membership.membership_status!=="ACTIVE")
  return notFound("Édition non autorisée","La structuration des programmes est réservée aux rôles Owner, Admin et Editor.");
 const isNew=!programId||programId==="nouveau";
 const program=isNew?null:(data.editorialPrograms||[]).find(x=>x.id===programId);
 if(!isNew&&(!program||program.status!=="DRAFT"))return notFound("Brouillon indisponible","Seuls les programmes au statut DRAFT peuvent être modifiés.");
 const departmentLinks=(data.editorialProgramDepartments||[]).filter(x=>x.program_id===program?.id);
 const domainLinks=(data.editorialProgramDomains||[]).filter(x=>x.program_id===program?.id);
 const rawNodes=(data.editorialProgramNodes||[]).filter(x=>x.program_id===program?.id);
 const codeById=new Map(rawNodes.map(x=>[x.id,x.code]));
 const nodes=rawNodes.map(x=>({...x,parent_code:codeById.get(x.parent_node_id)||null})).sort((a,b)=>a.sort_order-b.sort_order);
 const departments=(data.editorialDepartments||[]).filter(x=>x.status!=="ARCHIVED");
 const domains=(data.editorialDomains||[]).filter(x=>x.status!=="ARCHIVED");
 const primary=departmentLinks.find(x=>x.is_primary)?.department_code||"";
 const canPublish=["OWNER","ADMIN"].includes(membership.role);
 const typeOptions=["FOUNDATION","SPECIALIZATION","PROFESSIONAL","RESEARCH","TRANSVERSAL"];
 const levelOptions=["INTRODUCTORY","FOUNDATION","INTERMEDIATE","ADVANCED"];
 return '<section class="page-intro"><span class="eyebrow"><a href="#/administration">ESPACE ÉDITORIAL</a> / PROGRAMMES</span><h1>'+(isNew?"Nouveau programme":escapeHtml(program.title))+'</h1><p>Définir l’identité du cursus, ses disciplines de rattachement et sa hiérarchie. Aucun cours n’est rédigé dans cet éditeur.</p></section>'+
 '<form id="programme-editor-form" class="programme-editor-form" data-program-id="'+escapeHtml(program?.id||'')+'">'+
 '<section class="programme-editor-section"><span class="eyebrow">01 · IDENTITÉ DU PROGRAMME</span><div class="editor-form-grid">'+
 '<label>Code interne<input name="code" required maxlength="48" value="'+escapeHtml(program?.code||'')+'" placeholder="BIO-MYCO-FOUND"></label>'+
 '<label>Identifiant URL<input name="slug" required maxlength="80" value="'+escapeHtml(program?.slug||'')+'" placeholder="fondamentaux-mycologie"></label>'+
 '<label class="wide">Titre du programme<input name="title" required maxlength="180" value="'+escapeHtml(program?.title||'')+'" placeholder="Fondamentaux de mycologie appliquée"></label>'+
 '<label>Type de programme<select name="program_type">'+typeOptions.map(x=>'<option value="'+x+'" '+((program?.program_type||"FOUNDATION")===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
 '<label>Niveau d’entrée<select name="difficulty_level">'+levelOptions.map(x=>'<option value="'+x+'" '+((program?.difficulty_level||"FOUNDATION")===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
 '<label class="wide">Résumé<textarea name="summary" rows="2" maxlength="1200">'+escapeHtml(program?.summary||'')+'</textarea></label>'+
 '<label class="wide">Finalité générale / objectifs du cursus<textarea name="objectives" rows="3" maxlength="2000">'+escapeHtml(program?.objectives||'')+'</textarea></label>'+
 '<label class="wide">Public cible<input name="target_audience" maxlength="300" value="'+escapeHtml(program?.target_audience||'')+'" placeholder="Public mixte, techniciens, étudiants…"></label>'+
 '<label>Durée globale indicative (heures)<input name="duration_hours" type="number" min="0.5" step="0.5" value="'+(program?.estimated_duration_hours??'')+'" placeholder="Facultatif"></label>'+
 '<label>Version<input name="version_label" maxlength="24" value="'+escapeHtml(program?.version_label||'0.1')+'"></label>'+
 '</div></section>'+
 '<section class="programme-editor-section"><span class="eyebrow">02 · ANCRAGE DISCIPLINAIRE</span><h2>Départements associés</h2><p>Un programme peut être transversal. La mycologie peut constituer l’axe principal ou être associée aux autres disciplines. Un seul département reste le rattachement principal.</p>'+
 '<div class="programme-check-grid">'+departments.map(x=>'<label><input type="checkbox" data-program-department value="'+escapeHtml(x.code)+'" '+(departmentLinks.some(y=>y.department_code===x.code)?'checked':'')+'><span><b>'+escapeHtml(x.title)+'</b><small>'+escapeHtml(x.code)+'</small></span></label>').join('')+'</div>'+
 '<label>Département principal<select name="primary_department"><option value="">Choisir après sélection</option>'+departments.map(x=>'<option value="'+escapeHtml(x.code)+'" '+(primary===x.code?'selected':'')+'>'+escapeHtml(x.title)+'</option>').join('')+'</select></label>'+
 '<h2>Domaines concernés</h2><p>Les domaines doivent appartenir à l’un des départements sélectionnés.</p>'+
 '<div class="programme-check-grid programme-domain-grid">'+domains.map(x=>'<label data-program-domain-row data-department-code="'+escapeHtml(x.department_code)+'"><input type="checkbox" data-program-domain value="'+escapeHtml(x.code)+'" '+(domainLinks.some(y=>y.domain_code===x.code)?'checked':'')+'><span><b>'+escapeHtml(x.title)+'</b><small>'+escapeHtml(x.department_code)+' · '+escapeHtml(x.code)+'</small></span></label>').join('')+'</div></section>'+
 '<section class="programme-editor-section"><div class="section-heading"><div><span class="eyebrow">03 · HIÉRARCHIE PÉDAGOGIQUE</span><h2>Arborescence du cursus</h2></div><button type="button" id="add-programme-node" class="button button-outline">Ajouter un niveau +</button></div>'+
 '<p>Imbrication possible : cycle → année → semestre → bloc → module → unité → chapitre → séquence → leçon → activité. Les racines sont des cycles ou des blocs ; les niveaux intermédiaires restent facultatifs. Aucun contenu de cours n’est stocké ici.</p>'+
 '<div id="programme-node-list">'+(nodes.map((x,i)=>programmeNodeRowMarkup(x,i,nodes)).join('')||programmeNodeRowMarkup({node_type:"CYCLE",sort_order:1,is_required:true},0,[]))+'</div><div class="programme-hierarchy-preview" id="programme-hierarchy-preview"><span class="eyebrow">APERÇU DE L’ARBORESCENCE</span></div></section>'+
 '<div class="pathway-editor-actions"><a class="text-link" href="#/administration">Retour</a><button class="button button-primary" type="submit">Enregistrer la structure ↗</button></div><p id="programme-editor-feedback" class="auth-feedback" role="status" aria-live="polite"></p></form>'+
 (!isNew&&canPublish?'<section class="section-block"><p>La publication ouvre le programme au catalogue public après validation de ses rattachements et de sa hiérarchie.</p><button type="button" id="publish-programme" data-program-id="'+escapeHtml(program.id)+'" class="button button-outline">Publier le programme ↗</button></section>':'');
}

function learningPathEditorView(pathId = "nouveau") {
  if (!currentSession?.user) return loginView();
  const membership = data.membership;
  if (!["OWNER","ADMIN","EDITOR"].includes(membership?.role) || membership.membership_status !== "ACTIVE") {
    return notFound("Édition non autorisée", "La gestion des parcours est réservée aux rôles Owner, Admin et Editor.");
  }
  const isNew = !pathId || pathId === "nouveau";
  const path = isNew ? null : (data.editorialPaths || []).find((item) => item.id === pathId);
  if (!isNew && (!path || path.status !== "DRAFT")) return notFound("Brouillon indisponible", "Seuls les parcours au statut DRAFT peuvent être modifiés.");
  const currentItems = data.pathItems.filter((item) => item.path_id === path?.id).sort((a,b) => a.sort_order-b.sort_order);
  const resources = [...data.content].sort((a,b) => a.title.localeCompare(b.title, "fr"));
  const sequence = currentItems.map((item) => ({
    contentId: item.content_id,
    isRequired: item.is_required,
    prerequisites: data.pathPrerequisites.filter((link) => link.item_id === item.id)
      .map((link) => currentItems.find((candidate) => candidate.id === link.prerequisite_item_id)?.content_id).filter(Boolean)
  }));
  const canPublish = ["OWNER","ADMIN"].includes(membership.role);
  return `<section class="page-intro"><span class="eyebrow"><a href="#/administration">ESPACE ÉDITORIAL</a> / PARCOURS</span><h1>${isNew ? "Nouveau parcours" : escapeHtml(path.title)}</h1><p>Configurer les métadonnées et construire une séquence ordonnée avec étapes obligatoires et prérequis.</p></section>
    <form class="pathway-editor-form" id="pathway-editor-form" data-path-id="${escapeHtml(path?.id || "")}">
      <div class="editor-form-grid">
        <label>Code interne<input name="code" required maxlength="48" value="${escapeHtml(path?.code || "")}" placeholder="BIO-MYCO-01"></label>
        <label>Identifiant URL<input name="slug" required maxlength="80" value="${escapeHtml(path?.slug || "")}" placeholder="initiation-mycologie"></label>
        <label class="wide">Titre<input name="title" required maxlength="180" value="${escapeHtml(path?.title || "")}" placeholder="Initiation à la mycologie"></label>
        <label class="wide">Résumé<textarea name="summary" rows="3">${escapeHtml(path?.summary || "")}</textarea></label>
        <label class="wide">Public cible<input name="target_audience" value="${escapeHtml(path?.target_audience || "")}" placeholder="Étudiants, techniciens, débutants…"></label>
        <label>Niveau<select name="difficulty_level">${["INTRODUCTORY","FOUNDATION","INTERMEDIATE","ADVANCED"].map((level) => `<option value="${level}" ${(path?.difficulty_level || "FOUNDATION") === level ? "selected" : ""}>${level}</option>`).join("")}</select></label>
        <label>Durée estimée (minutes)<input name="duration" type="number" min="1" step="1" value="${escapeHtml(path?.estimated_duration_minutes || "")}" placeholder="120"></label>
        <label>Version<input name="version_label" value="${escapeHtml(path?.version_label || "0.1")}" maxlength="24"></label>
      </div>
      <section class="pathway-sequence-builder" id="pathway-sequence-builder"><span class="eyebrow">CONSTRUCTION DE LA SÉQUENCE</span><h2>Étapes et dépendances</h2><p class="sequence-builder-intro">Ajoute les ressources, change leur ordre et définis leurs prérequis. Le moteur vérifie la cohérence du graphe avant validation.</p><div id="pathway-sequence-panel"></div></section>
      <section class="pathway-sequence-builder"><span class="eyebrow">ÉVALUATIONS ET CERTIFICATION</span><h2>Conditions de validation</h2><p class="sequence-builder-intro">Associe des évaluations publiées au parcours et fixe le seuil exigé pour la certification.</p><div class="path-assessment-editor-list">
        ${(data.editorialAssessments||[]).filter((item)=>item.status==="PUBLISHED"&&item.visibility==="PUBLIC").map((item)=>{const link=(data.editorialPathAssessments||[]).find((entry)=>entry.path_id===path?.id&&entry.assessment_id===item.id);return `<article class="path-assessment-editor-row" data-path-assessment-row><label><input type="checkbox" data-path-assessment value="${escapeHtml(item.id)}" ${link?"checked":""}><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.code)} · Seuil par défaut ${item.pass_score}%</small></span></label><label>Seuil minimal<input type="number" data-path-assessment-score min="0" max="100" step="1" value="${link?.minimum_score??item.pass_score}" ${link?"":"disabled"}></label><label>Obligatoire<input type="checkbox" data-path-assessment-required ${link?.is_required!==false?"checked":""} ${link?"":"disabled"}></label></article>`}).join("")||emptyState("Aucune évaluation publiée","Publie d’abord une évaluation pour pouvoir l’associer à un parcours.") }
      </div></section>
      <div class="pathway-editor-actions"><a class="text-link" href="#/administration">Retour à l’espace éditorial</a><button class="button button-primary" type="submit">Enregistrer le brouillon ↗</button></div>
      <p id="pathway-editor-feedback" class="auth-feedback" role="status" aria-live="polite"></p>
    </form>
    ${!isNew && canPublish ? `<section class="pathway-publish-panel"><div><span class="eyebrow">VALIDATION FINALE</span><h2>Publier ce parcours</h2><p>La publication exige au moins une ressource encore publiée et publique. Elle rend le parcours visible dans le catalogue.</p></div><button class="button button-outline" id="publish-pathway" data-path-id="${escapeHtml(path.id)}">Publier ↗</button></section>` : ""}`;
}

function learnerView() {
  return currentSession?.user ? learnerDashboardView() : loginView();
}

function aboutView() {
  return `<section class="page-intro"><span class="eyebrow">À PROPOS</span><h1>Une académie scientifique appliquée.</h1><p>BA Labs Academy organise des ressources pédagogiques, des parcours et des connaissances autour des sciences expérimentales et de leurs applications.</p></section><div class="about-grid"><article><span class="eyebrow">01 / STRUCTURE</span><h3>Des départements</h3><p>Une organisation disciplinaire reliée à des domaines de spécialité.</p></article><article><span class="eyebrow">02 / CONTENUS</span><h3>Des ressources validées</h3><p>Un catalogue publié progressivement selon un circuit éditorial contrôlé.</p></article><article><span class="eyebrow">03 / ATLAS</span><h3>Une connaissance connectée</h3><p>Une représentation navigable des relations entre les ressources et les disciplines.</p></article></div>`;
}

function notFound(title, description) {
  return `<section class="page-intro"><span class="eyebrow">PAGE NON DISPONIBLE</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><a class="text-link" href="#/">Retour à l’accueil →</a></section>`;
}

function updateNavigation(route) {
  document.querySelectorAll("[data-route]").forEach((link) => {
    const target = link.dataset.route;
    const active = (route === "" && target === "home") ||
      (["departements", "domaines"].includes(route) && target === "departements") ||
      (["catalogue", "ressource"].includes(route) && target === "catalogue") ||
      (route === "recherche" && target === "recherche") ||
      (route === "atlas" && target === "atlas") ||
      (route === "parcours" && target === "parcours") ||
      (route === "espace" && target === "espace");
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function render() {
  unbindAtlas();
  const path = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const [route = "", routeTail = ""] = path.split("/");
  const [slug = "", query = ""] = routeTail.split("?");
  const [subroute = "", subId = ""] = slug.split("/");
  const pathItemId = new URLSearchParams(query).get("pathItem") || "";
  updateNavigation(route);
  if (loadError) {
    root.innerHTML = `<section class="page-intro"><span class="eyebrow">ÉTAT DES DONNÉES</span><h1>Connexion indisponible</h1><p>${escapeHtml(loadError)}</p><p>La plateforme reste accessible ; les données seront rechargées dès que l’API publique répondra.</p><button class="button button-outline" id="retry">Réessayer</button></section>`;
    document.querySelector("#retry")?.addEventListener("click", refresh);
    return;
  }
  connection.textContent = !data.departments.length && !data.content.length && !data.nodes.length && !data.learningPaths.length
    ? "API connectée · aucun contenu public"
    : "Données publiques synchronisées";
  const routes = {
    "": homeView,
    "departements": () => slug ? departmentDetail(slug) : departmentsView(),
    "domaines": () => domainDetail(slug),
    "catalogue": catalogueView,
    "formations": trainingCatalogView,
    "recherche": () => searchResultsView(new URLSearchParams(query).get("q") || ""),
    "ressource": () => resourceDetail(slug, pathItemId),
    "evaluations": () => assessmentDetail(slug, new URLSearchParams(query).get("attempt") || ""),
    "certificat": () => certificateView(slug),
    "verifier-formation": () => trainingVerificationView(slug),
    "parcours": () => slug ? learningPathDetail(slug) : learningPathsView(),
    "espace": learnerView,
    "administration": () => subroute === "programmes" ? programmeEditorView(subId) : subroute === "parcours" ? learningPathEditorView(subId) : subroute === "competences" ? competencyEditorView(subId) : subroute === "ressources" ? contentEditorView(subId) : subroute === "evaluations" ? assessmentEditorView(subId) : administrationView(),
    "atlas": atlasView,
    "apropos": aboutView
  };
  root.innerHTML = (routes[route] || (() => notFound("Page introuvable", "Cette adresse ne correspond à aucune page publique de l’Academy.")))();
  if (route === "atlas" && data.nodes.length) {
    unbindAtlas = bindAtlasGraph(root, data.nodes, (node) => {
      if (node.entity_type === "DEPARTMENT") {
        const item = data.departments.find((entry) => entry.code === node.entity_key);
        if (item) location.hash = `#/departements/${encodeURIComponent(item.slug)}`;
      } else if (node.entity_type === "DOMAIN") {
        const item = data.domains.find((entry) => entry.code === node.entity_key);
        if (item) location.hash = `#/domaines/${encodeURIComponent(item.slug)}`;
      } else if (node.entity_type === "PATHWAY") {
        const item = data.learningPaths.find((entry) =>
          entry.code === node.entity_key || entry.slug === node.entity_key
        );
        if (item) location.hash = `#/parcours/${encodeURIComponent(item.slug)}`;
      } else if (node.entity_type === "SKILL") {
        const item = data.competencies.find((entry) => entry.code === node.entity_key);
        if (item) {
          const relation = data.contentCompetencies.find((entry) => entry.competency_id === item.id);
          const resource = data.content.find((entry) => entry.id === relation?.content_id);
          if (resource) location.hash = `#/ressource/${encodeURIComponent(resource.slug)}`;
        }
      } else if (["CONTENT", "MODULE", "LESSON"].includes(node.entity_type)) {
        const item = data.content.find((entry) =>
          entry.business_id === node.entity_key || entry.slug === node.entity_key
        );
        if (item) location.hash = `#/ressource/${encodeURIComponent(item.slug)}`;
      }
    });
  }
  if (route === "formations") {
    document.querySelectorAll("[data-training-enroll]").forEach((form)=>{
      form.addEventListener("submit",async(event)=>{
        event.preventDefault();
        const button=form.querySelector('button[type="submit"]');
        const feedback=form.querySelector(".training-enroll-feedback");
        const values=new FormData(form);
        const participantName=String(values.get("participant_name")||"").trim();
        const participantCategory=String(values.get("participant_category")||"OTHER");
        if(!currentSession?.user?.email){feedback.textContent="Reconnecte-toi avec un compte disposant d’une adresse e-mail.";return;}
        if(!participantName){feedback.textContent="Le nom complet est obligatoire.";return;}
        button.disabled=true;feedback.textContent="Transmission de la demande…";
        try{
          await enrollInTrainingSession(form.dataset.trainingEnroll,participantName,currentSession.user.email,participantCategory);
          await refresh();
          const enrollment=(data.trainingEnrollments||[]).find(item=>item.session_id===form.dataset.trainingEnroll&&item.user_id===currentSession?.user?.id&&item.enrollment_status!=="CANCELLED");
          window.alert(enrollment?.enrollment_status==="WAITLISTED"?"Capacité atteinte : ta demande est enregistrée en liste d’attente.":"Ta demande d’inscription est enregistrée. Elle reste en attente de confirmation.");
        }catch(error){
          feedback.textContent=error.message||"Inscription impossible.";
          button.disabled=false;
        }
      });
    });
  }
  if (route === "recherche") {
    document.querySelector("#academy-search-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = new FormData(event.currentTarget).get("q")?.toString().trim() || "";
      location.hash = `#/recherche/?q=${encodeURIComponent(value)}`;
    });
  }
  if (route === "catalogue") {
    document.querySelector("#resource-search")?.addEventListener("input", (event) => filterCatalogue(event.target.value));
  }
  const sequencePanel = document.querySelector("#pathway-sequence-panel");
  if (sequencePanel) {
    const form = document.querySelector("#pathway-editor-form");
    const pathId = form.dataset.pathId || "";
    const existingItems = data.pathItems.filter((item) => item.path_id === pathId).sort((a,b) => a.sort_order-b.sort_order);
    let sequence = existingItems.map((item) => ({
      contentId: item.content_id,
      isRequired: item.is_required,
      prerequisites: data.pathPrerequisites.filter((link) => link.item_id === item.id)
        .map((link) => existingItems.find((candidate) => candidate.id === link.prerequisite_item_id)?.content_id).filter(Boolean)
    }));
    const resources = [...data.content].sort((a,b) => a.title.localeCompare(b.title, "fr"));
    renderPathwaySequence(sequencePanel, resources, sequence);
    sequencePanel.addEventListener("change", (event) => {
      const action = event.target.dataset.action;
      if (action === "add" && event.target.checked) {
        sequence.push({ contentId: event.target.value, isRequired: true, prerequisites: [] });
        renderPathwaySequence(sequencePanel, resources, sequence);
        return;
      }
      const row = event.target.closest(".pathway-sequence-row");
      if (!row) return;
      const current = readPathwaySequence(sequencePanel);
      sequence = current;
      const item = sequence.find((entry) => entry.contentId === row.dataset.contentId);
      if (!item) return;
      if (event.target.dataset.field === "required") item.isRequired = event.target.checked;
      if (event.target.dataset.field === "prerequisites") item.prerequisites = [...event.target.selectedOptions].map((option) => option.value);
    });
    sequencePanel.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const action = button.dataset.action;
      const row = button.closest(".pathway-sequence-row");
      if (!row) return;
      sequence = readPathwaySequence(sequencePanel);
      const index = sequence.findIndex((entry) => entry.contentId === row.dataset.contentId);
      if (action === "remove") {
        const removed = sequence.splice(index,1)[0];
        sequence.forEach((item) => { item.prerequisites = item.prerequisites.filter((id) => id !== removed.contentId); });
      } else if (action === "up" && index > 0) {
        [sequence[index-1],sequence[index]] = [sequence[index],sequence[index-1]];
      } else if (action === "down" && index < sequence.length-1) {
        [sequence[index+1],sequence[index]] = [sequence[index],sequence[index+1]];
      }
      renderPathwaySequence(sequencePanel, resources, sequence);
    });
  }




  const assessmentBuilder=document.querySelector("#assessment-question-list");
  const reindexAssessmentQuestions=()=>{assessmentBuilder?.querySelectorAll("[data-assessment-question]").forEach((question,index)=>{question.dataset.questionIndex=index;question.querySelector(".eyebrow").textContent="QUESTION "+String(index+1).padStart(2,"0");question.querySelectorAll('input[type="radio"]').forEach((radio)=>{radio.name="correct_"+index;});});};
  document.querySelector("#add-assessment-question")?.addEventListener("click",()=>{assessmentBuilder.insertAdjacentHTML("beforeend",assessmentQuestionMarkup({prompt:"",options:["",""],correctIndex:0},assessmentBuilder.children.length));});
  assessmentBuilder?.addEventListener("click",(event)=>{const button=event.target.closest("[data-assessment-action]");if(!button)return;const question=button.closest("[data-assessment-question]");const action=button.dataset.assessmentAction;
    if(action==="remove-question"){if(assessmentBuilder.children.length>1)question.remove();reindexAssessmentQuestions();}
    if(action==="add-option"){const index=Number(question.dataset.questionIndex);const options=question.querySelector("[data-assessment-options]");const next=options.children.length;options.insertAdjacentHTML("beforeend",`<div class="assessment-editor-option" data-assessment-option><label><input type="radio" name="correct_${index}" value="${next}" aria-label="Bonne réponse ${next+1}"><input type="text" data-option-text required maxlength="500" placeholder="Texte de la réponse"></label><button type="button" data-assessment-action="remove-option" aria-label="Retirer la réponse">×</button></div>`);options.querySelectorAll('[data-assessment-action="remove-option"]').forEach((item)=>item.disabled=options.children.length<=2);}
    if(action==="remove-option"){const options=question.querySelector("[data-assessment-options]");if(options.children.length>2){const wasChecked=button.closest("[data-assessment-option]").querySelector('input[type="radio"]').checked;button.closest("[data-assessment-option]").remove();if(wasChecked)options.querySelector('input[type="radio"]').checked=true;options.querySelectorAll("[data-assessment-option]").forEach((row,index)=>{const radio=row.querySelector('input[type="radio"]');radio.value=index;radio.name="correct_"+question.dataset.questionIndex;row.querySelector('[data-assessment-action="remove-option"]').disabled=options.children.length<=2;});}}
  });
  document.querySelectorAll("[data-path-assessment]").forEach((checkbox)=>checkbox.addEventListener("change",()=>{const row=checkbox.closest("[data-path-assessment-row]");row.querySelector("[data-path-assessment-score]").disabled=!checkbox.checked;row.querySelector("[data-path-assessment-required]").disabled=!checkbox.checked;}));
  document.querySelectorAll("[data-assessment-competency]").forEach((checkbox)=>checkbox.addEventListener("change",()=>{const row=checkbox.closest(".assessment-competency-row");row.querySelector("[data-assessment-competency-level]").disabled=!checkbox.checked;row.querySelector("[data-assessment-competency-score]").disabled=!checkbox.checked;}));
  const assessmentForm=document.querySelector("#assessment-editor-form");
  assessmentForm?.addEventListener("submit",async(event)=>{event.preventDefault();const button=assessmentForm.querySelector('button[type="submit"]');const feedback=document.querySelector("#assessment-editor-feedback");button.disabled=true;feedback.textContent="Enregistrement et validation des clés de correction…";
    try{const values=new FormData(assessmentForm);const questions=[...assessmentBuilder.querySelectorAll("[data-assessment-question]")].map((question)=>{const rows=[...question.querySelectorAll("[data-assessment-option]")];return {prompt:question.querySelector("[data-question-prompt]").value.trim(),options:rows.map((row)=>row.querySelector("[data-option-text]").value.trim()),correct_option_indexes:[rows.findIndex((row)=>row.querySelector('input[type="radio"]').checked)]};});
      const id=await saveAssessment({id:assessmentForm.dataset.assessmentId||null,code:values.get("code").trim().toUpperCase(),title:values.get("title").trim(),description:values.get("description"),passScore:values.get("pass_score"),maxAttempts:values.get("max_attempts"),timeLimitMinutes:values.get("time_limit_minutes"),versionLabel:values.get("version_label"),questions});
      const competencyMappings=[...assessmentForm.querySelectorAll("[data-assessment-competency]:checked")].map((checkbox)=>{const row=checkbox.closest(".assessment-competency-row");return {competency_id:checkbox.value,expected_level:row.querySelector("[data-assessment-competency-level]").value,minimum_score:Number(row.querySelector("[data-assessment-competency-score]").value)};});
      await saveAssessmentCompetencies(id,competencyMappings);
      location.hash="#/administration/evaluations/"+encodeURIComponent(id);await refresh();
    }catch(error){feedback.textContent=error.message||"Enregistrement impossible.";button.disabled=false;}
  });
  document.querySelector("#publish-assessment")?.addEventListener("click",async(event)=>{const button=event.currentTarget;button.disabled=true;button.textContent="Publication…";try{await publishAssessment(button.dataset.assessmentId);await refresh();location.hash="#/administration";}catch(error){window.alert(error.message||"Publication impossible.");button.disabled=false;button.textContent="Publier ↗";}});
  document.querySelector("#start-assessment")?.addEventListener("click",async(event)=>{
    const button=event.currentTarget;button.disabled=true;button.textContent="Initialisation…";
    try{const attemptId=await startAssessment(button.dataset.assessmentId);location.hash="#/evaluations/"+encodeURIComponent(button.dataset.assessmentId)+"?attempt="+encodeURIComponent(attemptId);await refresh();}
    catch(error){window.alert(error.message||"Démarrage impossible.");button.disabled=false;button.textContent="Commencer l’évaluation ↗";}
  });
  document.querySelector("#assessment-answer-form")?.addEventListener("submit",async(event)=>{
    event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button[type="submit"]');const feedback=document.querySelector("#assessment-feedback");button.disabled=true;feedback.textContent="Correction côté serveur…";
    const answers=[...form.querySelectorAll(".assessment-question")].map((question)=>({question_id:question.querySelector('input[type="radio"]').name.replace("question_",""),option_ids:[question.querySelector('input[type="radio"]:checked')?.value].filter(Boolean)}));
    try{await submitAssessment(form.dataset.attemptId,answers);await refresh();}
    catch(error){feedback.textContent=error.message||"Soumission impossible.";button.disabled=false;}
  });
  document.querySelector("#issue-path-certificate")?.addEventListener("click",async(event)=>{
    const button=event.currentTarget;button.disabled=true;button.textContent="Émission…";
    try{const code=await issuePathCertificate(button.dataset.pathId);location.hash="#/certificat/"+encodeURIComponent(code);render();}
    catch(error){window.alert(error.message||"Émission impossible.");button.disabled=false;button.textContent="Émettre mon certificat ↗";}
  });
  const verifyForm=document.querySelector("#certificate-verify-form");
  if(verifyForm){
    const verify=async(code)=>{const output=document.querySelector("#certificate-verification-result");output.innerHTML='<p class="progress-note">Vérification du registre…</p>';
      try{const records=await verifyCertificate(code);const item=Array.isArray(records)?records[0]:records;output.innerHTML=item?`<section class="certificate-verification ${item.valid?"is-valid":"is-revoked"}"><span class="eyebrow">${item.valid?"CERTIFICAT VALIDE":"CERTIFICAT RÉVOQUÉ"}</span><h2>${escapeHtml(item.certificate_title)}</h2><p>Code : ${escapeHtml(item.certificate_code)}</p><p>Version : ${escapeHtml(item.path_version)}</p><p>Émis le : ${new Date(item.issued_at).toLocaleDateString("fr-FR")}</p></section>`:'<p class="progress-note">Aucun certificat correspondant à ce code.</p>';}
      catch(error){output.innerHTML='<p class="progress-note">'+escapeHtml(error.message||"Vérification impossible.")+'</p>';}
    };
    verifyForm.addEventListener("submit",(event)=>{event.preventDefault();verify(new FormData(verifyForm).get("code").trim());});
    if(verifyForm.elements.code.value.trim())verify(verifyForm.elements.code.value.trim());
  }
  document.querySelectorAll("[data-training-billing]").forEach(form=>form.addEventListener("submit",async(event)=>{
    event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;const v=new FormData(form);
    try{const amount=Number(v.get("amount_da"));if(!Number.isFinite(amount)||amount<0)throw new Error("Montant invalide.");await saveTrainingBillingRecord({enrollment_id:form.dataset.trainingBilling,billing_owner:v.get("billing_owner"),external_invoice_reference:v.get("external_invoice_reference").trim(),currency_code:"DZD",amount_minor_units:Math.round(amount*100),payment_status:v.get("payment_status"),accounting_note:v.get("accounting_note")});await refresh();}
    catch(error){window.alert(error.message||"Enregistrement de la facture impossible.");button.disabled=false;}
  }));
  document.querySelectorAll("[data-training-billing-update]").forEach(form=>form.addEventListener("submit",async(event)=>{
    event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;const v=new FormData(form);
    try{await saveTrainingBillingRecord({id:form.dataset.trainingBillingUpdate,enrollment_id:v.get("enrollment_id"),billing_owner:v.get("billing_owner"),external_invoice_reference:v.get("external_invoice_reference"),currency_code:v.get("currency_code"),amount_minor_units:v.get("amount_minor_units"),payment_status:v.get("payment_status"),accounting_note:v.get("accounting_note")});await refresh();}
    catch(error){window.alert(error.message||"Mise à jour du règlement impossible.");button.disabled=false;}
  }));
  document.querySelector("#training-partner-form")?.addEventListener("submit",async(event)=>{
    event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button[type="submit"]');const feedback=document.querySelector("#training-partner-feedback");const v=new FormData(form);button.disabled=true;feedback.textContent="Enregistrement du partenaire en brouillon…";
    const list=(value)=>value.split(",").map(x=>x.trim()).filter(Boolean);
    try{await saveTrainingPartner({partner_code:v.get("partner_code").trim().toUpperCase(),legal_name:v.get("legal_name").trim(),approval_number:v.get("approval_number").trim(),approval_authority:v.get("approval_authority").trim(),approval_valid_from:v.get("approval_valid_from"),approval_valid_until:v.get("approval_valid_until"),approved_specialties:list(v.get("approved_specialties")),approved_delivery_modes:v.getAll("approved_delivery_modes")});await refresh();}
    catch(error){feedback.textContent=error.message||"Enregistrement impossible.";button.disabled=false;}
  });
  document.querySelector("#training-agreement-form")?.addEventListener("submit",async(event)=>{
    event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button[type="submit"]');const feedback=document.querySelector("#training-agreement-feedback");const v=new FormData(form);button.disabled=true;feedback.textContent="Enregistrement de la convention en brouillon…";
    const list=(value)=>value.split(",").map(x=>x.trim()).filter(Boolean);
    try{await saveTrainingAgreement({partner_id:v.get("partner_id"),agreement_code:v.get("agreement_code").trim().toUpperCase(),agreement_title:v.get("agreement_title").trim(),valid_from:v.get("valid_from"),valid_until:v.get("valid_until"),signed_at:v.get("signed_at"),billing_responsibility:v.get("billing_responsibility"),document_issuer:v.get("document_issuer"),permitted_specialties:list(v.get("permitted_specialties")),permitted_venues:list(v.get("permitted_venues")),permitted_delivery_modes:v.getAll("permitted_delivery_modes")});await refresh();}
    catch(error){feedback.textContent=error.message||"Enregistrement impossible.";button.disabled=false;}
  });
  document.querySelectorAll("[data-training-reference-status]").forEach(button=>button.addEventListener("click",async()=>{
    button.disabled=true;try{await setTrainingReferenceStatus(button.dataset.trainingReferenceStatus,button.dataset.id,button.dataset.next,"Validation documentaire depuis la console Academy");await refresh();}
    catch(error){window.alert(error.message||"Activation impossible.");button.disabled=false;}
  }));
  document.querySelector("#training-offering-form")?.addEventListener("submit",async(event)=>{
    event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button[type="submit"]');const feedback=document.querySelector("#training-offering-feedback");const v=new FormData(form);button.disabled=true;feedback.textContent="Enregistrement du brouillon…";
    try{const regime=v.get("delivery_regime");await saveTrainingOffering({offering_code:v.get("offering_code").trim().toUpperCase(),title:v.get("title").trim(),specialty_code:v.get("specialty_code").trim(),description:v.get("description"),audience_profile:v.get("audience_profile"),delivery_regime:regime,partner_id:regime==="PRIVATE_WORKSHOP"?null:(v.get("partner_id")||null),agreement_id:regime==="PRIVATE_WORKSHOP"?null:(v.get("agreement_id")||null),default_duration_days:v.get("default_duration_days"),default_capacity:v.get("default_capacity")});await refresh();}
    catch(error){feedback.textContent=error.message||"Enregistrement impossible.";button.disabled=false;}
  });
  document.querySelector("#training-session-form")?.addEventListener("submit",async(event)=>{
    event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button[type="submit"]');const feedback=document.querySelector("#training-session-feedback");const v=new FormData(form);button.disabled=true;feedback.textContent="Création de la session…";
    const iso=(value)=>value?new Date(value).toISOString():null;
    try{await saveTrainingSession({offering_id:v.get("offering_id"),session_code:v.get("session_code").trim().toUpperCase(),venue_code:v.get("venue_code").trim(),starts_at:iso(v.get("starts_at")),ends_at:iso(v.get("ends_at")),delivery_mode:v.get("delivery_mode"),capacity:v.get("capacity"),registration_opens_at:iso(v.get("registration_opens_at")),registration_closes_at:iso(v.get("registration_closes_at"))});await refresh();}
    catch(error){feedback.textContent=error.message||"Création impossible.";button.disabled=false;}
  });
  document.querySelectorAll("[data-training-status]").forEach(button=>button.addEventListener("click",async()=>{
    button.disabled=true;try{await setTrainingStatus(button.dataset.trainingStatus,button.dataset.id,button.dataset.next,"Changement depuis la console Academy");await refresh();}
    catch(error){window.alert(error.message||"Changement de statut impossible.");button.disabled=false;}
  }));
  document.querySelectorAll("[data-training-enrollment-status]").forEach(form=>form.addEventListener("submit",async(event)=>{
    event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;
    try{const v=new FormData(form);await setTrainingEnrollmentStatus(form.dataset.trainingEnrollmentStatus,v.get("status"),"Mise à jour depuis la console Academy");await refresh();}
    catch(error){window.alert(error.message||"Mise à jour impossible.");button.disabled=false;}
  }));
  document.querySelectorAll("[data-training-attendance]").forEach(form=>form.addEventListener("submit",async(event)=>{
    event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;
    try{const v=new FormData(form);await recordTrainingAttendance(form.dataset.trainingAttendance,v.get("date"),v.get("status"),v.get("minutes"),"");await refresh();}
    catch(error){window.alert(error.message||"Enregistrement de présence impossible.");button.disabled=false;}
  }));
  document.querySelectorAll("[data-training-issue]").forEach(form=>form.addEventListener("submit",async(event)=>{
    event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;const v=new FormData(form);let result=form.nextElementSibling;
    if(!result||!result.classList.contains("training-issued-result")){result=document.createElement("div");result.className="training-issued-result";form.after(result);}
    result.textContent="Émission sécurisée…";
    try{const issued=await issueTrainingDocument(form.dataset.trainingIssue,v.get("document_type"),v.get("title").trim(),v.get("issuer_kind")||null,v.get("issuer_reference") ? v.get("issuer_reference").trim() : null);const link=location.origin+location.pathname+"#/verifier-formation/"+issued.verification_token;
      result.innerHTML='<b>Document émis : '+escapeHtml(issued.document_code)+'</b><p>Le QR code est généré localement dans le navigateur. Il encode uniquement le lien public de vérification.</p><div class="training-qr" role="img" aria-label="QR code de vérification du document"></div><button type="button" class="button button-outline" data-training-qr-download>Télécharger le QR code (PNG)</button><a class="text-link" href="'+escapeHtml(link)+'">Ouvrir la vérification publique ↗</a><details><summary>Afficher le jeton de vérification</summary><code>'+escapeHtml(issued.verification_token)+'</code></details>';
      const qrNode=result.querySelector(".training-qr");
      if(window.QRCode){
        new window.QRCode(qrNode,{text:link,width:240,height:240,colorDark:"#101815",colorLight:"#ffffff",correctLevel:window.QRCode.CorrectLevel.M});
        result.querySelector("[data-training-qr-download]").addEventListener("click",()=>{
          const canvas=qrNode.querySelector("canvas");
          if(!canvas){window.alert("Le QR code n’est pas disponible au format PNG sur ce navigateur.");return;}
          const anchor=document.createElement("a");anchor.href=canvas.toDataURL("image/png");anchor.download="BA-Labs-Academy-"+issued.document_code+".png";anchor.click();
        });
      }else{
        qrNode.textContent="Générateur QR local indisponible. Le lien de vérification reste accessible ci-dessus.";
        result.querySelector("[data-training-qr-download]").disabled=true;
      }
      button.disabled=true;
    }catch(error){result.textContent=error.message||"Émission impossible.";button.disabled=false;}
  }));
  document.querySelectorAll("[data-training-revoke]").forEach(button=>button.addEventListener("click",async()=>{
    const reason=window.prompt("Motif obligatoire de révocation :");if(!reason||!reason.trim())return;button.disabled=true;
    try{await revokeTrainingDocument(button.dataset.trainingRevoke,reason.trim());await refresh();}
    catch(error){window.alert(error.message||"Révocation impossible.");button.disabled=false;}
  }));
  const verifyTrainingForm=document.querySelector("#training-document-verify-form");
  const verifyTraining=(form,output)=>async(event)=>{
    event.preventDefault();const token=new FormData(form).get("token").trim();output.textContent="Vérification…";
    try{const result=await verifyTrainingDocument(token);output.innerHTML=result?'<article class="training-verification '+(result.verification_status==="VALID"?"is-valid":"is-revoked")+'"><h3>'+escapeHtml(result.verification_status==="VALID"?"Document valide":"Document révoqué")+'</h3><b>'+escapeHtml(result.document_code)+'</b><p>'+escapeHtml(result.title)+' · '+escapeHtml(result.document_type)+'</p><p>Émetteur : '+escapeHtml(result.issuer_name)+' · '+escapeHtml(new Date(result.issued_at).toLocaleDateString("fr-FR"))+'</p></article>':'<p class="progress-note">Aucun document correspondant à ce jeton.</p>';}
    catch(error){output.textContent=error.message||"Vérification impossible.";}
  };
  if(verifyTrainingForm)verifyTrainingForm.addEventListener("submit",verifyTraining(verifyTrainingForm,document.querySelector("#training-document-verify-result")||document.querySelector("#training-public-verify-result")));
  const publicVerifyForm=document.querySelector("#training-public-verify-form");
  if(publicVerifyForm){const out=document.querySelector("#training-public-verify-result");publicVerifyForm.addEventListener("submit",verifyTraining(publicVerifyForm,out));if(publicVerifyForm.elements.token.value.trim())verifyTraining(publicVerifyForm,out)(new Event("submit",{cancelable:true}));}
  const membershipForm=document.querySelector("#membership-form");
  if(membershipForm) membershipForm.addEventListener("submit",async(event)=>{
    event.preventDefault();const button=membershipForm.querySelector('button[type="submit"]');const feedback=document.querySelector("#membership-feedback");const values=new FormData(membershipForm);
    button.disabled=true;feedback.textContent="Vérification des droits et enregistrement…";
    try{await manageAcademyMembership(values.get("user_id").trim(),values.get("role"),values.get("status"),values.get("note"));await refresh();}
    catch(error){feedback.textContent=error.message||"Modification impossible.";button.disabled=false;}
  });
  const contentForm=document.querySelector("#content-editor-form");
  if(contentForm){
    const syncDomains=()=>{const selected=new Set([...contentForm.querySelectorAll("[data-content-department]:checked")].map((x)=>x.value));contentForm.querySelectorAll("[data-domain-parent]").forEach((row)=>{row.hidden=!selected.has(row.dataset.domainParent);if(row.hidden)row.querySelector("input").checked=false;});};
    contentForm.querySelectorAll("[data-content-department]").forEach((x)=>x.addEventListener("change",syncDomains));
    contentForm.addEventListener("change",(event)=>{if(event.target.name==="primary_department"){contentForm.querySelectorAll("[data-content-department]").forEach((x)=>{if(x.value===event.target.value)x.checked=true;});syncDomains();}});
    syncDomains();
    contentForm.addEventListener("submit",async(event)=>{event.preventDefault();const button=contentForm.querySelector('button[type="submit"]');const feedback=document.querySelector("#content-editor-feedback");button.disabled=true;feedback.textContent="Enregistrement et synchronisation de l’Atlas…";
      try{const values=new FormData(contentForm);const departments=[...contentForm.querySelectorAll("[data-content-department]:checked")].map((x)=>({code:x.value,is_primary:values.get("primary_department")===x.value}));const domains=[...contentForm.querySelectorAll("[data-content-domain]:checked")].map((x)=>({code:x.value}));
        const id=await saveContentEditorial({id:contentForm.dataset.contentId||null,businessId:values.get("business_id").trim(),slug:values.get("slug").trim(),title:values.get("title").trim(),summary:values.get("summary"),resourceType:values.get("resource_type"),languageCode:values.get("language_code").trim(),learningLevel:values.get("learning_level")||null,departments,domains});
        location.hash="#/administration/ressources/"+encodeURIComponent(id);await refresh();
      }catch(error){feedback.textContent=error.message||"Enregistrement impossible.";button.disabled=false;}
    });
  }
  const assetForm=document.querySelector("#content-asset-form");
  if(assetForm){
    assetForm.addEventListener("submit",async(event)=>{event.preventDefault();const button=assetForm.querySelector('button[type="submit"]');const feedback=document.querySelector("#content-asset-feedback");button.disabled=true;feedback.textContent="Enregistrement de la version…";
      try{const values=new FormData(assetForm);await saveContentAssets(assetForm.dataset.contentId,[{asset_code:values.get("asset_code").trim(),asset_kind:values.get("asset_kind"),delivery_type:"EXTERNAL_URL",title:values.get("title").trim(),external_url:values.get("external_url").trim(),mime_type:values.get("mime_type").trim(),language_code:values.get("language_code").trim()||"fr",license_code:values.get("license_code").trim(),attribution:values.get("attribution").trim(),description:values.get("description").trim(),sort_order:0}]);await refresh();}
      catch(error){feedback.textContent=error.message||"Ajout du support impossible.";button.disabled=false;}
    });
  }
  document.querySelectorAll("[data-content-submit]").forEach((button)=>button.addEventListener("click",async()=>{button.disabled=true;try{await submitContentForReview(button.dataset.contentSubmit);await refresh();}catch(error){window.alert(error.message||"Soumission impossible.");button.disabled=false;}}));
  document.querySelectorAll("[data-content-review]").forEach((button)=>button.addEventListener("click",async()=>{button.disabled=true;try{await reviewContent(button.dataset.contentId,button.dataset.contentReview);await refresh();}catch(error){window.alert(error.message||"Revue impossible.");button.disabled=false;}}));
  document.querySelectorAll("[data-content-publish]").forEach((button)=>button.addEventListener("click",async()=>{button.disabled=true;try{await publishContent(button.dataset.contentPublish);await refresh();}catch(error){window.alert(error.message||"Publication impossible.");button.disabled=false;}}));
  document.querySelectorAll("[data-taxonomy-publish]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Publication…";
      try {
        if (button.dataset.taxonomyPublish === "department") await publishDepartment(button.dataset.code);
        else await publishDomain(button.dataset.code);
        await refresh();
      } catch (error) {
        window.alert(error.message || "Publication impossible.");
        button.disabled = false;
        button.textContent = "Publier";
      }
    });
  });
  document.querySelector("#competency-editor-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const feedback = document.querySelector("#competency-editor-feedback");
    button.disabled = true;
    feedback.textContent = "Enregistrement de la compétence et synchronisation de l’Atlas…";
    try {
      const values = new FormData(form);
      const mappings = [...form.querySelectorAll("[data-competency-content]:checked")].map((checkbox) => {
        const row = checkbox.closest(".competency-resource-row");
        return { content_id: checkbox.value, expected_level: row.querySelector("[data-expected-level]").value, assessment_hint: row.querySelector("[data-assessment-hint]").value.trim() };
      });
      const id = await saveCompetency({ id: form.dataset.competencyId || null, code: values.get("code").trim().toUpperCase(), title: values.get("title").trim(), description: values.get("description"), level: values.get("level"), mappings });
      const domainCodes = [...form.querySelectorAll("[data-competency-domain]:checked")].map((checkbox) => checkbox.value);
      await saveCompetencyDomains(id, domainCodes);
      const prerequisiteIds = [...form.querySelectorAll("[data-competency-prerequisite]:checked")].map((checkbox) => checkbox.value);
      await saveCompetencyPrerequisites(id, prerequisiteIds);
      location.hash = `#/administration/competences/${encodeURIComponent(id)}`;
      await refresh();
    } catch (error) {
      feedback.textContent = error.message || "Enregistrement impossible.";
      button.disabled = false;
    }
  });
  document.querySelector("#publish-competency")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Publication…";
    try { await publishCompetency(button.dataset.competencyId); await refresh(); location.hash = "#/administration"; }
    catch (error) { window.alert(error.message || "Publication impossible."); button.disabled = false; button.textContent = "Publier ↗"; }
  });
  document.querySelectorAll("[data-competency-publish]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try { await publishCompetency(button.dataset.competencyPublish); await refresh(); }
      catch (error) { window.alert(error.message || "Publication impossible."); button.disabled = false; }
    });
  });
  const programmeForm=document.querySelector("#programme-editor-form");
  if(programmeForm){
    const nodeList=programmeForm.querySelector("#programme-node-list");
    const refreshHierarchyPreview=()=>{
      const rows=[...nodeList.querySelectorAll("[data-program-node-row]")];
      const nodes=rows.map(row=>({code:row.querySelector("[data-program-node-code]").value.trim().toUpperCase(),node_type:row.querySelector("[data-program-node-type]").value,title:row.querySelector("[data-program-node-title]").value.trim(),parent_code:row.querySelector("[data-program-node-parent]").value,sort_order:Number(row.querySelector("[data-program-node-order]").value)||9999})).filter(node=>node.code);
      const preview=programmeForm.querySelector("#programme-hierarchy-preview");
      const children=new Map();
      nodes.forEach(node=>{const key=node.parent_code||"";if(!children.has(key))children.set(key,[]);children.get(key).push(node);});
      const render=(parent,depth,seen=new Set())=>(children.get(parent)||[]).sort((a,b)=>a.sort_order-b.sort_order).map(node=>{
        if(seen.has(node.code))return "";
        const next=new Set(seen);next.add(node.code);
        return '<div class="programme-preview-node" style="--tree-depth:'+depth+'"><span>'+escapeHtml(node.node_type)+'</span><b>'+escapeHtml(node.title||"Intitulé à définir")+'</b><small>'+escapeHtml(node.code)+'</small></div>'+render(node.code,depth+1,next);
      }).join("");
      const html=render("",0);
      preview.innerHTML='<span class="eyebrow">APERÇU DE L’ARBORESCENCE</span>'+(html||'<p class="muted">Ajoute des niveaux pour visualiser la structure.</p>');
    };
    const refreshParentOptions=()=>{
      const rows=[...nodeList.querySelectorAll("[data-program-node-row]")];
      const rank={CYCLE:1,YEAR:2,SEMESTER:3,BLOCK:4,MODULE:5,UNIT:6,CHAPTER:7,SEQUENCE:8,LESSON:9,ACTIVITY:10};
      const nodes=rows.map(row=>({code:row.querySelector("[data-program-node-code]").value.trim().toUpperCase(),node_type:row.querySelector("[data-program-node-type]").value,title:row.querySelector("[data-program-node-title]").value.trim()}));
      rows.forEach((row,index)=>{
        const select=row.querySelector("[data-program-node-parent]");
        const current=select.value;
        const own=nodes[index];
        select.innerHTML='<option value="">Racine du programme</option>'+nodes.filter((candidate,i)=>i!==index&&candidate.code&&rank[candidate.node_type]<rank[own.node_type]).map(candidate=>'<option value="'+escapeHtml(candidate.code)+'">'+escapeHtml(candidate.code)+' · '+escapeHtml(candidate.title||candidate.node_type)+'</option>').join('');
        if([...select.options].some(option=>option.value===current))select.value=current;
      });
    };
    nodeList.addEventListener("input",()=>{refreshParentOptions();refreshHierarchyPreview();});
    nodeList.addEventListener("change",()=>{refreshParentOptions();refreshHierarchyPreview();});
    nodeList.addEventListener("click",event=>{
      const remove=event.target.closest("[data-program-node-remove]");
      if(remove){remove.closest("[data-program-node-row]").remove();refreshParentOptions();refreshHierarchyPreview();}
    });
    programmeForm.querySelector("#add-programme-node")?.addEventListener("click",()=>{
      const count=nodeList.querySelectorAll("[data-program-node-row]").length;
      nodeList.insertAdjacentHTML("beforeend",programmeNodeRowMarkup({node_type:"BLOCK",sort_order:count+1,is_required:true},count,[]));
      refreshParentOptions();refreshHierarchyPreview();
    });
    const selectedDepartments=()=>[...programmeForm.querySelectorAll("[data-program-department]:checked")].map(input=>input.value);
    const primarySelect=programmeForm.querySelector('[name="primary_department"]');
    const updateDisciplineOptions=()=>{
      const selected=selectedDepartments();
      [...primarySelect.options].forEach(option=>{if(option.value)option.disabled=!selected.includes(option.value);});
      programmeForm.querySelectorAll("[data-program-domain-row]").forEach(row=>{
        const enabled=selected.includes(row.dataset.departmentCode);
        row.hidden=!enabled;
        if(!enabled)row.querySelector("input").checked=false;
      });
      if(!selected.includes(primarySelect.value))primarySelect.value=selected[0]||"";
    };
    programmeForm.querySelectorAll("[data-program-department]").forEach(checkbox=>checkbox.addEventListener("change",updateDisciplineOptions));
    updateDisciplineOptions();
    refreshHierarchyPreview();
    programmeForm.addEventListener("submit",async event=>{
      event.preventDefault();
      const button=programmeForm.querySelector('button[type="submit"]');
      const feedback=programmeForm.querySelector("#programme-editor-feedback");
      const values=new FormData(programmeForm);
      const departments=selectedDepartments().map(code=>({code,is_primary:code===values.get("primary_department")}));
      const domains=[...programmeForm.querySelectorAll("[data-program-domain]:checked")].map(input=>({code:input.value}));
      const nodes=[...nodeList.querySelectorAll("[data-program-node-row]")].map(row=>({
        code:row.querySelector("[data-program-node-code]").value.trim().toUpperCase(),
        node_type:row.querySelector("[data-program-node-type]").value,
        title:row.querySelector("[data-program-node-title]").value.trim(),
        parent_code:row.querySelector("[data-program-node-parent]").value||null,
        sort_order:Number(row.querySelector("[data-program-node-order]").value),
        estimated_minutes:row.querySelector("[data-program-node-duration]").value?Number(row.querySelector("[data-program-node-duration]").value):null,
        summary:row.querySelector("[data-program-node-summary]").value.trim(),
        is_required:row.querySelector("[data-program-node-required]").checked
      }));
      if(!departments.some(item=>item.is_primary)){feedback.textContent="Sélectionne au moins un département et désigne son rattachement principal.";return;}
      if(!domains.length){feedback.textContent="Sélectionne au moins un domaine disciplinaire.";return;}
      if(!nodes.length){feedback.textContent="Ajoute au moins un niveau à la hiérarchie.";return;}
      button.disabled=true;feedback.textContent="Enregistrement de la structure du programme…";
      try{
        const id=await saveProgramDraft({
          id:programmeForm.dataset.programId||null,code:values.get("code").trim().toUpperCase(),slug:values.get("slug").trim().toLowerCase(),
          title:values.get("title").trim(),summary:values.get("summary"),objectives:values.get("objectives"),
          programType:values.get("program_type"),targetAudience:values.get("target_audience"),difficultyLevel:values.get("difficulty_level"),
          durationHours:values.get("duration_hours"),versionLabel:values.get("version_label"),departments,domains,nodes
        });
        location.hash="#/administration/programmes/"+encodeURIComponent(id);
        await refresh();
      }catch(error){feedback.textContent=error.message||"Enregistrement impossible.";button.disabled=false;}
    });
  }
  document.querySelector("#publish-programme")?.addEventListener("click",async event=>{
    const button=event.currentTarget;button.disabled=true;button.textContent="Publication…";
    try{await publishProgram(button.dataset.programId);await refresh();location.hash="#/administration";}
    catch(error){window.alert(error.message||"Publication impossible.");button.disabled=false;button.textContent="Publier le programme ↗";}
  });
  document.querySelector("#pathway-editor-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const feedback = document.querySelector("#pathway-editor-feedback");
    button.disabled = true;
    feedback.textContent = "Enregistrement du brouillon…";
    try {
      const values = new FormData(form);
      const sequencePanel = document.querySelector("#pathway-sequence-panel");
      const sequence = readPathwaySequence(sequencePanel);
      const items = sequence.map((item) => ({
        content_id: item.contentId,
        is_required: item.isRequired,
        prerequisites: item.prerequisites
      }));
      const pathId = await saveLearningPath({
        id: form.dataset.pathId || null, code: values.get("code"), slug: values.get("slug"),
        title: values.get("title"), summary: values.get("summary"),
        targetAudience: values.get("target_audience"), difficultyLevel: values.get("difficulty_level"),
        durationMinutes: values.get("duration"), versionLabel: values.get("version_label"), items
      });
      const requirements=[...form.querySelectorAll("[data-path-assessment]:checked")].map((checkbox)=>{const row=checkbox.closest("[data-path-assessment-row]");return {assessment_id:checkbox.value,is_required:row.querySelector("[data-path-assessment-required]").checked,minimum_score:Number(row.querySelector("[data-path-assessment-score]").value)};});
      await savePathAssessments(pathId,requirements);
      location.hash = `#/administration/parcours/${encodeURIComponent(pathId)}`;
      await refresh();
    } catch (error) {
      feedback.textContent = error.message || "Enregistrement impossible.";
      button.disabled = false;
    }
  });
  document.querySelector("#publish-pathway")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await publishLearningPath(button.dataset.pathId);
      await refresh();
      location.hash = "#/administration";
    } catch (error) {
      window.alert(error.message || "Publication impossible.");
      button.disabled = false;
    }
  });
  document.querySelector("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const feedback = document.querySelector("#auth-feedback");
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    feedback.textContent = "Connexion…";
    try {
      const form = new FormData(event.currentTarget);
      await signInWithPassword(form.get("email"), form.get("password"));
      currentSession = await getSession();
      await refresh();
    } catch (error) {
      feedback.textContent = error.message || "Connexion impossible.";
      submit.disabled = false;
    }
  });
  document.querySelector("#logout")?.addEventListener("click", async () => {
    try { await signOut(); } catch (error) {
      const feedback = document.querySelector("#auth-feedback");
      if (feedback) feedback.textContent = error.message;
    }
  });
  document.querySelector("#enroll-path")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await enrollInPath(button.dataset.pathId);
      await refresh();
    } catch (error) {
      button.disabled = false;
      window.alert(error.message || "Inscription impossible.");
    }
  });
  document.querySelector("#complete-resource")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      if (button.dataset.pathItemId) {
        await savePathItemProgress(button.dataset.pathItemId, true);
      } else {
        await saveResourceProgress(button.dataset.contentId, true);
      }
      await refresh();
    } catch (error) {
      button.disabled = false;
      window.alert(error.message || "Enregistrement impossible.");
    }
  });
  document.title = route === "ressource" && slug
    ? `${data.content.find((item) => item.slug === slug)?.title || "Ressource"} — BA Labs Academy`
    : "BA Labs Academy";
}

async function refresh() {
  connection.textContent = "Synchronisation…";
  try {
    data = await loadAcademyData();
    loadError = null;
    render();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Erreur inconnue";
    connection.textContent = "API indisponible";
    render();
  }
}

window.addEventListener("hashchange", render);
window.addEventListener("academy:auth-change", (event) => {
  currentSession = event.detail?.session || null;
  refresh();
});
getSession().then((session) => {
  currentSession = session;
  return refresh();
}).catch(() => refresh());
