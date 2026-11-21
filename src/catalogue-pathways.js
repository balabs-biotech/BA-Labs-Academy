// Parcours transversaux repris de la cartographie générale BA Labs Academy.
// Les axes BPR/BMT/PHY restent distincts des sept départements canoniques.
export const cataloguePathways = [
  {
    code: "MYC-PAR-001",
    slug: "production-mycologique-laboratoire-fructification",
    departmentCode: "MYC",
    title: "Production mycologique, du laboratoire à la fructification",
    summary: "Relier sélection des souches, asepsie, inoculum, substrats, incubation et conduite de la production jusqu'à la fructification.",
    target: "Producteurs de champignons, techniciens mycologues et porteurs de projets de production",
    sectionCodes: ["MYC-01", "MYC-03", "MYC-04", "MYC-05", "MIC-03"],
    departmentCodes: ["MYC", "MIC", "GEN"],
    domainCodes: ["BPR"],
    status: "Cartographié"
  },
  {
    code: "MYC-PAR-002",
    slug: "technicien-culture-fongique",
    departmentCode: "MYC",
    title: "Technicien en culture fongique",
    summary: "Maîtriser les gestes de laboratoire, la préparation des inocula, le contrôle qualité et la conduite des lots fongiques.",
    target: "Opérateurs de laboratoire, techniciens de production et personnes en perfectionnement mycologique",
    sectionCodes: ["MYC-03", "MYC-04", "MYC-05", "MIC-03", "GEN-01"],
    departmentCodes: ["MYC", "MIC", "GEN"],
    domainCodes: ["BPR"],
    status: "Cartographié"
  },
  {
    code: "MYC-PAR-003",
    slug: "ingenierie-bioprocedes-fongiques",
    departmentCode: "MYC",
    title: "Ingénierie des bioprocédés fongiques",
    summary: "Relier physiologie et cinétique fongiques, bioréacteurs, paramètres de conduite, transferts et optimisation des procédés.",
    target: "Techniciens, ingénieurs et concepteurs de procédés de bioproduction",
    sectionCodes: ["MYC-02", "MYC-04", "BPR-01", "BPR-03", "GEN-04", "PHY-03"],
    departmentCodes: ["MYC", "MIC", "GEN"],
    domainCodes: ["BPR", "PHY"],
    status: "Cartographié"
  },
  {
    code: "MIC-PAR-001",
    slug: "microbiologie-sols-plantes",
    departmentCode: "MIC",
    title: "Microbiologie appliquée aux sols et aux plantes",
    summary: "Relier microbiologie des sols et des plantes, interactions microbiennes et applications agronomiques.",
    target: "Techniciens, agronomes et expérimentateurs en microbiologie environnementale et végétale",
    sectionCodes: ["MIC-04", "MIC-05", "AGR-01", "AGR-02", "BIO-04", "BIO-05"],
    departmentCodes: ["MIC", "AGR", "BIO"],
    domainCodes: ["PHY"],
    status: "Cartographié"
  },
  {
    code: "BIO-PAR-001",
    slug: "formulation-evaluation-biostimulants",
    departmentCode: "BIO",
    title: "Formulation et évaluation de biostimulants",
    summary: "Relier physiologie végétale, microbiologie, formulation et expérimentation pour développer et évaluer un biostimulant.",
    target: "Développeurs de biostimulants, agronomes, techniciens et responsables d'essais",
    sectionCodes: ["BIO-04", "BIO-05", "MIC-05", "AGR-02", "PHY-01", "PHY-04"],
    departmentCodes: ["BIO", "MIC", "AGR"],
    domainCodes: ["PHY"],
    status: "Cartographié"
  },
  {
    code: "GEN-PAR-001",
    slug: "conception-laboratoire-biologique",
    departmentCode: "GEN",
    title: "Conception d'un laboratoire biologique",
    summary: "Organiser un laboratoire biologique en reliant flux, équipements, instrumentation, sécurité, maintenance et qualification.",
    target: "Responsables de laboratoire, techniciens, concepteurs et porteurs de projets",
    sectionCodes: ["GEN-01", "GEN-02", "GEN-03", "GEN-04", "GEN-05", "GEN-06", "PHY-02"],
    departmentCodes: ["GEN", "MIC", "MYC"],
    domainCodes: ["PHY"],
    status: "Cartographié"
  },
  {
    code: "GEN-PAR-002",
    slug: "automatisation-salle-culture",
    departmentCode: "GEN",
    title: "Automatisation d'une salle de culture",
    summary: "Instrumenter et piloter une salle de culture par capteurs, régulation, ventilation, alarmes et supervision.",
    target: "Producteurs, techniciens de culture et concepteurs de systèmes automatisés",
    sectionCodes: ["GEN-01", "GEN-02", "GEN-04", "GEN-05", "INF-06", "PHY-03"],
    departmentCodes: ["GEN", "INF", "AGR"],
    domainCodes: ["PHY"],
    status: "Cartographié"
  },
  {
    code: "AGR-PAR-001",
    slug: "valorisation-biomasses",
    departmentCode: "AGR",
    title: "Valorisation des biomasses",
    summary: "Caractériser les biomasses et coproduits, choisir les voies de bioconversion et évaluer les possibilités de valorisation.",
    target: "Techniciens de bioprocédés, responsables de valorisation et porteurs de projets biosourcés",
    sectionCodes: ["BPR-02", "BPR-04", "AGR-02", "BMT-02", "MIC-05"],
    departmentCodes: ["AGR", "BIO", "MIC"],
    domainCodes: ["BPR", "BMT", "PHY"],
    status: "Cartographié"
  },
  {
    code: "MYC-PAR-004",
    slug: "conception-mycomateriaux",
    departmentCode: "MYC",
    title: "Conception de mycomatériaux",
    summary: "Concevoir des matériaux à base de mycélium, choisir les substrats, fabriquer des prototypes et caractériser leurs propriétés.",
    target: "Concepteurs, makers, mycologues et techniciens matériaux",
    sectionCodes: ["BMT-01", "BMT-02", "BMT-03", "BMT-04", "MYC-06", "GEN-03"],
    departmentCodes: ["MYC", "GEN", "AGR"],
    domainCodes: ["BMT", "PHY"],
    status: "Cartographié"
  },
  {
    code: "INF-PAR-001",
    slug: "donnees-intelligence-scientifique",
    departmentCode: "INF",
    title: "Données et intelligence scientifique",
    summary: "Construire une chaîne de données scientifiques associant collecte, traçabilité, statistiques, SIG et outils d'intelligence artificielle.",
    target: "Scientifiques, responsables de laboratoire, analystes et développeurs d'outils métiers",
    sectionCodes: ["INF-01", "INF-02", "INF-03", "INF-04", "INF-05", "INF-06", "INF-07", "GEN-02", "PHY-04"],
    departmentCodes: ["INF", "GEN", "AGR"],
    domainCodes: ["PHY"],
    status: "Cartographié"
  }
];
