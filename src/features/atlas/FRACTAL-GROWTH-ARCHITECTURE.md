# Atlas — modèle de croissance fractale organique

## Décision d'architecture

L'Atlas évolue vers une **grammaire de croissance récursive**, inspirée des ramifications mycéliennes et neuronales. Le logo BA Labs en constitue le motif fondateur : les générations suivantes prolongent ses axes et leurs ramifications, au lieu d'ajouter des points indépendants reliés par des traits décoratifs.

Il ne s'agit pas d'imposer une fractale mathématique autosimilaire stricte. Le modèle est une arborescence organique déterministe, contrainte par la taxonomie réelle.

## Règles structurelles

1. Le cœur MYC porte le symbole BA Labs et reste fixé à l'origine du repère.
2. Huit troncs morphologiques relient ce cœur aux huit départements satellites. Ils sont des primitives visuelles dédiées, jamais des relations taxonomiques ou scientifiques.
3. Chaque département prolonge son tronc par les branches de ses sections, domaines et modules, selon la hiérarchie canonique.
4. Chaque relation parent-enfant hiérarchique produit une branche de croissance ; les courbes et leurs épaisseurs diminuent avec la génération.
5. Les relations transversales (parcours, complémentarités, prérequis, transferts) restent des connexions secondaires ; elles ne deviennent jamais des instructions de croissance.
6. Les terminaisons sont les positions finales des nœuds feuilles. Elles ne sont pas ajoutées après le tracé des branches.
7. Les secteurs sont répartis selon le poids réel des sous-arbres, avec une marge angulaire contrôlée.
8. La croissance fractale est le mode spatial par défaut ; l'ancienne vue orbitale reste disponible comme comparaison.
9. La génération est déterministe pour un même graphe : l'ouverture d'un niveau de profondeur ne déplace pas les générations déjà visibles.

## Contrat logiciel

`atlas-growth-model.js` est un modèle géométrique pur, indépendant de PixiJS.

Entrées :
- nœuds canoniques avec identifiant, parent, niveau et ancrage racine ;
- profondeur visible ;
- taux d'occupation angulaire optionnel.

Sorties :
- nœuds positionnés sur les axes de croissance ;
- branches hiérarchiques avec courbes de Bézier ;
- vues filtrées par profondeur (`visibleNodes`, `visibleBranches`) ;
- index par identifiant et profondeur maximale.

Le modèle calcule toute la géométrie avant le filtrage visuel. Ainsi, passer de la génération 1 à la génération 2 révèle les nouvelles ramifications sans recalculer les positions précédentes.

## Séparation des responsabilités

- `atlas-graph.js` reste responsable de la vérité taxonomique et des relations déclarées.
- `atlas-growth-model.js` traduit la hiérarchie en squelette spatial.
- `atlas-curve.js` définit les filaments et leur continuité tangentielle.
- `atlas-pixi-frame-renderer.js` et PixiJS/WebGL restent responsables du rendu.
- La caméra et la navigation ne connaissent pas les règles biologiques de croissance.

## Stratégie d'intégration

Le modèle géométrique récursif est appliqué par défaut au graphe réel. Les huit troncs morphologiques sont transmis séparément des arêtes académiques jusqu'au renderer PixiJS. L'ancienne vue orbitale reste accessible par opt-out pour comparer les compositions. Aucun deuxième moteur graphique n'est introduit.

## Invariants

- Aucune relation scientifique n'est inventée.
- Aucun module n'est dupliqué pour les parcours.
- Les relations transversales ne déforment pas la hiérarchie.
- Les identifiants et données canoniques restent inchangés.
- PixiJS/WebGL demeure l'unique moteur 2D.
- Aucun contenu pédagogique ni schéma Supabase n'est modifié par cette évolution.
