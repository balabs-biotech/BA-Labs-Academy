# Academy Atlas — architecture spatiale

## Rôle

L'Atlas est le navigateur spatial 2D de l'Academy. Il représente le catalogue pédagogique et ses relations explicites dans un espace navigable. Ce n'est ni un graphe décoratif, ni une taxonomie alternative : les données canoniques restent la source de vérité.

## Topologie

- **MYC / Mycologie** est le noyau spatial central, placé à l'origine.
- Huit départements satellites prolongent ce noyau par huit troncs morphologiques.
- Ces troncs sont des primitives de composition visuelle. Ils sont conservés dans `morphologyBranches`, séparément des `edges` académiques ; ils ne créent aucune relation scientifique.
- Chaque département déploie ses sections, domaines et modules selon les relations parent-enfant réelles.
- Les dix parcours transversaux restent des objets distincts, reliés aux éléments qu'ils mobilisent. Ils ne dupliquent pas les modules et ne pilotent pas la croissance hiérarchique.
- Les relations de connaissances ne sont rendues que lorsqu'elles existent dans les données canoniques.

## Répartition des responsabilités

| Module | Responsabilité |
|---|---|
| `atlas-graph.js` | Construire le graphe canonique et les huit troncs morphologiques séparés |
| `atlas-growth-model.js` | Calculer les positions hiérarchiques, les filaments et les diagnostics géométriques |
| `atlas-geometry.js` | Centraliser les constantes et règles de géométrie |
| `atlas-curve.js` | Construire, échantillonner et comparer les courbes de Bézier |
| `atlas-connections.js` | Dessiner les connexions hiérarchiques, morphologiques et transversales |
| `atlas-pixi-frame-renderer.js` | Adapter le plan de rendu neutre aux couches PixiJS |
| `atlas-renderer-stage.js` | Composer les couches graphiques et les guides spatiaux |
| `atlas-view.js` | Gérer la caméra, les interactions, la sélection et la navigation accessible |

## Rendu

PixiJS v8 / WebGL est l'unique moteur graphique. Le repère spatial est en 2D. Le rendu sépare le fond spatial, les filaments, les jonctions, les nœuds et les étiquettes. Les guides circulaires du fond sont non sémantiques.

Le symbole Y BA Labs est un repère central vectoriel. Il ne remplace pas le contenu ni les nœuds de Mycologie.

## Navigation et accessibilité

- La caméra prend en charge le zoom, le déplacement, le recentrage et la sélection.
- Les générations sont révélées sans déplacer les nœuds déjà calculés.
- Les états de réduction des animations sont respectés.
- La navigation textuelle des 330 nœuds est construite indépendamment de l'initialisation WebGL.
- Une défaillance du renderer ne doit pas supprimer l'accès au catalogue ni à la navigation accessible.
- La vue orbitale historique reste disponible comme mode de comparaison.

## Invariants

1. Aucun lien scientifique n'est déduit de la seule proximité visuelle.
2. Les huit troncs morphologiques ne sont jamais ajoutés aux arêtes académiques.
3. Les parcours transversaux ne modifient pas la hiérarchie.
4. Les identifiants canoniques et le contenu pédagogique ne sont pas altérés par le calcul spatial.
5. Le résultat géométrique est déterministe pour un graphe et un ordre éditorial identiques.
6. La géométrie est indépendante de PixiJS et doit rester testable sans navigateur.
7. L'Atlas est un module facultatif : son échec ne bloque pas le reste de l'Academy.
