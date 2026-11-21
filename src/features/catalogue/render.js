import { catalogueMap, catalogueTotals } from "../../catalogue-map.js";

function renderDepartment(department, escapeHtml) {
  return `<article class="knowledge-map-card knowledge-department">
    <div class="knowledge-map-card-head"><span class="eyebrow">DÉPARTEMENT · ${escapeHtml(department.code)}</span><span>${department.sections.length} section(s)</span></div>
    <h3>${escapeHtml(department.title)}</h3>
    <p>${escapeHtml(department.description)}</p>
    <div class="knowledge-section-list">
      ${department.sections.map((section) => `<details class="knowledge-section">
        <summary><span><b>${escapeHtml(section.code)}</b> · ${escapeHtml(section.title)}</span><small>${section.modules.length} modules</small></summary>
        <p>${escapeHtml(section.description)}</p>
        <ul>${section.modules.map((module) => `<li class="knowledge-module">${escapeHtml(module)}</li>`).join("")}</ul>
      </details>`).join("")}
    </div>
  </article>`;
}

export function renderKnowledgeMap(escapeHtml, publishedCount = 0) {
  return `<section class="page-intro"><span class="eyebrow">RÉFÉRENTIEL · CARTOGRAPHIE DE TRAVAIL</span><h1>Catalogue des connaissances</h1><p>Neuf pôles disciplinaires, organisés en sections thématiques et modules réutilisables. MYCOLOGIE joue un rôle central et transversal.</p></section>
    <div class="knowledge-catalogue-stats">
      <div><strong>${catalogueTotals.departments}</strong><span>départements</span></div>
      <div><strong>${catalogueTotals.sections}</strong><span>sections</span></div>
      <div><strong>${catalogueTotals.modules}</strong><span>modules</span></div>
      <div><strong>${publishedCount}</strong><span>ressources publiées</span></div>
    </div>
    <section class="section-block"><div class="section-heading"><div><span class="eyebrow">STRUCTURE DISCIPLINAIRE</span><h2>Départements</h2></div></div>
      <div class="knowledge-map-grid">${catalogueMap.map((item) => renderDepartment(item, escapeHtml)).join("")}</div>
    </section>`;
}
