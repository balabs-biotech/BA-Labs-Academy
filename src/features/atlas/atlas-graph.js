import { createAtlasDepartmentLayout, getAtlasRootPosition, getAtlasChildPosition } from "./atlas-geometry.js";

const hash = (value) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
};

// Radial Academy graph: disciplinary hierarchy, declared pathways and verified knowledge relations.
const DEPARTMENT_LABELS = {
  MIC: "Microbiologie",
  MYC: "MYCOLOGIE",
  BIO: "Sciences végétales",
  AGR: "Sols & écosystèmes",
  BPR: "Bioprocédés",
  BMT: "Biomatériaux",
  PHY: "Sciences physiques & chimiques",
  INF: "Sciences numériques",
  GEN: "Ingénierie & instrumentation"
};

const PATHWAY_LABELS = {
  "MYC-PAR-001": "Prod. mycologique",
  "MYC-PAR-002": "Tech. fongique",
  "BPR-PAR-001": "Ing. bioprocédés",
  "MIC-PAR-001": "MIC sols/plantes",
  "BIO-PAR-001": "Biostimulants",
  "GEN-PAR-001": "Labo biologique",
  "GEN-PAR-002": "Auto. culture",
  "BPR-PAR-002": "Biomasses",
  "BMT-PAR-001": "Mycomatériaux",
  "INF-PAR-001": "Données & IA"
};

function makeNode(item, parent, rootId, level, x, y, angle, entityType) {
  return {
    id: item.id,
    node_key: item.code || item.id,
    entity_type: entityType,
    entity_key: item.code || item.id,
    title: item.title,
    title_override: item.title,
    summary: item.summary || item.description || "",
    x, y,
    r: level === 0 ? 13 : Math.max(2.1, 8 - level * 1.25),
    level,
    parent: parent?.id || null,
    rootId,
    angle,
    shortTitle: item.shortTitle || (level === 0 ? item.code : item.title),
    data: item
  };
}

export const KNOWLEDGE_RELATION_TYPES = Object.freeze({
  PREREQUISITE: { label: "Prérequis", directed: true },
  COMPLEMENTARY: { label: "Complémentarité", directed: false },
  METHOD_TRANSFER: { label: "Transfert de méthode", directed: true },
  TECHNICAL_DEPENDENCY: { label: "Dépendance technique", directed: true },
  APPLIED_IN: { label: "Application pratique", directed: true },
  INTERDISCIPLINARY: { label: "Lien interdisciplinaire", directed: false }
});

