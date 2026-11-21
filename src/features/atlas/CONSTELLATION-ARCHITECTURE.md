# Atlas Academy — architecture des constellations

## Intention spatiale

L'Atlas représente l'écosystème pédagogique comme un réseau organique, et non comme une arborescence linéaire.

- **MYC / Mycologie** est le noyau spatial central, placé à l'origine du repère.
- Les huit autres départements occupent une première couronne orbitale.
- Les dix parcours pratiques occupent une couronne extérieure distincte. Ils restent des objets transversaux reliés aux départements, domaines et sections déclarés.
- Les domaines, sections et modules restent des satellites hiérarchiques de leur département. Les modules ne sont pas dupliqués pour matérialiser les parcours.

## Signature BA Labs

Le nœud central Mycologie porte le marqueur graphique Y. Le Y est dessiné en primitives PixiJS, dans le même repère que les filaments et les nœuds : il reste vectoriel, interactif et indépendant de tout fichier image.

Le bras gauche utilise le cuivre BA Labs, le bras droit le turquoise, et le tronc central une teinte claire. Le symbole est un repère de navigation, pas un logo de remplacement.

## Règles de géométrie

- Noyau Mycologie : (0, 0), rayon augmenté.
- Départements satellites : rayon orbital nominal de 660 unités.
- Parcours : rayon orbital nominal de 1 110 unités, avec décalage angulaire entre les départements.
- Branches du noyau Mycologie : dispersion quasi circulaire.
- Branches des autres départements : dispersion orientée vers l'extérieur.
- Les coordonnées sont déterministes à partir des codes d'entités afin de préserver la stabilité spatiale entre les chargements.

## Comportement de navigation

La caméra continue, le zoom progressif, le rendu PixiJS/WebGL et les seuils de niveau de détail restent conservés. L'aperçu général montre les racines ; les satellites apparaissent progressivement au zoom. Les parcours restent reliés aux espaces qu'ils mobilisent par des relations transversales, sans modifier la taxonomie canonique.

## Évolutions visuelles prévues

1. Donner à chaque département une signature chromatique et une silhouette de constellation distinctes.
2. Affiner les transitions LOD et la gestion des étiquettes pour éviter les collisions.
3. Ajouter des états de focus cohérents entre carte, fil d'Ariane et panneau de sélection.
4. Préserver une vue mobile lisible sans transformer le graphe en liste.
