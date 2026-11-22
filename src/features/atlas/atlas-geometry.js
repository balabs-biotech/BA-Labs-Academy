export const ATLAS_GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

export const ATLAS_GEOMETRY = Object.freeze({
  departmentOrbitRadius: 1480,
  pathwayOrbitRadius: 2080,
  mycologyCoreAngle: -Math.PI / 2,
  childDistances: Object.freeze({ 1: 760, 2: 760 / ATLAS_GOLDEN_RATIO }),
  departmentPetalSpread: 1.95,
  sectionSpread: 3.4,
  minimumModuleGap: 0.98,
  minimumTerminalModuleGap: 210,
  maximumModuleSpread: 5.9
});

const TAU = Math.PI * 2;
const GOLDEN_OCCUPANCY = 1 / ATLAS_GOLDEN_RATIO;
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

/**
 * Reserves a proportional angular sector for each intermediate branch.
 * Sections with more modules receive more room, preventing dense terminal
 * fans from being compressed into the same narrow wedge as small sections.
 */
export function createAtlasChildSectors(items, parentSpread, centerAngle = 0, fullRing = false) {
  if (!items?.length || !Number.isFinite(parentSpread) || parentSpread <= 0) return [];
  const weights = items.map((item) => Math.max(1, item.children?.length || 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = fullRing ? 0 : -parentSpread / 2;
  return items.map((item, index) => {
    const width = parentSpread * weights[index] / totalWeight;
    const sector = {
      angle: centerAngle + cursor + width / 2,
      spread: width * GOLDEN_OCCUPANCY
    };
    cursor += width;
    return sector;
  });
}

export function getAtlasGoldenConnectionProfile(length, depth = 1) {
  const safeLength = Math.max(0, Number(length) || 0);
  const safeDepth = Math.max(1, Number(depth) || 1);
  return {
    controlPointRatio: 1 / (ATLAS_GOLDEN_RATIO ** 2),
    bend: safeLength / (ATLAS_GOLDEN_RATIO ** 2),
    width: 1.5 / (ATLAS_GOLDEN_RATIO ** (safeDepth - 1))
  };
}

export function getAtlasNestedBranchSpread(parentSpread, siblingCount, fullRing = false) {
  if (siblingCount <= 1) return Math.min(2.6, Math.max(0.8, parentSpread));
  const siblingGap = fullRing
    ? parentSpread / siblingCount
    : parentSpread / (siblingCount - 1);
  return clamp(siblingGap / ATLAS_GOLDEN_RATIO, 0.35, 2.6);
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
  const inheritedSpread = Number.isFinite(branchSpread)
    ? branchSpread
    : isMycologyCore
      ? TAU
      : isDepartmentRoot
        ? ATLAS_GEOMETRY.departmentPetalSpread
        : adaptiveModuleSpread;
  const terminalDistance = ATLAS_GEOMETRY.childDistances[depth] ?? Math.max(58, 92 - depth * 4);
  const minimumTerminalStep = 2 * Math.asin(clamp(
    ATLAS_GEOMETRY.minimumTerminalModuleGap / (2 * terminalDistance), 0, 0.99
  ));
  const requiredTerminalSpread = count > 1 ? minimumTerminalStep * (count - 1) : 0;
  const spread = depth >= 2
    ? Math.min(ATLAS_GEOMETRY.maximumModuleSpread, Math.max(inheritedSpread, requiredTerminalSpread))
    : inheritedSpread;
  const distance = terminalDistance;
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
