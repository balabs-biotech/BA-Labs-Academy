import { createVernpixiNetwork } from "./shared/explorer-2d-network.js";

/**
 * Academy adapter for the public BA Labs organic network engine.
 * Converts the Academy parent graph to the engine's tree contract, then maps
 * the resulting biological coordinates back onto the original Academy nodes.
 * No course, module, pathway or relationship data is sourced from the website.
 */
export function createAtlasOrganicLayout(nodes) {
  if (!Array.isArray(nodes)) throw new TypeError("Academy organic layout requires nodes");
  const byId = new Map(nodes.map((node) => [node.id, { ...node, children: [] }]));
  const roots = [];
  for (const node of nodes) {
    const copy = byId.get(node.id);
    if (node.parent) {
      const parent = byId.get(node.parent);
      if (!parent) throw new Error("Missing Academy organic parent: " + node.parent);
      parent.children.push(copy);
    } else {
      roots.push(copy);
    }
  }
  const tree = roots.map((root) => ({
    ...root,
    relations: [],
    children: root.children
  }));
  // Each Academy root needs its own deterministic layout seed. Pathways share the
  // semantic rootId "pathways", but must not inherit identical biological jitter.
  const rootLayoutIds = roots.map((root) => root.id);
  const layout = createVernpixiNetwork(tree, { rootLayoutIds });
  const positioned = new Map(layout.nodes.map((node) => [node.id, node]));
  return {
    nodes: layout.nodes,
    edges: layout.edges,
    byId: positioned,
    stats: layout.stats
  };
}
