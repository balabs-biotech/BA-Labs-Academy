const hash = (value) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const ROOT_ANCHORS = [
  [-560, -270], [-280, -330], [25, -285], [340, -320], [635, -205],
  [590, 155], [285, 310], [-65, 330], [-430, 215],
  [-565, 65], [-285, 15], [30, 60], [340, 15], [640, 85],
  [560, 395], [270, 520], [-80, 520], [-430, 420]
];

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

export function buildAcademyGraph(departments, pathways) {
  const nodes = [];
  const edges = [];
  const byId = new Map();
  const departmentNodes = new Map();
  const domainNodes = new Map();
  const rootItems = [
    ...departments.map((department) => ({ ...department, kind: "department" })),
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
      const entityType = item.kind === "domain" ? "DOMAIN" : "MODULE";
      const node = addNode(makeNode(item, parent, rootId, depth, x, y, angle, entityType));
      addEdge(parent, node);
      if (item.kind === "domain") domainNodes.set(item.code, node);
      if (item.children?.length) {
        const nextDrift = Math.sin((node.x + node.y) * 0.0017 + seed * 0.000001) * 0.16;
        walk(item.children, node, rootId, depth + 1, angle + fraction * 0.22 + jitter * 0.45 + nextDrift);
      }
    });
  };

  rootItems.forEach((item, index) => {
    const anchor = ROOT_ANCHORS[index % ROOT_ANCHORS.length];
    const seed = hash(item.code || item.id);
    const x = anchor[0] + ((seed & 255) / 255 - 0.5) * 34;
    const y = anchor[1] + (((seed >>> 8) & 255) / 255 - 0.5) * 30;
    const angle = Math.atan2(y, x) + (((seed >>> 16) & 255) / 255 - 0.5) * 0.24;
    const rootId = item.kind === "pathway" ? "pathways" : item.code.toLowerCase();
    const root = addNode(makeNode(
      { ...item, id: item.kind + ":" + item.code, shortTitle: item.kind === "pathway" ? "P·" + item.departmentCode : item.code },
      null,
      rootId,
      0,
      x,
      y,
      angle,
      item.kind === "pathway" ? "PATHWAY" : "DEPARTMENT"
    ));
    if (item.kind === "department") {
      departmentNodes.set(item.code, root);
      const children = item.sections.map((section) => ({
        ...section,
        id: "domain:" + section.code,
        kind: "domain",
        children: section.modules.map((module, moduleIndex) => ({
          id: "module:" + section.code + ":" + String(moduleIndex + 1).padStart(2, "0"),
          code: section.code + "-" + String(moduleIndex + 1).padStart(2, "0"),
          title: module,
          summary: "Module cartographié dans " + section.title + ". Fiche pédagogique à développer.",
          kind: "module"
        }))
      }));
      walk(children, root, rootId, 1, angle);
    } else {
      root.data.route = "#/parcours/" + item.slug;
      root.data.kind = "pathway";
    }
  });

  // A pathway is a practical bridge between disciplines, not a nested programme.
  pathways.forEach((pathway) => {
    const source = byId.get("pathway:" + pathway.code);
    if (!source) return;
    for (const departmentCode of pathway.departmentCodes || [pathway.departmentCode]) {
      const target = departmentNodes.get(departmentCode);
      if (target && target.id !== source.id) {
        addEdge(source, target, {
          id: "pathway-link:" + pathway.code + ":" + departmentCode,
          relationType: "APPLIES_TO",
          cross: true,
          verified: true,
          basis: "academy-pathway",
          label: "Parcours transversal"
        });
      }
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
      pathways: pathways.length,
      domains: domainNodes.size,
      modules: nodes.filter((node) => node.entity_type === "MODULE").length,
      anastomoses: localAnastomoses
    },
    byId,
    departmentNodes,
    domainNodes
  };
}
