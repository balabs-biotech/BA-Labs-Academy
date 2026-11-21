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
