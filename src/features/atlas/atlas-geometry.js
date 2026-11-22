export const ATLAS_GEOMETRY = Object.freeze({
  departmentOrbitRadius: 1480,
  pathwayOrbitRadius: 2080,
  mycologyCoreAngle: -Math.PI / 2,
  childDistances: Object.freeze({ 1: 760, 2: 700 }),
  departmentPetalSpread: 1.95,
  sectionSpread: 3.4,
  minimumModuleGap: 0.98,
  maximumModuleSpread: 5.9
});

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Gives each department an angular sector proportional to its actual
 * hierarchy size. Large technical departments receive more room without
 * changing their taxonomy or inventing cross-discipline relationships.
 */
export function createAtlasDepartmentLayout(departments) {
  const entries = departments.map((department) => {
    const sections = department.sections || [];
    const moduleCount = sections.reduce((sum, section) => sum + (section.modules?.length || 0), 0);
    return {
      code: department.code,
      weight: Math.max(1, 1 + sections.length + moduleCount * 0.06)
    };
  });
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const unit = totalWeight ? TAU / totalWeight : 0;
  const firstWeight = entries[0]?.weight || 0;
  let cursor = 0;
  const angles = {};
  const spreads = {};
  const sectorWidths = {};

  for (const entry of entries) {
    const sectorWidth = entry.weight * unit;
    angles[entry.code] = ATLAS_GEOMETRY.mycologyCoreAngle +
      (cursor + (entry.weight - firstWeight) / 2) * unit;
    sectorWidths[entry.code] = sectorWidth;
    // Leave a deliberate guard band between adjacent branch fans.
    spreads[entry.code] = sectorWidth * 0.97;
    cursor += entry.weight;
  }

  return { angles, spreads, sectorWidths };
}

export function getAtlasNestedBranchSpread(parentSpread, siblingCount, fullRing = false) {
  if (siblingCount <= 1) return Math.min(2.6, Math.max(0.8, parentSpread));
  const siblingGap = fullRing
    ? parentSpread / siblingCount
    : parentSpread / (siblingCount - 1);
  return clamp(siblingGap * 0.88, 0.35, 2.6);
}

export function getAtlasRootPosition({
  kind, code, departmentCodes = [], pathwayCodes = [], departmentLayout = null
}) {
  if (kind === "department" && code === "MYC") {
    return { x: 0, y: 0, angle: ATLAS_GEOMETRY.mycologyCoreAngle };
  }

  const isDepartment = kind === "department";
  const codes = isDepartment ? departmentCodes : pathwayCodes;
  const index = codes.indexOf(code);
  const count = codes.length;
  if (index < 0 || count === 0) {
    throw new Error(`Unknown Atlas root position: ${kind}:${code}`);
  }

  const angle = isDepartment && departmentLayout?.angles?.[code] !== undefined
    ? departmentLayout.angles[code]
    : ATLAS_GEOMETRY.mycologyCoreAngle +
      (isDepartment ? index : index + 0.5) * TAU / count;
  const radius = isDepartment
    ? ATLAS_GEOMETRY.departmentOrbitRadius
    : ATLAS_GEOMETRY.pathwayOrbitRadius;

  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, angle };
}

export function getAtlasChildPosition({
  parent, index, count, depth, branchAngle,
  isMycologyCore = false, isDepartmentRoot = false, branchSpread
}) {
  const adaptiveModuleSpread = clamp(
    Math.max(ATLAS_GEOMETRY.sectionSpread, (count - 1) * ATLAS_GEOMETRY.minimumModuleGap),
    1.15,
    ATLAS_GEOMETRY.maximumModuleSpread
  );
  const spread = Number.isFinite(branchSpread)
    ? branchSpread
    : isMycologyCore
      ? TAU
      : isDepartmentRoot
        ? ATLAS_GEOMETRY.departmentPetalSpread
        : adaptiveModuleSpread;
  const distance = ATLAS_GEOMETRY.childDistances[depth] ??
    Math.max(58, 92 - depth * 4);
  const fraction = count <= 1 ? 0 : index / (count - 1) - 0.5;
  const angle = isMycologyCore
    ? branchAngle + (index / Math.max(1, count)) * spread
    : branchAngle + fraction * spread;

  return {
    x: parent.x + Math.cos(angle) * distance,
    y: parent.y + Math.sin(angle) * distance,
    angle
  };
}
