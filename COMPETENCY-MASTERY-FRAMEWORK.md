# BA Labs Academy — référentiel de maîtrise des compétences

**Statut :** spécification d'architecture cible.  
**Implémentation :** non migrée ; aucune donnée historique n'est convertie par ce document.

## 1. Objet du référentiel

L'échelle L1–L4 décrit le degré de maîtrise démontré d'une compétence par un apprenant. Elle ne décrit ni la difficulté d'un cours, ni la profondeur d'un programme, ni le rang d'un nœud dans une arborescence.

Elle est indépendante :
- du niveau de difficulté d'un parcours ;
- de la structure Cycle → Bloc → Module → Unité → Chapitre → Séquence → Leçon → Activité ;
- du statut éditorial d'une compétence ;
- du score brut obtenu à une évaluation.

Une compétence est une capacité formulée avec un verbe d'action et un contexte d'exécution. Son niveau cible est défini par les exigences observables, pas par un intitulé abstrait.

## 2. Échelle canonique

| Niveau | Nom de travail | Autonomie et portée attendues | Nature des preuves |
|---|---|---|---|
| **L1** | Initiation guidée | Réalise une opération délimitée en suivant une procédure, avec assistance et contrôle rapproché. Identifie les paramètres et les erreurs évidentes. | Exercice guidé, démonstration commentée, contrôle de compréhension. |
| **L2** | Exécution autonome | Réalise correctement une tâche courante dans un contexte connu, choisit les outils prévus et respecte les critères qualité/sécurité. | Mise en situation standard, résultat reproductible, fiche de traçabilité complète. |
| **L3** | Adaptation et diagnostic | Adapte la méthode à une variation réelle, interprète les écarts, diagnostique les causes probables et justifie ses décisions. | Cas non trivial, diagnostic documenté, résolution d'incident ou comparaison argumentée. |
| **L4** | Conception et transfert | Conçoit ou améliore une méthode, arbitre entre contraintes, valide sa robustesse et transfère la compétence à un autre contexte ou à d'autres personnes. | Projet ouvert, protocole validé, audit, transfert démontré ou encadrement évalué. |

Les niveaux sont cumulatifs dans leurs prérequis de maîtrise : L3 suppose les capacités fondamentales L1 et L2 ; L4 suppose les capacités L1 à L3. Une évaluation isolée de L4 doit toutefois vérifier explicitement les prérequis pertinents et ne pas les présumer à partir du seul score.

## 3. Critères communs d'évaluation

Chaque compétence publiée doit préciser, pour chaque niveau visé :

1. **Action observable** : ce que l'apprenant réalise effectivement.
2. **Contexte** : conditions, matériel, contraintes et variabilité autorisée.
3. **Autonomie** : degré d'assistance autorisé.
4. **Critères qualité** : exactitude, reproductibilité, tolérances et traçabilité.
5. **Critères sécurité** : règles critiques qui ne peuvent être compensées par un score global.
6. **Preuve recevable** : production, observation, mesure, journal, dossier ou démonstration.
7. **Décision** : critères de réussite et motifs de non-validation.

Un score numérique peut contribuer à une décision, mais ne remplace pas les critères observables. Un échec sur un critère de sécurité critique ne doit pas être compensé par une moyenne élevée.

## 4. Modèle de preuve

Une preuve de compétence est un enregistrement immuable associé au minimum à :

- l'apprenant ;
- la compétence évaluée ;
- le niveau visé ;
- le niveau effectivement démontré, si validé ;
- l'évaluation et sa version ;
- la tentative ;
- la date ;
- le résultat et les critères satisfaits/non satisfaits ;
- l'évaluateur ou le mécanisme d'évaluation ;
- une référence vers l'artefact justificatif lorsque disponible.

Les nouvelles évaluations ajoutent des preuves ; elles ne réécrivent pas l'historique. Une correction administrative doit être tracée comme événement distinct, avec auteur, date, motif et valeurs antérieures.

