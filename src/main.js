import { loadAcademyData } from "./data.js";
import { escapeHtml } from "./core/dom.js";
import { bindAtlasGraph, renderAtlasGraph } from "./features/atlas/renderer.js";
import { resolvePathItems } from "./features/learning/progress.js";

const root = document.querySelector("#app");
const connection = document.querySelector("#connection-state");
let data = {
  departments: [], domains: [], content: [], departmentLinks: [], domainLinks: [],
  learningPaths: [], pathItems: [], pathPrerequisites: [], competencies: [], contentCompetencies: [],
  nodes: [], edges: []
};
let loadError = null;
let unbindAtlas = () => {};

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

function resourceDetail(slug) {
  const item = data.content.find((entry) => entry.slug === slug);
  if (!item) return notFound("Ressource indisponible", "Cette ressource n’est pas publiée ou n’existe pas dans le catalogue public.");
  const destination = safeExternalUrl(item.destination_url);
  return `<section class="page-intro"><span class="eyebrow"><a href="#/catalogue">CATALOGUE</a> / ${escapeHtml((item.resource_type || "RESSOURCE").toUpperCase())}</span><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.summary)}</p></section>
  <section class="resource-detail"><div class="detail-meta"><span>${escapeHtml((item.language_code || "fr").toUpperCase())}</span><span>${escapeHtml(item.learning_level || "Tous niveaux")}</span><span>Version ${escapeHtml(item.version_label || "—")}</span></div>
  <p class="detail-note">Cette fiche présente les informations publiques validées pour cette ressource.</p>
  ${destination ? `<a class="button button-primary" href="${escapeHtml(destination)}" target="_blank" rel="noopener noreferrer">Accéder à la ressource ↗</a>` : ""}
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
    []
  );
  const contentById = new Map(data.content.map((item) => [item.id, item]));
  const competencyIds = new Set(
    data.contentCompetencies
      .filter((relation) => rawItems.some((item) => item.content_id === relation.content_id))
      .map((relation) => relation.competency_id)
  );
  const competencies = data.competencies.filter((item) => competencyIds.has(item.id));
  const difficulty = {
    INTRODUCTORY: "Initiation",
    FOUNDATION: "Fondamental",
    INTERMEDIATE: "Intermédiaire",
    ADVANCED: "Avancé"
  }[path.difficulty_level] || path.difficulty_level;
  const steps = sequence.map((step, index) => {
    const resource = contentById.get(step.content_id);
    const title = resource?.title || "Ressource indisponible";
    const description = resource?.summary || "Description à compléter.";
    const state = step.isLocked ? "Prérequis à valider" : "Accessible";
    const body = `<span class="path-step-index">${String(index + 1).padStart(2, "0")}</span>
      <div class="path-step-copy"><span class="eyebrow">${step.is_required ? "ÉTAPE OBLIGATOIRE" : "ÉTAPE COMPLÉMENTAIRE"} · ${escapeHtml(state)}</span>
      <h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div>
      <span class="path-step-status">${step.isLocked ? "Verrouillé" : "Ouvrir"} ${step.isLocked ? "⌑" : "↗"}</span>`;
    return step.isLocked || !resource
      ? `<div class="path-step is-locked">${body}</div>`
      : `<a class="path-step" href="#/ressource/${encodeURIComponent(resource.slug)}">${body}</a>`;
  }).join("");
  return `<section class="page-intro"><span class="eyebrow"><a href="#/parcours">PARCOURS</a> / ${escapeHtml(path.code)}</span><h1>${escapeHtml(path.title)}</h1><p>${escapeHtml(path.summary)}</p></section>
    <div class="pathway-overview"><span>${escapeHtml(difficulty)}</span><span>${sequence.length} étape(s)</span><span>${path.estimated_duration_minutes ? `${path.estimated_duration_minutes} minutes estimées` : "Durée à définir"}</span></div>
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">SÉQUENCE D’APPRENTISSAGE</span><h2>Étapes et prérequis</h2></div></div>
    <div class="path-sequence">${steps || emptyState("Séquence en préparation", "Les ressources seront ajoutées au parcours après validation.")}</div></section>
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">RÉSULTATS D’APPRENTISSAGE</span><h2>Compétences visées</h2></div></div>
    ${competencies.length ? `<div class="competency-list">${competencies.map((item) => `<div class="competency-chip"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.competency_level)}</span></div>`).join("")}</div>` : emptyState("Compétences en cours de définition", "Les compétences seront associées aux ressources du parcours.")}</section>
    <p class="progress-note">Le suivi individuel et la sauvegarde de la progression seront activés avec l’espace apprenant et l’authentification.</p>`;
}

function atlasView() {
  return `<section class="page-intro"><span class="eyebrow">CARTOGRAPHIE DES CONNAISSANCES</span><h1>Atlas</h1><p>Explorer les relations entre départements, domaines et ressources. Déplace la carte par glisser-déposer et utilise la molette ou les contrôles pour zoomer.</p></section>
  <div class="atlas-panel"><div class="atlas-toolbar"><span><b>${data.nodes.length}</b> nœud(s) public(s)</span><span>${data.edges.length} relation(s) publique(s)</span></div>
  ${data.nodes.length ? renderAtlasGraph(data.nodes, data.edges) : emptyState("L’Atlas public est encore vide", "Le moteur 2D est en place. Les nœuds et relations apparaîtront ici après leur publication éditoriale.")}</div>
  <div class="atlas-legend"><span class="legend-department">Département</span><span class="legend-domain">Domaine</span><span class="legend-content">Ressource</span><span class="legend-pathway">Parcours</span></div>`;
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
      (route === "atlas" && target === "atlas") ||
      (route === "parcours" && target === "parcours");
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function render() {
  unbindAtlas();
  const path = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const [route = "", slug = ""] = path.split("/");
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
    "ressource": () => resourceDetail(slug),
    "parcours": () => slug ? learningPathDetail(slug) : learningPathsView(),
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
      } else if (["CONTENT", "MODULE", "LESSON"].includes(node.entity_type)) {
        const item = data.content.find((entry) =>
          entry.business_id === node.entity_key || entry.slug === node.entity_key
        );
        if (item) location.hash = `#/ressource/${encodeURIComponent(item.slug)}`;
      }
    });
  }
  if (route === "catalogue") {
    document.querySelector("#resource-search")?.addEventListener("input", (event) => filterCatalogue(event.target.value));
  }
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
refresh();
