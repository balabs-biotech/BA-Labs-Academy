# Academy Atlas — architecture canonique du moteur 2D V2

**Statut :** architecture de référence validée — mise à jour 2026-11-24  
**Périmètre :** moteur spatial 2D de l'Académie uniquement.  
**Règle de gouvernance :** toute évolution majeure du moteur doit commencer par la mise à jour de ce document. Il constitue la référence avant toute nouvelle implémentation ou refonte.

## 1. Vision et intention

L'Atlas représente les connaissances de l'Académie comme un organisme mycélien en croissance. La morphologie recherchée s'inspire notamment des réseaux mycéliens rhizomorphiques : croissance ramifiée, récursive, irrégulière mais structurée, avec des anastomoses contrôlées.

Il ne s'agit ni d'un graphe radial conventionnel, ni d'un réseau organique libre, ni d'une fractale mathématique strictement autosimilaire. Le moteur combine :

- une organisation radiale de haut niveau ;
- une croissance fractale biologique récursive ;
- une hiérarchie pédagogique canonique ;
- une régulation spatiale stricte pour préserver la lisibilité.

La fractalité est une grammaire de croissance, pas une obligation de répéter exactement la même forme à chaque échelle. La forme, la densité, la longueur et la fréquence des ramifications peuvent varier selon le contenu et la profondeur.

## 2. Organisation centrale et univers périphériques

### 2.1 Noyau central

La mycologie (MYC) est le noyau central de la représentation actuelle. Elle est placée au centre de l'organisme et constitue un point d'ancrage visuel et pédagogique.

### 2.2 Univers périphériques

L'Académie utilise actuellement huit grands univers périphériques. Leur disposition rayonnante reprend l'intention graphique du logo et la référence à la roue du Dharma.

**Le nombre huit n'est pas une contrainte du moteur.** Il s'agit de la configuration éditoriale et visuelle actuelle. Le moteur doit accepter un nombre variable d'univers : huit aujourd'hui, quatorze ou un autre nombre ultérieurement, sans réécriture de son noyau.

Les univers ne sont pas des emplacements codés en dur. Ils sont des entités configurées, chacune disposant au minimum de :

- un identifiant stable et unique ;
- un nom et des métadonnées éditoriales ;
- une couleur de référence ;
- un ordre ou une position angulaire préférentielle ;
- une racine pédagogique ou un ensemble de racines explicitement déclarées ;
- des paramètres morphologiques facultatifs.

Le nombre d'univers, leur nom, leur couleur, leur ordre et leur position peuvent évoluer sans changer les algorithmes fondamentaux.

### 2.3 Identité visuelle partagée avec BA Labs

L'Académie et le site BA Labs peuvent partager une identité visuelle de haut niveau : noyau central, composition rayonnante, huit univers dans la configuration actuelle, logique chromatique et langage organique.

Cette cohérence ne constitue **pas** une dépendance logicielle. Les deux produits conservent des moteurs, des données, des algorithmes et des cycles de déploiement indépendants. Aucun mécanisme de synchronisation de code avec le moteur du site BA Labs ne doit être nécessaire au fonctionnement de l'Académie.

## 3. Croissance fractale rhizomorphique

Chaque univers développe son propre réseau de ramifications à partir de sa zone d'ancrage.

La croissance suit les relations hiérarchiques réelles des données pédagogiques : univers, sous-univers, domaines, sections, modules et toute profondeur future. Le moteur ne doit pas imposer une profondeur maximale arbitraire.

Principes morphologiques :

1. **Ramification récursive :** toute branche peut engendrer des branches filles tant que la structure de connaissances contient des éléments à représenter.
2. **Variation locale :** angles, longueurs, courbures, densités et espacements varient de façon déterministe et bornée.
3. **Morphologie différenciée :** deux univers ou deux sous-arbres de tailles et de natures différentes ne sont pas obligés d'avoir la même silhouette.
4. **Croissance proportionnée :** la géométrie tient compte du volume, de la profondeur et de la distribution des contenus.
5. **Stabilité :** l'ajout d'un contenu ne doit pas provoquer le déplacement arbitraire de l'ensemble de l'organisme.
6. **Anastomoses visuelles contrôlées :** les ponts hyphaux peuvent relier les territoires selon la proximité géométrique. Un arbre couvrant minimal garantit que tous les univers périphériques appartiennent au même réseau, avec au moins N−1 ponts pour N univers. Ces ponts sont décoratifs, ne prouvent aucune relation scientifique et ne modifient jamais le graphe canonique. Les relations interdisciplinaires sémantiques restent exclusivement issues des arêtes canoniques explicitement déclarées.
7. **Lisibilité prioritaire :** le réalisme organique ne justifie ni chevauchement critique, ni amas illisible, ni perte d'accès aux contenus.

