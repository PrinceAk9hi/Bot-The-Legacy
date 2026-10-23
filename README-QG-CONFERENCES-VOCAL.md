# QG — Conférences, discipline et accueil vocal

## Déploiement Railway

1. Déployer **MonBotDiscord** (le bot QG principal). Les nouvelles commandes sont enregistrées uniquement sur le QG.
2. Conserver **une seule instance** du bot. Le stockage JSON existant utilise des écritures atomiques et des verrous dans le processus ; il ne permet pas plusieurs réplicas concurrents.
3. Monter un **volume Railway sur `/app/data`**. C'est le dossier `data` du projet déployé dans `/app`. Le bot vérifie `RAILWAY_VOLUME_MOUNT_PATH` avant d'activer les nouveaux services. Un disque de conteneur seul ne suffit pas. Sauvegarder le volume régulièrement. Si le répertoire de déploiement diffère, monter le volume sur le véritable dossier `data` du projet.
4. Les dépendances nécessaires sont déjà déclarées : `discord.js`, `@discordjs/voice`, `ffmpeg-static`, `prism-media` et `opusscript`. Utiliser `npm ci`. Node >= 22.12.0.
5. Le bot doit disposer des intents Guilds, GuildMembers et GuildVoiceStates. Activer Guild Members dans le portail si nécessaire.
6. Vérifier la hiérarchie du bot, Gérer les rôles, Voir le salon, Lire l'historique, Envoyer des messages, Intégrer des liens, Joindre des fichiers, Se connecter, Parler et Déplacer des membres selon les espaces.
7. Dans Discord : `/maj` → **Tout actualiser**. Les rôles disciplinaires et les panels de pilotage sont installés.
8. Ajouter la musique puis `/accueil-vocal activer`. L'accueil est désactivé par défaut.

Aucune connexion au serveur Discord ni modification du service Railway n'a été effectuée pendant le développement. Le déploiement et une recette dans le serveur restent nécessaires.

## Audio : fichiers exacts

Dossier : `assets/audio/qg/`.

| Fichier fourni (horaire) | Destination |
|---|---|
| 13_17_15 | `accueil.mp3` |
| 13_18_55 | `concertation.mp3` |
| 13_21_31 | `recruteurs-occupes.mp3` |
| 13_22_59 | `recruteurs-absents.mp3` |

Les quatre MP3 ont été copiés sans transformation depuis les pièces jointes locales, dont les noms n'ont pas le suffixe `(1)`. Les empreintes SHA256 sont vérifiées par les tests.

**Déposer ta musique sous `assets/audio/qg/ambiance.mp3`.** Aucun fond musical n'est fourni ou inventé. Sans ce fichier, l'activation explique ce qui manque. Pour remplacer la musique : déposer la nouvelle version, déployer puis `/accueil-vocal reconnecter`. Le dossier des assets appartient au code déployé, pas au volume des données.

Le bot utilise le vocal **1562136834396651560**. Un seul lecteur diffuse un flux PCM stéréo 48 kHz combinant les deux décodeurs FFmpeg. Le décodeur musical boucle indépendamment et ne redémarre pas lors des annonces. Un limiteur borne les échantillons pour éviter la saturation.

Réglages initiaux : musique 65 %, fond pendant Jessica 20 %, voix 100 %, baisse 1500 ms, remontée 2000 ms, intervalle de 15 secondes après la fin audible de la voix. Le fond à zéro est refusé. Les niveaux sont des gains linéaires ; le volume perçu dépend aussi du mastering du fichier choisi.

### Commandes vocales

- `/accueil-vocal activer`, `desactiver`, `statut`, `reconnecter`.
- `/accueil-vocal volume musique:65 jessica-fond:20 voix:100 baisse:1500 remontee:2000`.
- `/accueil-vocal intervalle secondes:15`.
- `/accueil-vocal tester annonce:accueil` (et les trois autres noms). Le test diffuse réellement dans le vocal configuré.

Direction et responsable recrutement uniquement. Le démarrage reconnecte automatiquement un accueil activé. Aucun candidat : connexion conservée, lecture et cycle arrêtés. Le bot refuse de voler une connexion qu'il utilise déjà dans un autre vocal du même serveur. Une coupure réseau peut interrompre l'audio ; aucun logiciel ne peut garantir une continuité pendant une perte de connexion Discord.

## Recruteurs et file d'attente

Les rôles configurés `recruitmentManagement` et `recruitmentLead` identifient les recruteurs. Les bureaux sont `schoolChannels.interview1` à `interview5` ; les candidats portent Attente entretien ou ont une candidature au statut `waiting_interview`.

Le panel permanent dans le salon du panel d'entretien propose : Disponible, Appeler le suivant, Commencer sur place, Terminer l'entretien, Concertation, Fin de concertation, Indisponible, File d'attente et Bureaux. Le panneau de surveillance est publié dans le même espace. Les messages sont réutilisés ; les contenus inchangés ne sont pas réédités.

Une prise en charge est réservée avant le déplacement. Les permissions et la hiérarchie sont recontrôlées. Un départ interrompt la session. Au redémarrage, les anciennes sessions deviennent interrompues et nécessitent une reprise explicite. Les mouvements directs dans Discord ne sont pas interprétés comme une concertation.

Annonces : nouvelle arrivée → accueil groupé ; tous les recruteurs présents explicitement en concertation → concertation ; tous en entretien → occupés ; aucun dans les bureaux → absents. Un recruteur disponible ou une situation mixte ambiguë n'entraîne pas d'annonce inexacte. Les statuts Indisponible ne sont pas assimilés à des entretiens.

