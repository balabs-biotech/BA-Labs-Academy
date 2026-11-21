import { loadAcademyData, enrollInPath, saveResourceProgress, savePathItemProgress, saveLearningPath, publishLearningPath, publishDepartment, publishDomain } from "./data.js";
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
  learningPaths: [], editorialPaths: [], pathItems: [], pathPrerequisites: [], competencies: [], contentCompetencies: [],
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
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">RÉSULTATS D’APPRENTISSAGE</span><h2>Compétences visées</h2></div></div>
    ${competencies.length ? `<div class="competency-list">${competencies.map((item) => `<div class="competency-chip"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.competency_level)}</span></div>`).join("")}</div>` : emptyState("Compétences en cours de définition", "Les compétences seront associées aux ressources du parcours.")}</section>
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
    ${["OWNER","ADMIN","EDITOR"].includes(membership.role) ? `
    <section class="section-block pathway-editorial">
      <div class="section-heading"><div><span class="eyebrow">GESTION DES PARCOURS</span><h2>Parcours pédagogiques</h2></div><a class="button button-primary" href="#/administration/parcours/nouveau">Créer un parcours ↗</a></div>
      <div class="editorial-path-list">${(data.editorialPaths || []).filter((path) => path.status === "DRAFT").map((path) => `<a class="editorial-path-row" href="#/administration/parcours/${encodeURIComponent(path.id)}"><div><span class="eyebrow">${escapeHtml(path.code)} · ${escapeHtml(path.status)}</span><h3>${escapeHtml(path.title)}</h3><p>${escapeHtml(path.summary || "Aucun résumé.")}</p></div><b>Modifier ↗</b></a>`).join("") || emptyState("Aucun parcours", "Crée le premier brouillon pédagogique.")}</div>
    </section>` : ""}

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
    "recherche": () => searchResultsView(new URLSearchParams(query).get("q") || ""),
    "ressource": () => resourceDetail(slug, pathItemId),
    "parcours": () => slug ? learningPathDetail(slug) : learningPathsView(),
    "espace": learnerView,
    "administration": () => subroute === "parcours" ? learningPathEditorView(subId) : administrationView(),
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
