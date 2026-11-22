# BA Labs Academy — architecture des programmes pédagogiques

## 1. Séparation des couches

L’Academy distingue les objets suivants :

- **Département** : discipline scientifique de référence.
- **Domaine** : axe thématique ou transversal, rattaché à un ou plusieurs départements selon le modèle éditorial.
- **Programme** : offre structurée autour d'une finalité, d'un public, de prérequis et de résultats attendus.
- **Structure de programme** : organisation des blocs et modules qui composent l'offre.
- **Parcours pédagogique** : progression ordonnée qui mobilise des modules, activités et ressources réutilisables.
- **Compétence** : capacité démontrable, associée à des critères et à des preuves d'acquisition.
- **Ressource / activité / évaluation** : objets pédagogiques distincts, liés au programme sans duplication de contenu.

Un programme assemble ces objets ; il ne devient pas leur propriétaire exclusif et ne doit pas dupliquer les contenus canoniques.

## 2. Structure pédagogique

La structure est volontairement souple. Elle doit convenir à une formation courte, à un atelier intensif ou à un programme long sans imposer le calendrier d'une université classique.

\`\`\`text
ACADEMY
└── Programme
    ├── Cycle (facultatif)
    │   └── Bloc pédagogique
    │       └── Module
    │           └── Unité (facultative)
    │               └── Chapitre (facultatif)
    │                   └── Séquence (facultative)
    │                       └── Leçon (facultative)
    │                           └── Activité
    └── Bloc pédagogique (racine alternative)
        └── Module
            └── ...
\`\`\`

Les racines autorisées sont CYCLE et BLOCK. Les niveaux intermédiaires sont facultatifs : un atelier peut être constitué directement de blocs et de modules ; un programme approfondi peut ajouter des unités, chapitres, séquences et leçons.

Les types structurels actuellement pris en charge sont : CYCLE, BLOCK, MODULE, UNIT, CHAPTER, SEQUENCE, LESSON et ACTIVITY.

**La profondeur structurelle ne représente pas le niveau de maîtrise.** Le niveau L1–L4 est l'axe cible de maîtrise de l'Academy : il est indépendant de la position d'un objet dans l'arborescence et ne doit pas être assimilé à une année, un semestre ou un rang structurel.

**Écart d'implémentation à résoudre avant publication :** la migration actuelle du graphe de compétences utilise cinq valeurs (INTRODUCTORY, FOUNDATION, INTERMEDIATE, ADVANCED, EXPERT) pour les niveaux attendus et démontrés. Ces valeurs ne sont pas encore normalisées sur l'échelle cible L1–L4. Aucune conversion implicite ne doit être faite ; le mapping devra être défini et testé avant d'exposer les niveaux de maîtrise aux apprenants.

Chaque nœud possède un code éditorial stable dans son programme, un parent éventuel, un ordre parmi ses frères, un indicateur obligatoire/facultatif et une durée indicative facultative.

Les codes servent de clés éditoriales stables. Une sauvegarde met à jour les nœuds existants à partir de leur code et conserve leurs identifiants UUID ; cela protège les futurs liens vers compétences, ressources, évaluations et parcours. Les réordonnancements de frères sont appliqués sans collision d'index. Les nœuds supprimés ne sont retirés qu'après réconciliation de l'arborescence.

## 3. Invariants de structure

La base impose ou doit garantir :

- parent dans le même programme ;
- progression vers un niveau structurel autorisé ;
- absence de parent manquant ou de cycle ;
- unicité des codes dans un programme ;
- unicité de l'ordre parmi les frères ;
- racines limitées aux types autorisés ;
- rattachement disciplinaire principal explicite par programme.

Ces invariants concernent la structure du programme. Ils ne doivent pas contraindre les relations transversales entre modules, compétences et ressources.

## 4. Rattachement disciplinaire

Un programme peut mobiliser plusieurs départements et domaines. Un département est principal ; les autres apportent les contributions transversales.

Le type TRANSVERSAL permet de construire des programmes qui traversent plusieurs disciplines. La mycologie peut être l'axe principal d'un programme ou être associée à des domaines d'autres départements. Les domaines sélectionnés doivent rester cohérents avec le périmètre disciplinaire déclaré.

## 5. Relations avec les objets pédagogiques canoniques

| Objet | Fonction |
|---|---|
| academy_programs | Identité et métadonnées du programme |
| academy_program_nodes | Structure du programme |
| academy_program_departments | Départements associés et département principal |
| academy_program_domains | Domaines associés |
| academy_learning_paths | Parcours ordonnés réutilisables |
| content_items | Ressources et contenus canoniques |
| academy_competencies | Référentiel des compétences et prérequis |
| academy_assessments | Évaluations et contrôle des acquis |

Les relations entre nœuds et objets pédagogiques sont portées par des tables dédiées : academy_program_node_competencies (acquis attendus et niveau), academy_program_node_resources (ressources réutilisables), academy_program_node_assessments (évaluations) et academy_program_node_paths (parcours réutilisables).

Une offre de formation peut être rattachée à un programme entier ou à un nœud précis. Ces relations ne créent pas de copie des contenus. Leur remplissage éditorial reste séparé de la construction de l'architecture.

## 6. Workflow éditorial

1. Création d’un programme au statut DRAFT.
2. Définition de son périmètre disciplinaire et de son public.
3. Construction et validation de la structure.
4. Association des compétences, ressources et évaluations réutilisables.
5. Relecture éditoriale.
6. Publication par Owner ou Admin.

Les programmes publiés ne sont pas modifiables par l’éditeur de brouillon. Le champ version_label existe, mais la gestion complète des versions successives (fork d’un programme publié, lien entre versions, comparaison et archivage) reste à construire avant l'ouverture de la production de contenu.

## 7. Hors périmètre de la phase architecture

- Aucun cours, chapitre, leçon ou protocole fictif n'est préchargé.
- Aucun participant, cohorte ou résultat d'évaluation fictif n'est créé.
- Aucun parcours ou support n'est automatiquement généré à partir d'un nœud.
- Le remplissage pédagogique commence après validation de la structure, des relations et du workflow de publication.
