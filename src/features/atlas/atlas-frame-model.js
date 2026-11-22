import { createAtlasRenderContext } from "./atlas-render-context.js";

/**
 * Prepares immutable-in-contract frame data without depending on a drawing
 * backend. The renderer receives selection sets and a world-to-screen transform.
 */
export function createAtlasFrameModel({ renderContextFactory = createAtlasRenderContext } = {}) {
  let contextNodes = null;
  let renderContext = null;

  function prepare(frame) {
    const { nodes, selected, scale, offset, width, height } = frame;
    if (contextNodes !== nodes) {
      contextNodes = nodes;
      renderContext = renderContextFactory(nodes);
    }
    const { lineage, activeBranch } = renderContext.resolveSelection(selected);
    return {
      ...frame,
      lineage,
      activeBranch,
      transform: {
        x: width / 2 + offset.x,
        y: height / 2 + offset.y,
        scale
      }
    };
  }

  function reset() {
    contextNodes = null;
    renderContext = null;
  }

  return { prepare, reset };
}
