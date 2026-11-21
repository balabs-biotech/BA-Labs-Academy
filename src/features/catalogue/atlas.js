export function buildCatalogueAtlas(catalogueMap, focusSectionCode = null) {
  if (focusSectionCode) {
    const section = catalogueMap.flatMap((department) =>
      department.sections.map((item) => ({ ...item, department }))
    ).find((item) => item.code === focusSectionCode);
    if (!section) return buildCatalogueAtlas(catalogueMap);
    const nodes = [{
      id: "catalogue-section-" + section.code,
      node_key: section.code,
      entity_type: "SECTION",
      entity_key: section.code,
      title: section.title,
      title_override: section.title,
      summary: section.description,
      position_x: 0.5,
      position_y: 0.5,
      layout_version: 1
    }];
    const edges = [];
    const count = section.modules.length;
    section.modules.forEach((module, index) => {
      const angle = (index / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
      const moduleId = "catalogue-module-" + section.code + "-" + (index + 1);
      nodes.push({
        id: moduleId,
        node_key: section.code + "-" + String(index + 1).padStart(2, "0"),
        entity_type: "MODULE",
        entity_key: section.code + "-" + String(index + 1).padStart(2, "0"),
        title: module,
        title_override: module,
        summary: "Module prévu dans " + section.title + ". Fiche pédagogique à développer.",
        position_x: Math.max(0.08, Math.min(0.92, 0.5 + Math.cos(angle) * 0.34)),
        position_y: Math.max(0.08, Math.min(0.92, 0.5 + Math.sin(angle) * 0.34)),
        layout_version: 1
      });
      edges.push({
        id: "catalogue-module-edge-" + section.code + "-" + (index + 1),
        source_node_id: "catalogue-section-" + section.code,
        target_node_id: moduleId,
        relation_type: "CONTAINS",
        rationale: section.description
      });
    });
    return { nodes, edges, focus: { department: section.department, section } };
  }

  const nodes = [];
  const edges = [];
  const columns = [0.17, 0.5, 0.83];
  const rows = [0.17, 0.5, 0.83];
  catalogueMap.forEach((department, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const centerX = columns[column];
    const centerY = rows[row];
    const departmentId = "catalogue-department-" + department.code;
    nodes.push({
      id: departmentId,
      node_key: department.code,
      entity_type: "DEPARTMENT",
      entity_key: department.code,
      title: department.title,
      title_override: department.title,
      summary: department.description,
      position_x: centerX,
      position_y: centerY,
      layout_version: 1
    });
    const count = department.sections.length;
    department.sections.forEach((section, sectionIndex) => {
      const angle = (sectionIndex / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
      const sectionId = "catalogue-section-" + section.code;
      nodes.push({
        id: sectionId,
        node_key: section.code,
        entity_type: "SECTION",
        entity_key: section.code,
        title: section.title,
        title_override: section.title,
        summary: section.description,
        position_x: Math.max(0.04, Math.min(0.96, centerX + Math.cos(angle) * 0.105)),
        position_y: Math.max(0.04, Math.min(0.96, centerY + Math.sin(angle) * 0.105)),
        layout_version: 1
      });
      edges.push({
        id: "catalogue-edge-" + section.code,
        source_node_id: departmentId,
        target_node_id: sectionId,
        relation_type: "CONTAINS",
        rationale: section.description
      });
    });
  });
  return { nodes, edges, focus: null };
}