/**
 * Builds the keyboard-accessible node index for the visual Atlas.
 * DOM rendering is isolated from PixiJS and camera state.
 */
export function renderAtlasAccessibleNodes({ nav, nodes, typeLabels, onSelect }) {
  if (!nav) return 0;
  const documentRef = nav.ownerDocument || document;
  nav.replaceChildren();
  const fragment = documentRef.createDocumentFragment();
  for (const node of nodes) {
    const button = documentRef.createElement("button");
    button.type = "button";
    button.textContent = node.title;
    button.setAttribute("aria-label", node.title + " · " + (typeLabels[node.entity_type] || "Nœud"));
    button.addEventListener("click", () => onSelect(node));
    fragment.append(button);
  }
  nav.append(fragment);
  return nodes.length;
}