La géométrie doit rester déterministe pour un même jeu de données, une même configuration versionnée et une même graine.

## 4. Séparation entre sémantique, géométrie et présentation

Trois états sont strictement séparés.

| Couche | Contenu | Autorité |
|---|---|---|
| Données canoniques | Univers, départements, parcours, sections, modules, relations et identifiants | Source de vérité pédagogique |
| État spatial dérivé | Territoires, branches, positions, courbes, index et diagnostics géométriques | Recalculable par le moteur |
| État de présentation | Caméra, zoom, sélection, animation, labels et objets PixiJS | Temporaire et non canonique |

Invariant : le rendu ne modifie jamais les données canoniques ou la géométrie. Une erreur de rendu ne doit jamais invalider les données pédagogiques. Une erreur spatiale ne doit jamais altérer la source de vérité.

## 5. Architecture logique cible

Le moteur est organisé en modules autonomes communiquant par contrats publics.

| Module | Responsabilité |
|---|---|
| `topology-core` | Construire et valider le graphe pédagogique canonique |
| `identity` | Garantir les identifiants stables et uniques |
| `radial-topology` | Distribuer un nombre variable d'univers autour du noyau |
| `territory-engine` | Construire les sous-structures de chaque univers |
| `morphogenesis` | Produire les règles de croissance rhizomorphique récursive |
| `growth-engine` | Calculer les ramifications et leurs dépendances hiérarchiques |
| `spatial-solver` | Résoudre positions, distances, enveloppes et contraintes |
| `spatial-index` | Accélérer les recherches de proximité et de collision |
| `connection-engine` | Calculer les connexions transversales et anastomoses |
| `scene-model` | Produire une scène neutre, indépendante du backend graphique |
| `renderer-adapter` | Afficher la scène via PixiJS ou un futur backend |
| `camera-controller` | Gérer zoom, déplacement et cadrage |
| `interaction-engine` | Gérer pointeurs, sélection, navigation et gestes tactiles |
| `lod-engine` | Adapter détail, labels et densité affichée au niveau de zoom |
| `lifecycle-supervisor` | Superviser initialisation, suspension, reprise, erreurs et destruction |
| `diagnostics` | Exposer métriques, anomalies et mesures de performance |

Les algorithmes de topologie, de morphogenèse et de résolution spatiale ne dépendent ni de PixiJS, ni du DOM, ni de la caméra.

## 6. Invariants de conception — Safe by Design

### 6.1 Identité et validation

- Chaque univers et chaque nœud possède un identifiant stable et unique.
- Les identifiants de type ou de catégorie ne remplacent jamais les identifiants d'instance.
- Les dix parcours transversaux actuels restent des entités distinctes ; aucun identifiant partagé artificiellement.
- Les références parentes et les relations sont validées avant indexation.
- Les cycles hiérarchiques invalides, références manquantes, valeurs non finies et entrées mal formées sont rejetés avec des diagnostics explicites.
- Les parcours ne sont pas forcés dans la hiérarchie des univers s'ils représentent des chemins transversaux.

### 6.2 Déterminisme et stabilité

- Les calculs utilisent des graines déterministes dérivées d'identifiants stables et d'une configuration versionnée.
- L'ordre d'entrée ne doit pas produire de variation géométrique non intentionnelle.
- Révéler une profondeur supplémentaire ne déplace pas arbitrairement les éléments déjà positionnés.
- Les changements locaux déclenchent une invalidation locale lorsque les dépendances le permettent.
- Les coordonnées canoniques ne dépendent ni du viewport, ni du zoom, ni du renderer.

### 6.3 Calcul transactionnel

Toute reconstruction spatiale est calculée dans un état isolé. Elle est validée avant publication atomique. Si elle échoue, le dernier état spatial valide est conservé. Une branche défectueuse ne doit pas faire disparaître les autres territoires.

### 6.4 Géométrie et collisions

