# BA Labs Academy

Frontend public de BA Labs Academy. Le site est conçu comme une application statique, hébergée sur GitHub Pages, avec Supabase comme source de données publiques.

## Architecture

- `index.html` — point d'entrée et structure globale.
- `src/main.js` — routes, vues et orchestration de l'interface.
- `src/data.js` — adaptateur de lecture Supabase et résolution des libellés de l'Atlas.
- `src/core/` — fonctions partagées du runtime, dont `auth.js` pour les sessions et `permissions.js` pour les capacités par rôle.
- `src/features/atlas/layout.js` — moteur de positionnement 2D déterministe.
- `src/features/atlas/renderer.js` — rendu SVG, sélection, déplacement et zoom.
- `src/features/learning/progress.js` — calcul de progression et résolution des prérequis.
- `academy_competencies` et `academy_content_competencies` — référentiel des compétences, niveaux attendus et associations aux ressources.
- `src/core/auth.js` — connexion, session et renouvellement des jetons Supabase Auth.
- `supabase/migrations/` — migrations versionnées du schéma Academy.
- `src/styles.css` — système visuel responsive.
- `scripts/build.mjs` — génération du site statique dans `dist/`.
- `tests/` — tests unitaires du moteur Atlas, de l’authentification et de la progression.
- `.github/workflows/deploy-pages.yml` — tests, build et déploiement.

## Données et sécurité

Le frontend utilise exclusivement une clé Supabase publishable, destinée à être exposée dans le navigateur. Aucune clé `service_role` ni aucun secret serveur ne doit être ajouté au dépôt.

Les parcours pédagogiques, leurs étapes, les prérequis, les compétences, les inscriptions et la progression individuelle disposent de tables dédiées. Les parcours et compétences publiés sont consultables publiquement ; les inscriptions et la progression sont limitées à l'utilisateur authentifié via `auth.uid()` et RLS. Le client Auth utilise les endpoints officiels Supabase, stocke les jetons dans `sessionStorage` et renouvelle les sessions avant expiration. L'espace apprenant permet la connexion, l'inscription à un parcours publié et la validation d'une ressource. La progression personnelle et les inscriptions sont chargées séparément des données publiques : une panne de l'espace privé ne bloque pas le catalogue public. La création publique de comptes reste désactivée dans l'interface : les comptes sont provisionnés par l'administration. Aucun contenu n'a été créé ou publié dans les tables pédagogiques.

La table `academy_memberships` pilote les rôles `OWNER`, `ADMIN`, `EDITOR` et `REVIEWER`. L'interface expose un espace éditorial uniquement aux membres actifs, mais l'autorisation réelle reste vérifiée dans les fonctions PostgreSQL. Le bootstrap du premier propriétaire est limité au rôle `service_role` ; il ne peut pas être déclenché depuis le navigateur.

Les lectures sont filtrées par les statuts de publication et les politiques PostgreSQL RLS. Les brouillons, données internes et fiches non publiées ne doivent jamais être rendus accessibles au public. La console éditoriale permet aux rôles Owner/Admin/Editor de créer et configurer des parcours en brouillon ; la publication reste réservée à Owner/Admin. Le constructeur de séquence gère l'ordre, les étapes obligatoires/facultatives et les prérequis multiples. La console expose également la file de publication des départements et domaines : les membres éditoriaux actifs peuvent lire les brouillons, tandis que seuls Owner/Admin peuvent publier ; un domaine ne peut être publié avant son département parent. Le référentiel des compétences dispose d’un éditeur dédié : code, intitulé, description opérationnelle, niveau de maîtrise, ressources contributives, niveau attendu et indice d’évaluation. L’enregistrement atomique synchronise le nœud SKILL et les relations SUPPORTS dans l’Atlas ; la publication d’une compétence est réservée à Owner/Admin et ne publie que les relations dont les deux nœuds sont déjà publiés. Le catalogue éditorial des ressources gère les fiches, les identifiants métier, les slugs, les métadonnées, la classification par départements/domaines, la revue, l’approbation et la publication. La classification impose un seul département principal et vérifie l’appartenance des domaines sélectionnés ; les relations USES sont synchronisées dans l’Atlas. Les brouillons ne sont lisibles que par les membres éditoriaux actifs. Les modifications des métadonnées et de la séquence des parcours sont atomiques. La publication synchronise le nœud PATHWAY et ses relations USES/REQUIRES dans l’Atlas. Les opérations éditoriales restent réservées aux fonctions contrôlées du backend.

L'absence actuelle de contenus publics est un état valide : l'interface affiche des états vides explicites au lieu de données de démonstration.

## Développement local

Prérequis : Node.js 22 ou supérieur.

```bash
npm test
npm run build
```

Le résultat statique est généré dans `dist/`.

