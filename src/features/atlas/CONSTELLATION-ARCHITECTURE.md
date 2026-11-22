# Atlas Academy — architecture des constellations

## Intention spatiale

L'Atlas représente l'écosystème pédagogique comme un réseau organique, et non comme une arborescence linéaire.

- **MYC / Mycologie** est le noyau spatial central, placé à l'origine du repère.
- Les huit autres départements occupent les huit axes disciplinaires qui prolongent le noyau MYC. Chacun est relié au cœur par un tronc morphologique organique ; ces huit troncs sont des primitives visuelles dédiées, séparées des relations académiques. Leurs descendants se déploient récursivement selon la hiérarchie réelle et les secteurs pondérés.
- Les parcours pratiques occupent une couronne extérieure distincte. Ils restent des objets transversaux reliés aux départements, domaines et sections déclarés.
- Les domaines, sections et modules restent des satellites hiérarchiques de leur département. Les modules ne sont pas dupliqués pour matérialiser les parcours.
- Les relations de connaissances ne sont rendues que si elles sont explicitement vérifiées et documentées. Les huit troncs morphologiques sont rendus dans une couche dédiée, hors du tableau des relations pédagogiques.

## Signature BA Labs

Le nœud central Mycologie porte le marqueur graphique Y. Le Y est dessiné en primitives PixiJS, dans le même repère que les filaments et les nœuds : il reste vectoriel, interactif et indépendant de tout fichier image.

Le bras gauche utilise le cuivre BA Labs, le bras droit le turquoise, et le tronc central une teinte claire. Le symbole est un repère de navigation, pas un logo de remplacement.

## Géométrie orbitale et hiérarchique

Les paramètres de référence sont centralisés dans `atlas-geometry.js` :

- Noyau Mycologie : origine (0, 0).
- Départements satellites : rayon nominal de **1 480 unités**.
- Parcours : rayon nominal de **2 080 unités**.
- Première descente hiérarchique : **760 unités**.
- Descente suivante : **760 / φ ≈ 470 unités**.
- Les secteurs départementaux sont pondérés selon le nombre de sections et de modules, plutôt que répartis uniformément.
- À l'intérieur d'un département, les sections reçoivent un secteur proportionnel à leur nombre de modules. Les domaines transversaux sans descendants reçoivent un poids minimal.

## Convention du nombre d'or

Le moteur utilise **φ = (1 + √5) / 2 ≈ 1,618** comme rapport de proportion, et non comme contrainte de coordonnées absolues.

- **Rayons successifs** : la distance de la deuxième descente vaut la distance de la première divisée par φ.
- **Secteurs de branches** : chaque sous-branche occupe 1 / φ de son secteur attribué ; le solde constitue une réserve angulaire pour la respiration entre les groupes.
- **Connexions** : les points de contrôle des courbes de Bézier utilisent le rapport 1 / φ ; la courbure de base est proportionnelle à la longueur divisée par φ².
- **Hiérarchie visuelle** : l'épaisseur nominale des connexions diminue d'un facteur φ à chaque niveau ; les liens transversaux sont encore atténués pour rester distincts des liens hiérarchiques.

Les proportions sont appliquées aux géométries calculées à partir des données réelles. Le nombre d'or ne doit jamais forcer une branche dense à entrer dans un secteur trop petit : la pondération du sous-arbre reste prioritaire, puis le rapport φ règle l'occupation et les marges.

## Connexions et sémantique

Le rendu des connexions est isolé dans `atlas-connections.js`. Les familles restent visuellement différenciées :

- hiérarchie disciplinaire ;
- transferts ordonnés des parcours ;
- ponts entre départements mobilisés par un même parcours ;
- relations de connaissances vérifiées (prérequis, complémentarité, transfert de méthode, dépendance technique, application et interdisciplinarité).

Une courbe ne crée pas une relation scientifique : elle ne fait que représenter une relation déclarée dans le graphe. Les guides circulaires du fond sont purement spatiaux et ne portent aucune signification relationnelle.

## Comportement de navigation

La caméra continue, le zoom progressif, le rendu PixiJS/WebGL et les seuils de niveau de détail restent conservés. L'aperçu général montre les racines ; les satellites apparaissent progressivement au zoom. Les parcours restent reliés aux espaces qu'ils mobilisent par des relations transversales, sans modifier la taxonomie canonique.

Le rendu est séparé en couches indépendantes : fond spatial, connexions, jonctions, nœuds et étiquettes. La sélection et le contexte de branche sont pré-indexés afin d'éviter de reconstruire toute la hiérarchie à chaque interaction.

## Principes de stabilité

- Les coordonnées sont calculées à partir de la hiérarchie et de l'ordre éditorial des éléments.
- L'ajout d'une section ne doit pas modifier la taxonomie ni créer de copie de modules.
- Les secteurs doivent être recalculables sans dépendre de l'état de la caméra.
- Le rendu doit rester déterministe pour un même jeu de données et un même ordre éditorial.
- Les règles de géométrie doivent rester testables indépendamment du moteur PixiJS.

## Évolutions visuelles prévues

1. Affiner les transitions LOD et la lisibilité des branches intermédiaires sur les petits écrans.
2. Vérifier les collisions réelles des branches et des étiquettes sur des captures desktop et mobile.
3. Ajouter des états de focus cohérents entre carte, fil d'Ariane et panneau de sélection.
4. Préserver une vue mobile lisible sans transformer le graphe en liste.


---

# Atlas — modèle de croissance fractale organique

## Décision d'architecture

L'Atlas évolue vers une **grammaire de croissance récursive**, inspirée des ramifications mycéliennes et neuronales. Le logo BA Labs en constitue le motif fondateur : les générations suivantes prolongent ses axes et leurs ramifications, au lieu d'ajouter des points indépendants reliés par des traits décoratifs.

Il ne s'agit pas d'imposer une fractale mathématique autosimilaire stricte. Le modèle est une arborescence organique déterministe, contrainte par la taxonomie réelle.

## Règles structurelles

1. Le logo et les racines disciplinaires forment les ancrages spatiaux.
2. Chaque relation parent-enfant hiérarchique produit une branche de croissance.
3. Chaque génération ajoute uniquement les descendants de profondeur correspondante.
4. Les relations transversales (parcours, complémentarités, prérequis, transferts) restent des connexions secondaires ; elles ne deviennent jamais des instructions de croissance.
5. Les terminaisons sont les positions finales des nœuds feuilles. Elles ne sont pas ajoutées après le tracé des branches.
6. Les secteurs sont répartis selon le poids réel des sous-arbres, avec une marge angulaire contrôlée.
7. La génération est déterministe pour un même graphe : l'ouverture d'un niveau de profondeur ne déplace pas les générations déjà visibles.

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

Le modèle est d'abord validé indépendamment du rendu existant. L'intégration dans le graphe réel devra ensuite être progressive : comparaison des coordonnées, validation des secteurs et terminaisons, puis bascule du renderer vers les branches générées. Aucun deuxième moteur graphique n'est introduit.

## Invariants

- Aucune relation scientifique n'est inventée.
- Aucun module n'est dupliqué pour les parcours.
- Les relations transversales ne déforment pas la hiérarchie.
- Les identifiants et données canoniques restent inchangés.
- PixiJS/WebGL demeure l'unique moteur 2D.
- Aucun contenu pédagogique ni schéma Supabase n'est modifié par cette évolution.
