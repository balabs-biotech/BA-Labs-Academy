export const ATLAS_GEOMETRY = Object.freeze({
  departmentOrbitRadius: 1260,
  pathwayOrbitRadius: 1760,
  mycologyCoreAngle: -Math.PI / 2,
  childDistances: Object.freeze({ 1: 300, 2: 245 }),
  departmentPetalSpread: 0.96,
  sectionSpread: 1.38
});

const TAU = Math.PI * 2;

export function getAtlasRootPosition({ kind, code, departmentCodes = [], pathwayCodes = [] }) {
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

  const angle = ATLAS_GEOMETRY.mycologyCoreAngle +
    (isDepartment ? index : index + 0.5) * TAU / count;
  const radius = isDepartment
    ? ATLAS_GEOMETRY.departmentOrbitRadius
    : ATLAS_GEOMETRY.pathwayOrbitRadius;

  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, angle };
}

export function getAtlasChildPosition({
  parent, index, count, depth, branchAngle,
  isMycologyCore = false, isDepartmentRoot = false
}) {
  const spread = isMycologyCore
    ? TAU
    : isDepartmentRoot
      ? ATLAS_GEOMETRY.departmentPetalSpread
      : ATLAS_GEOMETRY.sectionSpread;
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
