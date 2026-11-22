/**
 * Pre-indexes the immutable Academy hierarchy for renderer selection context.
 * Descendant and ancestor sets are recomputed only when the selected node changes,
 * not on every animation frame.
 */
export function createAtlasRenderContext(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map();
  for (const node of nodes) {
    if (!node.parent) continue;
    if (!childrenByParent.has(node.parent)) childrenByParent.set(node.parent, []);
    childrenByParent.get(node.parent).push(node);
  }

  let cachedSelectionId = Symbol("uninitialized");
  let cachedContext = null;

  function resolveSelection(selected) {
    const selectionId = selected?.id ?? null;
    if (selectionId === cachedSelectionId) return cachedContext;
    cachedSelectionId = selectionId;

    const lineage = new Set();
    const activeBranch = new Set();
    if (selected && byId.has(selectionId)) {
      let ancestor = byId.get(selectionId);
      while (ancestor && !lineage.has(ancestor.id)) {
        lineage.add(ancestor.id);
        ancestor = ancestor.parent ? byId.get(ancestor.parent) : null;
      }

      const queue = [selectionId];
      while (queue.length) {
        const parentId = queue.shift();
        if (activeBranch.has(parentId)) continue;
        activeBranch.add(parentId);
        for (const child of childrenByParent.get(parentId) || []) {
          if (!activeBranch.has(child.id)) queue.push(child.id);
        }
      }
    }

    cachedContext = { lineage, activeBranch };
    return cachedContext;
  }

  return { byId, childrenByParent, resolveSelection };
}
