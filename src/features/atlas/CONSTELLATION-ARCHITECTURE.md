# BA Labs Academy — architecture canonique du moteur 2D

**Statut :** alignée sur l'explorateur 2D du site BA Labs  
**Révision :** 2026-11-26  
**Référence :** `balabs-biotech/BA-lab/ecosystem/EXPLORER-2D-ARCHITECTURE.md`

## 1. Principe directeur

L'Atlas de l'Académie reprend la même architecture biologique et spatiale que l'explorateur 2D du site BA Labs. L'organisme est un espace 2D continu et asymétrique : centre BA Labs, noyau mycologique central, huit territoires scientifiques autonomes, ramifications internes et connexions transversales documentées.

Les territoires ne sont ni des satellites indépendants, ni des secteurs circulaires, ni des anneaux, ni des faisceaux radiaux. Ils colonisent un même espace biologique avec des densités et morphologies propres.

## 2. Les huit univers

1. `MIC` — Microbiologie (`microbiology`)
2. `BIO` — Sciences végétales (`plants`)
3. `AGR` — Sols et écosystèmes (`ecology`)
4. `BPR` — Bioprocédés (`bioprocesses`)
5. `BMT` — Biomatériaux (`biomaterials`)
6. `GEN` — Ingénierie et instrumentation (`instrumentation`)
7. `INF` — Sciences numériques (`digital`)
8. `PHY` — Sciences physiques et chimiques (`physical`)

MYC est le noyau mycologique central, pas un neuvième univers. Il est relié visuellement aux huit territoires par le tissu de filaments primaires, sans créer de relations pédagogiques artificielles.

## 3. Morphogenèse

La même grammaire que le site BA Labs est appliquée :
- filaments primaires, bifurcations secondaires et tertiaires ;
- ramifications asymétriques, irrégulières et déterministes ;
- courbure, longueur, épaisseur et orientation variables ;
- croissance latérale rhizomorphique, jamais huit éventails réguliers ;
- anastomoses locales contrôlées ;
- extrémités terminales fines et ouvertes ;
- densité révélée progressivement selon le zoom.

La géométrie est calculée à partir de la hiérarchie réelle. Aucun filament décoratif, nœud fantôme ou lien arbitraire ne remplit l'espace. Les anastomoses locales expriment une proximité morphologique, pas une relation académique nouvelle.

## 4. Huit univers, huit sources d'information

Chaque univers possède son propre adaptateur de données et sa source d'information. L'adaptateur normalise les contenus vers un graphe canonique sans modifier les identifiants stables ni les routes.

Contrat minimal d'un nœud : identifiant stable, univers propriétaire, type d'entité, titre et métadonnées, parent hiérarchique, route interne, provenance et date de synchronisation lorsqu'elles sont disponibles.

Les parcours interdisciplinaires et relations transversales sont conservés comme liens documentés, distincts de la hiérarchie. Un parcours est représenté une seule fois ; ses autres appartenances deviennent des relations explicites.

Le catalogue actuel demeure la source de vérité des contenus déjà intégrés. Les huit adaptateurs permettent de connecter progressivement des sources distinctes sans modifier le moteur géométrique. Une source indisponible ne doit pas bloquer les autres univers ; chaque adaptateur doit pouvoir exposer son état et, si configuré, son dernier instantané valide.

## 5. Couches logicielles

1. **Sources** : catalogue et dépôts documentaires propres à chaque univers.
2. **Adaptateurs** : validation, normalisation, provenance et graphe canonique.
3. **Graphe académique** : identifiants, hiérarchie, relations et routes.
4. **Géométrie biologique** : coordonnées, ramifications, relaxation et anastomoses.
5. **Rendu PixiJS** : filaments, jonctions, labels et détails selon le zoom.
6. **Caméra et interactions** : zoom, déplacement, sélection et accessibilité.
7. **Navigation** : ouverture explicite de la fiche ou du module.

Le moteur géométrique et le renderer ne connaissent ni Notion ni les formats de stockage. La sélection ne déclenche jamais automatiquement une navigation externe.

## 6. Cohérence avec le site BA Labs

Les deux expériences partagent le centre BA Labs / MYC, les huit territoires, l'ordre, les repères chromatiques et la grammaire de croissance. Le code du moteur partagé est synchronisé depuis le dépôt du site à une révision explicitement épinglée. Les adaptateurs, routes, interactions pédagogiques et cycles de publication restent propres à l'Académie.

Toute synchronisation du moteur doit être suivie de tests et d'une vérification visuelle avant fusion.

## 7. Expérience

- Un seul espace 2D continu, sans remplacement de scène.
- Zoom progressif et déplacement libre souris, clavier et tactile.
- La sélection centre le nœud et affiche sa fiche dans l'interface Academy.
- La fiche propose une action explicite vers le module ou la ressource.
- Les listes DOM rendent les contenus atteignables au clavier.
- `prefers-reduced-motion` est respecté.
- La vue mobile conserve une vue d'ensemble exploitable des huit territoires.

## 8. Critères d'acceptation

1. MYC est central et n'est pas compté comme neuvième univers.
2. Les huit univers sont présents et reconnaissables.
3. Le réseau est organique, asymétrique et latéralement ramifié, jamais radial.
4. Chaque nœud correspond à une donnée canonique et conserve identifiant et route.
5. Les huit adaptateurs évoluent indépendamment.
6. Les relations transversales conservent leur provenance.
7. Les coordonnées sont déterministes à données et graine identiques.
8. L'ajout d'un contenu ne déplace pas arbitrairement les autres univers.
9. Desktop, mobile, tactile, clavier, RTL et réduction des animations sont testés.
10. Aucun solveur radial retiré n'est importé par le chemin actif.
11. Build, tests et rendu navigateur sont validés avant fusion ou publication.
