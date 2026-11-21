/**
 * Pointer gesture controller for the Atlas camera.
 * Owns drag, pinch, tap selection and pointer-local state; rendering stays external.
 */
export function createAtlasPointerController({
  canvas,
  getOffset,
  setOffset,
  isReducedMotion,
  zoom,
  hit,
  focusNode
}) {
  const pointers = new Map();
  let gesture = null;
  let dragged = false;
  let lastPinchDistance = 0;
  let lastClick = null;

  const onPointerDown = (event) => {
    canvas.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragged = false;
    const offset = getOffset();
    gesture = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
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
        setOffset({ x: gesture.ox + dx, y: gesture.oy + dy });
      }
    } else if (pointers.size === 2) {
      const points = [...pointers.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (lastPinchDistance) {
        const rect = canvas.getBoundingClientRect();
        zoom(
          distance / lastPinchDistance,
          (points[0].x + points[1].x) / 2 - rect.left,
          (points[0].y + points[1].y) / 2 - rect.top
        );
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
      const offset = getOffset();
      gesture = { x: point.x, y: point.y, ox: offset.x, oy: offset.y };
      lastPinchDistance = 0;
      dragged = true;
    }
  };

  return { onPointerDown, onPointerMove, onPointerUp };
}
