# BA Labs Academy

Frontend statique de BA Labs Academy, hébergé sur GitHub Pages et connecté en lecture seule au projet Supabase Academy.

## Architecture actuelle

- `index.html` : point d'entrée.
- `src/main.js` : navigation et vues publiques.
- `src/data.js` : adaptateur de lecture des données publiques.
- `src/config.js` : URL Supabase et clé publishable publique.
- `src/styles.css` : interface responsive.
- `.github/workflows/deploy-pages.yml` : déploiement automatique à chaque push sur `main`.

## Sécurité des données

Le navigateur utilise exclusivement une clé Supabase publishable. Aucune clé `service_role` ou clé secrète n'est incluse. La visibilité des données dépend des privilèges SQL et des politiques RLS du projet Supabase.

Les contenus internes, brouillons et fiches non publiées ne doivent pas être rendus accessibles au public. La publication reste contrôlée par les procédures éditoriales du backend.

## Déploiement

Dans GitHub : Settings → Pages → Build and deployment → Source : GitHub Actions.

Le workflow prépare le dossier `dist` et le publie avec GitHub Pages.
