import { createPixiRenderer } from "./pixi-renderer.js";
import { createAtlasRendererHost } from "./atlas-renderer-contract.js";
import { createAtlasNavigation, getAtlasBreadcrumbPath } from "./atlas-navigation.js";
import { atlasScreenPoint, fitAtlasCamera, getAtlasFocusScale, zoomAtlasCamera, interpolateAtlasCamera } from "./atlas-camera.js";
import { createAtlasLifecycle } from "./atlas-lifecycle.js";
import { createAtlasAnimation } from "./atlas-animation.js";
import { createAtlasPointerController } from "./atlas-interaction.js";
import { renderAtlasAccessibleNodes } from "./atlas-accessibility.js";
import { getAtlasLabelHitData } from "./atlas-labels.js";
import { renderAtlasSelectionPanel } from "./atlas-selection.js";
import { ATLAS_GEOMETRY, ATLAS_GOLDEN_RATIO } from "./atlas-geometry.js";

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
  const growthControls = graph.growthPreview
    ? `<div class="atlas-growth-preview-controls">
        <span class="eyebrow">STRUCTURE FRACTALE ACTIVE · ${graph.growthPreview.visibleNodes} NŒUDS VISIBLES</span>
        <span>${Number.isFinite(graph.growthPreview.depth)
          ? `Génération ${graph.growthPreview.depth} / ${graph.growthPreview.maxDepth}`
          : "Toutes les ramifications sont déployées"}</span>
        ${Array.from({ length: graph.growthPreview.maxDepth + 1 }, (_, depth) =>
          `<a class="text-link" href="?atlas-depth=${depth}#/atlas" aria-current="${depth === graph.growthPreview.depth ? "page" : "false"}">Génération ${depth}</a>`
        ).join("")}
        <a class="text-link" href="?atlas-growth=0#/atlas">Vue orbitale de référence</a>
      </div>`
    : `<div class="atlas-growth-preview-controls">
        <a class="text-link" href="?atlas-growth=1#/atlas">Activer la structure fractale</a>
      </div>`;
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
    <section class="academy-atlas" id="academy-atlas">
      <div class="atlas-topline">
        <div class="atlas-topline-copy">
          <span class="eyebrow">EXPLORATEUR 2D · PIXIJS / WEBGL</span>
          <strong>${departments} départements <i>·</i> ${domainSummary}${pathways} parcours <i>·</i> ${sections} sections <i>·</i> ${modules} modules</strong>
        </div>
        <span class="atlas-engine-state" id="atlas-engine-state">Initialisation du moteur…</span>
      </div>
      <div class="atlas-stage" id="academy-atlas-stage">
        <canvas id="academy-atlas-canvas" aria-label="Réseau de connaissances interactif BA Labs Academy"></canvas>
        <div class="atlas-stage-heading">
          <span class="eyebrow">CŒUR MYCOLOGIE · HUIT RAMIFICATIONS DISCIPLINAIRES</span>
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
      <div class="atlas-legend">
        <span class="legend-department">Département</span>
        ${domains ? '<span class="legend-domain">Domaine publié</span>' : ""}
        <span class="legend-pathway">Parcours transversal</span>
        <span class="legend-section">Section</span>
        <span class="legend-module">Module</span>
        <span class="legend-link">Relation entre disciplines</span>
        <span class="legend-flow">Transfert de parcours · flux animé</span>
      </div>
    </section>
    <section class="page-intro atlas-page-intro">
      <span class="eyebrow">BA LABS ACADEMY · CARTOGRAPHIE VIVANTE</span>
      <h1>Atlas des connaissances</h1>
      <p>La mycologie forme le cœur vivant de l’Atlas. Huit ramifications disciplinaires prolongent le symbole BA Labs ; leurs branches secondaires se subdivisent selon la structure réelle des connaissances.</p>
      ${growthControls}
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

  const { nodes, edges, morphologyBranches = [], byId } = graph;
  const childrenByParent = new Map();
  for (const node of nodes) {
    if (!node.parent) continue;
    if (!childrenByParent.has(node.parent)) childrenByParent.set(node.parent, []);
    childrenByParent.get(node.parent).push(node);
  }
  const reduced = reducedMotion();
  let renderer = null;
  const lifecycle = createAtlasLifecycle();
  const rendererHost = createAtlasRendererHost({ backendFactory: createPixiRenderer, canvas });
  lifecycle.add(() => rendererHost.dispose());
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
      morphologyBranches,
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

  const hasVisibleAnimatedTransfers = () => edges.some((edge) => {
    const knowledge = edge.basis === "academy-knowledge-relation";
    if (!knowledge && edge.basis !== "academy-pathway-flow") return false;
    if ((edge.a.entity_type === "PATHWAY" || edge.b.entity_type === "PATHWAY") &&
        navigation.selected?.entity_type !== "PATHWAY") return false;
    if (knowledge && relationFilter !== "all" && edge.relation_type !== relationFilter) return false;
    const depth = Math.max(edge.a.level, edge.b.level);
    const thresholds = [0, 0.10, 0.16, 0.24, 0.4, 0.7, 1.1];
    const threshold = thresholds[Math.min(depth, thresholds.length - 1)];
    let alpha = depth === 0 ? 1 : clamp((scale - threshold * 0.72) / (threshold * 0.42), 0, 1);
    if (knowledge) alpha *= clamp((scale - 0.12) / 0.55, 0, 1);
    return alpha > 0.2;
  });

  const animation = createAtlasAnimation({
    enabled: !reduced,
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (frameId) => cancelAnimationFrame(frameId),
    onFrame: () => {
      const camera = interpolateAtlasCamera(
        { scale, offset },
        { scale: targetScale, offset: targetOffset },
        0.12
      );
      const settled = Math.abs(camera.scale - targetScale) < 0.0005 &&
        Math.abs(camera.offset.x - targetOffset.x) < 0.05 &&
        Math.abs(camera.offset.y - targetOffset.y) < 0.05;
      scale = settled ? targetScale : camera.scale;
      offset = settled ? { ...targetOffset } : camera.offset;
      draw();
      return !settled || hasVisibleAnimatedTransfers();
    }
  });
  lifecycle.add(() => animation.dispose());

  const fitOverview = () => {
    // Frame the eight disciplinary anchors together with their first fractal
    // generation. Fitting only department roots clips the actual morphology
    // trunks at overview scale; deeper taxonomy remains available by zoom.
    const overviewAnchors = nodes.filter((node) =>
      node.entity_type === "DEPARTMENT" || (node.level === 1 && node.entity_type !== "PATHWAY")
    );
    const camera = fitAtlasCamera(overviewAnchors, width, height);
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
    renderAtlasSelectionPanel({
      selection,
      selected: navigation.selected,
      nodes,
      byId,
      edges,
      focusNode,
      typeLabels
    });
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
    const hasChildren = (childrenByParent.get(node.id)?.length || 0) > 0;
    const branchDistance = (ATLAS_GEOMETRY.childDistances[1] || 760) /
      (ATLAS_GOLDEN_RATIO ** Math.max(0, node.level || 0)) *
      (node.rootId === "myc" ? 0.28 : 1);
    const zoomLevel = zoomTo ?? (hasChildren
      ? getAtlasFocusScale(branchDistance, width, height)
      : 4.1);
    targetScale = clamp(zoomLevel, 0.075, 12);
    targetOffset = { x: -node.x * targetScale, y: -node.y * targetScale };
    updateSelection();
    draw();
    animation.start();
  };

  const zoom = (factor, x = width / 2, y = height / 2) => {
    const camera = zoomAtlasCamera({ scale: targetScale, offset: targetOffset, width, height }, factor, x, y);
    targetScale = camera.scale;
    targetOffset = camera.offset;
    if (reduced) {
      scale = targetScale;
      offset = { ...targetOffset };
      draw();
    } else {
      animation.start();
    }
  };

  const onWheel = (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    zoom(event.deltaY < 0 ? 1.16 : 0.86, event.clientX - rect.left, event.clientY - rect.top);
  };

  const hit = (x, y) => {
    const { visibleNodes, hitBoxes: boxes } = getAtlasLabelHitData(canvas);
    let labelHit = null;
    let labelArea = Infinity;
    for (const candidate of visibleNodes) {
      const node = candidate.n;
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
    for (const candidate of visibleNodes) {
      const node = candidate.n;
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
      } else {
        animation.start();
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
    animation.start();
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
        } else {
          animation.start();
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
      } else {
        animation.start();
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

  // Keep the semantic navigation available even when Pixi/WebGL cannot start.
  renderAccessible();

  rendererHost.initialize().then(() => {
    if (lifecycle.disposed) return;
    renderer = rendererHost;
    resize();
    updateSelection();
    engineState.textContent = "Moteur actif · WebGL 2D";
    loading.hidden = true;
    animation.start();
  }).catch((error) => {
    console.error("Academy PixiJS Atlas initialization failed", error);
    engineState.textContent = "Moteur indisponible";
    loading.querySelector("p").textContent = "Le moteur graphique n’a pas pu démarrer. La navigation textuelle reste disponible ci-dessous.";
    loading.classList.add("is-error");
  });

  return () => lifecycle.dispose();
}
