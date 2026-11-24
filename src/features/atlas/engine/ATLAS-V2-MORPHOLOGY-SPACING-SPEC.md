# Academy Atlas V2 — spécification morphologie et espacement

**Statut :** correction de composition radiale en validation — 2026-11-24  
**Périmètre :** moteur 2D autonome de BA Labs Academy, y compris son intégration de production.  
**Indépendance :** aucun partage de code, d’algorithme ou de cycle de déploiement avec le moteur du site web BA Labs.

## 1. Objectif utilisateur

Le moteur Academy doit représenter une roue mycélienne fractale, avec la mycologie (MYC) au centre et huit univers disciplinaires disposés autour du noyau. Chaque univers développe des ramifications biologiques récursives vers l’extérieur. Les dix parcours transversaux occupent une orbite secondaire. Chaque niveau de la hiérarchie dispose d’un espacement angulaire explicite ; les libellés affichés ne doivent jamais se superposer ni sortir du viewport.

Les trois exigences sont indissociables :
1. **Identité biologique :** branches principales épaisses et organiques, hyphes secondaires plus fines, ramifications irrégulières mais cohérentes, anastomoses uniquement décoratives ou justifiées par une relation canonique.
2. **Espacement hiérarchique :** chaque parent réserve des secteurs angulaires à ses enfants, à toutes les profondeurs.
3. **Lisibilité :** les collisions de libellés sont détectées et résolues avant le rendu ; le zoom réduit progressivement la densité visuelle sans supprimer l'accès aux nœuds.

## 2.1 Contrat de composition radiale

1. MYC est le noyau spatial exact : coordonnées (0, 0), identité et libellé prioritaires.
2. L'emblème de référence impose une morphologie en Y : un tronc unique part de MYC, se divise en deux bras organiques, puis chaque bras distribue quatre cordons terminaux vers les huit univers.
3. Les huit univers restent répartis sur un anneau radial complet et régulier ; l'anneau est décalé de 22,5° par rapport à l'axe du tronc pour préserver la bifurcation centrale.
4. Chaque univers développe ensuite un rachis mycélien local ; ses descendants émergent latéralement à des profondeurs radiales décalées, au lieu de former un éventail terminal depuis un seul point.
5. Les descendants de MYC se développent dans une couronne interne compacte ; ils ne remplacent pas les huit univers périphériques.
6. Les dix parcours sont positionnés sur une orbite extérieure distincte et restent discrets à faible zoom.
7. Quatre anastomoses secondaires relient sélectivement des territoires distincts ; elles ne doivent pas fermer la roue en polygone.
8. Les relations pédagogiques transversales sont une couche secondaire : masquées ou très discrètes à faible zoom, puis révélées progressivement au zoom.

La composition est recalculable pour un nombre variable d’univers. Les huit secteurs décrivent la configuration éditoriale actuelle, pas une limite du moteur.

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
- **tronc et deux bras fondateurs :** un axe central épais, une bifurcation en Y et deux bras continus, courbés de façon asymétrique ;
- **cordons terminaux :** quatre départs par bras vers les huit univers, sans huit rayons indépendants issus du centre ;
- **rachis locaux :** une continuité principale par univers, avec des ramifications latérales plus fines, plus courtes et décalées en profondeur ;
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
3. Construire le tronc unique, les deux bras, les huit cordons terminaux et les rachis locaux avec points de bifurcation purement géométriques ; conserver les nœuds et relations pédagogiques canoniques inchangés.
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

La direction retenue suit le fichier de référence BA Labs : **un tronc central, deux bras, huit terminaisons hyphales et quatre connexions secondaires**. L'Atlas conserve huit univers sur un anneau complet, mais la géométrie de croissance suit le Y de l'emblème : les univers ne partent plus chacun directement du noyau.

La composition en Y est implémentée dans la branche `fix/atlas-open-mycelial-logo-morphology`. La configuration conserve un anneau à huit univers, avec un tronc unique, deux bras à quatre cordons chacun, des rachis locaux à ramifications latérales et quatre anastomoses secondaires. La validation Node et le smoke Chromium/WebGL desktop/mobile sont exécutés sur le dernier commit avant fusion. Le moteur de production reste inchangé jusqu'à validation du déploiement GitHub Pages.
