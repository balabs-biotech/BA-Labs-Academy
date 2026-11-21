import { createPixiRenderer } from "./pixi-renderer.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const typeLabels = {
  DEPARTMENT: "Département",
  DOMAIN: "Domaine",
  MODULE: "Module",
  PATHWAY: "Parcours"
};

export function renderAcademyAtlas(graph) {
  const { departments, pathways, domains, modules } = graph.stats;
  return `
    <section class="page-intro atlas-page-intro">
      <span class="eyebrow">BA LABS ACADEMY · CARTOGRAPHIE VIVANTE</span>
      <h1>Atlas des connaissances</h1>
      <p>Un réseau unique : départements, domaines, modules et parcours transversaux. Approche-toi pour révéler les ramifications, sélectionne un nœud pour en lire la fiche.</p>
    </section>
    <section class="academy-atlas" id="academy-atlas">
      <div class="atlas-topline">
        <div class="atlas-topline-copy">
          <span class="eyebrow">EXPLORATEUR 2D · PIXIJS / WEBGL</span>
          <strong>${departments} départements <i>·</i> ${pathways} parcours <i>·</i> ${domains} domaines <i>·</i> ${modules} modules</strong>
        </div>
        <span class="atlas-engine-state" id="atlas-engine-state">Initialisation du moteur…</span>
      </div>
      <div class="atlas-stage" id="academy-atlas-stage">
        <canvas id="academy-atlas-canvas" aria-label="Réseau de connaissances interactif BA Labs Academy"></canvas>
        <div class="atlas-stage-heading">
          <span class="eyebrow">UN SEUL RÉSEAU · ZOOM PROGRESSIF</span>
          <p>Glisser pour déplacer · Pincer ou molette pour zoomer · Toucher un nœud pour le centrer</p>
        </div>
        <nav class="atlas-controls" aria-label="Contrôles de la carte">
          <button type="button" class="btn btn-square btn-sm" data-atlas-action="in" aria-label="Zoom avant">＋</button>
          <button type="button" class="btn btn-square btn-sm" data-atlas-action="out" aria-label="Zoom arrière">−</button>
          <button type="button" class="btn btn-square btn-sm" data-atlas-action="reset" aria-label="Recentrer la carte">⌖</button>
          <button type="button" class="btn btn-square btn-sm" data-atlas-action="back" aria-label="Vue précédente" disabled>↶</button>
        </nav>
        <div class="atlas-breadcrumbs" id="academy-atlas-breadcrumbs" aria-live="polite">BA Labs Academy / Vue générale</div>
        <aside class="atlas-selection card" id="academy-atlas-selection" aria-live="polite" hidden></aside>
        <nav class="atlas-accessible-nodes" id="academy-atlas-accessible" aria-label="Navigation textuelle des nœuds"></nav>
        <div class="atlas-loading" id="academy-atlas-loading"><span class="atlas-loading-pulse"></span><p>Déploiement du réseau de connaissances…</p></div>
      </div>
      <div class="atlas-legend">
        <span class="legend-department">Département</span>
        <span class="legend-pathway">Parcours transversal</span>
        <span class="legend-domain">Domaine</span>
        <span class="legend-module">Module</span>
        <span class="legend-link">Relation entre disciplines</span>
      </div>
    </section>`;
}

