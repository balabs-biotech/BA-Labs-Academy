import { catalogueMap, catalogueTotals } from "../../catalogue-map.js";

export function renderKnowledgeMap(escapeHtml, publishedResources) {
  const departments = catalogueMap.map((department) => {
    const sections = department.sections.map((section) => {
      const modules = section.modules.map((module, index) =>
        '<article class="knowledge-module">' +
          '<span>' + escapeHtml(section.code) + ' · ' + String(index + 1).padStart(2, "0") + '</span>' +
          '<h4>' + escapeHtml(module) + '</h4>' +
          '<p>Notions clés, méthodes et applications liés à ' + escapeHtml(section.title.toLocaleLowerCase("fr")) + '.</p>' +
          '<small>Fiche à développer · non publiée</small>' +
        '</article>'
      ).join("");
      return '<details class="knowledge-section">' +
        '<summary><span><small>' + escapeHtml(section.code) + '</small><b>' + escapeHtml(section.title) + '</b><em>' + section.modules.length + ' modules</em></span><i>＋</i></summary>' +
        '<p>' + escapeHtml(section.description) + '</p>' +
        '<div class="knowledge-module-grid">' + modules + '</div>' +
      '</details>';
    }).join("");
    const searchText = [department.code, department.title, department.description].concat(
      department.sections.flatMap((section) => [section.title, section.description].concat(section.modules))
    ).join(" ").toLocaleLowerCase("fr");
    return '<article class="knowledge-department" data-knowledge-search="' + escapeHtml(searchText) + '">' +
      '<div class="knowledge-department-head"><span>' + escapeHtml(department.code) + '</span><div><h2>' + escapeHtml(department.title) + '</h2><p>' + escapeHtml(department.description) + '</p></div><b>' + department.sections.length + ' sections</b></div>' +
      '<div class="knowledge-sections">' + sections + '</div>' +
    '</article>';
  }).join("");
  return '<section class="page-intro"><span class="eyebrow">CARTOGRAPHIE DES CONNAISSANCES · VERSION DE TRAVAIL</span><h1>Catalogue</h1><p>La carte générale des savoirs de BA Labs Academy. Les titres et descriptions indiquent les contenus prévus ; ils ne signifient pas que les cours sont déjà disponibles.</p></section>' +
    '<div class="knowledge-catalogue-stats"><div><strong>' + catalogueTotals.departments + '</strong><span>départements</span></div><div><strong>' + catalogueTotals.sections + '</strong><span>sections</span></div><div><strong>' + catalogueTotals.modules + '</strong><span>modules cartographiés</span></div><div><strong>' + publishedResources + '</strong><span>ressources publiées</span></div></div>' +
    '<div class="catalogue-tools"><label for="resource-search">Explorer la cartographie et les ressources publiées</label><input id="resource-search" type="search" placeholder="Département, section, module, protocole…" autocomplete="off"><span id="map-count">Carte complète · ' + catalogueTotals.modules + ' modules prévus</span></div>' +
    '<section class="knowledge-map" id="knowledge-map"><div class="section-heading"><div><span class="eyebrow">STRUCTURE GÉNÉRALE</span><h2>Disciplines et modules</h2></div><span class="resource-level">En construction</span></div>' + departments + '</section>';
}
