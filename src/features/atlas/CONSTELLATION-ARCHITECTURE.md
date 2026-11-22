# Atlas Academy — architecture des constellations

## Intention spatiale

L'Atlas représente l'écosystème pédagogique comme un réseau organique, et non comme une arborescence linéaire.

- **MYC / Mycologie** est le noyau spatial central, placé à l'origine du repère.
- Les huit autres départements occupent une couronne orbitale pondérée selon la taille réelle de leur hiérarchie.
- Les parcours pratiques occupent une couronne extérieure distincte. Ils restent des objets transversaux reliés aux départements, domaines et sections déclarés.
- Les domaines, sections et modules restent des satellites hiérarchiques de leur département. Les modules ne sont pas dupliqués pour matérialiser les parcours.
- Les relations de connaissances ne sont rendues que si elles sont explicitement vérifiées et documentées.

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
