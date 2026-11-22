/**
 * Owns the Pixi display-list composition and the non-semantic Atlas backdrop.
 * Only concentric spatial guides live here; the eight organic trunks are
 * rendered by the dedicated morphology layer, not as backdrop decoration.
 */
export function createAtlasRenderStage(app, pixi) {
  const { Graphics: LayerGraphics, Container: LayerContainer, TextStyle: LayerTextStyle } = pixi || {};
  if (!LayerGraphics || !LayerContainer || !LayerTextStyle) throw new TypeError("Pixi layer constructors are required");
  const field = new LayerGraphics();
  const filaments = new LayerGraphics();
  const junctions = new LayerGraphics();
  const labels = new LayerContainer();
  app.stage.addChild(field, filaments, junctions, labels);

  const style = new LayerTextStyle({
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: 12,
    fill: 0xf2f1e9,
    fontWeight: "600",
    stroke: { color: 0x07100f, width: 4.5 },
    align: "center"
  });

  function drawBackdrop({ width, height }) {
    field.clear().rect(0, 0, width, height).fill({ color: 0x111b1d });
    field.circle(width * 0.5, height * 0.48, Math.max(width, height) * 0.78)
      .fill({ color: 0x172925, alpha: 0.22 });
    filaments.clear();
    // Concentric guides are spatial references, not graph relationships.
    filaments.circle(0, 0, 820).stroke({ color: 0x91a99b, alpha: 0.075, width: 2 });
    filaments.circle(0, 0, 1600).stroke({ color: 0x91a99b, alpha: 0.055, width: 2 });

  }

  return { field, filaments, junctions, labels, style, drawBackdrop };
}