- Une méthode conservative commune calcule les enveloppes des courbes et sert à l'indexation, au filtrage large et aux diagnostics.
- Aucun test de proximité ne doit utiliser une approximation moins sûre que celle utilisée pour construire l'index spatial.
- Les contraintes de collision, marges et seuils sont configurables et versionnés.
- Les métriques distinguent collision réelle, proximité, croisement intentionnel et connexion explicite.
- Les corrections locales sont bornées et ne doivent pas déplacer silencieusement les identités ou la topologie.

### 6.5 Cycle de vie et résilience du rendu

- Montage, démontage, suspension et reprise sont idempotents.
- Les erreurs d'initialisation, de rendu, de redimensionnement et de destruction sont isolées.
- Un backend défaillant peut être détruit et reconstruit sans corrompre la scène neutre.
- Les événements `pointerup`, `pointercancel`, perte de capture et interruption de geste suivent des chemins distincts.
- Une annulation de geste ne déclenche jamais une sélection.
- Les ressources, listeners, textures et objets graphiques sont libérés de manière déterministe.
- L'accès au catalogue et la navigation accessible ne dépendent pas de la disponibilité de PixiJS.

### 6.6 Évolution

- Les paramètres morphologiques sont centralisés, bornés et versionnés.
- Les contrats entre modules sont documentés et testés.
- Les changements de backend graphique ne doivent pas imposer de modifier la topologie ou la morphogenèse.
- Les anciennes couches de compatibilité ne sont pas conservées uniquement pour éviter une migration propre.
- Toute refonte future commence par une mise à jour de ce document et une nouvelle validation des invariants.

## 7. Historique des problèmes à ne pas reproduire

L'audit des versions précédentes a identifié les risques suivants, à convertir en tests de non-régression :

1. **Multiplicité des autorités géométriques :** coexistence de plusieurs modèles de layout et transformations successives. V2 doit avoir un seul pipeline spatial faisant autorité.
2. **Collision d'identité des parcours :** plusieurs parcours pouvaient partager une identité de racine générique. Chaque instance doit avoir une identité propre.
3. **Annulation de pointeur :** `pointercancel` et `pointerup` ne doivent pas partager une sémantique de sélection.
4. **Erreurs tardives du renderer :** les échecs après initialisation, notamment `render()` et `resize()`, doivent être supervisés.
5. **Enveloppes de Bézier incohérentes :** index spatial et préfiltrage doivent partager une même garantie conservative.
6. **Réglages géométriques locaux :** les corrections d'angles, longueurs, densités et espacements doivent être contrôlées par des invariants globaux.
7. **Validation visuelle insuffisante :** les tests fonctionnels seuls ne garantissent pas la qualité de l'espacement ni la lisibilité.
8. **Couplage au moteur du site :** la synchronisation de sources partagées avec BA Labs doit disparaître ; le moteur Academy possède son propre code.
9. **Documentation contradictoire :** ce fichier est la référence canonique. Les documents complémentaires doivent pointer vers lui et ne pas redéfinir une architecture concurrente.

### Éléments historiques utiles à conserver comme enseignements

- La validation des identifiants avant indexation.
- La consolidation des contrats et documents d'architecture.
- L'index spatial pour réduire les comparaisons de collision.
- Les bornes conservatives des courbes de Bézier.
- Le nettoyage LIFO des ressources lorsqu'il est idempotent et supervisé.

Ces éléments sont des enseignements et non une obligation de conserver l'ancienne implémentation.

## 8. Stratégie de migration

La V2 est construite dans un espace de code indépendant de l'ancien moteur.

1. Inventorier et figer les contrats de données pédagogiques consommés par l'Atlas.
2. Ajouter des fixtures représentatives et vérifier les identités et relations.
3. Construire le noyau topologique et la configuration radiale variable.
4. Construire les territoires et la morphogenèse récursive.
5. Construire le solveur spatial, les enveloppes conservatives et l'index.
6. Construire les anastomoses à partir des seules relations autorisées.
7. Construire le modèle de scène neutre et l'adaptateur PixiJS.
8. Réintégrer caméra, interactions, labels, LOD et accessibilité.
9. Exécuter les tests de résilience, de performance et les comparaisons visuelles.
10. Basculer l'Atlas vers V2 après validation ; supprimer l'ancienne implémentation de la branche principale uniquement après cette validation.

L'ancien moteur reste consultable dans l'historique Git pendant la transition. Il n'est pas une dépendance de V2.

## 9. Stratégie de test et critères d'acceptation

