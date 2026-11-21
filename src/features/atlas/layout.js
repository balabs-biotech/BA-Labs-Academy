const WIDTH = 1200;
const HEIGHT = 760;

function hash(value) {
  let h = 2166136261;
  for (const char of String(value)) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hasSavedLayout(nodes) {
  return nodes.length > 0 && nodes.every((node) =>
    Number.isFinite(node.position_x) && Number.isFinite(node.position_y)
  );
}

function savedPositions(nodes) {
  const xs = nodes.map((node) => node.position_x);
  const ys = nodes.map((node) => node.position_y);
  const normalized = Math.min(...xs) >= 0 && Math.max(...xs) <= 1 &&
    Math.min(...ys) >= 0 && Math.max(...ys) <= 1;
  return nodes.map((node) => ({
    ...node,
    x: normalized ? 70 + node.position_x * (WIDTH - 140) : node.position_x,
    y: normalized ? 70 + node.position_y * (HEIGHT - 140) : node.position_y
  }));
}

function seededPositions(nodes) {
  const groups = new Map();
  for (const node of nodes) {
    const group = node.entity_type || "OTHER";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(node);
  }
  const groupNames = [...groups.keys()].sort();
  const result = [];
  groupNames.forEach((group, groupIndex) => {
    const members = groups.get(group).slice().sort((a, b) =>
      String(a.node_key).localeCompare(String(b.node_key))
    );
    const ringRadius = Math.min(300, 115 + members.length * 9);
    const ringAngle = (groupIndex / Math.max(1, groupNames.length)) * Math.PI * 2;
    const centerX = WIDTH / 2 + Math.cos(ringAngle) * 115;
    const centerY = HEIGHT / 2 + Math.sin(ringAngle) * 85;
    members.forEach((node, index) => {
      const angle = (index / Math.max(1, members.length)) * Math.PI * 2 +
        (hash(node.node_key) % 1000) / 1000 * 0.2;
      const radius = ringRadius * (0.72 + (hash(node.node_key + ":r") % 100) / 250);
      result.push({
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    });
  });
  return result;
}

function relaxPositions(nodes, edges, iterations = 80) {
  if (nodes.length < 2) return nodes;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links = edges.map((edge) => [byId.get(edge.source_node_id), byId.get(edge.target_node_id)])
    .filter(([a, b]) => a && b);
  const area = WIDTH * HEIGHT;
  const ideal = Math.sqrt(area / nodes.length) * 0.72;
  const points = nodes.map((node) => ({ ...node, vx: 0, vy: 0 }));
  for (let step = 0; step < iterations; step++) {
    const temperature = 1 - step / iterations;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      let fx = 0, fy = 0;
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        const b = points[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const force = (ideal * ideal) / distance;
        fx += (dx / distance) * force;
        fy += (dy / distance) * force;
      }
      for (const [source, target] of links) {
        if (source !== a && target !== a) continue;
        const other = source === a ? target : source;
        const dx = other.x - a.x, dy = other.y - a.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const force = (distance * distance) / ideal;
        fx += (dx / distance) * force * 0.8;
        fy += (dy / distance) * force * 0.8;
      }
      const centerX = WIDTH / 2, centerY = HEIGHT / 2;
      fx += (centerX - a.x) * 0.012;
      fy += (centerY - a.y) * 0.012;
      const magnitude = Math.max(0.001, Math.hypot(fx, fy));
      const travel = Math.min(magnitude, 9 * temperature);
      a.x = Math.max(42, Math.min(WIDTH - 42, a.x + fx / magnitude * travel));
      a.y = Math.max(42, Math.min(HEIGHT - 42, a.y + fy / magnitude * travel));
    }
  }
  return points;
}

export function layoutAtlas(nodes, edges) {
  if (!nodes.length) return [];
  if (hasSavedLayout(nodes)) return savedPositions(nodes);
  return relaxPositions(seededPositions(nodes), edges);
}

export function atlasBounds(points) {
  if (!points.length) return { x: 0, y: 0, width: WIDTH, height: HEIGHT };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - 100;
  const minY = Math.min(...ys) - 90;
  return {
    x: minX,
    y: minY,
    width: Math.max(500, Math.max(...xs) - minX + 120),
    height: Math.max(360, Math.max(...ys) - minY + 110)
  };
}
