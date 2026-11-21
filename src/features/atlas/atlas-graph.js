const hash = (value) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Organic field: seven departments, three transversal domains, ten pathways.
const ROOT_ANCHORS = [
  [-690, -310], [-360, -520], [80, -610], [520, -420], [790, -60],
  [620, 390], [210, 620],
  [-760, 230], [-310, 570], [140, 310],
  [-510, -20], [-90, -260], [310, -90],
  [-430, -610], [-80, -740], [320, -690], [710, -470],
  [900, 40], [520, 760], [-520, 790]
];

const DEPARTMENT_LABELS = {
  MIC: "Microbiologie",
  MYC: "Mycologie appliquée",
  BIO: "Biotechnologies végétales",
  AGR: "Agronomie",
  ZOO: "Zootechnie",
  INF: "Informatique et données",
  GEN: "Génie biologique et instrumentation"
};

const DOMAIN_LABELS = {
  BPR: "Bioprocédés",
  BMT: "Biomatériaux",
  PHY: "Sciences physiques & chimiques"
};

const PATHWAY_LABELS = {
  "MYC-PAR-001": "Prod. mycologique",
  "MYC-PAR-002": "Tech. fongique",
  "MYC-PAR-003": "Ing. bioprocédés",
  "MIC-PAR-001": "MIC sols/plantes",
  "BIO-PAR-001": "Biostimulants",
  "GEN-PAR-001": "Labo biologique",
  "GEN-PAR-002": "Auto. culture",
  "AGR-PAR-001": "Biomasses",
  "MYC-PAR-004": "Mycomatériaux",
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

export function buildAcademyGraph(departments, domains, pathways) {
  const nodes = [];
  const edges = [];
  const byId = new Map();
  const departmentNodes = new Map();
  const domainNodes = new Map();
  const sectionNodes = new Map();
  const rootItems = [
    ...departments.map((department) => ({ ...department, kind: "department" })),
    ...domains.map((axis) => ({ ...axis, kind: "domain" })),
    ...pathways.map((pathway) => ({ ...pathway, kind: "pathway" }))
  ];

  const addNode = (node) => {
    nodes.push(node);
    byId.set(node.id, node);
    return node;
  };

  const addEdge = (source, target, options = {}) => {
    edges.push({
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
    });
  };

  const walk = (items, parent, rootId, depth, branchAngle) => {
    if (!items?.length) return;
    const spread = Math.min(2.5, 1.08 + Math.log2(items.length + 1) * 0.4);
    const distance = depth === 1
      ? 245 + Math.sqrt(items.length) * 15
      : depth === 2
        ? 180 + Math.sqrt(items.length) * 18
        : Math.max(34, 64 - depth * 3);
    items.forEach((item, index) => {
      const seed = hash(item.id);
      const fraction = items.length === 1 ? 0 : index / (items.length - 1) - 0.5;
      const jitter = ((seed % 1000) / 1000 - 0.5) * 0.3;
      const fieldX = Math.sin(parent.x * 0.0021 + parent.y * 0.0013 + depth * 0.73);
      const fieldY = Math.cos(parent.y * 0.0018 - parent.x * 0.0011 - depth * 0.51);
      const curl = Math.atan2(fieldY, fieldX) * 0.22;
      const angle = branchAngle + curl + fraction * spread + jitter;
      const bend = distance * (0.72 + ((seed >>> 8) % 56) / 100);
      const lateral = ((seed >>> 17) & 255) / 255 - 0.5;
      const sway = depth > 1 ? lateral * Math.min(22, distance * 0.16) : 0;
      const x = parent.x + Math.cos(angle) * bend - Math.sin(angle) * sway;
      const y = parent.y + Math.sin(angle) * bend + Math.cos(angle) * sway;
      const entityType = item.kind === "section" ? "SECTION" : "MODULE";
      const node = addNode(makeNode(item, parent, rootId, depth, x, y, angle, entityType));
      addEdge(parent, node);
      if (item.kind === "section") sectionNodes.set(item.code, node);
      if (item.children?.length) {
        const nextDrift = Math.sin((node.x + node.y) * 0.0017 + seed * 0.000001) * 0.16;
        walk(item.children, node, rootId, depth + 1, angle + fraction * 0.22 + jitter * 0.45 + nextDrift);
      }
    });
  };

  rootItems.forEach((item, index) => {
    const anchor = ROOT_ANCHORS[index];
    const seed = hash(item.code || item.id);
    const x = anchor[0] + ((seed & 255) / 255 - 0.5) * 34;
    const y = anchor[1] + (((seed >>> 8) & 255) / 255 - 0.5) * 30;
    const angle = Math.atan2(y, x) + (((seed >>> 16) & 255) / 255 - 0.5) * 0.24;
    const rootId = item.kind === "pathway" ? "pathways" : item.code.toLowerCase();
    const shortTitle = item.kind === "pathway"
      ? (PATHWAY_LABELS[item.code] || item.title)
      : item.kind === "domain"
        ? (DOMAIN_LABELS[item.code] || item.title)
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

    if (item.kind === "department") {
      root.data.route = "#/departements/" + item.code.toLowerCase();
      departmentNodes.set(item.code, root);
    } else if (item.kind === "domain") {
      root.data.route = "#/domains/" + item.code.toLowerCase();
      domainNodes.set(item.code, root);
    } else {
      root.data.route = "#/parcours/" + item.slug;
      root.data.kind = "pathway";
    }

    if (item.kind === "department" || item.kind === "domain") {
      const children = (item.sections || []).map((section) => ({
        ...section,
        route: "#/sections/" + section.code.toLowerCase(),
        id: "section:" + section.code,
        kind: "section",
        children: section.modules.map((module, moduleIndex) => ({
          id: "module:" + section.code + ":" + String(moduleIndex + 1).padStart(2, "0"),
          code: section.code + "-" + String(moduleIndex + 1).padStart(2, "0"),
          title: module,
          summary: "Module cartographié dans " + section.title + ". Fiche pédagogique à développer.",
          kind: "module"
        }))
      }));
      walk(children, root, rootId, 1, angle);
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
        id: "pathway-axis:" + pathway.code + ":" + domainCode,
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
  });

  // Local anastomoses connect nearby branches without imposing a grid.
  const groups = new Map();
  nodes.filter((node) => node.level > 0).forEach((node) => {
    const key = node.rootId + ":" + node.level;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  });
  let localAnastomoses = 0;
  groups.forEach((group) => {
    if (group.length < 4) return;
    const candidates = [];
    const nearestDistances = [];
    group.forEach((a, index) => {
      const nearby = group
        .filter((b, otherIndex) => otherIndex !== index)
        .map((b) => ({ a, b, distance: Math.hypot(a.x - b.x, a.y - b.y) }))
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 3);
      if (nearby.length) nearestDistances.push(nearby[0].distance);
      nearby.forEach((pair) => candidates.push(pair));
    });
    nearestDistances.sort((a, b) => a - b);
    const median = nearestDistances[Math.floor(nearestDistances.length / 2)] || 60;
    const maxDistance = clamp(median * 2.8, 48, 175);
    candidates.sort((a, b) => a.distance - b.distance);
    const degree = new Map();
    const existing = new Set(edges.map((edge) => [edge.a.id, edge.b.id].sort().join("|")));
    for (const pair of candidates) {
      if (pair.distance > maxDistance) break;
      if ((degree.get(pair.a.id) || 0) >= 1 || (degree.get(pair.b.id) || 0) >= 1) continue;
      const key = [pair.a.id, pair.b.id].sort().join("|");
      if (existing.has(key)) continue;
      addEdge(pair.a, pair.b, {
        id: "anastomosis:" + key,
        relationType: "RELATED_TO",
        cross: true,
        verified: false,
        basis: "local-anastomosis"
      });
      existing.add(key);
      degree.set(pair.a.id, 1);
      degree.set(pair.b.id, 1);
      localAnastomoses += 1;
    }
  });

  return {
    nodes,
    edges,
    stats: {
      departments: departments.length,
      domains: domains.length,
      pathways: pathways.length,
      sections: sectionNodes.size,
      modules: nodes.filter((node) => node.entity_type === "MODULE").length,
      anastomoses: localAnastomoses
    },
    byId,
    departmentNodes,
    domainNodes,
    sectionNodes
  };
}