### Tests de contrat et de données
- Identifiants uniques pour tous les univers, départements, parcours, sections et modules.
- Références parentes valides et absence de cycles hiérarchiques interdits.
- Conservation exacte des données pédagogiques et relations canoniques.
- Tests de configuration avec 1, 8, 14 et un nombre supérieur d'univers.
- Ajout, retrait, renommage, recoloration et réordonnancement d'univers sans changement du noyau.

### Tests morphologiques et spatiaux
- Croissance récursive sur plusieurs profondeurs.
- Morphologies différentes selon la taille et la structure des sous-arbres.
- Déterminisme à données et configuration identiques.
- Stabilité des coordonnées existantes lors d'une révélation de profondeur.
- Tests de collisions, enveloppes, courbes et anastomoses.
- Connectivité du réseau périphérique : tous les univers reliés avec N−1 ponts minimum, sans mutation des relations pédagogiques.
- Tests de calcul incrémental et de publication transactionnelle.

### Tests runtime et navigateur
- Échec injecté pendant l'initialisation, le rendu, le redimensionnement et la destruction.
- Annulation de geste, perte de capture, pincement interrompu et changement du nombre de pointeurs.
- Montage/démontage répétés sans fuite.
- Navigation accessible sans backend graphique.
- Parcours desktop, mobile et tactile.

### Tests visuels et performance
- Captures de référence à plusieurs tailles d'écran et niveaux de zoom.
- Comparaison visuelle avec seuils documentés.
- Mesures du temps de calcul, nombre de collisions candidates, géométries produites, temps de frame et mémoire lorsque mesurable.
- Fixture initiale correspondant au catalogue réel : 19 territoires, 47 sections, 264 modules et 330 nœuds, après vérification des données effectivement chargées.
- Fixtures synthétiques plus grandes pour vérifier la montée en charge.

### Condition de bascule

La V2 ne remplace l'ancien Atlas que lorsque les contrats, données, interactions, tests de résilience, contrôles visuels et critères de performance sont satisfaits. Une CI verte seule n'est pas une preuve suffisante de qualité visuelle ou architecturale.

## 10. Hors périmètre

- Refonte du moteur 2D du site BA Labs.
- Synchronisation de code entre le site et l'Académie.
- Modification du contenu ou de la taxonomie pédagogique pour satisfaire le layout.
- Ajout automatique de relations scientifiques ou pédagogiques par proximité visuelle.
- Refonte générale de l'application Academy hors intégration nécessaire à l'Atlas.

## 11. Gouvernance de cette architecture

Ce document est le point de départ obligatoire pour toute modification structurelle du moteur Academy 2D.

Lorsqu'un besoin nouveau apparaît :
1. identifier l'invariant ou le contrat concerné ;
2. modifier cette architecture avant de modifier le code si la décision change le modèle ;
3. définir les tests de non-régression ;
4. établir un plan d'implémentation ciblé ;
5. préserver l'indépendance des modules et des données canoniques.

Toute évolution doit préserver l'intention fondatrice : **un organisme de connaissances à croissance fractale rhizomorphique, rayonnant depuis un noyau central, extensible en nombre d'univers et en profondeur, organique mais toujours lisible.**

## 12. Registre d'implémentation V2

Ce registre suit l'état réel de la branche `feat/academy-atlas-v2-foundation`. Il ne vaut pas autorisation de bascule en production.

| Capacité | État | Implémentation |
|---|---|---|
| Topologie canonique et validation des identités | Implémenté | `engine/core/topology.js` |
| Configuration radiale à nombre variable d'univers | Implémenté | `engine/spatial/radial-topology.js` |
| Morphogenèse rhizomorphique déterministe, secteurs angulaires récursifs et hyphes secondaires bornées | Implémenté dans la branche V2 en validation | `engine/biology/morphogenesis.js` |
| Enveloppes conservatives et index spatial | Implémenté | `engine/spatial/collision-index.js` |
| Anastomoses visuelles distinctes des relations pédagogiques | Implémenté | `engine/biology/visual-anastomoses.js` |
| Transaction géométrique avec conservation du dernier état valide | Implémenté | `engine/spatial/geometry-transaction.js` |
| Solveur de collisions nodales borné | Implémenté | `engine/spatial/node-collision-solver.js` |
| Scène neutre indépendante du backend | Implémenté | `engine/rendering/scene-model.js` |
| Adaptateur PixiJS avec cordons hiérarchiques et hyphes secondaires | Implémenté dans la branche V2 en validation CI | `engine/rendering/pixi-adapter.js` |
| Supervision des erreurs runtime du renderer | Implémenté | `engine/rendering/renderer-supervisor.js` |
| Interaction, caméra, gestes tactiles et accessibilité intégrés à V2 | À construire | Aucun branchement de production |
| LOD des libellés avec placement anti-collision déterministe | Implémenté dans la branche V2 en validation CI | `engine/rendering/label-layout.js` |
| Baselines visuelles comparatives et QA sur appareils réels | À construire | Les captures de smoke ne constituent pas encore des baselines de référence |
| Intégration dans l'Atlas de l'Académie | Non commencée | L'ancien Atlas reste actif |