Une tentative non validée constitue une preuve de non-démonstration à cette date ; elle n'efface pas une preuve positive antérieure. Les tableaux de bord doivent distinguer « dernière tentative », « meilleure preuve », « niveau actuellement reconnu » et « historique ».

## 5. Règle d'attribution du niveau reconnu

Le niveau reconnu n'est pas le maximum mécanique de toutes les tentatives.

Le moteur doit appliquer une politique de reconnaissance versionnée qui précise :
- le nombre et la diversité minimale des preuves ;
- les évaluations ou observations autorisées pour chaque compétence ;
- les critères critiques non compensables ;
- la fraîcheur requise pour les compétences sensibles à la pratique ;
- les règles de renouvellement, de suspension ou de réévaluation ;
- le traitement des preuves contradictoires.

Tant que cette politique n'est pas configurée et testée, le produit peut afficher les preuves et les scores, mais ne doit pas présenter un maximum historique comme une certification actuelle.

## 6. Distinctions de données obligatoires

Les notions suivantes ne doivent pas être fusionnées :

- **Niveau cible de compétence** : niveau auquel une compétence doit être démontrée.
- **Niveau démontré** : niveau soutenu par des preuves acceptées.
- **Difficulté du parcours** : difficulté globale indicative d'un parcours.
- **Score** : résultat quantitatif d'une évaluation particulière.
- **Progression** : avancement dans les ressources ou étapes d'un parcours.
- **Certification / attestation** : décision formelle d'émettre un document selon une règle et un émetteur déterminés.

Le niveau L1–L4 ne confère pas à lui seul un diplôme, une habilitation réglementaire ou une qualification reconnue par l'État.

## 7. Compatibilité avec le modèle historique

Le schéma historique emploie cinq valeurs : `INTRODUCTORY`, `FOUNDATION`, `INTERMEDIATE`, `ADVANCED`, `EXPERT`. Ces valeurs apparaissent dans plusieurs champs distincts, notamment difficulté de parcours, classement de compétence, niveau attendu et niveau démontré.

Aucune conversion automatique vers L1–L4 n'est autorisée à ce stade. Les correspondances intuitives ne sont pas suffisamment fiables : elles mélangeraient parfois difficulté, autonomie et profondeur d'expertise. En particulier, fusionner deux anciennes valeurs dans un même niveau ferait perdre une distinction historique ; les décaler arbitrairement pourrait rehausser ou dégrader une preuve.

Avant toute migration, il faut :
1. inventorier chaque colonne et chaque fonction qui consomme les cinq valeurs ;
2. séparer les champs de difficulté des champs de maîtrise ;
3. définir une table de correspondance approuvée par type de champ ;
4. conserver la valeur d'origine et la version de la règle de conversion ;
5. tester les vues, RPC, filtres, formulaires, exports et certificats ;
6. exécuter une migration additive, réversible et contrôlée ;
7. ne jamais réécrire les preuves historiques sans provenance de conversion.

Les cinq valeurs historiques restent donc valides dans les données existantes jusqu'à une migration dédiée.

## 8. Architecture d'implémentation cible

La mise en œuvre devra séparer au minimum :

- un référentiel de niveaux versionné ;
- les descripteurs L1–L4 par compétence ;
- les critères d'évaluation par niveau ;
- les preuves d'évaluation append-only ;
- la politique de reconnaissance du niveau courant ;
- les événements d'audit et la provenance des décisions.

Les règles de reconnaissance doivent être exécutées côté serveur. Les clients ne peuvent ni s'attribuer un niveau, ni modifier une preuve, ni émettre un document de certification en contournant les RPC autorisées.

## 9. Conditions de sortie de la phase architecture

Le référentiel est prêt à être implémenté lorsque :
- les quatre niveaux et leurs descripteurs sont validés ;
- les champs de difficulté et de maîtrise sont distincts ;
- la politique de reconnaissance est spécifiée ;
- les preuves et leur provenance sont définies ;
- la stratégie de compatibilité historique est testée ;
- les règles de sécurité et d'audit sont explicites.

Aucun catalogue de compétences ou contenu pédagogique n'est à remplir pour réaliser cette phase.
