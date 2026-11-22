import { createAtlasFrameModel } from "./atlas-frame-model.js";

/** PixiJS-specific frame adapter. It translates a neutral frame plan into Pixi display-list operations. */
export function createAtlasPixiFrameRenderer({
  stage, canvas, labelPool, labelResources, createLabel, connections, nodesLayer, labelsLayer,
  frameModel = createAtlasFrameModel()
}) {
  function render(frame, backendRender) {
    const plan = frameModel.prepare(frame);
    const {
      nodes, edges, morphologyBranches = [], selected, scale, reduced, relationFilter = "all",
      lang = "fr", time = 0, alphaFor, lineage, activeBranch, transform
    } = plan;

    stage.drawBackdrop({ nodes, width: plan.width, height: plan.height });
    stage.junctions.clear();

    connections({
      filaments: stage.filaments, junctions: stage.junctions, edges, morphologyBranches, selected,
      scale, reduced, relationFilter, time, alphaFor, activeBranch
    });
    nodesLayer({
      junctions: stage.junctions, nodes, selected, scale, alphaFor,
      activeBranch, lineage
    });

    stage.filaments.position.set(transform.x, transform.y);
    stage.filaments.scale.set(transform.scale);
    stage.junctions.position.set(transform.x, transform.y);
    stage.junctions.scale.set(transform.scale);

    labelsLayer({
      canvas, labels: stage.labels, labelPool, labelResources, style: stage.style, createLabel,
      nodes, selected, scale, offset: plan.offset, width: plan.width, height: plan.height,
      alphaFor, activeBranch, lineage, lang
    });
    backendRender();
  }

  return {
    render,
    reset() {
      frameModel.reset();
      labelResources?.clear();
    }
  };
}