export function buildAcademyGraph(departments, domains, pathways, knowledgeRelations = []) {
  const nodes = [];
  const edges = [];
  const byId = new Map();
  const departmentNodes = new Map();
  const domainNodes = new Map();
  const sectionNodes = new Map();
  const rootItems = [
    ...departments.map((department) => ({ ...department, kind: "department" })),
    ...pathways.map((pathway) => ({ ...pathway, kind: "pathway" }))
  ];
  const satelliteDepartments = departments.filter((department) => department.code !== "MYC");
  const departmentLayout = createAtlasDepartmentLayout(satelliteDepartments);

  const addNode = (node) => {
    nodes.push(node);
    byId.set(node.id, node);
    return node;
  };

  const addEdge = (source, target, options = {}) => {
    const edge = {
      id: options.id || source.id + "->" + target.id,
      a: source,
      b: target,
      depth: Math.max(source.level, target.level),
      seed: hash(source.id + "|" + target.id),
      relation_type: options.relationType || "BELONGS_TO",
      cross: Boolean(options.cross),
      verified: Boolean(options.verified),
      basis: options.basis || "hierarchy",
      label: options.label || ""
    };
    edges.push(edge);
    return edge;
  };

  const walk = (items, parent, rootId, depth, branchAngle) => {
    if (!items?.length) return;
    const isMycologyCore = parent.entity_type === "DEPARTMENT" && parent.entity_key === "MYC";
    const isDepartmentRoot = parent.entity_type === "DEPARTMENT";
    // Mycology occupies the central hub; outer departments receive weighted, non-overlapping sectors.
    const branchSpread = isDepartmentRoot && parent.entity_key !== "MYC"
      ? departmentLayout.spreads[parent.entity_key]
      : undefined;
    items.forEach((item, index) => {
      const { x, y, angle } = getAtlasChildPosition({
        parent, index, count: items.length, depth, branchAngle,
        isMycologyCore, isDepartmentRoot, branchSpread
      });
      const entityType = item.kind === "section" ? "SECTION" : item.kind === "domain" ? "DOMAIN" : "MODULE";
      const node = addNode(makeNode(item, parent, rootId, depth, x, y, angle, entityType));
      addEdge(parent, node, {
        relationType: item.kind === "domain" ? "BELONGS_TO" : "CONTAINS",
        cross: false,
        verified: true,
        basis: "academy-hierarchy",
        label: item.kind === "domain" ? "Domaine du département" : item.kind === "section" ? "Section du département" : "Module de section"
      });
      if (item.kind === "section") sectionNodes.set(item.code, node);
      if (item.kind === "domain") domainNodes.set(item.code, node);
      if (item.children?.length) {
        walk(item.children, node, rootId, depth + 1, angle);
      }
    });
  };

  const pathwayItems = rootItems.filter((item) => item.kind === "pathway");
  rootItems.forEach((item) => {
    const { x, y, angle } = getAtlasRootPosition({
      kind: item.kind,
      code: item.code,
      departmentCodes: satelliteDepartments.map((department) => department.code),
      pathwayCodes: pathwayItems.map((pathway) => pathway.code),
      departmentLayout
    });
    const rootId = item.kind === "pathway" ? "pathways" : item.code.toLowerCase();
    const shortTitle = item.kind === "pathway"
      ? (PATHWAY_LABELS[item.code] || item.title)
      : item.kind === "domain"
        ? item.title
        : (DEPARTMENT_LABELS[item.code] || item.title);
    const entityType = item.kind === "pathway"
      ? "PATHWAY"
      : item.kind === "domain"
        ? "DOMAIN"
        : "DEPARTMENT";
    const root = addNode(makeNode(
      { ...item, id: item.kind + ":" + item.code, shortTitle },
      null,
      rootId,
      0,
      x,
      y,
      angle,
      entityType
    ));
    if (item.kind === "department" && item.code === "MYC") {
      root.isAcademyCore = true;
      root.r = 42;
      root.data.isAcademyCore = true;
    }

    if (item.kind === "department") {
      root.data.route = "#/departements/" + item.code.toLowerCase();
      departmentNodes.set(item.code, root);
    } else if (item.kind === "domain") {
      root.data.route = "#/domaines/" + item.code.toLowerCase();
      domainNodes.set(item.code, root);
    } else {
      root.data.route = "#/parcours/" + item.slug;
      root.data.kind = "pathway";
    }

    if (item.kind === "department" || item.kind === "domain") {
      const domainChildren = domains.filter((domain) => domain.department_code === item.code).map((domain) => ({
        ...domain,
        id: "domain:" + domain.code,
        kind: "domain",
        route: "#/domaines/" + domain.slug,
        children: []
      }));
      const sectionChildren = (item.sections || []).map((section) => ({
        ...section,
        route: "#/sections/" + section.code.toLowerCase(),
        id: "section:" + section.code,
        kind: "section",
        children: section.modules.map((module, moduleIndex) => ({
          id: "module:" + section.code + ":" + String(moduleIndex + 1).padStart(2, "0"),
          code: section.code + "-" + String(moduleIndex + 1).padStart(2, "0"),
          title: module,
          summary: "Module cartographié dans " + section.title + ". Fiche pédagogique à développer.",
          kind: "module",
          sectionCode: section.code,
          sectionTitle: section.title,
          departmentCode: item.code,
          departmentTitle: item.title,
          moduleIndex: moduleIndex + 1,
          route: "#/modules/" + section.code.toLowerCase() + "/" + String(moduleIndex + 1).padStart(2, "0")
        }))
      }));
      walk([...domainChildren, ...sectionChildren], root, rootId, 1, item.code === "MYC" ? 0 : angle);
    }
  });

  // Pathways connect canonical departments and transversal domains without duplicating modules.
  pathways.forEach((pathway) => {
    const source = byId.get("pathway:" + pathway.code);
    if (!source) return;
    for (const departmentCode of pathway.departmentCodes || [pathway.departmentCode]) {
      const target = departmentNodes.get(departmentCode);
      if (target) addEdge(source, target, {
        id: "pathway-department:" + pathway.code + ":" + departmentCode,
        relationType: "APPLIES_TO",
        cross: true,
        verified: true,
        basis: "academy-pathway",
        label: "Département mobilisé"
      });
    }
    for (const domainCode of pathway.domainCodes || []) {
      const target = domainNodes.get(domainCode);
      if (target) addEdge(source, target, {
        id: "pathway-domain:" + pathway.code + ":" + domainCode,
        relationType: "USES",
        cross: true,
        verified: true,
        basis: "academy-domain",
        label: "Domaine transversal mobilisé"
      });
    }
    for (const sectionCode of pathway.sectionCodes || []) {
      const target = sectionNodes.get(sectionCode);
      if (target) addEdge(source, target, {
        id: "pathway-section:" + pathway.code + ":" + sectionCode,
        relationType: "USES_SECTION",
        cross: true,
        verified: true,
        basis: "academy-pathway",
        label: "Section mobilisée"
      });
    }
    // Ordered section links expose the transfer sequence defined by each pathway.
    const orderedSections = (pathway.sectionCodes || []).map((code) => sectionNodes.get(code)).filter(Boolean);
    for (let index = 0; index < orderedSections.length - 1; index += 1) {
      const from = orderedSections[index];
      const to = orderedSections[index + 1];
      if (from.id === to.id) continue;
      addEdge(from, to, {
        id: "pathway-flow:" + pathway.code + ":" + from.entity_key + ":" + to.entity_key,
        relationType: "TRANSFERS_TO",
        cross: true,
        verified: true,
        basis: "academy-pathway-flow",
        label: "Transfert pédagogique · " + pathway.code
      });
    }
  });

  // Shared pathways create visible bridges between the departments they explicitly mobilize.
  // This is a pathway-membership relation, not an inferred scientific relation.
  const sharedDepartments = new Map();
  for (const pathway of pathways) {
    const participants = [...new Set(pathway.departmentCodes || [pathway.departmentCode])]
      .map((code) => departmentNodes.get(code)).filter(Boolean);
    for (let left = 0; left < participants.length; left += 1) {
      for (let right = left + 1; right < participants.length; right += 1) {
        const a = participants[left];
        const b = participants[right];
        const key = [a.id, b.id].sort().join("|");
        if (!sharedDepartments.has(key)) sharedDepartments.set(key, { a, b, pathwayCodes: [] });
        sharedDepartments.get(key).pathwayCodes.push(pathway.code);
      }
    }
  }
  for (const { a, b, pathwayCodes } of sharedDepartments.values()) {
    const edge = addEdge(a, b, {
      id: "shared-pathway:" + a.entity_key + ":" + b.entity_key,
      relationType: "SHARED_PATHWAY",
      cross: true,
      verified: true,
      basis: "academy-pathway-network",
      label: "Départements mobilisés par un même parcours"
    });
    edge.pathwayCodes = pathwayCodes;
  }

  // Only explicit, evidence-backed editorial relations become visible edges.
  for (const relation of knowledgeRelations) {
    const type = KNOWLEDGE_RELATION_TYPES[relation.type];
    const source = byId.get(relation.source);
    const target = byId.get(relation.target);
    if (!type || !source || !target || source.entity_type !== "MODULE" || target.entity_type !== "MODULE") continue;
    if (source.id === target.id || relation.status !== "verified" || !String(relation.evidence || "").trim()) continue;
    const edge = addEdge(source, target, {
      id: "knowledge:" + source.id + ":" + relation.type + ":" + target.id,
      relationType: relation.type, cross: true, verified: true,
      basis: "academy-knowledge-relation", label: type.label
    });
    edge.directed = type.directed;
    edge.evidence = String(relation.evidence).trim();
  }

  return {
    nodes,
    edges,
    stats: {
      departments: departments.length,
      domains: domainNodes.size,
      pathways: pathways.length,
      sections: sectionNodes.size,
      modules: nodes.filter((node) => node.entity_type === "MODULE").length
    },
    byId,
    departmentNodes,
    domainNodes,
    sectionNodes
  };
}
