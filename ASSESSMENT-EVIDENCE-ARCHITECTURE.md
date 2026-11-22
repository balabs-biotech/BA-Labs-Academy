# BA Labs Academy — architecture des évaluations et des preuves

**Statut :** spécification d'architecture ; les évolutions décrites ne sont pas encore implémentées.

## 1. Principe

Une évaluation est un dispositif de collecte de preuves. Elle ne se réduit pas à un questionnaire à choix multiples et ne produit pas automatiquement une maîtrise dès qu'un seuil de score est atteint.

Le système distingue :
- l'objectif pédagogique évalué ;
- la compétence concernée ;
- le niveau L1–L4 visé ;
- la méthode d'évaluation ;
- les critères et seuils de décision ;
- la preuve recueillie ;
- la décision d'un évaluateur ou d'une règle automatisée explicitement autorisée.

## 2. Modalités d'évaluation

Le modèle doit prendre en charge plusieurs modalités, sans imposer une seule interface à toutes :

| Modalité | Usage | Preuve principale |
|---|---|---|
| QUESTIONNAIRE | Connaissances, vocabulaire, compréhension de principes | Réponses et score |
| CALCUL / ANALYSE | Raisonnement quantitatif, interprétation de données | Résultat, démarche et justification |
| OBSERVATION_PRATIQUE | Gestes, séquences opératoires, respect des règles | Grille d'observation horodatée |
| PRODUCTION / LIVRABLE | Rapport, protocole, préparation, schéma, jeu de données | Artefact versionné et critères de revue |
| DIAGNOSTIC / CAS | Analyse d'un écart ou résolution d'un problème contextualisé | Diagnostic, hypothèses et décision argumentée |
| ORAL / SOUTENANCE | Explication, justification et transfert | Grille d'entretien et compte rendu |
| SIMULATION | Procédure ou décision en environnement simulé | Traces d'exécution et résultat |
| PORTFOLIO | Progression sur plusieurs situations | Ensemble de preuves reliées et synthèse |

Les questionnaires à choix unique restent utiles, mais ils ne suffisent pas à prouver un geste technique, une autonomie en laboratoire, une capacité de diagnostic ou la conception d'un protocole.

## 3. Constat sur le moteur actuel

Le moteur actuel crée une preuve de compétence à partir d'une tentative d'évaluation et copie le niveau attendu de la liaison évaluation-compétence lorsque le score atteint le seuil.

Cette règle est acceptable comme résultat d'un contrôle de connaissances si la compétence évaluée est strictement cognitive et si le niveau est explicitement limité à ce que le questionnaire mesure. Elle est insuffisante pour déclarer une compétence pratique ou un niveau global L1–L4.

**Blocage de conception :** une réussite à un questionnaire ne doit pas attribuer automatiquement le niveau pratique attendu. Le type d'évaluation et les critères effectivement mesurés doivent autoriser le type de preuve créé.

Avant la mise en production du référentiel L1–L4, il faut séparer :
- résultat de tentative ;
- preuve liée à un critère ;
- niveau visé ;
- niveau observé ;
- validation par évaluateur ;
- niveau reconnu par la politique de maîtrise.

## 4. Architecture de données cible

Les entités doivent rester distinctes et liées par identifiants stables :

- **Assessment** : identité, version, modalités, public et statut.
- **Assessment component** : question, cas, tâche, station pratique ou livrable.
- **Rubric** : critères, pondération, seuils et critères critiques.
- **Rubric criterion** : comportement ou résultat observable.
- **Competency mapping** : compétence et niveau visés par l'évaluation.
- **Attempt** : session d'évaluation d'un apprenant, versionnée.
- **Response / observation** : réponse ou observation recueillie pour un composant.
- **Evidence** : preuve append-only reliée à une compétence et à un ou plusieurs critères.
- **Review** : décision d'un évaluateur, identité, horodatage et justification.
- **Mastery decision** : niveau reconnu selon une politique versionnée.

Une même tentative peut produire plusieurs preuves. Une preuve peut être réutilisée dans un portfolio, mais ne doit pas être dupliquée ni détachée de sa provenance.

## 5. Évaluation pratique

Pour les ateliers et travaux de laboratoire, une grille d'observation doit pouvoir enregistrer :

- étapes attendues et ordre éventuel ;
- préparation du poste et du matériel ;
- gestes et paramètres critiques ;
- résultat obtenu et tolérances ;
- incidents, écarts et actions correctives ;
- respect des règles de sécurité et de traçabilité ;
- degré d'assistance nécessaire ;
- évaluateur et date.

Les critères critiques de sécurité et de conformité sont non compensables : leur échec bloque la validation, indépendamment du score global.

L'interface doit fonctionner sur mobile et permettre une saisie rapide, mais la décision reste traçable côté serveur.

## 6. Règles de preuve

- Les réponses automatiques peuvent produire une preuve de connaissance dans le périmètre réellement mesuré.
- Une observation pratique requiert une grille adaptée et une observation attribuable.
- Un livrable requiert une référence stable, une version et une décision de revue.
- Une évaluation orale requiert une grille et un compte rendu minimal.
- Une preuve négative ne supprime pas les preuves positives antérieures.
- Une correction ou annulation est un événement d'audit, jamais une réécriture silencieuse.
- Une preuve doit toujours conserver la version de l'évaluation et de la grille utilisées.

## 7. Sécurité et responsabilités

Les apprenants peuvent consulter leurs résultats et les preuves qui leur appartiennent. Ils ne peuvent pas créer ou modifier une décision de maîtrise directement.

Les évaluateurs ne peuvent décider que dans le périmètre de leurs habilitations. Les éditeurs peuvent configurer les évaluations en brouillon ; la publication et l'attribution des rôles d'évaluation relèvent des responsabilités éditoriales prévues.

Les RPC serveur valident les droits, l'état de la version, l'appartenance de la tentative, les critères et les pièces de preuve. Les clés de correction restent invisibles aux apprenants.

## 8. Ordre de construction

1. Définir les modalités et composants d'évaluation.
2. Définir les grilles et critères observables.
3. Relier chaque critère à une compétence et à un niveau cible L1–L4.
4. Séparer le résultat de tentative de la preuve de compétence.
5. Construire le workflow de revue et de validation.
6. Définir la politique de reconnaissance du niveau courant.
7. Relier les décisions aux parcours et aux attestations, avec provenance complète.

Aucun questionnaire, atelier, protocole ou contenu d'évaluation fictif ne doit être préchargé pendant cette phase.
