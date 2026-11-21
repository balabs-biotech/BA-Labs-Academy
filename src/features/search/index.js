const TYPE_LABELS = {
  DEPARTMENT: "Département",
  DOMAIN: "Domaine",
  RESOURCE: "Ressource",
  PATHWAY: "Parcours",
  COMPETENCY: "Compétence"
};

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim();
}

function tokenize(value) {
  return normalize(value).split(/[^\p{L}\p{N}]+/u).filter((part) => part.length > 1);
}

function makeEntry(type, item, href, extra = []) {
  return {
    type,
    title: item.title,
    summary: item.summary || item.description || "",
    href,
    terms: [item.title, item.summary, item.description, item.code, item.slug, ...extra].filter(Boolean).join(" ")
  };
}

export function buildAcademySearchIndex(data) {
  const entries = [];
  for (const item of data.departments || []) {
    entries.push(makeEntry("DEPARTMENT", item, `#/departements/${encodeURIComponent(item.slug)}`, [item.code]));
  }
  for (const item of data.domains || []) {
    const department = (data.departments || []).find((entry) => entry.code === item.department_code);
    entries.push(makeEntry("DOMAIN", item, `#/domaines/${encodeURIComponent(item.slug)}`, [item.code, department?.title]));
  }
  for (const item of data.content || []) {
    const domainLabels = (data.domainLinks || [])
      .filter((link) => link.content_id === item.id)
      .map((link) => (data.domains || []).find((entry) => entry.code === link.domain_code)?.title);
    const departmentLabels = (data.departmentLinks || [])
      .filter((link) => link.content_id === item.id)
      .map((link) => (data.departments || []).find((entry) => entry.code === link.department_code)?.title);
    entries.push(makeEntry("RESOURCE", item, `#/ressource/${encodeURIComponent(item.slug)}`, [
      item.resource_type, item.learning_level, item.language_code, ...domainLabels, ...departmentLabels
    ]));
  }
  for (const item of data.learningPaths || []) {
    entries.push(makeEntry("PATHWAY", item, `#/parcours/${encodeURIComponent(item.slug)}`, [
      item.code, item.target_audience, item.difficulty_level
    ]));
  }
  for (const item of data.competencies || []) {
    const linkedResources = (data.contentCompetencies || [])
      .filter((link) => link.competency_id === item.id)
      .map((link) => (data.content || []).find((entry) => entry.id === link.content_id)?.title);
    entries.push(makeEntry("COMPETENCY", item, "#/catalogue", [
      item.code, item.competency_level, ...linkedResources
    ]));
  }
  return entries;
}

export function searchAcademy(query, dataOrIndex, limit = 30) {
  const terms = tokenize(query);
  if (!terms.length) return [];
  const index = Array.isArray(dataOrIndex) ? dataOrIndex : buildAcademySearchIndex(dataOrIndex);
  return index.map((entry) => {
    const title = normalize(entry.title);
    const summary = normalize(entry.summary);
    const all = normalize(entry.terms);
    let score = 0;
    for (const term of terms) {
      if (title === term) score += 12;
      else if (title.startsWith(term)) score += 7;
      else if (title.includes(term)) score += 5;
      else if (all.includes(term)) score += 2;
      else return null;
      if (summary.includes(term)) score += 1;
    }
    return { ...entry, score };
  }).filter(Boolean)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "fr"))
    .slice(0, Math.max(1, limit));
}

export function searchTypeLabel(type) {
  return TYPE_LABELS[type] || "Résultat";
}
