import { createPixiRenderer } from "./pixi-renderer.js";
import { createAtlasNavigation, getAtlasBreadcrumbPath } from "./atlas-navigation.js";
import { atlasScreenPoint, fitAtlasCamera, zoomAtlasCamera, interpolateAtlasCamera } from "./atlas-camera.js";
import { createAtlasLifecycle } from "./atlas-lifecycle.js";
import { createAtlasPointerController } from "./atlas-interaction.js";
import { renderAtlasAccessibleNodes } from "./atlas-accessibility.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const typeLabels = {
  DEPARTMENT: "Département",
  DOMAIN: "Domaine",
  SECTION: "Section",
  MODULE: "Module",
  PATHWAY: "Parcours"
};

const escapeAtlasText = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

export function renderAcademyAtlas(graph) {
  const { departments, domains, pathways, sections, modules } = graph.stats;
  const domainSummary = domains ? `${domains} domaines <i>·</i> ` : "";
  const departmentRoots = graph.nodes.filter((node) => node.entity_type === "DEPARTMENT" && node.level === 0);
  const pathwayRoots = graph.nodes.filter((node) => node.entity_type === "PATHWAY" && node.level === 0);
  const rootNavigation = (items, kind, label) => {
    const content = `
      <div class="atlas-root-group atlas-root-group--${kind}">
        <span class="atlas-root-label">${label}</span>
        <div class="atlas-root-items">${items.map((node) => `
          <button type="button" class="atlas-root-chip" data-atlas-root="${escapeAtlasText(node.id)}" aria-pressed="false">
            <small>${escapeAtlasText(node.entity_key)}</small><span>${escapeAtlasText(node.title)}</span>
          </button>`).join("")}</div>
      </div>`;
    return kind === "pathways"
      ? `<details class="atlas-utility-disclosure atlas-pathway-disclosure"><summary>PARCOURS PRATIQUES <span>${items.length}</span></summary>${content}</details>`
      : content;
  };
  return `
    <section class="page-intro atlas-page-intro">
      <span class="eyebrow">BA LABS ACADEMY · CARTOGRAPHIE VIVANTE</span>
      <h1>Atlas des connaissances</h1>
      <p>La mycologie forme le noyau vivant de l’Atlas. Autour d’elle, les autres disciplines déploient leurs propres constellations ; les parcours relient les espaces entre eux.</p>
    </section>
    <section class="academy-atlas" id="academy-atlas">
      <div class="atlas-topline">
        <div class="atlas-topline-copy">
          <span class="eyebrow">EXPLORATEUR 2D · PIXIJS / WEBGL</span>
          <strong>${departments} départements <i>·</i> ${domainSummary}${pathways} parcours <i>·</i> ${sections} sections <i>·</i> ${modules} modules</strong>
        </div>
        <span class="atlas-engine-state" id="atlas-engine-state">Initialisation du moteur…</span>
      </div>
      <nav class="atlas-root-navigation" aria-label="Accès direct aux départements">
        ${rootNavigation(departmentRoots, "departments", "DÉPARTEMENTS")}
      </nav>
      ${rootNavigation(pathwayRoots, "pathways", "PARCOURS PRATIQUES")}
      <details class="atlas-utility-disclosure atlas-filter-disclosure">
        <summary>FILTRES DES CONNEXIONS <span>7</span></summary>
        <div class="atlas-relation-filters" role="group" aria-label="Filtres des connexions pédagogiques">
        <span>FLUX PÉDAGOGIQUES</span>
        <button type="button" data-atlas-relation="all" aria-pressed="true">Tous</button>
        <button type="button" data-atlas-relation="PREREQUISITE" aria-pressed="false">Prérequis</button>
        <button type="button" data-atlas-relation="COMPLEMENTARY" aria-pressed="false">Complémentarité</button>
        <button type="button" data-atlas-relation="METHOD_TRANSFER" aria-pressed="false">Transfert</button>
        <button type="button" data-atlas-relation="TECHNICAL_DEPENDENCY" aria-pressed="false">Dépendance</button>
        <button type="button" data-atlas-relation="APPLIED_IN" aria-pressed="false">Application</button>
          <button type="button" data-atlas-relation="INTERDISCIPLINARY" aria-pressed="false">Interdisciplinaire</button>
        </div>
      </details>
      <div class="atlas-stage" id="academy-atlas-stage">
        <canvas id="academy-atlas-canvas" aria-label="Réseau de connaissances interactif BA Labs Academy"></canvas>
        <div class="atlas-stage-heading">
          <span class="eyebrow">NOYAU MYCOLOGIE · CONSTELLATIONS DISCIPLINAIRES</span>
          <p>Le Y BA Labs structure le noyau central · Explorer les disciplines par zoom</p>
        </div>
        <nav class="atlas-controls" aria-label="Contrôles de la carte">
          <button type="button" class="btn btn-square btn-sm" data-atlas-action="in" aria-label="Zoom avant">＋</button>
          <button type="button" class="btn btn-square btn-sm" data-atlas-action="out" aria-label="Zoom arrière">−</button>
          <button type="button" class="btn btn-square btn-sm" data-atlas-action="reset" aria-label="Vue générale">⌖</button>
          <span class="atlas-zoom-readout" id="atlas-zoom-readout" aria-live="polite">Vue globale</span>
          <button type="button" class="btn btn-square btn-sm" data-atlas-action="back" aria-label="Vue précédente" disabled>↶</button>
        </nav>
        <div class="atlas-breadcrumbs" id="academy-atlas-breadcrumbs" aria-live="polite">BA Labs Academy / Vue générale</div>
        <aside class="atlas-selection card" id="academy-atlas-selection" aria-live="polite" hidden></aside>
        <nav class="atlas-accessible-nodes" id="academy-atlas-accessible" aria-label="Navigation textuelle des nœuds"></nav>
        <div class="atlas-loading" id="academy-atlas-loading"><span class="atlas-loading-pulse"></span><p>Déploiement du réseau de connaissances…</p></div>
      </div>
      <div class="atlas-legend">
        <span class="legend-department">Département</span>
        ${domains ? '<span class="legend-domain">Domaine publié</span>' : ""}
      <span class="legend-pathway">Parcours transversal</span>
        <span class="legend-section">Section</span>
        <span class="legend-module">Module</span>
        <span class="legend-link">Relation entre disciplines</span>
        <span class="legend-flow">Transfert de parcours · flux animé</span>
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
  const zoomReadout = container.querySelector("#atlas-zoom-readout");
  const backButton = container.querySelector('[data-atlas-action="back"]');
  if (!canvas || !stage || !loading || !selection) return () => {};

  const { nodes, edges, byId } = graph;
  const reduced = reducedMotion();
  let renderer = null;
  const lifecycle = createAtlasLifecycle();
  lifecycle.add(() => renderer?.destroy());
  let frame = 0;
  let width = 0;
  let height = 0;
  let hasInitialFit = false;
  let scale = 1;
  let targetScale = 1;
  let offset = { x: 0, y: 0 };
  let targetOffset = { x: 0, y: 0 };
  const navigation = createAtlasNavigation(nodes);
  let relationFilter = "all";

  const screen = (node) => atlasScreenPoint(node, { width, height, scale, offset });

  const draw = () => {
    if (!renderer || lifecycle.disposed) return;
    renderer.render({
      nodes,
      edges,
      selected: navigation.selected,
      scale,
      offset,
      width,
      height,
      reduced,
      relationFilter,
      lang: "fr",
      time: performance.now()
    });
  };

  const fitOverview = () => {
    const camera = fitAtlasCamera(nodes.filter((node) => node.level === 0 && node.entity_type === "DEPARTMENT"), width, height);
    if (!camera) return;
    targetScale = camera.scale;
    targetOffset = camera.offset;
  };

  const updateBreadcrumbs = () => {
    if (zoomReadout) zoomReadout.textContent = targetScale < 0.3 ? "Vue globale" : targetScale < 1.25 ? "Constellations" : targetScale < 3 ? "Sections" : "Modules";
    if (!navigation.selected) {
      breadcrumbs.textContent = "BA Labs Academy / Vue générale";
      return;
    }
    const path = getAtlasBreadcrumbPath(navigation.selected, byId);
    breadcrumbs.textContent = "BA Labs Academy / " + path.join(" / ");
  };

  const updateSelection = () => {
    updateBreadcrumbs();
    backButton.disabled = !navigation.canGoBack;
    container.querySelectorAll("[data-atlas-root]").forEach((button) => {
      const active = button.dataset.atlasRoot === navigation.selected?.id;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    selection.replaceChildren();
    if (!navigation.selected) {
      selection.hidden = true;
      return;
    }
    const body = document.createElement("div");
    body.className = "card-body";
    const heading = document.createElement("div");
    heading.className = "atlas-selection-heading";
    const type = document.createElement("span");
    type.className = "eyebrow";
    type.textContent = typeLabels[navigation.selected.entity_type] || "Nœud";
    const title = document.createElement("h3");
    title.textContent = navigation.selected.title;
    heading.append(type, title);
    body.append(heading);

    const description = document.createElement("p");
    description.textContent = navigation.selected.summary || "Fiche descriptive à compléter.";
    body.append(description);

    const branch = document.createElement("nav");
    branch.className = "atlas-branch-navigation";
    branch.setAttribute("aria-label", "Navigation dans la hiérarchie");
    const parentNode = navigation.selected.parent ? byId.get(navigation.selected.parent) : null;
    if (parentNode) {
      const up = document.createElement("button");
      up.type = "button";
      up.className = "atlas-branch-parent";
      up.textContent = "↑ Remonter vers " + parentNode.title;
      up.addEventListener("click", () => focusNode(parentNode));
      branch.append(up);
    }
    const children = nodes.filter((node) => node.parent === navigation.selected.id);
    if (children.length) {
      const branchTitle = document.createElement("strong");
      branchTitle.textContent = "Explorer cette branche · " + children.length;
      branch.append(branchTitle);
      const childList = document.createElement("div");
      childList.className = "atlas-branch-children";
      children.forEach((child) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "atlas-branch-child";
        item.textContent = child.title;
        item.addEventListener("click", () => focusNode(child));
        childList.append(item);
      });
      branch.append(childList);
    }
    if (parentNode || children.length) body.append(branch);

    if (navigation.selected.entity_type === "PATHWAY" && Array.isArray(navigation.selected.data.sectionCodes)) {
      const sections = document.createElement("div");
      sections.className = "atlas-selection-tags";
      navigation.selected.data.sectionCodes.forEach((code) => {
        const tag = document.createElement("span");
        tag.textContent = code;
        sections.append(tag);
      });
      body.append(sections);
      if (Array.isArray(navigation.selected.data.domainCodes) && navigation.selected.data.domainCodes.length) {
        const domaines = document.createElement("div");
        domaines.className = "atlas-selection-tags";
        navigation.selected.data.domainCodes.forEach((code) => {
          const tag = document.createElement("span");
          tag.textContent = "DOM · " + code;
          domaines.append(tag);
        });
        body.append(domaines);
      }
      const status = document.createElement("small");
      status.textContent = "Parcours cartographié · séquence et ressources à construire";
      body.append(status);
    } else if (navigation.selected.entity_type === "DOMAIN") {
      const status = document.createElement("small");
      status.textContent = "Domaine publié · rattaché à son département";
      body.append(status);
    } else if (navigation.selected.entity_type === "MODULE") {
      const status = document.createElement("small");
      status.textContent = "Module prévu · fiche pédagogique non rédigée";
      body.append(status);
    } else if (navigation.selected.entity_type === "DEPARTMENT" || navigation.selected.entity_type === "DOMAIN" || navigation.selected.entity_type === "SECTION") {
      const status = document.createElement("small");
      status.textContent = "Référentiel cartographié · publication éditoriale distincte";
      body.append(status);
    }

    if (navigation.selected.entity_type === "MODULE") {
      const relationEdges = edges.filter((edge) => edge.basis === "academy-knowledge-relation" && (edge.a.id === navigation.selected.id || edge.b.id === navigation.selected.id));
      const connections = document.createElement("section");
      connections.className = "atlas-knowledge-connections";
      const connectionTitle = document.createElement("strong");
      connectionTitle.textContent = "Connexions pédagogiques";
      connections.append(connectionTitle);
      if (!relationEdges.length) {
        const empty = document.createElement("small");
        empty.textContent = "Aucune relation inter-module validée pour le moment.";
        connections.append(empty);
      } else {
        relationEdges.forEach((edge) => {
          const isSource = edge.a.id === navigation.selected.id;
          const other = isSource ? edge.b : edge.a;
          const item = document.createElement("button");
          item.type = "button";
          item.className = "atlas-knowledge-connection";
          const relationLabel = document.createElement("small");
          relationLabel.textContent = edge.label + (isSource ? " · vers" : " · depuis");
          const relationName = document.createElement("span");
          relationName.textContent = other.title;
          item.append(relationLabel, relationName);
          item.addEventListener("click", () => focusNode(other));
          connections.append(item);
        });
      }
      body.append(connections);
    }
    if (navigation.selected.data.route) {
      const link = document.createElement("a");
      link.className = "atlas-selection-link";
      link.href = navigation.selected.data.route;
      link.textContent = "Ouvrir la fiche ↗";
      body.append(link);
    }
    selection.append(body);
    selection.hidden = false;
  };

  const renderAccessible = () => renderAtlasAccessibleNodes({
    nav: container.querySelector("#academy-atlas-accessible"),
    nodes,
    typeLabels,
    onSelect: focusNode
  });

  const focusNode = (node, zoomTo) => {
    if (!node) return;
    navigation.focus(node, { scale: targetScale, offset: { ...targetOffset } });
    const zoomLevel = zoomTo ?? (node.level === 0 ? 0.96 : node.level === 1 ? 2.15 : 4.1);
    targetScale = clamp(zoomLevel, 0.075, 12);
    targetOffset = { x: -node.x * targetScale, y: -node.y * targetScale };
    updateSelection();
    draw();
  };

  const zoom = (factor, x = width / 2, y = height / 2) => {
    const camera = zoomAtlasCamera({ scale: targetScale, offset: targetOffset, width, height }, factor, x, y);
    targetScale = camera.scale;
    targetOffset = camera.offset;
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
    if (lifecycle.disposed) return;
    const rect = stage.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (renderer) renderer.resize(width, height);
    // Fit the universe only on first mount. Subsequent resizes preserve the
    // current world-space focus instead of silently ejecting the user to overview.
    if (!hasInitialFit) {
      fitOverview();
      hasInitialFit = true;
    }
    scale = targetScale;
    offset = { ...targetOffset };
    draw();
  };

  const pointerController = createAtlasPointerController({
    canvas,
    getOffset: () => targetOffset,
    setOffset: (nextOffset) => {
      targetOffset = nextOffset;
      if (reduced) {
        offset = { ...targetOffset };
        draw();
      }
    },
    isReducedMotion: () => reduced,
    zoom,
    hit,
    focusNode
  });

  const onRootNavigation = (event) => {
    const button = event.target.closest("[data-atlas-root]");
    if (!button) return;
    const node = byId.get(button.dataset.atlasRoot);
    if (node) focusNode(node);
  };

  const onRelationFilter = (event) => {
    const button = event.target.closest("[data-atlas-relation]");
    if (!button) return;
    relationFilter = button.dataset.atlasRelation;
    container.querySelectorAll("[data-atlas-relation]").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    draw();
  };

  const onControls = (event) => {
    const button = event.target.closest("[data-atlas-action]");
    if (!button) return;
    const action = button.dataset.atlasAction;
    if (action === "in") zoom(1.24);
    else if (action === "out") zoom(0.81);
    else if (action === "back") {
      const previous = navigation.back();
      if (previous) {
        targetScale = previous.scale;
        targetOffset = { ...previous.offset };
        updateSelection();
        if (reduced) {
          scale = targetScale;
          offset = { ...targetOffset };
          draw();
        }
      }
    } else {
      navigation.reset();
      fitOverview();
      updateSelection();
      if (reduced) {
        scale = targetScale;
        offset = { ...targetOffset };
        draw();
      }
    }
  };

  lifecycle.listen(canvas, "pointerdown", pointerController.onPointerDown);
  lifecycle.listen(canvas, "pointermove", pointerController.onPointerMove);
  lifecycle.listen(canvas, "pointerup", pointerController.onPointerUp);
  lifecycle.listen(canvas, "pointercancel", pointerController.onPointerUp);
  lifecycle.listen(canvas, "wheel", onWheel, { passive: false });
  lifecycle.listen(container, "click", onControls);
  lifecycle.listen(container, "click", onRelationFilter);
  lifecycle.listen(container, "click", onRootNavigation);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    lifecycle.add(() => observer.disconnect());
  } else {
    lifecycle.listen(window, "resize", resize, { passive: true });
  }

  const animate = () => {
    if (lifecycle.disposed) return;
    if (!reduced) {
      const camera = interpolateAtlasCamera(
        { scale, offset },
        { scale: targetScale, offset: targetOffset },
        0.12
      );
      scale = camera.scale;
      offset = camera.offset;
      draw();
      frame = requestAnimationFrame(animate);
    }
  };

  createPixiRenderer(canvas).then((instance) => {
    if (lifecycle.disposed) {
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

  lifecycle.add(() => { if (frame) cancelAnimationFrame(frame); });
  return () => lifecycle.dispose();
}
