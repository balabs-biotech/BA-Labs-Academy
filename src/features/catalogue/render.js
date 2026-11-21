import { catalogueMap, catalogueTotals } from "../../catalogue-map.js";
import { catalogueDomains } from "../../catalogue-domains.js";

function renderGroup(group, escapeHtml, kind) {
  const label = kind === "axis" ? "DOMAINE TRANSVERSAL" : "DÉPARTEMENT";
  const className = kind === "axis" ? "knowledge-domain" : "knowledge-department";
  return `<article class="knowledge-map-card ${className}">
    <div class="knowledge-map-card-head"><span class="eyebrow">${label} · ${escapeHtml(group.code)}</span><span>${group.sections.length} section(s)</span></div>
    <h3>${escapeHtml(group.title)}</h3>
    <p>${escapeHtml(group.description)}</p>
    <div class="knowledge-section-list">
      ${group.sections.map((section) => `<details class="knowledge-section">
        <summary><span><b>${escapeHtml(section.code)}</b> · ${escapeHtml(section.title)}</span><small>${section.modules.length} modules</small></summary>
        <p>${escapeHtml(section.description)}</p>
        <ul>${section.modules.map((module) => `<li class="knowledge-module">${escapeHtml(module)}</li>`).join("")}</ul>
      </details>`).join("") || '<p class="taxonomy-intro">Sections à cartographier.</p>'}
    </div>
  </article>`;
}

export function renderKnowledgeMap(escapeHtml, publishedCount = 0) {
  const groups = [...catalogueMap, ...catalogueDomains];
  return `<section class="page-intro"><span class="eyebrow">RÉFÉRENTIEL · CARTOGRAPHIE DE TRAVAIL</span><h1>Catalogue des connaissances</h1><p>Une carte de travail qui distingue les sept départements canoniques, les domaines transversaux, les sections thématiques et les modules réutilisables.</p></section>
    <div class="knowledge-catalogue-stats">
      <div><strong>${catalogueTotals.departments}</strong><span>départements</span></div>
      <div><strong>${catalogueTotals.domaines}</strong><span>domaines transversaux</span></div>
      <div><strong>${catalogueTotals.sections}</strong><span>sections</span></div>
      <div><strong>${catalogueTotals.modules}</strong><span>modules</span></div>
      <div><strong>${publishedCount}</strong><span>ressources publiées</span></div>
    </div>
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">STRUCTURE DISCIPLINAIRE</span><h2>Départements</h2></div></div>
      <div class="knowledge-map-grid">${catalogueMap.map((item) => renderGroup(item, escapeHtml, "department")).join("")}</div>
    </section>
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">CLASSIFICATION TRANSVERSALE</span><h2>Axes transversaux</h2></div></div>
      <div class="knowledge-map-grid">${catalogueDomains.map((item) => renderGroup(item, escapeHtml, "axis")).join("")}</div>
      <p class="taxonomy-intro">Les domaines sont conservés séparément des départements ; leurs rattachements disciplinaires restent à valider.</p>
    </section>`;
}
