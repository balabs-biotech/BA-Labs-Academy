import { createAtlasRenderContext } from "./atlas-render-context.js";

/** Backend-neutral frame orchestration; drawing remains the adapter's responsibility. */
export function createAtlasFramePipeline({
  stage, canvas, labelPool, createLabel, connections, nodesLayer, labelsLayer,
  renderContextFactory = createAtlasRenderContext
}) {
  let contextNodes = null;
  let renderContext = null;

  function render(frame, backendRender) {
    const {
      nodes, edges, selected, scale, offset, width, height, reduced,
      relationFilter = "all", lang = "fr", time = performance.now(), alphaFor
    } = frame;

    if (contextNodes !== nodes) {
      contextNodes = nodes;
      renderContext = renderContextFactory(nodes);
    }

    stage.drawBackdrop({ nodes, width, height });
    stage.junctions.clear();
    const { lineage, activeBranch } = renderContext.resolveSelection(selected);

    connections({
      filaments: stage.filaments, junctions: stage.junctions, edges, selected,
      scale, reduced, relationFilter, time, alphaFor, activeBranch
    });
    nodesLayer({
      junctions: stage.junctions, nodes, selected, scale, alphaFor,
      activeBranch, lineage
    });

    stage.filaments.position.set(width / 2 + offset.x, height / 2 + offset.y);
    stage.filaments.scale.set(scale);
    stage.junctions.position.set(width / 2 + offset.x, height / 2 + offset.y);
    stage.junctions.scale.set(scale);

    labelsLayer({
      canvas, labels: stage.labels, labelPool, style: stage.style, createLabel,
      nodes, selected, scale, offset, width, height, alphaFor, activeBranch, lineage, lang
    });
    backendRender();
  }

  return {
    render,
    reset() {
      contextNodes = null;
      renderContext = null;
    }
  };
}
