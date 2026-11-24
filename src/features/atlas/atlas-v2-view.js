import { mountAcademyAtlasV2 } from "./adapters/mount-academy-atlas-v2.js";

const escapeText = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

export function renderAcademyAtlasV2(graph) {
  const { departments, domains, pathways, sections, modules } = graph.stats;
  const roots = graph.nodes.filter((node) => node.level === 0);
  const departmentRoots = roots.filter((node) => node.entity_type === "DEPARTMENT");
  const pathwayRoots = roots.filter((node) => node.entity_type === "PATHWAY");
  const rootChips = (items, label, kind) => `
    <div class="atlas-root-group atlas-root-group--${kind}">
      <span class="atlas-root-label">${label}</span>
      <div class="atlas-root-items">${items.map((node) => `
        <button type="button" class="atlas-root-chip" data-v2-focus="${escapeText(node.id)}">
          <small>${escapeText(node.entity_key)}</small><span>${escapeText(node.title)}</span>
        </button>`).join("")}</div>
    </div>`;
  return `
    <section class="academy-atlas academy-atlas-v2" id="academy-atlas">
      <div class="atlas-topline">
        <div class="atlas-topline-copy">
          <span class="eyebrow">BA LABS ACADEMY · MOTEUR MYCÉLIEN 2D</span>
          <strong>${departments} départements · ${domains} domaines · ${pathways} parcours · ${sections} sections · ${modules} modules</strong>
        </div>
        <span class="atlas-engine-state" id="atlas-v2-state">Initialisation du moteur V2…</span>
      </div>
      <div class="atlas-stage" id="academy-atlas-v2-stage">
        <canvas id="academy-atlas-v2-canvas" aria-label="Réseau mycélien interactif des connaissances de BA Labs Academy"></canvas>
        <div class="atlas-stage-heading">
          <span class="eyebrow">RÉSEAU RHIZOMORPHIQUE · MORPHOGENÈSE V2</span>
          <p>Branches primaires, hyphes secondaires et anastomoses · Déplacer et zoomer pour explorer</p>
        </div>
        <nav class="atlas-controls" aria-label="Contrôles du réseau">
          <button type="button" class="btn btn-square btn-sm" data-v2-action="in" aria-label="Zoom avant">＋</button>
          <button type="button" class="btn btn-square btn-sm" data-v2-action="out" aria-label="Zoom arrière">−</button>
          <button type="button" class="btn btn-square btn-sm" data-v2-action="fit" aria-label="Vue générale">⌖</button>
        </nav>
        <div class="atlas-breadcrumbs" id="atlas-v2-status" aria-live="polite">BA Labs Academy · Vue générale</div>
        <aside class="atlas-selection card" id="atlas-v2-selection" aria-live="polite" hidden></aside>
        <div class="atlas-loading" id="atlas-v2-loading"><span class="atlas-loading-pulse"></span><p>Construction du réseau mycélien…</p></div>
      </div>
      <nav class="atlas-root-navigation" aria-label="Accès direct aux territoires">
        ${rootChips(departmentRoots, "DÉPARTEMENTS", "departments")}
        ${rootChips(pathwayRoots, "PARCOURS", "pathways")}
      </nav>
      <div class="atlas-legend">
        <span class="legend-department">Cordons principaux</span>
        <span class="legend-section">Hyphes secondaires</span>
        <span class="legend-pathway">Anastomoses</span>
        <span class="legend-link">Relations pédagogiques</span>
      </div>
    </section>
    <section class="page-intro atlas-page-intro">
      <span class="eyebrow">BA LABS ACADEMY · CARTOGRAPHIE VIVANTE</span>
      <h1>Réseau des connaissances</h1>
      <p>Une morphologie mycélienne unique organise les disciplines, domaines, sections, modules et parcours. Les liens pédagogiques restent distincts des connexions biologiques décoratives.</p>
    </section>`;
}