export function mountAcademyAtlas(container, graph) {
  const canvas = container.querySelector("#academy-atlas-canvas");
  const stage = container.querySelector("#academy-atlas-stage");
  const loading = container.querySelector("#academy-atlas-loading");
  const selection = container.querySelector("#academy-atlas-selection");
  const breadcrumbs = container.querySelector("#academy-atlas-breadcrumbs");
  const engineState = container.querySelector("#atlas-engine-state");
  const backButton = container.querySelector('[data-atlas-action="back"]');
  if (!canvas || !stage || !loading || !selection) return () => {};

  const { nodes, edges, byId } = graph;
  const reduced = reducedMotion();
  let renderer = null;
  let disposed = false;
  let frame = 0;
  let width = 0;
  let height = 0;
  let scale = 1;
  let targetScale = 1;
  let offset = { x: 0, y: 0 };
  let targetOffset = { x: 0, y: 0 };
  let selected = null;
  const pointers = new Map();
  const history = [];
  let gesture = null;
  let dragged = false;
  let lastPinchDistance = 0;
  let lastClick = null;

  const screen = (node) => ({
    x: width / 2 + offset.x + node.x * scale,
    y: height / 2 + offset.y + node.y * scale
  });

  const draw = () => {
    if (!renderer || disposed) return;
    renderer.render({
      nodes,
      edges,
      selected,
      scale,
      offset,
      width,
      height,
      reduced,
      lang: "fr",
      time: performance.now()
    });
  };

  const fitOverview = () => {
    const roots = nodes.filter((node) => node.level === 0);
    if (!roots.length || !width || !height) return;
    const xs = roots.map((node) => node.x);
    const ys = roots.map((node) => node.y);
    const padX = Math.min(150, Math.max(72, width * 0.11));
    const padY = Math.min(125, Math.max(70, height * 0.13));
    const spanX = Math.max(...xs) - Math.min(...xs) + 230;
    const spanY = Math.max(...ys) - Math.min(...ys) + 220;
    targetScale = clamp(Math.min((width - padX * 2) / spanX, (height - padY * 2) / spanY), 0.28, 0.82);
    targetOffset = { x: 0, y: 0 };
  };

  const updateBreadcrumbs = () => {
    if (!selected) {
      breadcrumbs.textContent = "BA Labs Academy / Vue générale";
      return;
    }
    const path = [];
    let current = selected;
    while (current) {
      path.unshift(current.title);
      current = current.parent ? byId.get(current.parent) : null;
    }
    breadcrumbs.textContent = "BA Labs Academy / " + path.join(" / ");
  };

  const updateSelection = () => {
    updateBreadcrumbs();
    backButton.disabled = history.length === 0;
    selection.replaceChildren();
    if (!selected) {
      selection.hidden = true;
      return;
    }
    const body = document.createElement("div");
    body.className = "card-body";
    const heading = document.createElement("div");
    heading.className = "atlas-selection-heading";
    const type = document.createElement("span");
    type.className = "eyebrow";
    type.textContent = typeLabels[selected.entity_type] || "Nœud";
    const title = document.createElement("h3");
    title.textContent = selected.title;
    heading.append(type, title);
    body.append(heading);

    const description = document.createElement("p");
    description.textContent = selected.summary || "Fiche descriptive à compléter.";
    body.append(description);

    if (selected.entity_type === "PATHWAY" && Array.isArray(selected.data.domainCodes)) {
      const domains = document.createElement("div");
      domains.className = "atlas-selection-tags";
      selected.data.domainCodes.forEach((code) => {
        const tag = document.createElement("span");
        tag.textContent = code;
        domains.append(tag);
      });
      body.append(domains);
      const status = document.createElement("small");
      status.textContent = "Parcours cartographié · séquence et ressources à construire";
      body.append(status);
    } else if (selected.entity_type === "MODULE") {
      const status = document.createElement("small");
      status.textContent = "Module prévu · fiche pédagogique non rédigée";
      selection.append(status);
    } else if (selected.entity_type === "DEPARTMENT" || selected.entity_type === "DOMAIN") {
      const status = document.createElement("small");
      status.textContent = "Référentiel cartographié · publication éditoriale distincte";
      selection.append(status);
    }

    if (selected.data.route) {
      const link = document.createElement("a");
      link.className = "atlas-selection-link";
      link.href = selected.data.route;
      link.textContent = "Ouvrir la fiche ↗";
      body.append(link);
    }
    selection.append(body);
    selection.hidden = false;
  };

  const renderAccessible = () => {
    const nav = container.querySelector("#academy-atlas-accessible");
    if (!nav) return;
    nav.replaceChildren();
    nodes.forEach((node) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = node.title;
      button.setAttribute("aria-label", node.title + " · " + (typeLabels[node.entity_type] || "Nœud"));
      button.addEventListener("click", () => focusNode(node));
      nav.append(button);
    });
  };

  const focusNode = (node, zoomTo) => {
    if (!node) return;
    if (!selected || selected.id !== node.id) {
      history.push({ scale: targetScale, offset: { ...targetOffset }, selected });
      if (history.length > 80) history.shift();
    }
    const zoomLevel = zoomTo ?? (node.level === 0 ? 0.88 : node.level === 1 ? 1.8 : 3.6);
    targetScale = clamp(zoomLevel, 0.28, 12);
    targetOffset = { x: -node.x * targetScale, y: -node.y * targetScale };
    selected = node;
    updateSelection();
    draw();
  };

  const zoom = (factor, x = width / 2, y = height / 2) => {
    const next = clamp(targetScale * factor, 0.28, 12);
    const ratio = next / targetScale;
    targetOffset.x = (x - width / 2) - (x - width / 2 - targetOffset.x) * ratio;
    targetOffset.y = (y - height / 2) - (y - height / 2 - targetOffset.y) * ratio;
    targetScale = next;
    if (reduced) {
      scale = targetScale;
      offset = { ...targetOffset };
      draw();
    }
  };

  const hit = (x, y) => {
    const visible = new Set(JSON.parse(canvas.dataset.visibleNodeIds || "[]"));
    const boxes = JSON.parse(canvas.dataset.visibleNodeHitBoxes || "{}");
    let labelHit = null;
    let labelArea = Infinity;
    for (const node of nodes) {
      if (!visible.has(node.id)) continue;
      const box = boxes[node.id];
      if (!box) continue;
      if (x >= box.left - 8 && x <= box.right + 8 && y >= box.top - 6 && y <= box.bottom + 6) {
        const area = (box.right - box.left) * (box.bottom - box.top);
        if (area < labelArea) {
          labelHit = node;
          labelArea = area;
        }
      }
    }
    if (labelHit) return labelHit;
    let found = null;
    let best = 22;
    for (const node of nodes) {
      if (!visible.has(node.id)) continue;
      const point = screen(node);
      const distance = Math.hypot(point.x - x, point.y - y);
      const limit = Math.max(best, node.r * Math.sqrt(scale) + 8);
      if (distance < limit) {
        best = distance;
        found = node;
      }
    }
    return found;
  };

  const resize = () => {
    if (disposed) return;
    const rect = stage.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (renderer) renderer.resize(width, height);
    fitOverview();
    scale = targetScale;
    offset = { ...targetOffset };
    draw();
  };

  const onPointerDown = (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragged = false;
    gesture = { x: event.clientX, y: event.clientY, ox: targetOffset.x, oy: targetOffset.y };
    canvas.classList.add("is-dragging");
  };

  const onPointerMove = (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1 && gesture) {
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) dragged = true;
      if (dragged) {
        targetOffset.x = gesture.ox + dx;
        targetOffset.y = gesture.oy + dy;
        if (reduced) {
          offset = { ...targetOffset };
          draw();
        }
      }
    } else if (pointers.size === 2) {
      const points = [...pointers.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (lastPinchDistance) {
        const rect = canvas.getBoundingClientRect();
        zoom(distance / lastPinchDistance,
          (points[0].x + points[1].x) / 2 - rect.left,
          (points[0].y + points[1].y) / 2 - rect.top);
      }
      lastPinchDistance = distance;
      dragged = true;
    }
  };

  const onPointerUp = (event) => {
    pointers.delete(event.pointerId);
    canvas.classList.remove("is-dragging");
    if (!pointers.size) {
      if (!dragged) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const node = hit(x, y);
        if (node) {
          const now = performance.now();
          const previous = lastClick;
          if (previous && now - previous.time < 420 && Math.hypot(x - previous.x, y - previous.y) < 22) {
            focusNode(node);
            lastClick = null;
          } else {
            focusNode(node);
            lastClick = { time: now, x, y, node };
          }
        }
      }
      gesture = null;
      lastPinchDistance = 0;
    } else if (pointers.size === 1) {
      const point = [...pointers.values()][0];
      gesture = { x: point.x, y: point.y, ox: targetOffset.x, oy: targetOffset.y };
      lastPinchDistance = 0;
      dragged = true;
    }
  };

  const onWheel = (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoom(event.deltaY < 0 ? 1.16 : 0.86, event.clientX - rect.left, event.clientY - rect.top);
  };

  const onControls = (event) => {
    const button = event.target.closest("[data-atlas-action]");
    if (!button) return;
    const action = button.dataset.atlasAction;
    if (action === "in") zoom(1.24);
    else if (action === "out") zoom(0.81);
    else if (action === "back") {
      const previous = history.pop();
      if (previous) {
        targetScale = previous.scale;
        targetOffset = { ...previous.offset };
        selected = previous.selected || null;
        updateSelection();
        if (reduced) {
          scale = targetScale;
          offset = { ...targetOffset };
          draw();
        }
      }
    } else {
      selected = null;
      history.length = 0;
      fitOverview();
      updateSelection();
      if (reduced) {
        scale = targetScale;
        offset = { ...targetOffset };
        draw();
      }
    }
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  container.addEventListener("click", onControls);
  window.addEventListener("resize", resize, { passive: true });

  const animate = () => {
    if (disposed) return;
    if (!reduced) {
      scale += (targetScale - scale) * 0.12;
      offset.x += (targetOffset.x - offset.x) * 0.12;
      offset.y += (targetOffset.y - offset.y) * 0.12;
      draw();
      frame = requestAnimationFrame(animate);
    }
  };

  createPixiRenderer(canvas).then((instance) => {
    if (disposed) {
      instance.destroy();
      return;
    }
    renderer = instance;
    resize();
    renderAccessible();
    updateSelection();
    engineState.textContent = "Moteur actif · WebGL 2D";
    loading.hidden = true;
    if (!reduced) frame = requestAnimationFrame(animate);
  }).catch((error) => {
    console.error("Academy PixiJS Atlas initialization failed", error);
    engineState.textContent = "Moteur indisponible";
    loading.querySelector("p").textContent = "Le moteur graphique n’a pas pu démarrer. Vérifie la prise en charge WebGL du navigateur.";
    loading.classList.add("is-error");
  });

  return () => {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("wheel", onWheel);
    container.removeEventListener("click", onControls);
    window.removeEventListener("resize", resize);
    renderer?.destroy();
  };
}
