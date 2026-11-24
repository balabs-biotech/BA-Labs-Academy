# Academy Atlas V2 — spécification morphologie et espacement

**Statut :** implémentation V2 réalisée — validation CI desktop/mobile en cours  
**Base :** `main` — `4af24ba4d89917f9a2b9bc3eaf310c5490c1ff09`  
**Périmètre :** moteur V2 et page de prévisualisation autonome uniquement.  
**Hors périmètre :** Atlas actuellement en production, moteur du site BA Labs, données pédagogiques canoniques et déploiement de production.

## 1. Objectif utilisateur

La prévisualisation V2 doit évoquer un véritable réseau mycélien, et non un arbre radial générique. En parallèle, chaque niveau de la hiérarchie doit disposer d'un espacement angulaire explicite. Les libellés ne doivent jamais se superposer.

Les trois exigences sont indissociables :
1. **Identité biologique :** branches principales épaisses et organiques, hyphes secondaires plus fines, ramifications irrégulières mais cohérentes, anastomoses uniquement décoratives ou justifiées par une relation canonique.
2. **Espacement hiérarchique :** chaque parent réserve des secteurs angulaires à ses enfants, à toutes les profondeurs.
3. **Lisibilité :** les collisions de libellés sont détectées et résolues avant le rendu ; le zoom réduit progressivement la densité visuelle sans supprimer l'accès aux nœuds.

## 2. Direction retenue : arbre rhizomorphique à secteurs contraints

Conserver une structure hiérarchique déterministe, mais rendre la géométrie locale organique. Ce n'est ni un arbre radial rigide, ni un réseau libre.

### 2.1 Allocation angulaire récursive

- Calculer le poids de chaque sous-arbre à partir du nombre de descendants.
- Pour chaque parent, répartir l'angle disponible entre ses enfants proportionnellement à ces poids.
- Réserver un intervalle vide explicite entre deux secteurs voisins ; cet intervalle ne peut pas être consommé par le jitter.
- Appliquer cette règle à chaque niveau, sans profondeur maximale codée en dur.
- Calculer un espacement minimal adaptatif : le minimum demandé est réduit de façon bornée si le nombre d'enfants rend la somme des secteurs et des intervalles impossible.
- Préserver les ancres radiales des univers et la stabilité déterministe des identifiants existants.
- Limiter la variation angulaire à l'intérieur du secteur attribué à chaque enfant. Aucun enfant ne peut franchir la limite de son secteur.
- Pour un seul enfant, conserver l'axe parent-enfant sans dispersion artificielle.

Les paramètres d'espacement sont centralisés, validés, bornés et versionnés. Les valeurs exactes seront déterminées par tests géométriques et inspection de la prévisualisation, pas par des constantes dispersées dans le code.

### 2.2 Croissance biologique des branches

Le modèle de branche doit distinguer :
- **cordons rhizomorphiques primaires :** trait plus épais, silhouette sinueuse et continue, courbure asymétrique ;
- **hyphes secondaires :** ramifications latérales plus fines, plus courtes et moins nombreuses ;
- **bifurcations :** angles et longueurs variables, déterministes et dépendants de la profondeur et du poids du sous-arbre ;
- **anastomoses :** uniquement lorsque la relation canonique ou la règle décorative explicitement autorisée le permet.

Les détails biologiques restent des objets de présentation dérivés. Ils ne créent aucun nœud pédagogique, aucune relation canonique et aucun changement de topologie. Les détails secondaires sont plafonnés afin de préserver les performances sur mobile.

### 2.3 Variation contrôlée

La variation dépend d'une graine stable, des identifiants, de la profondeur et de la densité locale. Même données + même version de paramètres + même graine = même géométrie.

Une branche locale ne doit pas déplacer les autres territoires. Les changements de densité restent confinés autant que possible au sous-arbre concerné.

## 3. Espacement des libellés

Le renderer actuel dessine chaque libellé directement sous son nœud sans mesurer les collisions. Cette stratégie doit être remplacée.

- Mesurer les dimensions réelles des textes avec les métriques du moteur de rendu.
- Calculer les boîtes englobantes des libellés dans un même espace de coordonnées.
- Prendre en compte les rayons des nœuds, les marges, les libellés voisins et les limites des secteurs.
- Résoudre les conflits par déplacement local borné, choix d'un côté alternatif ou masquage LOD des libellés secondaires.
- Ne jamais résoudre une collision en modifiant l'identité, la parenté ou les relations du graphe.
- Les libellés des nœuds structurants restent prioritaires ; les détails de niveau inférieur peuvent être masqués à faible zoom, puis réapparaître progressivement.
- Un nœud masqué visuellement reste présent dans la scène et accessible par les mécanismes de navigation/sélection.
- La règle de priorité doit être déterministe et indépendante de l'ordre d'entrée.