export async function mountAcademyAtlasV2View(container, graph) {
  const canvas = container.querySelector("#academy-atlas-v2-canvas");
  const state = container.querySelector("#atlas-v2-state");
  const status = container.querySelector("#atlas-v2-status");
  const selection = container.querySelector("#atlas-v2-selection");
  const loading = container.querySelector("#atlas-v2-loading");
  if (!canvas || !state || !status || !selection || !loading) return () => {};
  let mounted = null;
  let destroyed = false;
  const byId = graph.byId;
  const showSelection = (node) => {
    if (!node) return;
    const source = byId.get(node.id);
    const title = source?.title || node.label;
    const type = source?.entity_type || "Élément";
    status.textContent = "BA Labs Academy · " + title;
    selection.hidden = false;
    selection.innerHTML = `
      <div class="card-body">
        <div class="atlas-selection-heading"><span class="eyebrow">${escapeText(type)} · ${escapeText(source?.entity_key || node.id)}</span><h3>${escapeText(title)}</h3></div>
        <p>${escapeText(source?.summary || source?.data?.summary || "Nœud de la cartographie pédagogique BA Labs Academy.")}</p>
        ${source?.data?.route ? `<a class="atlas-selection-link" href="${escapeText(source.data.route)}">Ouvrir la fiche ↗</a>` : ""}
      </div>`;
    if (mounted) {
      const camera = mounted.camera;
      const point = camera.worldToScreen({ x: node.x, y: node.y });
      const viewport = camera.getSnapshot().viewport;
      camera.panBy(viewport.width / 2 - point.x, viewport.height / 2 - point.y);
      mounted.render();
    }
  };
  try {
    mounted = await mountAcademyAtlasV2({
      canvas,
      graph,
      compositionOptions: {
        seed: "ba-labs-academy-main-v2",
        universeRadius: 760,
        pathwayOrbitRadius: 1320,
        morphologyOptions: { maximumSecondaryHyphae: 420, coreBranchLength: 180, universeSpread: 0.62, branchSpread: 0.95, curveBend: 0.14, minimumAngularGap: 0.10 }
      },
      cameraOptions: {
        minScale: 0.035,
        maxScale: 3.5,
        fitPadding: window.innerWidth < 700 ? 0.14 : 0.11,
        minVisibleRatio: 0.08
      },
      onSelect: showSelection,
      onError: (error) => {
        state.textContent = "Moteur V2 indisponible";
        loading.classList.add("is-error");
        loading.querySelector("p").textContent = "Le rendu biologique n’a pas pu démarrer. " + (error?.message || "");
      }
    });
    if (destroyed) { mounted.destroy(); return () => {}; }
    loading.hidden = true;
    state.textContent = "Moteur mycélien V2 actif · " + mounted.composition.metrics.renderedNodeCount + " nœuds · " + mounted.composition.metrics.visualOnlyPathCount + " structures biologiques";
    status.textContent = "BA Labs Academy · Vue générale";
    const onControls = (event) => {
      const action = event.target.closest("[data-v2-action]")?.dataset.v2Action;
      if (!action) return;
      const camera = mounted.camera;
      const viewport = camera.getSnapshot().viewport;
      if (action === "in") camera.zoomAt(1.25, { x: viewport.width / 2, y: viewport.height / 2 });
      else if (action === "out") camera.zoomAt(0.8, { x: viewport.width / 2, y: viewport.height / 2 });
      else camera.fit();
      mounted.render();
    };
    const onRoot = (event) => {
      const id = event.target.closest("[data-v2-focus]")?.dataset.v2Focus;
      if (!id) return;
      const node = mounted.scene.nodes.find((item) => item.id === id);
      if (node) showSelection(node);
    };
    container.addEventListener("click", onControls);
    container.addEventListener("click", onRoot);
    return () => {
      destroyed = true;
      container.removeEventListener("click", onControls);
      container.removeEventListener("click", onRoot);
      mounted?.destroy();
    };
  } catch (error) {
    state.textContent = "Erreur d’initialisation V2";
    loading.classList.add("is-error");
    loading.querySelector("p").textContent = error?.message || "Initialisation impossible.";
    console.error("[Academy Atlas V2]", error);
    return () => { destroyed = true; mounted?.destroy(); };
  }
}
