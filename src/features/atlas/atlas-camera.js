const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function atlasScreenPoint(node, camera) {
  return {
    x: camera.width / 2 + camera.offset.x + node.x * camera.scale,
    y: camera.height / 2 + camera.offset.y + node.y * camera.scale
  };
}

export function fitAtlasCamera(roots, width, height) {
  if (!roots?.length || !width || !height) return null;
  const xs = roots.map((node) => node.x);
  const ys = roots.map((node) => node.y);
  const mobile = width < 700;
  const padX = mobile ? 26 : Math.min(150, Math.max(72, width * 0.11));
  const padY = mobile ? 42 : Math.min(125, Math.max(70, height * 0.13));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX + 230;
  const spanY = maxY - minY + 220;
  const scale = clamp(Math.min((width - padX * 2) / spanX, (height - padY * 2) / spanY), 0.075, 0.82);
  return {
    scale,
    offset: { x: -((minX + maxX) / 2) * scale, y: -((minY + maxY) / 2) * scale }
  };
}

export function getAtlasFocusScale(branchDistance, width, height, fillRatio = 0.34) {
  if (!Number.isFinite(branchDistance) || branchDistance <= 0) return 12;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0.075;
  return clamp(Math.min(width, height) * fillRatio / branchDistance, 0.075, 12);
}

export function zoomAtlasCamera(camera, factor, x = camera.width / 2, y = camera.height / 2) {
  const scale = clamp(camera.scale * factor, 0.075, 12);
  const ratio = scale / camera.scale;
  return {
    scale,
    offset: {
      x: (x - camera.width / 2) - (x - camera.width / 2 - camera.offset.x) * ratio,
      y: (y - camera.height / 2) - (y - camera.height / 2 - camera.offset.y) * ratio
    }
  };
}

export function interpolateAtlasCamera(current, target, alpha = 0.12) {
  const amount = clamp(alpha, 0, 1);
  return {
    scale: current.scale + (target.scale - current.scale) * amount,
    offset: {
      x: current.offset.x + (target.offset.x - current.offset.x) * amount,
      y: current.offset.y + (target.offset.y - current.offset.y) * amount
    }
  };
}
