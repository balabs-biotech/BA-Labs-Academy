/**
 * Renders the Atlas inspector for the currently selected knowledge node.
 * Keeps DOM composition and pedagogical status labels outside the camera controller.
 */
export function renderAtlasSelectionPanel({ selection, selected, nodes, byId, edges, focusNode, typeLabels }) {
  selection.replaceChildren();
  if (!selected) {
    selection.hidden = true;
    return;
  }
      const body = document.createElement("div");
      body.className = "card-body";
      const heading = document.createElement("div");
      heading.className = "atlas-selection-heading";
      const type = document.createElement("span");
      type.className = "eyebrow";
      type.textContent = typeLabels[selected.entity_type] || "Nœud";
      const title = document.createElement("h3");
      title.textContent = selected.title;
      heading.append(type, title);
      body.append(heading);
  
      const description = document.createElement("p");
      description.textContent = selected.summary || "Fiche descriptive à compléter.";
      body.append(description);
  
      const branch = document.createElement("nav");
      branch.className = "atlas-branch-navigation";
      branch.setAttribute("aria-label", "Navigation dans la hiérarchie");
      const parentNode = selected.parent ? byId.get(selected.parent) : null;
      if (parentNode) {
        const up = document.createElement("button");
        up.type = "button";
        up.className = "atlas-branch-parent";
        up.textContent = "↑ Remonter vers " + parentNode.title;
        up.addEventListener("click", () => focusNode(parentNode));
        branch.append(up);
      }
      const children = nodes.filter((node) => node.parent === selected.id);
      if (children.length) {
        const branchTitle = document.createElement("strong");
        branchTitle.textContent = "Explorer cette branche · " + children.length;
        branch.append(branchTitle);
        const childList = document.createElement("div");
        childList.className = "atlas-branch-children";
        children.forEach((child) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = "atlas-branch-child";
          item.textContent = child.title;
          item.addEventListener("click", () => focusNode(child));
          childList.append(item);
        });
        branch.append(childList);
      }
      if (parentNode || children.length) body.append(branch);
  
      if (selected.entity_type === "PATHWAY" && Array.isArray(selected.data.sectionCodes)) {
        const sections = document.createElement("div");
        sections.className = "atlas-selection-tags";
        selected.data.sectionCodes.forEach((code) => {
          const tag = document.createElement("span");
          tag.textContent = code;
          sections.append(tag);
        });
        body.append(sections);
        if (Array.isArray(selected.data.domainCodes) && selected.data.domainCodes.length) {
          const domaines = document.createElement("div");
          domaines.className = "atlas-selection-tags";
          selected.data.domainCodes.forEach((code) => {
            const tag = document.createElement("span");
            tag.textContent = "DOM · " + code;
            domaines.append(tag);
          });
          body.append(domaines);
        }
        const status = document.createElement("small");
        status.textContent = "Parcours cartographié · séquence et ressources à construire";
        body.append(status);
      } else if (selected.entity_type === "DOMAIN") {
        const status = document.createElement("small");
        status.textContent = "Domaine publié · rattaché à son département";
        body.append(status);
      } else if (selected.entity_type === "MODULE") {
        const status = document.createElement("small");
        status.textContent = "Module prévu · fiche pédagogique non rédigée";
        body.append(status);
      } else if (selected.entity_type === "DEPARTMENT" || selected.entity_type === "DOMAIN" || selected.entity_type === "SECTION") {
        const status = document.createElement("small");
        status.textContent = "Référentiel cartographié · publication éditoriale distincte";
        body.append(status);
      }
  
      if (selected.entity_type === "MODULE") {
        const relationEdges = edges.filter((edge) => edge.basis === "academy-knowledge-relation" && (edge.a.id === selected.id || edge.b.id === selected.id));
        const connections = document.createElement("section");
        connections.className = "atlas-knowledge-connections";
        const connectionTitle = document.createElement("strong");
        connectionTitle.textContent = "Connexions pédagogiques";
        connections.append(connectionTitle);
        if (!relationEdges.length) {
          const empty = document.createElement("small");
          empty.textContent = "Aucune relation inter-module validée pour le moment.";
          connections.append(empty);
        } else {
          relationEdges.forEach((edge) => {
            const isSource = edge.a.id === selected.id;
            const other = isSource ? edge.b : edge.a;
            const item = document.createElement("button");
            item.type = "button";
            item.className = "atlas-knowledge-connection";
            const relationLabel = document.createElement("small");
            relationLabel.textContent = edge.label + (isSource ? " · vers" : " · depuis");
            const relationName = document.createElement("span");
            relationName.textContent = other.title;
            item.append(relationLabel, relationName);
            item.addEventListener("click", () => focusNode(other));
            connections.append(item);
          });
        }
        body.append(connections);
      }
      if (selected.data.route) {
        const link = document.createElement("a");
        link.className = "atlas-selection-link";
        link.href = selected.data.route;
        link.textContent = "Ouvrir la fiche ↗";
        body.append(link);
      }
  selection.append(body);
  selection.hidden = false;
}
