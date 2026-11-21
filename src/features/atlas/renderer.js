import { atlasBounds, layoutAtlas } from "./layout.js";

const escape = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

const palette = {
  DEPARTMENT: "department",
  DOMAIN: "domain",
  CONTENT: "content",
  MODULE: "content",
  LESSON: "content",
  PATHWAY: "pathway",
  SKILL: "skill",
  PROJECT: "project"
};

export function renderAtlasGraph(nodes, edges) {
  const points = layoutAtlas(nodes, edges);
  const bounds = atlasBounds(points);
  const byId = new Map(points.map((point) => [point.id, point]));
  const lines = edges.map((edge) => {
    const source = byId.get(edge.source_node_id);
    const target = byId.get(edge.target_node_id);
    if (!source || !target) return "";
    return `<line class="atlas-edge" data-relation="${escape(edge.relation_type)}" x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}"></line>`;
  }).join("");
  const circles = points.map((point) => {
    const kind = palette[point.entity_type] || "other";
    const title = point.title || point.title_override || point.entity_key || point.node_key;
    return `<g class="atlas-node atlas-node--${kind}" data-node-id="${escape(point.id)}" tabindex="0" role="button" aria-label="${escape(title)}">
      <circle cx="${point.x}" cy="${point.y}" r="13"></circle>
      <text x="${point.x + 21}" y="${point.y + 4}">${escape(title)}</text>
    </g>`;
  }).join("");
  return `<div class="atlas-stage">
    <div class="atlas-controls" aria-label="Contrôles de l’Atlas">
      <button type="button" data-atlas-zoom="in" aria-label="Zoom avant">＋</button>
      <button type="button" data-atlas-zoom="out" aria-label="Zoom arrière">−</button>
      <button type="button" data-atlas-zoom="reset" aria-label="Réinitialiser la vue">Réinitialiser</button>
    </div>
    <svg class="atlas-svg" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" role="group" aria-label="Graphe interactif des connaissances">
      <g class="atlas-viewport">${lines}${circles}</g>
    </svg>
    <aside class="atlas-selection" aria-live="polite">Sélectionne un nœud pour afficher ses informations.</aside>
  </div>`;
}

export function bindAtlasGraph(container, nodes, onSelect = () => {}) {
  const svg = container.querySelector(".atlas-svg");
  const viewport = container.querySelector(".atlas-viewport");
  if (!svg || !viewport) return () => {};
  const initialView = svg.viewBox.baseVal;
  const startView = { x: initialView.x, y: initialView.y, width: initialView.width, height: initialView.height };
  let view = { ...startView };
  let drag = null;
  const applyView = () => svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`);
  const zoom = (factor, anchorX = view.x + view.width / 2, anchorY = view.y + view.height / 2) => {
    const nextWidth = Math.max(220, Math.min(2600, view.width * factor));
    const nextHeight = Math.max(160, Math.min(1800, view.height * factor));
    const ratioX = (anchorX - view.x) / view.width;
    const ratioY = (anchorY - view.y) / view.height;
    view = {
      x: anchorX - ratioX * nextWidth,
      y: anchorY - ratioY * nextHeight,
      width: nextWidth,
      height: nextHeight
    };
    applyView();
  };
  const pointFromEvent = (event) => {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  };
  const onWheel = (event) => {
    event.preventDefault();
    const point = pointFromEvent(event);
    zoom(event.deltaY < 0 ? 0.88 : 1.14, point.x, point.y);
  };
  const onPointerDown = (event) => {
    if (event.target.closest(".atlas-node")) return;
    drag = { x: event.clientX, y: event.clientY, view: { ...view } };
    svg.setPointerCapture?.(event.pointerId);
    svg.classList.add("is-panning");
  };
  const onPointerMove = (event) => {
    if (!drag) return;
    const rect = svg.getBoundingClientRect();
    view.x = drag.view.x - (event.clientX - drag.x) * drag.view.width / rect.width;
    view.y = drag.view.y - (event.clientY - drag.y) * drag.view.height / rect.height;
    applyView();
  };
  const onPointerUp = () => {
    drag = null;
    svg.classList.remove("is-panning");
  };
  const onClick = (event) => {
    const nodeElement = event.target.closest(".atlas-node");
    if (!nodeElement) return;
    const node = nodes.find((item) => item.id === nodeElement.dataset.nodeId);
    if (!node) return;
    const selection = container.querySelector(".atlas-selection");
    const title = node.title || node.title_override || node.entity_key || node.node_key;
    selection.textContent = `${title} · ${node.entity_type}`;
    onSelect(node);
  };
  const onKeyDown = (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches(".atlas-node")) {
      event.preventDefault();
      event.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  };
  const onControls = (event) => {
    const button = event.target.closest("[data-atlas-zoom]");
    if (!button) return;
    const action = button.dataset.atlasZoom;
    if (action === "in") zoom(0.8);
    else if (action === "out") zoom(1.25);
    else {
      view = { x: startView.x, y: startView.y, width: startView.width, height: startView.height };
      applyView();
    }
  };
  svg.addEventListener("wheel", onWheel, { passive: false });
  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointercancel", onPointerUp);
  svg.addEventListener("click", onClick);
  svg.addEventListener("keydown", onKeyDown);
  container.addEventListener("click", onControls);
  return () => {
    svg.removeEventListener("wheel", onWheel);
    svg.removeEventListener("pointerdown", onPointerDown);
    svg.removeEventListener("pointermove", onPointerMove);
    svg.removeEventListener("pointerup", onPointerUp);
    svg.removeEventListener("pointercancel", onPointerUp);
    svg.removeEventListener("click", onClick);
    svg.removeEventListener("keydown", onKeyDown);
    container.removeEventListener("click", onControls);
  };
}
