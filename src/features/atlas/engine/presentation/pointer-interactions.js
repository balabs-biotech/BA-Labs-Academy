function pointFromEvent(element, event) {
  const rect = element.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Attach pointer, pinch and wheel gestures without coupling the camera to a renderer. */
export function attachAtlasPointerInteractions(element, camera, {
  onSelect = () => {},
  onChange = () => {},
  clickTolerance = 6,
  wheelSensitivity = 0.0015
} = {}) {
  if (!element || typeof element.addEventListener !== "function" ||
      typeof element.removeEventListener !== "function" ||
      typeof element.getBoundingClientRect !== "function") {
    throw new TypeError("Atlas interactions require an event target with a bounding rectangle");
  }
  if (!camera || typeof camera.panBy !== "function" ||
      typeof camera.zoomAt !== "function" || typeof camera.getSnapshot !== "function") {
    throw new TypeError("Atlas interactions require a compatible camera controller");
  }
  if (typeof onSelect !== "function" || typeof onChange !== "function") {
    throw new TypeError("Interaction callbacks must be functions");
  }
  if (!Number.isFinite(clickTolerance) || clickTolerance < 0) throw new RangeError("clickTolerance must be non-negative");
  if (!Number.isFinite(wheelSensitivity) || wheelSensitivity <= 0) throw new RangeError("wheelSensitivity must be positive");

  const pointers = new Map();
  const previousTouchAction = element.style?.touchAction;
  let gesture = null;
  let destroyed = false;

  const emitChange = () => onChange(camera.getSnapshot());

  function releaseCapture(pointerId) {
    try {
      if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
    } catch { /* Capture may already have been released by the browser. */ }
  }

  function cancelGesture() {
    const activeIds = [...pointers.keys()];
    pointers.clear();
    gesture = null;
    for (const pointerId of activeIds) releaseCapture(pointerId);
  }

  function onPointerDown(event) {
    if (destroyed || (event.button !== undefined && event.button !== 0 && event.pointerType !== "touch")) return;
    event.preventDefault?.();
    const point = pointFromEvent(element, event);
    const pointerId = event.pointerId ?? 1;
    pointers.set(pointerId, { start: point, last: point });
    if (!gesture) gesture = { multiTouch: false, cancelled: false };
    else gesture.multiTouch = true;

    if (pointers.size >= 2) {
      const [first, second] = [...pointers.values()].slice(0, 2);
      gesture.pinchDistance = Math.max(1e-6, distance(first.last, second.last));
      gesture.pinchCenter = midpoint(first.last, second.last);
    }
    try { element.setPointerCapture?.(pointerId); } catch { /* Some embedded surfaces do not support capture. */ }
  }

  function onPointerMove(event) {
    if (destroyed) return;
    const pointerId = event.pointerId ?? 1;
    const pointer = pointers.get(pointerId);
    if (!pointer) return;
    event.preventDefault?.();
    const nextPoint = pointFromEvent(element, event);

    if (pointers.size >= 2) {
      pointer.last = nextPoint;
      const [first, second] = [...pointers.values()].slice(0, 2);
      const nextDistance = Math.max(1e-6, distance(first.last, second.last));
      const nextCenter = midpoint(first.last, second.last);
      if (gesture.pinchDistance > 0) {
        camera.zoomAt(nextDistance / gesture.pinchDistance, gesture.pinchCenter);
        camera.panBy(nextCenter.x - gesture.pinchCenter.x, nextCenter.y - gesture.pinchCenter.y);
      }
      gesture.pinchDistance = nextDistance;
      gesture.pinchCenter = nextCenter;
    } else {
      const dx = nextPoint.x - pointer.last.x;
      const dy = nextPoint.y - pointer.last.y;
      pointer.last = nextPoint;
      camera.panBy(dx, dy);
    }

    pointer.moved = pointer.moved || distance(pointer.start, pointer.last) > clickTolerance;
    emitChange();
  }

  function onPointerUp(event) {
    if (destroyed) return;
    const pointerId = event.pointerId ?? 1;
    const pointer = pointers.get(pointerId);
    if (!pointer) return;
    const point = pointFromEvent(element, event);
    const isTap = pointers.size === 1 &&
      !gesture.multiTouch &&
      !gesture.cancelled &&
      !pointer.moved &&
      distance(pointer.start, point) <= clickTolerance;
    pointers.delete(pointerId);
    if (pointers.size === 0) gesture = null;
    releaseCapture(pointerId);
    if (isTap) onSelect(point, event);
  }

  function onPointerCancel() {
    if (destroyed || !gesture) return;
    gesture.cancelled = true;
    cancelGesture();
  }

  function onLostPointerCapture(event) {
    if (pointers.has(event.pointerId)) onPointerCancel();
  }

  function onWheel(event) {
    if (destroyed) return;
    event.preventDefault?.();
    const point = pointFromEvent(element, event);
    const factor = Math.exp(-event.deltaY * wheelSensitivity);
    camera.zoomAt(factor, point);
    emitChange();
  }

  if (element.style) element.style.touchAction = "none";
  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerup", onPointerUp);
  element.addEventListener("pointercancel", onPointerCancel);
  element.addEventListener("lostpointercapture", onLostPointerCapture);
  element.addEventListener("wheel", onWheel, { passive: false });

  return Object.freeze({
    cancel: cancelGesture,
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      cancelGesture();
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerCancel);
      element.removeEventListener("lostpointercapture", onLostPointerCapture);
      element.removeEventListener("wheel", onWheel);
      if (element.style) element.style.touchAction = previousTouchAction ?? "";
      return true;
    },
    get activePointerCount() { return pointers.size; }
  });
}
