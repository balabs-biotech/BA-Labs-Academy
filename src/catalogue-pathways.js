// Parcours cartographiés : finalités pratiques, sans séquence pédagogique publiée.
export const cataloguePathways = [
  {
    code: "MIC-PAR-001",
    slug: "laboratoire-microbiologie-appliquee",
    departmentCode: "MIC",
    title: "Mettre en place un laboratoire de microbiologie appliquée",
    summary: "Prélever, isoler, cultiver, observer et contrôler des microorganismes dans un environnement de laboratoire organisé et traçable.",
    target: "Techniciens, expérimentateurs et personnes qui structurent un laboratoire appliqué",
    domainCodes: ["MIC-01", "MIC-02", "MIC-03", "MIC-04", "MIC-05"],
    departmentCodes: ["MIC", "MYC", "BPR"],
    status: "Cartographié"
  },
  {
    code: "MYC-PAR-001",
    slug: "souche-a-production-fongique",
    departmentCode: "MYC",
    title: "De la souche à la production fongique",
    summary: "Sélectionner et conserver une souche, produire un inoculum, conduire la culture et maîtriser les paramètres de fructification et de qualité.",
    target: "Producteurs, techniciens de laboratoire et porteurs de projets mycologiques",
    domainCodes: ["MYC-01", "MYC-02", "MYC-03", "MYC-04", "MYC-05", "MYC-06"],
    departmentCodes: ["MYC", "MIC", "BPR", "BMT"],
    status: "Cartographié"
  },
  {
    code: "BIO-PAR-001",
    slug: "production-et-acclimatation-des-plants",
    departmentCode: "BIO",
    title: "Produire et acclimater des plants de qualité",
    summary: "Relier physiologie végétale, multiplication, culture in vitro, acclimatation et contrôle de la qualité des plants.",
    target: "Pépiniéristes, techniciens horticoles et producteurs de plants",
    domainCodes: ["BIO-01", "BIO-02", "BIO-03", "BIO-04", "BIO-05"],
    departmentCodes: ["BIO", "AGR", "MIC"],
    status: "Cartographié"
  },
  {
    code: "AGR-PAR-001",
    slug: "diagnostic-et-regeneration-des-sols",
    departmentCode: "AGR",
    title: "Diagnostiquer et régénérer un sol cultivé",
    summary: "Lire les propriétés d'un sol, identifier ses facteurs limitants et construire une stratégie raisonnée de restauration de sa fertilité.",
    target: "Agronomes, conseillers agricoles, producteurs et techniciens des sols",
    domainCodes: ["AGR-01", "AGR-02", "AGR-03", "AGR-04", "AGR-05", "AGR-06"],
    departmentCodes: ["AGR", "BIO", "PHY", "MIC"],
    status: "Cartographié"
  },
  {
    code: "BPR-PAR-001",
    slug: "conception-et-pilotage-bioprocedes",
    departmentCode: "BPR",
    title: "Concevoir et piloter un bioprocédé",
    summary: "Passer d'une culture biologique à un procédé maîtrisé en raisonnant milieux, paramètres opératoires, transferts, rendement et formulation.",
    target: "Techniciens, ingénieurs et porteurs de projets de bioproduction",
    domainCodes: ["BPR-01", "BPR-02", "BPR-03", "BPR-04"],
    departmentCodes: ["BPR", "MIC", "MYC", "GEN"],
    status: "Cartographié"
  },
  {
    code: "BMT-PAR-001",
    slug: "prototypage-biomateriaux-biosources",
    departmentCode: "BMT",
    title: "Concevoir un prototype de biomatériau biosourcé",
    summary: "Choisir des matières biologiques, élaborer une formulation, fabriquer un prototype et caractériser ses propriétés et ses limites.",
    target: "Concepteurs, makers, techniciens matériaux et porteurs de projets biosourcés",
    domainCodes: ["BMT-01", "BMT-02", "BMT-03", "BMT-04"],
    departmentCodes: ["BMT", "MYC", "AGR", "GEN"],
    status: "Cartographié"
  },
  {
    code: "GEN-PAR-001",
    slug: "instrumentation-et-automatisation-biologique",
    departmentCode: "GEN",
    title: "Concevoir et automatiser un équipement biologique",
    summary: "Définir un besoin expérimental, sélectionner capteurs et composants, assembler un système de mesure puis automatiser et valider son fonctionnement.",
    target: "Techniciens, concepteurs d'équipements et expérimentateurs",
    domainCodes: ["GEN-01", "GEN-02", "GEN-03", "GEN-04", "GEN-05", "GEN-06"],
    departmentCodes: ["GEN", "BPR", "INF", "PHY"],
    status: "Cartographié"
  },
  {
    code: "INF-PAR-001",
    slug: "tracabilite-numerique-scientifique",
    departmentCode: "INF",
    title: "Construire une chaîne numérique de traçabilité scientifique",
    summary: "Structurer les données, concevoir une base fiable, relier les outils par API et produire une interface de suivi exploitable.",
    target: "Scientifiques, responsables de laboratoire et développeurs d'outils métiers",
    domainCodes: ["INF-01", "INF-02", "INF-03", "INF-04", "INF-05", "INF-06", "INF-07"],
    departmentCodes: ["INF", "GEN", "AGR"],
    status: "Cartographié"
  },
  {
    code: "PHY-PAR-001",
    slug: "mesure-et-modelisation-systemes-biologiques",
    departmentCode: "PHY",
    title: "Mesurer et modéliser un système biologique",
    summary: "Choisir des grandeurs pertinentes, réaliser des mesures fiables, établir des bilans et interpréter les résultats à l'aide de modèles quantitatifs.",
    target: "Expérimentateurs, ingénieurs et étudiants en sciences appliquées",
    domainCodes: ["PHY-01", "PHY-02", "PHY-03", "PHY-04"],
    departmentCodes: ["PHY", "GEN", "AGR", "MIC"],
    status: "Cartographié"
  }
];
