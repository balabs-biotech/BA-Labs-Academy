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
  // Academy departments often expose many sections directly under one root.
  // Feeding all of them as siblings creates a wide fan. Add invisible spatial
  // branch points (never Academy entities) so the shared engine grows several
  // subordinate clusters before reaching the real sections/domains.
  const makeSpatialClusters = (root) => {
    const children = root.children;
    if (children.length <= 5) return children;
    const clusters = [];
    const byType = new Map();
    for (const child of children) {
      const type = child.entity_type || "NODE";
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type).push(child);
    }
    let clusterIndex = 0;
    for (const [type, group] of byType) {
      if (group.length <= 4) {
        clusters.push(...group);
        continue;
      }
      const clusterCount = Math.ceil(group.length / 4);
      const chunkSize = Math.ceil(group.length / clusterCount);
      for (let offset = 0; offset < group.length; offset += chunkSize) {
        clusters.push({
          id: "__academy-spatial__" + root.id + "__" + clusterIndex++,
          title: "",
          children: group.slice(offset, offset + chunkSize),
          relations: [],
          entity_type: "SPATIAL_GROUP",
          spatialOnly: true,
          groupType: type
        });
      }
    }
    return clusters;
  };
  const tree = roots.map((root) => ({
    ...root,
    relations: [],
    children: makeSpatialClusters(root)
  }));
  // Each Academy root needs its own deterministic layout seed. Pathways share the
  // semantic rootId "pathways", but must not inherit identical biological jitter.
  const rootLayoutIds = roots.map((root) => root.id);
  const layout = createVernpixiNetwork(tree, { rootLayoutIds });
  const visibleLayoutNodes = layout.nodes.filter((node) => byId.has(node.id));
  const positioned = new Map(visibleLayoutNodes.map((node) => [node.id, node]));
  return {
    nodes: visibleLayoutNodes,
    edges: layout.edges,
    byId: positioned,
    stats: layout.stats
  };
}
