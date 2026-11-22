# BA Labs Academy — cycle de vie des contenus et variantes linguistiques

**Statut :** architecture cible ; aucune migration de schéma n'est introduite par ce document.

## 1. Identité et version d'un contenu

Un contenu pédagogique canonique possède une identité stable et des versions éditoriales successives. Une version publiée est immuable : toute correction substantielle crée une nouvelle version, avec une relation explicite vers la version précédente.

Les identifiants techniques et les codes métier ne doivent pas être confondus :
- identifiant UUID : identité persistante de l'enregistrement ;
- code métier : identité éditoriale stable du contenu ;
- numéro/étiquette de version : état précis du contenu ;
- slug : adresse de consultation, modifiable sous contrôle éditorial.

Une version publiée ne doit jamais être écrasée par une sauvegarde de brouillon. Une nouvelle version doit conserver le lien vers l'ancienne, l'auteur, la date, le motif du changement et l'état de validation.

## 2. Cycle éditorial

Cycle cible :

`PLANNED → OUTLINE → DRAFT → IN_REVIEW → APPROVED → PUBLISHED → SUPERSEDED`

Les transitions de retour (correction demandée, retrait de revue, rejet) sont explicites et auditées. Les contenus archivés restent consultables par les rôles autorisés et ne sont pas effacés physiquement lorsqu'ils sont liés à des parcours, évaluations, preuves ou certificats.

La publication doit vérifier :
- présence des métadonnées obligatoires ;
- rattachement disciplinaire et domaine cohérents ;
- objectifs et compétences associés ;
- ressources avec licence et provenance ;
- version et langue déclarées ;
- validation éditoriale ;
- accessibilité et contrôles de sécurité applicables.

## 3. Traductions et variantes linguistiques

Une traduction n'est pas un contenu indépendant sans lien avec sa source. Chaque variante linguistique doit pointer vers une identité de contenu canonique et préciser :
- langue et région éventuelle (BCP 47) ;
- version source traduite ;
- version de la traduction ;
- état de traduction (à traduire, en cours, relue, publiée, obsolète) ;
- traducteur et relecteur ;
- date de synchronisation avec la source.

Une modification de fond de la version source doit marquer les traductions concernées comme potentiellement obsolètes. Elle ne doit pas écraser leur texte ni les retirer de l'accès sans décision éditoriale.

Les libellés d'interface, les métadonnées et le corps pédagogique sont des couches distinctes. Traduire l'interface ne signifie pas que les contenus sont disponibles dans cette langue.

## 4. Ressources jointes

Les ressources de `academy_content_assets` possèdent déjà une version technique et un lien vers la version précédente. Ce versionnement de fichier ne remplace pas le versionnement éditorial du contenu auquel la ressource est attachée.

Chaque ressource doit conserver :
- son code stable dans le contenu ;
- sa nature et son format ;
- sa langue ;
- son type de livraison ;
- sa licence et son attribution ;
- son empreinte cryptographique lorsque pertinente ;
- sa version et son lien vers la précédente.

Le remplacement d'un fichier ne doit pas changer silencieusement le contenu d'une version publiée. La publication d'une nouvelle ressource doit être rattachée à une nouvelle version éditoriale ou à une correction formellement tracée.

## 5. Relations canoniques

Les modules, parcours, programmes et évaluations référencent des versions précises des contenus, ou une règle explicite de résolution vers la dernière version publiée.

Le système doit distinguer :
- « dernière version publiée » pour la découverte ;
- « version suivie par l'apprenant » pour la continuité ;
- « version utilisée lors de l'évaluation » pour la preuve ;
- « version figée dans le certificat » pour l'audit.

Une mise à jour ne doit pas modifier rétroactivement le parcours suivi, les réponses d'une tentative ou les preuves historiques.

## 6. Écarts à traiter avant le remplissage

L'architecture existante possède un workflow éditorial et un versionnement des ressources jointes. Le versionnement complet de l'identité du contenu, les liens de traduction et la résolution des versions consommées par les parcours et évaluations doivent être vérifiés et complétés avant de remplir massivement le catalogue.

Aucune migration automatique ni duplication du catalogue n'est autorisée pendant cette phase. Il faut d'abord inventorier les références existantes, définir les clés canoniques et les règles de conservation.

## 7. Critères de sortie

- Identité stable d'un contenu et version immuable définies.
- Transitions éditoriales et rôles définis.
- Traductions reliées à une version source précise.
- Ressources versionnées indépendamment du texte principal.
- Parcours, programmes, évaluations et preuves reliés à des versions déterministes.
- Plan de migration additive, réversible et testé.
