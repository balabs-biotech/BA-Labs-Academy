# BA Labs Academy — architecture des programmes pédagogiques

## 1. Séparation des couches

L’Academy distingue quatre objets qui ne doivent pas être confondus :

- **Département / domaine** : classification scientifique et disciplinaire.
- **Programme** : cursus complet défini par une finalité, un public, un niveau et une durée indicative.
- **Arborescence du programme** : organisation interne du cursus en niveaux structurels.
- **Parcours pédagogique** : séquence d’apprentissage ordonnée qui mobilise des ressources existantes.

Les ressources de cours, évaluations et compétences restent des objets distincts. Le programme les organisera ultérieurement sans dupliquer leur contenu.

## 2. Hiérarchie structurelle

```text
ACADEMY
└── Département(s)
    └── Domaine(s)
        └── Programme
            ├── Cycle (facultatif)
            │   └── Année (facultatif)
            │       └── Semestre (facultatif)
            │           └── Bloc pédagogique
            │               └── Module
            │                   └── Unité d’enseignement
            │                       └── Chapitre
            │                           └── Séquence
            │                               └── Leçon
            │                                   └── Activité pédagogique
            └── Bloc pédagogique (racine alternative)
                └── Module
                    └── Unité d’enseignement
                        └── Chapitre
                            └── Séquence
                                └── Leçon
                                    └── Activité pédagogique
```

Les niveaux intermédiaires sont facultatifs. Un cursus court peut commencer par un bloc ; un cursus long peut être structuré en cycles, années et semestres.

Types de nœuds pris en charge :

- `CYCLE`
- `YEAR`
- `SEMESTER`
- `BLOCK`
- `MODULE`
- `UNIT`
- `CHAPTER`
- `SEQUENCE`
- `LESSON`
- `ACTIVITY`

Les racines autorisées sont `CYCLE` et `BLOCK`. Chaque nœud possède un code unique dans son programme, un parent éventuel, un ordre parmi ses frères, un indicateur obligatoire/facultatif et une durée indicative facultative.

La base impose :
- parent dans le même programme ;
- progression vers un niveau inférieur dans la hiérarchie ;
- absence de parent manquant ou de cycle ;
- unicité des codes et de l’ordre parmi les frères ;
- un rattachement disciplinaire principal par programme.

## 3. Rattachement disciplinaire

Un programme peut être rattaché à plusieurs départements et domaines. Un département est principal ; les autres apportent les contributions transversales.

Le type `TRANSVERSAL` permet de construire des programmes qui traversent plusieurs disciplines. La mycologie peut être l’axe principal d’un cursus ou être associée à des domaines des autres départements. Les domaines sélectionnés doivent appartenir aux départements rattachés au programme.

## 4. Relations avec les objets pédagogiques existants

| Objet | Fonction |
|---|---|
| `academy_programs` | Identité et métadonnées du cursus |
| `academy_program_nodes` | Arborescence du cursus |
| `academy_program_departments` | Départements associés et département principal |
| `academy_program_domains` | Domaines associés |
| `academy_learning_paths` | Parcours linéaires d’apprentissage |
| `content_items` | Ressources et unités de contenu |
| `academy_competencies` | Référentiel des compétences et prérequis |
| `academy_assessments` | Évaluations et contrôle des acquis |

Les liens entre nœuds de programme, parcours, compétences et évaluations seront ajoutés comme relations explicites. Ils ne doivent pas être simulés par des copies de contenu ou des intitulés libres.

## 5. Workflow éditorial

1. Création d’un programme au statut `DRAFT`.
2. Définition de son périmètre disciplinaire.
3. Construction et validation de l’arborescence.
4. Relecture éditoriale.
5. Publication par Owner ou Admin.

Les programmes publiés ne sont pas modifiables par l’éditeur de brouillon. La stratégie de création d’une nouvelle version d’un programme publié sera traitée avant l’ouverture de la production de contenu.

## 6. Hors périmètre à ce stade

- Aucun cours, chapitre, leçon ou protocole n’est rédigé dans l’éditeur de programme.
- Aucun programme, module ou participant fictif n’est préchargé.
- Aucun parcours ou support n’est automatiquement créé à partir d’un nœud.
- La hiérarchie structurelle est construite avant le remplissage pédagogique.
