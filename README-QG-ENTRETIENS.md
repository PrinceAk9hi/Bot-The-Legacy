# Réunions et espace recruteur QG

## Déploiement et installation

Le point d’entrée reste `index.js`. Son enregistrement des commandes QG inclut désormais `/entretien` avec un schéma propre au QG. Aucune dépendance supplémentaire ni variable d’environnement ajoutée.

Après le déploiement et la reconnexion du bot :

1. La direction utilise `/entretien installer`.
2. Cette commande crée ou réutilise les rôles sans permissions `Attente entretien` et `Membre refusé`.
3. Elle crée ou réutilise `✦・ESPACE RECRUTEUR`, le panel, les candidatures écrites, la discussion recruteurs, les disponibilités, le vocal d’attente et cinq bureaux.
4. Les salons déjà identifiés par `candidateReception`, `interview1` et `interview2` sont déplacés dans cet espace avec des permissions de recrutement. Leurs messages sont conservés. Les autres espaces de gestion ne sont pas déplacés.
5. Les candidatures écrites actives de l’ancien parcours sont republiées dans le nouveau salon. Les anciens dossiers et salons ne sont pas supprimés.

La réinstallation réapplique les permissions de ces salons ciblés. Elle ne supprime pas d’historique. Ne l’utiliser que lorsque cette actualisation est souhaitée.

`/entretien panel` ouvre les outils en privé. Le panel installé dans le salon reste utilisable après redémarrage.

## Parcours

- Questionnaire écrit existant en MP conservé. Les nouvelles réponses ont un délai de réponse mesuré ; ce délai inclut les pauses du candidat.
- Aucun ticket créé automatiquement lors de l’envoi du dossier.
- Accepter l’écrit : attribue **Attente entretien**, sans attribuer le grade familial.
- Refuser : attribue **Membre refusé** et prévient en MP lorsque les MP sont ouverts.
- DDS : demande d’informations adressée au salon configuré `foundationRequests`. Seuls Créateur, Gérant Global et propriétaires autorisés peuvent répondre. Réponse conservée et envoyée au recruteur en MP ; aucun avertissement ou sanction n’est appliqué.
- Ouvrir un ticket : salon dans l’espace recruteur, réservé au candidat, au recruteur et au bot. Les administrateurs Discord conservent leur accès natif. Une seconde demande réutilise le ticket existant. Aucun effacement automatique de ticket.
- Déplacer vers soi / Attente : sélection du candidat par son nom, vérification de sa position vocale et des permissions.
- Accepter l’oral : Membre Test, retrait des rôles d’attente/refus. Refuser l’oral : rôle refusé, retrait de l’attente.
- Décisions confirmées, permissions et hiérarchie revérifiées à l’exécution. Une opération dont la réponse réseau est incertaine nécessite vérification humaine avant reprise.
- Aucun `/bienvenue` ou `=bienvenue` ajouté ni déclenché.
- Questions : indique honnêtement que le guide oral attend les consignes de la direction. Les questions écrites existantes restent inchangées.

## Compte-rendu

Le formulaire contient Présentation + Communication, Date/décision, Durée PDT et identifiant du candidat prérempli. Ce dernier doit rester inchangé : le formulaire est lié au candidat sélectionné.

Destination : `1562090387588390942`, qui doit être privée. Le bouton **Voir candidature** vérifie les droits de recrutement et ouvre une copie privée des réponses. La décision saisie dans le CR est descriptive ; elle ne déclenche pas de modification de rôle.

La durée correspond au temps observé dans un bureau avec au moins un recruteur, jusqu’à la décision orale. Aucun temps hors ligne n’est reconstruit. Les bureaux sont suivis aux changements vocaux et chaque minute. Le CR peut être complété depuis un bureau jusqu’à 24 h après une décision prise par le même recruteur, même si le candidat a quitté le vocal.

## Réunions

L’événement Discord est créé lors de la configuration. La préparation des notes reste disponible immédiatement ou 1/3/6 heures avant.

L’accès du rôle `1561363081018474626` au salon `1562077941469552680` et à la discussion est accordé au début programmé. Le bot publie alors l’annonce dans `1561157213160996866`. Le contrôle a lieu toutes les minutes : décalage possible jusqu’à environ une minute, davantage si Discord est indisponible. Au redémarrage, une réunion encore dans son créneau peut être ouverte ; une réunion déjà terminée ne déclenche pas d’annonce tardive.

À la fin prévue, l’accès de ce rôle est refermé si aucune autre réunion n’est en cours. Les rôles disposant d’Administrateur contournent toujours les restrictions Discord. Les notes et grades restent appliqués uniquement par `/notesmp`.

## Permissions et stockage

Bot : gérer les salons, gérer les rôles avec hiérarchie suffisante, déplacer les membres, voir/envoyer/lire l’historique, joindre des fichiers, intégrer des liens et gérer les événements programmés.

Les rôles de recrutement reçoivent le droit de déplacement dans l’espace recruteur. Les dossiers sont réservés au recrutement et à la direction. Les candidats en attente voient les disponibilités et l’attente ; les bureaux sont visibles mais leur connexion est réservée au déplacement par un recruteur.

Stockage existant `qgServer` : `schoolFamilyRecruitment`, `schoolInterviewSessions`, `schoolInterviewTimers`, `schoolInterviewReports`, `schoolInterviewDds`, `schoolInterviewPanel`, identifiants dans `schoolRoles/schoolChannels/schoolCategories`. Pas de nouvelle base. La durabilité dépend du volume persistant existant sur Railway. Les dossiers et CR nécessitent une politique de purge administrative ; aucune suppression de dossiers historiques n’est effectuée par cette livraison.

## Vérifications

Contrôle de syntaxe Node des cinq fichiers JavaScript modifiés/créés. Pas de démarrage du bot, de test connecté à Discord, ni de validation visuelle desktop/mobile. Les droits effectifs, déplacements, MP et événements doivent être vérifiés après déploiement. Aucun test automatisé fonctionnel exécuté pour cette modification.
