/**
 * Build a validated, renderer-independent view of the Academy knowledge graph.
 * The input records remain untouched; all indexes belong to this derived model.
 */
export function createAtlasTopology({ nodes, edges = [] }) {
  if (!Array.isArray(nodes)) throw new TypeError("Atlas topology requires a nodes array");
  if (!Array.isArray(edges)) throw new TypeError("Atlas topology requires an edges array");

  const byId = new Map();
  for (const node of nodes) {
    if (!node || typeof node.id !== "string" || !node.id.trim()) {
      throw new TypeError("Atlas topology nodes require a non-empty string id");
    }
    if (byId.has(node.id)) throw new Error("Atlas topology contains duplicate node id: " + node.id);
    byId.set(node.id, node);
  }

  const childrenByParent = new Map();
  const parentById = new Map();
  for (const node of nodes) {
    if (node.parent === null || node.parent === undefined || node.parent === "") continue;
    if (typeof node.parent !== "string" || !byId.has(node.parent)) {
      throw new Error("Missing Atlas parent for " + node.id + ": " + String(node.parent));
    }
    if (node.parent === node.id) throw new Error("Atlas hierarchy contains a cycle at " + node.id);
    parentById.set(node.id, node.parent);
    if (!childrenByParent.has(node.parent)) childrenByParent.set(node.parent, []);
    childrenByParent.get(node.parent).push(node);
  }

  // Iterative parent-chain traversal avoids call-stack limits on deep knowledge trees.
  const completed = new Set();
  for (const node of nodes) {
    if (completed.has(node.id)) continue;
    const path = [];
    const pathIndex = new Map();
    let currentId = node.id;
    while (currentId && !completed.has(currentId)) {
      if (pathIndex.has(currentId)) {
        throw new Error("Atlas hierarchy contains a cycle at " + currentId);
      }
      pathIndex.set(currentId, path.length);
      path.push(currentId);
      currentId = parentById.get(currentId);
    }
    for (const id of path) completed.add(id);
  }

  const edgeById = new Map();
  const normalizedEdges = edges.map((edge, index) => {
    if (!edge || typeof edge !== "object") throw new TypeError("Atlas topology edges must be objects");
    const sourceId = edge.sourceId || edge.source_node_id || edge.a?.id;
    const targetId = edge.targetId || edge.target_node_id || edge.b?.id;
    if (typeof sourceId !== "string" || !byId.has(sourceId)) {
      throw new Error("Atlas edge " + index + " references an unknown source: " + String(sourceId));
    }
    if (typeof targetId !== "string" || !byId.has(targetId)) {
      throw new Error("Atlas edge " + index + " references an unknown target: " + String(targetId));
    }
    const id = edge.id || sourceId + "->" + targetId;
    if (edgeById.has(id)) throw new Error("Atlas topology contains duplicate edge id: " + id);
    const normalized = { ...edge, id, sourceId, targetId };
    edgeById.set(id, normalized);
    return normalized;
  });

  const roots = nodes.filter((node) => !parentById.has(node.id));
  const depthById = new Map();
  for (const root of roots) {
    depthById.set(root.id, 0);
    const queue = [root];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const parent = queue[cursor];
      const depth = depthById.get(parent.id);
      for (const child of childrenByParent.get(parent.id) || []) {
        depthById.set(child.id, depth + 1);
        queue.push(child);
      }
    }
  }

  return {
    nodes: [...nodes], edges: normalizedEdges, byId, edgeById, roots,
    childrenByParent, parentById, depthById,
    maxDepth: depthById.size ? [...depthById.values()].reduce((maximum, depth) => Math.max(maximum, depth), 0) : 0
  };
}