## Conférences

Les réunions `/réunion` et `/notesmp` existantes sont conservées. `/conference` organise les convocations et le suivi de présence. Les deux utilisent les mêmes membres et absences ; créer une réunion ne convoque pas automatiquement toute la famille à une conférence.

- `/conference creer vocal:<salon> automatique:false tolerance:0` ouvre le formulaire titre, description et dates **JJ/MM/AAAA HH:mm, heure de Paris**. Les heures ambiguës ou inexistantes au changement d'heure sont refusées.
- `/conference modifier id:<id>` modifie une conférence encore planifiée.
- `/conference convoquer id:<id> membre:<membre> action:ajouter` ; actions retirer, exempter et retirer-exemption également disponibles. Répéter pour chaque membre. Les convocations sont figées au démarrage.
- `/conference demarrer`, `terminer`, `annuler` avec ID : confirmation requise.
- Démarrage et fin automatiques aux heures prévues, avec une résolution de surveillance de 10 secondes. Un démarrage trop tardif ou une interruption rend les données incertaines.
- `/conference presences`, `rapport`, `historique` : la direction consulte les dossiers complets ; un membre consulte uniquement ses propres convocations et compteurs.
- `/conference absences id:<conference>` liste les absences. Les options `absence:<id>` et `decision:Valider/Refuser` enregistrent la décision dans le système d'absences existant.

Les anciennes absences sans validation explicite sont traitées comme **en attente**, donc ne déclenchent pas de sanction automatique. Modifier les dates remet la validation en attente.

Le seuil est fixé à 10 minutes cumulées. La tolérance (0 à 120 secondes) s'ajoute au temps mesuré. Arrivées, départs, retours, retard et départ anticipé sont conservés dans le rapport JSON. Les sessions sont checkpointées ; les temps pendant un arrêt ou une coupure Gateway ne sont jamais extrapolés. Une conférence trop courte, annulée, une exemption ou une absence validée protège le membre. Une anomalie produit un dossier à examiner. Une absence en attente suspend l'application.

Politique par défaut : **validation humaine**. Avec `automatique:true`, les infractions fiables progressent d'un seul niveau, sous l'autorité de l'organisateur encore habilité et dans sa hiérarchie. Le contrôle définitif a lieu après la fin. Une erreur de permissions reste visible pour examen.

## Discipline

Rôles existants réutilisés par leurs identifiants : `warning1`, `warning2`, `lastChance`. Les rôles manquants sont créés sans permissions par `/maj`.

**Avertissement 1 → Avertissement 2 → Dernière Chance → dossier d'escalade.** Il n'existe pas de quatrième avertissement. Les rôles inférieurs sont retirés ; les motifs et décisions précédentes restent dans l'historique. Aucune exclusion ni rétrogradation automatique.

`/sc membre:<membre> raison:<motif> gravite:<niveau>` : affiche l'ancien et le nouveau niveau, puis demande confirmation. Direction et responsables Support/Recrutement ; Dernière Chance manuelle est réservée à la direction. Une hiérarchie insuffisante bloque l'application.

Rapports obligatoires : **1563175247216251072**, privé pour la direction et les responsables Support/Recrutement. Le bot refuse d'y publier si un autre rôle possède l'accès. Les échecs d'envoi sont conservés. Un envoi réseau incertain n'est pas répété aveuglément.

Boutons : Consulter (JSON avec historique et présences), Valider l'infraction, Corriger, Annuler, Examiner. Les corrections et annulations sont réservées à la direction et confirmées. Une contestation peut être déposée par le membre depuis le bouton de son MP. Un MP fermé est enregistré sans annuler la sanction. Une décision plus récente empêche l'annulation d'un ancien dossier d'écraser le niveau actuel.

`/derank membre:<membre> nature:disciplinaire` conserve le parcours existant et crée le rapport de grade précédent/nouveau grade, sans avertissement supplémentaire. Corriger un grade passe par `/rankup` ou `/derank`, avec le dossier cité dans le motif, afin de conserver les contrôles de hiérarchie.

Les avertissements de `/notesmp` passent également par le barème. Les avertissements proposés par `/sp` sont appliqués par les responsables habilités ou transmis à la direction pour validation si l'auteur est un membre de l'équipe Support.

## Fichiers

Créés : `systems/qgConferences.js`, `qgDiscipline.js`, `qgRecruitmentLive.js`, `qgVoiceReception.js` ; `utils/qgAudioMixer.js`, `qgDurability.js` ; commandes `conference.js`, `sc.js`, `accueil-vocal.js` ; `tests/qgConferencesVoice.test.js` ; quatre MP3 et cette documentation.

Modifiés : `index.js`, `systems/qgServer.js`, `qgMaintenance.js`, `qgInterviews.js`, `qgGrades.js`, `qgSchoolFamily.js`, `qgSanctionPanel.js`, `qgMeetingDelivery.js`, `utils/recruitmentData.js`.

## Vérifications

`npm test` exécute la suite existante et les nouveaux scénarios : présence cumulée et reconnexion, exemptions, absences, redémarrage, sanctions exclusives, escalade, idempotence, confirmation, contestation, annulation, confidentialité, conférences, file d'attente, bureaux, volumes, fichiers manquants, empreintes et décodage des quatre MP3, mixage réel avec une piste WAV de test, rampes et arrêt des décodeurs.

La connexion Discord réelle, le rendu audio entendu par les candidats, les permissions du serveur et le montage du volume Railway nécessitent une recette après déploiement. Aucun succès en production n'est supposé à partir des tests locaux.