## Déploiement

Dans GitHub : **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Chaque push sur `main` exécute les tests, génère le site, puis tente le déploiement Pages.


## Moteur d’évaluation et certification

Le moteur d’évaluation sépare les questionnaires, les questions, les options visibles et les clés de correction privées. Les tentatives sont versionnées, historisées et corrigées exclusivement côté serveur. Le premier type pris en charge est le QCM à choix unique ; le schéma permet d’étendre ultérieurement les modalités d’évaluation.

Les parcours peuvent référencer des évaluations obligatoires ou complémentaires et fixer un seuil minimal propre au parcours. L’émission d’un certificat est contrôlée côté serveur : inscription au parcours, validation de toutes les étapes obligatoires et réussite des évaluations requises. Les certificats disposent d’un code unique et d’un endpoint public de vérification qui ne révèle aucune donnée personnelle de l’apprenant.


La console éditoriale comprend un constructeur de QCM à choix unique, le paramétrage des seuils, tentatives et durées, ainsi que l’association d’évaluations publiques à un parcours. Les parcours peuvent imposer un seuil spécifique pour chaque évaluation liée.


## Architecture disciplinaire en réseau

La taxonomie comprend huit pôles disciplinaires — Microbiologie, Sciences végétales, Sols & écosystèmes, Bioprocédés, Biomatériaux, Ingénierie & instrumentation, Sciences numériques, Sciences physiques & chimiques — et un neuvième pôle central, MYCOLOGIE. Celui-ci couvre la biologie fongique, la culture, les symbioses, l’écologie, les applications et les mycomatériaux. Dans l’Atlas, MYCOLOGIE est reliée explicitement aux huit autres pôles par des relations transversales, sans hiérarchie disciplinaire.

Les domaines existants sont conservés autant que possible. L’ancienne classification zootechnique est archivée et reste traçable ; les nouveaux domaines des bioprocédés, biomatériaux et sciences physiques & chimiques sont préparés comme structures éditoriales, sans remplissage de cours.


## Référentiel de compétences et preuves d’acquisition

Les compétences peuvent être rattachées à plusieurs domaines disciplinaires, avec un ancrage principal. Une même évaluation peut mesurer plusieurs compétences et définir, pour chacune, un niveau attendu et un seuil de validation. La soumission d’une tentative produit côté serveur une preuve append-only par compétence, avec niveau, score et statut de démonstration. La vue `academy_learner_competency_mastery` agrège les niveaux démontrés et l’historique des preuves ; aucune preuve ne peut être créée ou modifiée directement par le navigateur.


Les compétences peuvent aussi déclarer des prérequis. Le moteur rejette les dépendances cycliques, exige que les prérequis soient publiés avant la compétence dépendante et représente les relations `REQUIRES` dans l’Atlas. Cette progression par compétences est indépendante de l’ordre des ressources dans un parcours.


## Supports pédagogiques versionnés

Une fiche de ressource peut référencer plusieurs supports distincts : document, vidéo, audio, image, jeu de données, protocole, simulation, activité pratique, présentation ou lien externe. La table `academy_content_assets` conserve chaque version, son code stable, sa langue, son type MIME, son empreinte SHA-256 éventuelle, sa licence et son attribution. Les versions antérieures restent traçables via `previous_version_id`. Les supports héritent de la visibilité de leur ressource par RLS ; le navigateur ne peut pas écrire directement dans la table et passe par une RPC éditoriale contrôlée. Les liens externes HTTP(S) sont pris en charge dans la console. Le stockage de fichiers Supabase est prévu par le modèle, mais reste désactivé tant qu'un bucket privé et ses politiques d'accès ne sont pas configurés.


## Gestion opérationnelle des formations

Le moteur de formation est séparé des parcours d'apprentissage. Il distingue les offres, sessions datées, inscriptions, présences, documents remis, partenaires agréés, conventions et références de facturation. Chaque offre porte un régime explicite : `PRIVATE_WORKSHOP`, `PARTNER_DELIVERED` ou `APPROVED_ESTABLISHMENT`. Les offres portées par un partenaire exigent une référence de partenaire et une convention ; les documents privés BA Labs sont limités aux attestations de participation, de réalisation pratique et aux relevés d'évaluation interne. Les certificats de partenaire et certificats reconnus par l'État portent une identité d'émetteur distincte. La couche de données est privée, en lecture réservée aux membres éditoriaux actifs et à l'apprenant pour ses propres inscriptions et documents. Les écritures navigateur directes sont révoquées. Les RPC contrôlent la création des offres/sessions, l'inscription, la présence, l'activation et le cycle de vie documentaire. L'émission exige une inscription terminée et une présence validée ; les règles d'émetteur sont contrôlées par trigger selon le régime et la convention. Les jetons QR sont générés aléatoirement, stockés uniquement sous forme de hash et retournés une seule fois à l'émission. La vérification publique ne révèle aucune donnée personnelle ; la révocation est réservée à Owner/Admin et auditée. Les références de facturation sont des pointeurs vers la comptabilité externe, pas un logiciel comptable.

