import { loadAcademyData } from "./data.js";

const root = document.querySelector("#app");
const connection = document.querySelector("#connection-state");
let data = { departments: [], domains: [], content: [], nodes: [], edges: [] };
let loadError = null;

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

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
    ${data.departments.length ? `<div class="card-grid">${data.departments.slice(0, 4).map(departmentCard).join("")}</div>` : emptyState("Les départements seront bientôt ouverts", "La structure académique est configurée. Les fiches publiques seront affichées après validation éditoriale.")}
  </section>
  <section class="section-block feature-strip"><div><span class="eyebrow">EXPLORATION TRANSVERSALE</span><h2>L’Atlas des connaissances</h2><p>Visualiser les liens entre disciplines, domaines, ressources et parcours.</p></div><a class="button button-outline" href="#/atlas">Explorer l’Atlas <span>↗</span></a></section>`;
}

function departmentsView() {
  return `<section class="page-intro"><span class="eyebrow">ORGANISATION DES SAVOIRS</span><h1>Départements</h1><p>Les grands pôles scientifiques de BA Labs Academy.</p></section>
  ${data.departments.length ? `<div class="card-grid">${data.departments.map(departmentCard).join("")}</div>` : emptyState("Aucun département publié", "Les départements existent dans le référentiel interne, mais aucun n’est encore publié pour le public.")}`;
}

function catalogueView() {
  return `<section class="page-intro"><span class="eyebrow">RESSOURCES PÉDAGOGIQUES</span><h1>Catalogue</h1><p>Modules, cours, protocoles et ressources validés pour diffusion.</p></section>
  ${data.content.length ? `<div class="resource-list">${data.content.map((item) => `<article class="resource-row"><div><span class="eyebrow">${escapeHtml(item.resource_type || "RESSOURCE")} · ${escapeHtml((item.language_code || "fr").toUpperCase())}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></div><span class="resource-level">${escapeHtml(item.learning_level || "Tous niveaux")}</span></article>`).join("")}</div>` : emptyState("Le catalogue est en préparation", "Aucune ressource n’est actuellement publiée. Les contenus internes ne sont pas exposés avant validation.")}`;
}

function atlasView() {
  const count = data.nodes.length;
  return `<section class="page-intro"><span class="eyebrow">CARTOGRAPHIE DES CONNAISSANCES</span><h1>Atlas</h1><p>Un espace de navigation visuelle dans les relations entre les connaissances.</p></section>
  <div class="atlas-panel"><div class="atlas-toolbar"><span><b>${count}</b> nœud${count > 1 ? "s" : ""} public(s)</span><span>${data.edges.length} relation(s)</span></div>
  ${count ? renderAtlas() : emptyState("L’Atlas public est encore vide", "La structure du moteur est prête à recevoir les nœuds et relations validés. Les éléments internes restent masqués.")}</div>`;
}

function renderAtlas() {
  const width = 900, height = 480;
  const positioned = data.nodes.map((node, index) => ({
    ...node,
    x: Number.isFinite(node.position_x) ? 50 + node.position_x * 800 : 100 + (index % 5) * 170,
    y: Number.isFinite(node.position_y) ? 50 + node.position_y * 380 : 90 + Math.floor(index / 5) * 100
  }));
  const byId = new Map(positioned.map((node) => [node.id, node]));
  const lines = data.edges.map((edge) => {
    const a = byId.get(edge.source_node_id), b = byId.get(edge.target_node_id);
    return a && b ? `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />` : "";
  }).join("");
  const dots = positioned.map((node) => `<g><circle cx="${node.x}" cy="${node.y}" r="8"></circle><text x="${node.x + 14}" y="${node.y + 4}">${escapeHtml(node.title_override || node.entity_key)}</text></g>`).join("");
  return `<svg class="atlas-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Graphe des connaissances">${lines}${dots}</svg>`;
}

function aboutView() {
  return `<section class="page-intro"><span class="eyebrow">À PROPOS</span><h1>Une académie scientifique appliquée.</h1><p>BA Labs Academy organise des ressources pédagogiques, des parcours et des connaissances autour des sciences expérimentales et de leurs applications.</p></section><div class="about-grid"><article><span class="eyebrow">01 / STRUCTURE</span><h3>Des départements</h3><p>Une organisation disciplinaire reliée à des domaines de spécialité.</p></article><article><span class="eyebrow">02 / CONTENUS</span><h3>Des ressources validées</h3><p>Un catalogue publié progressivement selon un circuit éditorial contrôlé.</p></article><article><span class="eyebrow">03 / ATLAS</span><h3>Une connaissance connectée</h3><p>Une représentation navigable des relations entre les ressources et les disciplines.</p></article></div>`;
}

function departmentDetail(slug) {
  const department = data.departments.find((item) => item.slug === slug);
  if (!department) return `<section class="page-intro"><span class="eyebrow">DÉPARTEMENT</span><h1>Fiche indisponible</h1><p>Ce département n’est pas publié ou n’existe pas dans le catalogue public.</p><a class="text-link" href="#/departements">Retour aux départements →</a></section>`;
  const domains = data.domains.filter((item) => item.department_code === department.code);
  return `<section class="page-intro"><span class="eyebrow">${escapeHtml(department.code)} · DÉPARTEMENT</span><h1>${escapeHtml(department.title)}</h1><p>${escapeHtml(department.summary)}</p></section><div class="domain-list">${domains.length ? domains.map((domain) => `<article class="domain-row"><span>${escapeHtml(domain.code)}</span><div><h3>${escapeHtml(domain.title)}</h3><p>${escapeHtml(domain.summary)}</p></div></article>`).join("") : emptyState("Domaines en préparation", "Les domaines de ce département ne sont pas encore publiés.")}</div>`;
}

function render() {
  const path = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const [route, slug] = path.split("/");
  document.querySelectorAll("[data-route]").forEach((link) => link.classList.toggle("active",
    (route || "home") === link.dataset.route || (!route && link.dataset.route === "home")));
  if (loadError) {
    root.innerHTML = `<section class="page-intro"><span class="eyebrow">ÉTAT DES DONNÉES</span><h1>Connexion indisponible</h1><p>${escapeHtml(loadError)}</p><p>La plateforme reste accessible ; les données seront rechargées dès que l’API publique répondra.</p><button class="button button-outline" id="retry">Réessayer</button></section>`;
    document.querySelector("#retry")?.addEventListener("click", refresh);
    return;
  }
  if (!data.departments.length && !data.content.length && !data.nodes.length) {
    connection.textContent = "API connectée · aucun contenu public";
  } else connection.textContent = "Données publiques synchronisées";
  const views = {
    "": homeView,
    "departements": () => slug ? departmentDetail(slug) : departmentsView,
    "catalogue": catalogueView,
    "atlas": atlasView,
    "apropos": aboutView
  };
  const selected = views[route || ""] || homeView;
  root.innerHTML = typeof selected === "function" && route === "departements" && slug
    ? selected() : selected();
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