La garantie visée est l'absence de chevauchement entre libellés affichés et entre un libellé et un nœud non associé, dans les limites du viewport et du niveau de détail actif.

## 4. Contrats et limites architecturales

- Ne pas modifier les identifiants, les parents, les arêtes ou les parcours canoniques.
- Ne pas introduire de dépendance à l'ancien moteur de l'Académie ou au moteur BA Labs.
- Garder la morphogenèse indépendante de PixiJS et du DOM.
- Le modèle de scène reste neutre ; les détails biologiques et les positions de libellés sont des données de rendu dérivées.
- Les erreurs de mesure ou de placement d'un libellé ne doivent pas interrompre le rendu des autres éléments.
- Toute reconstruction spatiale doit rester déterministe et transactionnelle.
- L'ancien Atlas publié et la page d'accueil ne sont pas modifiés pendant ce chantier.

## 5. Stratégie d'implémentation proposée

1. Ajouter des tests de contrat pour l'allocation angulaire : gaps positifs, limites de secteurs, enfants nombreux, sous-arbres déséquilibrés, stabilité et profondeur élevée.
2. Introduire un allocateur sectoriel récursif avec intervalles réservés.
3. Remplacer la courbe simple par un modèle de cordon principal et de ramifications hyphales secondaires, borné et déterministe.
4. Ajouter une étape de placement de libellés fondée sur leurs dimensions mesurées et indépendante de la topologie.
5. Adapter PixiJS pour dessiner les styles hiérarchiques et appliquer le LOD des libellés.
6. Ajouter des tests de scène et des contrôles navigateur ciblant explicitement `atlas-v2-preview.html`.
7. Comparer les rendus desktop et mobile, à faible et fort zoom ; ajuster les paramètres à partir de ces résultats.
8. Mettre à jour le document d'architecture canonique lorsque la conception est validée et l'implémentation stabilisée.

## 6. Critères d'acceptation

### Géométrie
- Aucun enfant ne sort du secteur de son parent.
- Un intervalle angulaire positif est préservé entre secteurs adjacents, sauf réduction adaptative documentée dans les cas impossibles.
- La règle s'applique à tous les niveaux et à des profondeurs supérieures aux fixtures actuelles.
- Les résultats sont reproductibles à entrée et configuration identiques.
- Les changements locaux n'entraînent pas de réorganisation arbitraire des autres univers.

### Apparence biologique
- Les branches principales se distinguent visuellement des hyphes secondaires.
- La silhouette présente des courbures asymétriques et des ramifications irrégulières, sans aspect de lignes droites uniformes.
- La densité des détails est bornée et adaptée à la profondeur.
- Les détails visuels ne modifient jamais le graphe pédagogique.

### Lisibilité
- Aucun chevauchement entre les libellés visibles dans les fixtures de référence.
- Aucun libellé visible ne masque un nœud sans lien.
- Le niveau de détail s'adapte au zoom et les libellés structurants restent lisibles.
- Les nœuds restent sélectionnables même lorsque leur libellé est masqué.

### Résilience et non-régression
- Les tests unitaires et l'ensemble de la suite passent.
- Le smoke test navigateur cible réellement la page V2 autonome.
- Le build GitHub Pages fonctionne.
- L'Atlas de production, son moteur historique et la page d'accueil restent inchangés.

## 7. Questions de validation

La direction proposée est celle d'un **arbre rhizomorphique à secteurs contraints**, avec des cordons primaires, des hyphes secondaires, des intervalles angulaires explicites à chaque niveau et une résolution réelle des collisions de texte.

La direction a été retenue et implémentée dans la branche `feat/atlas-v2-rhizomorphic-spacing`. Les paramètres initiaux sont `minimumAngularGap = 0.08` radian, courbure déterministe des cordons, plafond global de 1 200 hyphes secondaires, marge de collision de 12 unités monde et seuils LOD décrits ci-dessus. Les tests Node, le build et un premier smoke Chromium/WebGL desktop/mobile ont passé. La validation finale porte sur le dernier commit et les captures associées. La fusion et le remplacement de l'Atlas publié restent hors de ce chantier.
