export function createAtlasNavigation(nodes, maxHistory = 80) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let selected = null;
  const history = [];
  return {
    get selected() { return selected; },
    get canGoBack() { return history.length > 0; },
    focus(node, viewState) {
      if (!node || !byId.has(node.id)) return false;
      if (selected?.id !== node.id) {
        history.push({ ...viewState, selected });
        if (history.length > maxHistory) history.shift();
      }
      selected = node;
      return true;
    },
    back() {
      const previous = history.pop();
      if (!previous) return null;
      selected = previous.selected || null;
      return previous;
    },
    reset() { selected = null; history.length = 0; }
  };
}
