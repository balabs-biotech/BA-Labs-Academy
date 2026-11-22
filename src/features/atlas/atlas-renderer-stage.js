import { Container, Graphics, TextStyle } from "pixi.js";
import { PALETTE } from "./atlas-palette.js";

/**
 * Owns the Pixi display-list composition and the non-semantic Atlas backdrop.
 * The backdrop is deliberately separate from graph edges: rings and radial
 * guides establish spatial orientation without asserting knowledge relations.
 */
export function createAtlasRenderStage(app) {
  const field = new Graphics();
  const filaments = new Graphics();
  const junctions = new Graphics();
  const labels = new Container();
  app.stage.addChild(field, filaments, junctions, labels);

  const style = new TextStyle({
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 12,
    fill: 0xf2f1e9,
    fontWeight: "600",
    stroke: { color: 0x07100f, width: 4.5 },
    align: "center"
  });

  function drawBackdrop({ nodes, width, height }) {
    field.clear().rect(0, 0, width, height).fill({ color: 0x111b1d });
    field.circle(width * 0.5, height * 0.48, Math.max(width, height) * 0.78)
      .fill({ color: 0x172925, alpha: 0.22 });
    filaments.clear();
    // Concentric guides are spatial references, not graph relationships.
    filaments.circle(0, 0, 820).stroke({ color: 0x91a99b, alpha: 0.075, width: 2 });
    filaments.circle(0, 0, 1600).stroke({ color: 0x91a99b, alpha: 0.055, width: 2 });

    const roots = nodes.filter((node) =>
      node.level === 0 && node.entity_type === "DEPARTMENT" && node.entity_key !== "MYC"
    );
    for (const root of roots) {
      const angle = Math.atan2(root.y, root.x);
      const tangent = { x: -Math.sin(angle), y: Math.cos(angle) };
      const side = root.rootId.charCodeAt(0) % 2 ? 1 : -1;
      filaments.moveTo(0, 0)
        .bezierCurveTo(
          root.x * 0.32 + tangent.x * side * 34,
          root.y * 0.32 + tangent.y * side * 34,
          root.x * 0.72 - tangent.x * side * 22,
          root.y * 0.72 - tangent.y * side * 22,
          root.x,
          root.y
        )
        .stroke({
          color: PALETTE[root.rootId] || 0x91a99b,
          alpha: 0.16,
          width: 2.4,
          cap: "round"
        });
    }
  }

  return { field, filaments, junctions, labels, style, drawBackdrop };
}