### Validation automatisée

La CI dédiée doit exécuter, dans cet ordre :
1. la suite complète de tests Node ;
2. le benchmark du moteur historique, conservé comme point de comparaison ;
3. le contrôle syntaxique et la génération du bundle statique ;
4. un smoke test Chromium avec PixiJS/WebGL sur deux viewports (ordinateur et mobile) ;
5. la conservation des captures d'écran comme artefacts de diagnostic.

Le smoke test navigateur vérifie le démarrage du backend, la création d'une surface réelle, le dessin d'une scène de test contenant hiérarchie, relation transversale canonique et anastomose, la lecture de pixels WebGL non transparents, le redimensionnement, le second rendu et l'absence d'erreurs non interceptées. Il ne prétend pas encore valider la morphologie du catalogue complet, la qualité esthétique, les gestes tactiles, l'accessibilité ou les performances sur matériel mobile réel.

### Règle de passage à l'intégration

Aucune bascule ne doit être effectuée sur la seule base de tests unitaires ou d'un smoke test WebGL. L'intégration exige encore :
- l'adaptation des données pédagogiques réelles au contrat de scène V2 ;
- la validation des 330 nœuds et de leurs relations ;
- la caméra, les interactions, la sélection et la navigation clavier/tactile ;
- des captures comparatives avec critères d'espacement, lisibilité et stabilité ;
- des essais sur matériel mobile réel et une mesure de performance ;
- une stratégie de repli vers l'Atlas actuel pendant la phase de comparaison.

### Adaptation du catalogue réel

Le premier adaptateur de composition Academy est `src/features/atlas/adapters/academy-graph-v2.js`. Il consomme le graphe canonique déjà produit par l'Académie, sans importer ni réutiliser le moteur spatial historique.

La composition distingue trois familles :
- MYC reste le noyau central ;
- les autres départements sont les univers périphériques radiaux ;
- les parcours transversaux occupent une orbite secondaire et restent reliés par les seules relations canoniques déclarées.

Les relations transversales vérifiées possèdent une géométrie de rendu dérivée dans `relationshipPaths`, séparée des branches hiérarchiques et des anastomoses décoratives. Les anastomoses ne deviennent jamais des relations pédagogiques. Le contrat de scène conserve chaque nœud et chaque relation du graphe d'entrée ; une omission d'identifiant provoque un échec explicite au lieu de produire une carte partielle silencieuse.

Le contrat de rayon utilise `r` du graphe historique comme rayon de nœud par défaut, sans reprendre ses coordonnées. Les couleurs de territoire sont dérivées des jetons de palette Academy.

**Test d'intégration du modèle :** le catalogue courant produit 330 nœuds visibles, neuf départements (MYC + huit univers), dix ancres de parcours et conserve toutes les relations canoniques. La suite complète de la branche a passé 334 tests sur le commit validé. Ce test de composition n'autorise pas encore le branchement du renderer dans l'application publiée.

### Navigation et interactions de caméra

La caméra V2 est un contrôleur pur, sans dépendance DOM ni PixiJS : `engine/presentation/camera-controller.js`. Elle expose les conversions monde/écran, le cadrage, le déplacement, le zoom ancré sous le pointeur, les limites d'échelle et une contrainte de visibilité minimale.

Les événements de pointeur sont isolés dans `engine/presentation/pointer-interactions.js`. Le contrat distingue explicitement :
- glissement mono-pointeur : déplacement de caméra ;
- pincement à deux pointeurs : zoom autour du centre du geste et translation ;
- tap sans déplacement : sélection ;
- `pointercancel` et perte de capture : annulation, jamais conversion en sélection ;
- molette : zoom local au curseur ;
- destruction : retrait des listeners, libération des captures et restauration de `touch-action`.

