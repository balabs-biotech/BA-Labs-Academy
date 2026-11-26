import { createVernpixiNetwork } from "../shared/explorer-2d-network.js";
import { resolveAcademyUniverseSources } from "./academy-universe-sources.js";

const ANCHORS = [
  [0, 0],
  [-0.62, -0.34], [-0.17, -0.62], [0.39, -0.48], [0.68, 0.08],
  [0.24, 0.53], [-0.34, 0.57], [-0.70, 0.19], [0.02, -0.02]
];
const hash = (value) => {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
};

function boundsOf(nodes) {
  return nodes.reduce((bounds, node) => ({
    minX: Math.min(bounds.minX, node.x - node.r),
    minY: Math.min(bounds.minY, node.y - node.r),
    maxX: Math.max(bounds.maxX, node.x + node.r),
    maxY: Math.max(bounds.maxY, node.y + node.r)
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

/**
 * Academy data adapter for the exact shared BA Labs biological graph engine.
 * Canonical Academy IDs and source records are retained; only visual geometry is generated.
 */
export function createAcademySharedAtlas({ graph, seed = "ba-labs-academy-shared-engine" } = {}) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new TypeError("Academy shared Atlas requires the canonical Academy graph");
  }
  const departments = graph.nodes.filter((node) => node.level === 0 && node.entity_type === "DEPARTMENT");
  const core = departments.find((node) => node.isAcademyCore || node.entity_key === "MYC");
  const universeSources = resolveAcademyUniverseSources(departments.filter((node) => node.id !== core?.id));
  const universes = universeSources.map((source) => source.record);
  if (!core || universes.length !== 8) {
    throw new Error("Academy Atlas requires the MYC core and exactly eight disciplinary universes");
  }

  const children = new Map();
  for (const node of graph.nodes) {
    if (!node.parent) continue;
    if (!children.has(node.parent)) children.set(node.parent, []);
    children.get(node.parent).push(node);
  }
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const toTreeNode = (node, rootId, visited = new Set()) => {
    if (visited.has(node.id)) throw new Error("Cycle detected in Academy hierarchy: " + node.id);
    const nextVisited = new Set(visited).add(node.id);
    return {
      id: node.id,
      title: node.title,
      data: node,
      children: (children.get(node.id) || []).map((child) => toTreeNode(child, rootId, nextVisited))
    };
  };

  // Each transversal pathway is assigned once to its first canonical department.
  // Its other documented departmental links become evidence-bearing root relations.
  const pathwayRoots = graph.nodes.filter((node) => node.level === 0 && node.entity_type === "PATHWAY");
  const pathwayTargets = new Map();
  for (const pathway of pathwayRoots) {
    const targets = graph.edges
      .filter((edge) => edge.a.id === pathway.id || edge.b.id === pathway.id)
      .map((edge) => nodeById.get(edge.a.id === pathway.id ? edge.b.id : edge.a.id))
      .filter(Boolean)
      .map((node) => node.rootId)
      .filter((id) => universes.some((department) => department.rootId === id));
    pathwayTargets.set(pathway.id, [...new Set(targets)]);
  }

  const makeRoot = (node, layoutId) => {
    const treeNode = toTreeNode(node, node.id);
    treeNode.layoutId = layoutId;
    return treeNode;
  };
  const coreTree = makeRoot(core, "myco");
  const roots = [coreTree];
  for (const department of universes) {
    const source = universeSources.find((item) => item.code === department.entity_key);
    const root = makeRoot(department, source.layoutId);
    const attachedPathways = pathwayRoots.filter((pathway) => pathwayTargets.get(pathway.id)?.[0] === department.rootId);
    for (const pathway of attachedPathways) root.children.push(toTreeNode(pathway, department.id));
    roots.push(root);
  }

  for (const pathway of pathwayRoots.filter((item) => !(pathwayTargets.get(item.id) || []).length)) {
    coreTree.children.push(toTreeNode(pathway, core.id));
  }

  const rootByDepartment = new Map(universes.map((node) => [node.rootId, node]));
  const relationsByRoot = new Map(roots.map((root) => [root.id, []]));
  for (const pathway of pathwayRoots) {
    const targets = pathwayTargets.get(pathway.id) || [];
    for (let i = 0; i < targets.length; i += 1) {
      for (let j = i + 1; j < targets.length; j += 1) {
        const source = rootByDepartment.get(targets[i]);
        const target = rootByDepartment.get(targets[j]);
        if (!source || !target) continue;
        relationsByRoot.get(source.id).push({
          target: target.id, basis: "page-content", label: "Parcours transversal : " + pathway.title,
          evidence: pathway.id
        });
      }
    }
  }
  for (const root of roots) root.relations = relationsByRoot.get(root.id) || [];

  const network = createVernpixiNetwork(roots, {
    rootLayoutIds: ["myco", ...universeSources.map((source) => source.layoutId)],
    rootAnchors: ANCHORS,
    fixedRootIds: [core.id]
  });


  const expectedIds = graph.nodes.map((node) => node.id);
  const represented = new Set(network.nodes.map((node) => node.id));
  const missing = expectedIds.filter((id) => !represented.has(id));
  if (missing.length) {
    throw new Error("Shared biological adapter omitted canonical Academy node(s): " + missing.slice(0, 5).join(", "));
  }
  const bounds = boundsOf(network.nodes);
  const metrics = Object.freeze({
    canonicalNodeCount: graph.nodes.length,
    renderedNodeCount: network.nodes.length,
    universeCount: 8,
    sourceCount: universeSources.length,
    sourceIds: Object.freeze(universeSources.map((source) => source.sourceId)),
    coreCount: 1,
    edgeCount: network.edges.length,
    crossUniverseConnections: network.stats.crossUniverseConnections,
    localAnastomoses: network.stats.localAnastomoses
  });
  return Object.freeze({
    ...network,
    bounds: Object.freeze(bounds),
    metrics
  });
}
