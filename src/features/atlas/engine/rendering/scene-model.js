function finitePoint(point, label) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError(label + " must be a finite point");
  }
}

function copyCurve(curve, id) {
  const names = ["a", "c1", "c2", "b"];
  const copied = {};
  for (const name of names) {
    finitePoint(curve?.[name], "Scene path " + id + " control point " + name);
    copied[name] = Object.freeze({ x: curve[name].x, y: curve[name].y });
  }
  return Object.freeze(copied);
}

/** Build a renderer-neutral scene; canonical relationships and decorative paths stay separate. */
export function createAtlasScene({
  topology,
  morphology,
  anastomoses = [],
  coreId = "MYC",
  defaultNodeRadius = 18
} = {}) {
  if (!topology?.byId || !Array.isArray(topology.edges)) {
    throw new TypeError("Atlas scene requires validated canonical topology");
  }
  if (!morphology?.byId || !Array.isArray(morphology.nodes) || !Array.isArray(morphology.branches)) {
    throw new TypeError("Atlas scene requires derived morphology");
  }
  if (!Array.isArray(anastomoses)) throw new TypeError("Anastomoses must be an array");
  if (!Number.isFinite(defaultNodeRadius) || defaultNodeRadius <= 0) {
    throw new RangeError("defaultNodeRadius must be positive");
  }

  const seenNodes = new Set();
  const nodes = morphology.nodes.map((node) => {
    if (!topology.byId.has(node.id)) throw new Error("Scene node is absent from canonical topology: " + node.id);
    if (seenNodes.has(node.id)) throw new Error("Scene contains duplicate node id: " + node.id);
    seenNodes.add(node.id);
    finitePoint(node, "Scene node " + node.id);
    const radius = node.radius === undefined ? defaultNodeRadius : node.radius;
    if (!Number.isFinite(radius) || radius <= 0) throw new RangeError("Scene node radius must be positive: " + node.id);
    return Object.freeze({
      id: node.id,
      x: node.x,
      y: node.y,
      radius,
      label: String(node.label ?? node.title ?? node.name ?? node.id),
      color: node.universeColor ?? node.color ?? null,
      territoryId: node.territoryId ?? null,
      generation: node.generation ?? 0,
      kind: node.id === coreId ? "core" : node.id === node.territoryId ? "universe" : "knowledge"
    });
  });

  const pathIds = new Set();
  const paths = [];
  const appendPath = (path, type) => {
    if (!path || typeof path.id !== "string" || !path.id.trim()) throw new TypeError("Scene paths require stable IDs");
    if (pathIds.has(path.id)) throw new Error("Scene contains duplicate path id: " + path.id);
    if (!seenNodes.has(path.sourceId) || !seenNodes.has(path.targetId)) {
      throw new Error("Scene path references a missing node: " + path.id);
    }
    pathIds.add(path.id);
    paths.push(Object.freeze({
      id: path.id,
      sourceId: path.sourceId,
      targetId: path.targetId,
      type,
      visualOnly: type !== "pedagogy",
      territoryId: path.territoryId ?? null,
      territoryIds: path.territoryIds ? Object.freeze([...path.territoryIds]) : null,
      curve: copyCurve(path.curve, path.id)
    }));
  };

  for (const branch of morphology.branches) appendPath(branch, branch.visualOnly ? "universe-trunk" : "morphology");
  for (const link of anastomoses) appendPath(link, "anastomosis");

  const relationships = topology.edges.map((edge) => Object.freeze({
    id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId,
    type: "pedagogy", data: Object.freeze({ ...edge })
  }));

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.radius);
    minY = Math.min(minY, node.y - node.radius);
    maxX = Math.max(maxX, node.x + node.radius);
    maxY = Math.max(maxY, node.y + node.radius);
  }
  for (const path of paths) {
    for (const point of Object.values(path.curve)) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  const bounds = nodes.length ? Object.freeze({ minX, minY, maxX, maxY }) : null;

  return Object.freeze({
    version: 1,
    nodes: Object.freeze(nodes),
    relationships: Object.freeze(relationships),
    paths: Object.freeze(paths),
    bounds,
    metrics: Object.freeze({
      nodeCount: nodes.length,
      relationshipCount: relationships.length,
      pathCount: paths.length,
      decorativePathCount: paths.filter((path) => path.visualOnly).length
    })
  });
}