### Console opérationnelle des formations

La console d'administration Academy charge les partenaires, conventions, offres, sessions, inscriptions, présences, documents et références de facturation. Elle permet de créer des offres et sessions en brouillon, d'activer une offre et d'ouvrir une session (Owner/Admin), de confirmer/admettre/terminer une inscription, de consigner les présences et d'émettre ou révoquer les documents autorisés. La vérification publique utilise le jeton QR via `#/verifier-formation/<jeton>` et ne renvoie aucune donnée personnelle. La clôture d'une inscription exige une présence validée. Les écritures passent par des RPC sécurisées ; les données réelles ne sont pas préremplies.

Les fiches partenaires et conventions sont créées en brouillon par Owner/Admin. L'activation d'un partenaire exige les références d'agrément, l'autorité et un périmètre de spécialités/modes ; l'activation d'une convention exige partenaire actif, date de signature, lieux, spécialités et modes. Des triggers SQL vérifient ensuite le périmètre de chaque offre et session (spécialité, lieu, mode et dates) avant leur enregistrement.

### Intégrité des preuves de présence

La clôture d'une inscription exige désormais une présence validée pour chaque journée calendaire de la session (heure locale d'Algérie). L'émission d'un document applique la même règle. Après clôture ou émission d'un document actif, les preuves de présence sont verrouillées pour éviter leur altération rétroactive. L'interface d'émission demande explicitement l'émetteur et sa référence pour les documents relevant d'un partenaire ou d'une autorité ; les ateliers privés restent limités aux attestations BA Labs.

### Inscription publique aux sessions

Le catalogue public propose une demande d’inscription aux sessions ouvertes pour les apprenants déjà connectés. Le nom et le profil sont saisis dans le formulaire ; l’adresse e-mail provient du compte authentifié et est contrôlée à nouveau par la RPC PostgreSQL. Les personnes non connectées sont redirigées vers l’espace apprenant : aucune création publique de compte n’est activée. Les doublons, fenêtres d’inscription et capacités sont contrôlés côté serveur ; les demandes excédentaires passent en liste d’attente. Une demande acceptée reste au statut PENDING jusqu’à confirmation par l’administration.

### Architecture des programmes pédagogiques

Les programmes sont des cursus distincts des parcours linéaires et des ressources de cours. Chaque programme possède un périmètre disciplinaire (un ou plusieurs départements, un ou plusieurs domaines). La mycologie peut être l’axe principal d’un cursus ou traverser plusieurs disciplines. Chaque programme possède une arborescence ordonnée de niveaux : cycle, année, semestre, bloc, module, unité, chapitre, séquence, leçon et activité. Les niveaux sont imbriqués par parent ; les racines sont des cycles ou des blocs. La base vérifie les codes, les rattachements domaine-département, les parents, l’ordre et l’absence de cycle. L’éditeur de programme ne stocke pas de cours, de leçons ni de supports : leur conception intervient dans une phase ultérieure.

L’architecture détaillée, les règles de niveaux et les frontières avec les parcours et ressources sont documentées dans [ACADEMIC-PROGRAMME-ARCHITECTURE.md](./ACADEMIC-PROGRAMME-ARCHITECTURE.md).

### Catalogue public des formations

Une page publique `#/formations` présente uniquement les offres au statut ACTIVE et les sessions au statut OPEN. Les politiques RLS permettent la lecture publique de ces deux ensembles sans exposer les partenaires, conventions, participants, présences ou documents internes. Le catalogue ne publie ni capacité, ni code de lieu, ni données personnelles.

### Facturation et suivi des règlements

Le registre de facturation conserve les références de factures externes, le responsable de facturation, la devise, le montant en unités mineures et le statut de règlement. L'écriture est réservée aux Owner/Admin et contrôlée par le régime de formation et la responsabilité financière inscrite dans la convention. Les transitions de règlement sont auditées ; un changement de statut exige une note, et un paiement confirmé ne peut être rétrogradé en impayé. Ce registre de suivi ne remplace pas la comptabilité ni l'émission réglementaire des factures.

### QR codes de vérification des documents

Les QR codes des attestations et certificats sont générés localement dans le navigateur avec une copie embarquée de QRCode.js (licence MIT, attribution conservée dans `src/vendor/QR-CODE-LICENSE.txt`). Aucun service QR tiers ne reçoit le jeton. Le PNG est téléchargeable depuis la console après émission ; il encode l'URL de vérification publique de l'Academy.
