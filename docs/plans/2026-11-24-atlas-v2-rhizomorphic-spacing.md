# Academy Atlas V2 — plan d'implémentation morphologie et espacement

**Statut :** implémentation réalisée ; validation navigateur finale en cours.  
**Branche :** `feat/atlas-v2-rhizomorphic-spacing`  
**PR :** [#38](https://github.com/balabs-biotech/BA-Labs-Academy/pull/38) — brouillon, non fusionnée.

## Périmètre et invariants

- Prévisualisation V2 autonome uniquement.
- Aucun changement à l'Atlas de production ou à la page d'accueil.
- Identifiants, hiérarchie, relations et parcours canoniques conservés.
- Aucun code synchronisé ou importé depuis le moteur du site BA Labs.
- Morphogenèse indépendante de PixiJS et du DOM.
- Les hyphes secondaires restent décoratifs et n'ajoutent aucun nœud pédagogique.

## Livrables implémentés

### 1. Allocation angulaire récursive

- Secteurs proportionnels au poids des sous-arbres.
- Espacements explicites entre frères à tous les niveaux.
- Écart circulaire entre le dernier et le premier secteur du noyau.
- Réduction adaptative et bornée des gaps en cas de forte densité.
- Jitter contenu dans le secteur attribué ; ancres d'univers préservées.
- Métadonnées de secteur dérivées par nœud.

### 2. Morphologie mycélienne

- Courbes de Bézier asymétriques et déterministes.
- Largeurs différenciées entre troncs d'univers, cordons rhizomorphiques et hyphes primaires.
- Hyphes secondaires latéraux, courts, fins et plafonnés à 1 200.
- Chemins secondaires validés et exposés comme décorations de scène, sans altérer le graphe canonique.

### 3. Lisibilité des libellés

- Mesure des dimensions réelles des textes PixiJS.
- Placement déterministe selon priorité structurelle.
- Huit positions locales candidates et exclusion des cercles des autres nœuds.
- Masquage LOD progressif au zoom faible ; nœuds et sélection conservés.
- Diagnostics du nombre de libellés visibles/masqués, nœuds et hyphes.

### 4. Vérification

- Tests unitaires pour secteurs, hyphes, scène et placement de libellés.
- Build statique GitHub Pages.
- Smoke Chromium/WebGL pour la page V2 autonome sur desktop et mobile.
- Captures navigateur conservées comme artefacts CI.
- Les tests visuels automatisés ne remplacent pas une inspection esthétique humaine ni des essais tactiles sur appareils physiques.

## Validation CI

- Dernier cycle complet réussi avant les deux derniers ajustements de métadonnées : tests, benchmark, build, smoke renderer et smoke V2, avec captures publiées comme artefact.
- Les derniers commits renforcent les invariants d'espacement ; leur workflow complet doit finir avant de déclarer le chantier stabilisé.
- La PR reste en brouillon et non fusionnée jusqu'à revue visuelle et décision explicite.

## Suite

1. Vérifier le résultat du dernier workflow sur le commit courant.
2. Corriger toute régression révélée par Chromium desktop/mobile.
3. Inspecter les captures de la prévisualisation V2 et ajuster les paramètres si nécessaire.
4. Présenter la prévisualisation et la PR ; ne pas fusionner et ne pas remplacer le moteur publié sans accord explicite.
