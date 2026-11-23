> **ARCHIVE — CONTRAT HISTORIQUE REMPLACÉ**
>
> Ce document décrit le moteur fractal précédent. Il est conservé pour comprendre les choix et contraintes des versions historiques, mais ne constitue plus une spécification active.
>
> La référence unique pour toute évolution du moteur Academy 2D est désormais :
> [CONSTELLATION-ARCHITECTURE.md](./CONSTELLATION-ARCHITECTURE.md)
>
> En particulier, les paramètres et hypothèses historiques ci-dessous (dont les huit troncs codés dans l'ancien modèle) ne doivent pas être repris comme contraintes de V2. La V2 utilise un nombre configurable d'univers, une croissance fractale rhizomorphique récursive et les invariants définis dans le document canonique.
>
> Toute implémentation nouvelle doit suivre le document canonique V2, et non ce contrat historique.

---

# Archive — ancien contrat du moteur de croissance fractale 2D

Le contenu ci-dessous est conservé à titre d'historique technique uniquement.

## Décision historique

L'ancien Atlas utilisait une grammaire de croissance hiérarchique récursive inspirée des ramifications mycéliennes. Il ne s'agissait pas d'une fractale mathématique autosimilaire stricte : la taxonomie canonique déterminait les ramifications, tandis que les règles géométriques en déterminaient la forme.

Le calcul spatial était un modèle pur, déterministe et indépendant du renderer PixiJS.

## Entrées et validation historiques

`createAtlasGrowthModel({ nodes, visibleDepth, occupancy })` recevait les nœuds canoniques.

Avant l'indexation :
- chaque nœud devait posséder un identifiant chaîne non vide ;
- les identifiants devaient être uniques ;
- chaque parent déclaré devait exister ;
- les cycles hiérarchiques étaient rejetés ;
- `occupancy` devait appartenir à l'intervalle ouvert-fermé `(0, 1]`.

## Construction spatiale historique

1. MYC était le cœur central.
2. Huit troncs morphologiques reliaient MYC aux huit départements satellites. Ils étaient fournis au renderer hors du graphe académique.
3. Les branches hiérarchiques suivaient exclusivement les relations parent-enfant du catalogue.
4. Les secteurs étaient pondérés par le poids des sous-arbres.
5. Une variation angulaire et une variation de longueur, dérivées d'un hash stable des identifiants, produisaient une irrégularité organique reproductible.
6. Les descendants MYC restaient dans une enveloppe compacte.
7. Les parcours et relations transversales étaient dessinés comme connexions secondaires et ne pilotaient jamais la croissance.

## Stabilité et géométrie historiques

Le modèle calculait la géométrie complète avant de filtrer les nœuds visibles par profondeur. Les filaments utilisaient des courbes de Bézier. Les diagnostics d'intersection et de dégagement reposaient sur un échantillonnage discret et non sur une preuve analytique d'absence d'intersection.

Le modèle exposait notamment les nœuds et branches complets, les éléments visibles, un index par identifiant, la profondeur maximale et des diagnostics locaux.

## Ancien réglage d'expansion spatiale

L'ancien layout utilisait une longueur de branche de première génération de 560 unités spatiales et une occupation angulaire de 0,99. La longueur de base était propagée récursivement avec une progression fondée sur le nombre d'or. Ces paramètres sont archivés comme historique et ne constituent pas des valeurs par défaut de V2.
