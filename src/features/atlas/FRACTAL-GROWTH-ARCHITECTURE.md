# Atlas — contrat du moteur de croissance fractale 2D

## Décision

L'Atlas utilise une grammaire de croissance hiérarchique récursive, inspirée des ramifications mycéliennes. Il ne s'agit pas d'une fractale mathématique autosimilaire stricte : la taxonomie canonique détermine les ramifications, tandis que les règles géométriques en déterminent la forme.

Le calcul spatial est un modèle pur, déterministe et indépendant du renderer PixiJS.

## Entrées et validation

`createAtlasGrowthModel({ nodes, visibleDepth, occupancy })` reçoit les nœuds canoniques.

Avant l'indexation :
- chaque nœud doit posséder un identifiant chaîne non vide ;
- les identifiants doivent être uniques ;
- chaque parent déclaré doit exister ;
- les cycles hiérarchiques sont rejetés ;
- `occupancy` doit appartenir à l'intervalle ouvert-fermé `(0, 1]`.

Ces contrôles empêchent les collisions silencieuses d'identifiants, les parents ambigus et les structures impossibles à déployer.

## Construction spatiale

1. MYC est le cœur central.
2. Huit troncs morphologiques relient MYC aux huit départements satellites. Ils sont fournis au renderer hors du graphe académique.
3. Les branches hiérarchiques suivent exclusivement les relations parent-enfant du catalogue.
4. Les secteurs sont pondérés par le poids des sous-arbres.
5. Une variation angulaire et une variation de longueur, dérivées d'un hash stable des identifiants, produisent une irrégularité organique reproductible.
6. Les descendants MYC restent dans une enveloppe compacte ; ils ne forment pas une neuvième branche satellite.
7. Les parcours et relations transversales sont dessinés comme connexions secondaires et ne pilotent jamais la croissance.

## Stabilité des coordonnées

Le modèle calcule la géométrie complète avant de filtrer les nœuds visibles par profondeur. Ainsi, révéler une génération supplémentaire ne déplace pas les générations précédentes.

La caméra, le zoom et le renderer ne participent pas au calcul des positions.

## Courbes et encombrement

Les filaments utilisent des courbes de Bézier. La courbure latérale diminue avec la profondeur et avec la largeur angulaire disponible.

Une correction locale bornée peut réduire la courbure lorsqu'un filament croise un filament frère ou un filament d'une autre génération. Elle ne déplace pas les nœuds et ne change pas les secteurs.

Les diagnostics d'intersection et de dégagement utilisent un échantillonnage des courbes et des distances entre segments. Ils constituent une approximation géométrique discrète, pas une preuve analytique d'absence d'intersection. Le seuil de proximité intergénérationnel actuel est de 18 unités du repère spatial.

## Sorties

Le modèle expose :
- `nodes` et `branches` complets ;
- `visibleNodes` et `visibleBranches` filtrés par profondeur ;
- `byId`, index des nœuds positionnés ;
- `maxDepth` ;
- `fanDiagnostics`, mesures locales par parent ;
- `crossGenerationDiagnostics`, mesures des interactions entre générations.

Les diagnostics sont des informations de qualité géométrique. Ils ne modifient jamais la sémantique du graphe.

## Invariants de test

- Les huit troncs sont distincts des relations académiques.
- Les coordonnées sont identiques pour deux calculs du même catalogue.
- Les nœuds déjà visibles conservent leurs coordonnées quand la profondeur augmente.
- Les secteurs et perturbations restent bornés.
- Les corrections de courbe ne déplacent pas les nœuds.
- Les croisements et distances sont testés sur des courbes synthétiques.
- Les entrées avec identifiants absents, non textuels ou dupliqués sont rejetées.
- Le renderer PixiJS doit rester fonctionnel sur desktop et mobile.


## Global spatial expansion

The default fractal layout uses a 1,250-world-unit first-generation branch length and a 0.9 angular occupancy. The 1,250-unit base is propagated recursively with the golden-ratio length progression, so every generation receives the larger spatial scale rather than expanding only the first visible endpoints. The higher occupancy uses more of each allocated angular sector, widening branch fans throughout the hierarchy. The Pixi stage provides a taller overview area; camera navigation remains responsible for inspecting dense local subtrees.


## Landscape-aware root distribution

The eight department anchors and ten pathway anchors use a deterministic horizontal ellipse rather than a circular orbit. The horizontal semi-axis retains the configured orbit radius; the vertical semi-axis is multiplied by `orbitVerticalRatio` (0.62). This preserves angular order and normalized orbital distance while matching the wide 2D stage, reducing camera fit's vertical bottleneck. Child hierarchy coordinates remain canonical relative to their positioned parent; no taxonomy or academic relation is changed.