Les tests unitaires utilisent une cible événementielle simulée pour vérifier la sémantique des gestes et le nettoyage. Le smoke WebGL précédent valide le renderer, pas encore l'interaction tactile sur un appareil physique.

### Graphe canonique sans moteur spatial historique

L'adaptateur `adapters/academy-catalogue-graph.js` reconstruit la topologie éditoriale depuis le catalogue Academy en laissant volontairement les coordonnées à zéro. Il ne dépend ni de `atlas-organic-layout.js`, ni de `explorer-2d-network.js`, ni de PixiJS. La morphogenèse V2 est donc l'unique autorité spatiale dans la prévisualisation V2.

Le générateur historique `atlas-graph.js` reste intact pour l'Atlas actuellement publié. Les deux adaptateurs partagent le même contenu canonique, mais pas leur moteur de disposition. Un test de non-régression vérifie explicitement l'absence de dépendance spatiale historique dans le nouvel adaptateur.


## 13. Morphogenèse rhizomorphique et lisibilité — révision 2026-11-24

Cette révision formalise les contraintes ajoutées à la prévisualisation autonome V2. Elle ne change pas la topologie pédagogique ni le moteur de production.

### 13.1 Secteurs angulaires récursifs

Chaque parent distribue un secteur à chacun de ses enfants en fonction du poids du sous-arbre. Les intervalles entre secteurs sont réservés avant la distribution des largeurs ; la variation déterministe d'angle reste à l'intérieur du secteur attribué.

- Paramètre par défaut : `minimumAngularGap = 0.08` radian.
- L'allocation circulaire du noyau réserve également un intervalle entre le dernier et le premier secteur.
- Si le nombre d'enfants rend la marge demandée impossible, l'écart est réduit uniformément selon la largeur angulaire disponible. Les largeurs restent positives et les secteurs ne se chevauchent pas.
- Un parent à enfant unique conserve l'axe parent-enfant sans dispersion.
- Les métadonnées `sector.start`, `sector.end`, `sector.center` et `sector.gapAfter` sont dérivées et non canoniques.
- Les ancres radiales des univers restent inchangées.

### 13.2 Hiérarchie biologique des traits

La morphogenèse produit des courbes de Bézier asymétriques, reproductibles à graine et identifiants constants. Le renderer distingue les cordons rhizomorphiques, les troncs d'univers et les hyphes secondaires.

- Les cordons primaires portent une largeur dérivée de la génération.
- Les hyphes secondaires sont des chemins décoratifs autonomes, courts et plus fins ; leur nombre est plafonné à 1 200 dans la prévisualisation.
- Les hyphes ne créent aucun nœud, aucune arête canonique et aucune relation pédagogique.
- La scène neutre les expose sous le type `hypha`, distinct des branches hiérarchiques, des anastomoses et des relations transversales.
- Les paramètres de courbure et de densité sont déterministes et bornés.

### 13.3 Placement des libellés

Le renderer mesure les objets texte PixiJS puis appelle le solveur pur `engine/rendering/label-layout.js`. Le solveur teste huit positions radiales autour de chaque nœud, selon un ordre de priorité stable : noyau, univers, structures, feuilles.

Les seuils LOD initiaux sont :
- noyau : échelle 0.02 ;
- univers : échelle 0.055 ;
- structures et parcours : échelle 0.12 ;
- feuilles : échelle 0.28.

La marge de collision initiale est de 12 unités monde. Un libellé sans position sûre est masqué avec un motif de diagnostic ; le nœud, son identifiant, ses relations et sa sélection restent présents. Les placements sont recalculés lorsque l'échelle de caméra change.

Ces seuils sont des paramètres de présentation, pas des propriétés du graphe. Ils pourront être ajustés à partir des captures desktop et mobile sans modifier les contrats canoniques.

### 13.4 Vérification visuelle spécifique à V2

Le smoke test `tests/atlas-v2-preview-smoke.mjs` ouvre directement `atlas-v2-preview.html` aux viewports 1440×900 et 390×844. Il vérifie :
- 330 nœuds toujours présents ;
- des libellés visibles et d'autres masqués au niveau de zoom initial ;
- une visibilité des libellés qui ne diminue pas après zoom avant ;
- la présence de chemins d'hyphes secondaires ;
- le fonctionnement du cadrage et l'absence d'erreurs navigateur.

Ce smoke test valide le comportement du renderer sur Chromium/WebGL simulé. Il ne remplace pas une inspection esthétique humaine ni des essais sur appareils physiques.
