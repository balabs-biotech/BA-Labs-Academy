const UNIVERSE_SOURCES = Object.freeze([
  { code: "MIC", layoutId: "lab", sourceId: "catalogue-map#MIC" },
  { code: "BIO", layoutId: "bio", sourceId: "catalogue-map#BIO" },
  { code: "AGR", layoutId: "soil", sourceId: "catalogue-map#AGR" },
  { code: "BPR", layoutId: "products", sourceId: "catalogue-map#BPR" },
  { code: "BMT", layoutId: "myco", sourceId: "catalogue-map#BMT" },
  { code: "GEN", layoutId: "iot", sourceId: "catalogue-map#GEN" },
  { code: "INF", layoutId: "work", sourceId: "catalogue-map#INF" },
  { code: "PHY", layoutId: "evidence", sourceId: "catalogue-map#PHY" }
]);

export const ACADEMY_UNIVERSE_SOURCE_MANIFEST = UNIVERSE_SOURCES;

export function resolveAcademyUniverseSources(departments) {
  if (!Array.isArray(departments)) throw new TypeError("Academy universe sources require a department collection");
  const byCode = new Map(departments.map((department) => [department.entity_key, department]));
  return UNIVERSE_SOURCES.map((source) => {
    const record = byCode.get(source.code);
    if (!record) throw new Error("Missing Academy source " + source.sourceId);
    return Object.freeze({ ...source, record });
  });
}
