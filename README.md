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

Les lectures sont filtrées par les statuts de publication et les politiques PostgreSQL RLS. Les brouillons, données internes et fiches non publiées ne doivent jamais être rendus accessibles au public. Les opérations éditoriales restent réservées aux fonctions contrôlées du backend.

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
