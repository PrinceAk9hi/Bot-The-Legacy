# Historique des migrations

Ce fichier regroupe les anciennes listes `MIGRATION-xx-FICHIERS.txt`. Chaque
entrée indique le thème de la livraison et les fichiers envoyés à ce moment-là.
Certains fichiers cités ont depuis été supprimés ou remplacés : la liste reflète
l'état de la livraison, pas le dépôt actuel. Pour le détail de chaque version,
consulter l'historique Git.

## 91 — Relance des candidats en attente d'entretien

- Le délai part de la dernière nouvelle du candidat : acceptation écrite, passage dans le vocal d'attente ou
  un bureau, message dans le salon des disponibilités.
- 48 h sans nouvelles : MP de relance. 24 h avant la fermeture : dernier rappel. Après
  `config.interviewExpiryDays` (7 jours par défaut) : dossier « Fermée — sans réponse du candidat » (fiche
  grise), rôle d'attente retiré, MP ; le candidat peut recandidater. Journal : `recruitment.expired`.
- Modifiés : `systems/qgInterviews.js`, `systems/qgServer.js`, tests.

## 90 — Sécurité du serveur

- Anti-phishing / token grab (tout le monde sauf le propriétaire) : liens qui imitent Discord, Steam ou Roblox,
  liens d'arnaque (appât + promesse + lien inconnu), domaines interdits et fichiers exécutables → message
  supprimé, pause 6 h, MP « compte peut-être piraté ».
- Compte piraté : même message dans 3 salons en 30 secondes → tous supprimés, pause 6 h, MP.
- Hors Direction : @everyone / @here, mentions de masse (5 membres ou 3 rôles), invitations vers un autre
  serveur → supprimés, pause 10 minutes.
- Anti-raid : 10 arrivées en 60 secondes → mode raid 30 minutes (prolongé à chaque vague), comptes de moins
  de 7 jours expulsés. =raid on / =raid off (Direction).
- Anti-nuke (journal d'audit) : salons / rôles supprimés ou créés, bans, expulsions, webhooks en masse →
  l'auteur perd ses rôles (un bot est expulsé) ; bot ajouté hors propriétaire → expulsé ; Administrateur donné
  → retiré. Exemptés : propriétaire, le bot, `config.securityTrustedIds`.
- Alertes dans le journal de la direction (mention du propriétaire pour raid et nuke). =securite : état.
- Ajoutés : `systems/qgSecurity.js`, `tests/qgSecurity.test.js`. Modifiés : `systems/qgServer.js`,
  `systems/qgHelp.js`.

## 89 — Compte rendu obligatoire après l'entretien

- « Accepter » et « Refuser » du panel recruteur ouvrent d'abord le formulaire de compte rendu, pré-rempli
  (« Accepté — arrivée le JJ/MM/AAAA » + durée de PDT, ou « Refusé le JJ/MM/AAAA » + « Aucune »). La
  décision n'est appliquée qu'à l'envoi du formulaire, avec les mêmes contrôles qu'avant, puis le compte rendu
  est publié. Le salon des comptes rendus est vérifié avant la décision. Le bouton « Compte rendu » reste pour
  compléter un dossier.
- Statistiques de recrutement : nombre de comptes rendus manquants, au total et par recruteur.
- Modifiés : `systems/qgInterviews.js`, `systems/qgRecruitmentStats.js`, tests.

## 88 — Fin de PDT automatique, membre de la semaine, familles invitées aux animations

- Fin de période de test : à l'échéance (PDT ouverte avec /pdt, sinon arrivée dans la famille + 7 jours,
  `config.testPeriodDays`), une fiche est publiée dans le salon 1562090387588390942 avec l'activité de la
  période et les observations. Boutons (Direction, responsable recrutement) : Valider → Membre Confirmé,
  Prolonger 7 jours (nouvelle fiche à la nouvelle échéance), Retirer de la famille (motif, même retrait
  que =derank). La fiche passe en vert, gris ou rouge et ses boutons sont désactivés.
- Membre de la semaine : chaque lundi à partir de 10 h, annonce dans le salon 1561157222032212059 du membre
  de la famille le plus actif (1 pt/min de vocal, 2 par message, 30 par animation présente ; Direction
  exclue), podium, et rôle « ⭐ Membre de la semaine » (créé si besoin, retiré au gagnant précédent).
- Animations : bouton « Familles invitées » à la création/modification ; les membres du serveur dont le
  compte Roblox est dans ces familles reçoivent les rappels comme les inscrits et apparaissent dans les
  participants. Nouveau rappel 15 minutes avant (en plus de celui d'une heure) ; au début, l'organisateur
  reçoit en MP la liste des inscrits et des invités.
- Ajoutés : `systems/qgTestPeriod.js`, `systems/qgMemberOfWeek.js`, `tests/qgTestWeekAnimations.test.js`.
- Modifiés : `systems/qgAnimations.js`, `systems/qgExpel.js` (retrait réutilisable), `systems/qgServer.js`.

## 87 — Sauvegardes, stats de recrutement, transfert de voc, alerte autres familles

- Sauvegarde quotidienne (à partir de 4 h, heure de Paris) de tous les fichiers .json de data/ dans le salon
  privé « 💾・sauvegardes », créé à côté du journal de la direction avec les mêmes accès. 14 gardées.
  =sauvegarde (immédiate) et =restore (en réponse au fichier, sinon la plus récente) avec bouton de
  confirmation : l'état actuel est sauvegardé avant, puis le bot redémarre.
- Statistiques de recrutement chaque lundi à partir de 9 h dans le journal de la direction, et
  =statsrecrutement [jours] : candidatures reçues, décisions écrites et orales, taux d'acceptation,
  attente moyenne avant l'entretien, décisions par recruteur, dossiers en cours.
- Vocal temporaire : si le propriétaire part et que d'autres restent, la voc passe automatiquement au membre
  suivant ; menu « Transférer la propriété » dans le panel (membre présent dans la voc).
- Autres familles School : alerte dans le journal de la direction quand un membre déjà vérifié rejoint une
  nouvelle famille, ou qu'un membre arrivé depuis moins de 7 jours en fait déjà partie.
- Ajoutés : `systems/qgBackup.js`, `systems/qgRecruitmentStats.js`, `tests/qgBackupStats.test.js`.
- Modifiés : `systems/qgServer.js`, `systems/qgSchoolVoice.js`, `systems/qgVoiceControls.js`,
  `systems/qgOtherFamilies.js`, `systems/qgHelp.js`.

## 86 — Réglages du vocal dans le tchat de la voc

- À la création d'un vocal temporaire, le panel de réglages (renommer, places, verrouiller, autoriser ou
  retirer un membre) est posté dans le tchat du vocal, avec mention du propriétaire. Le propriétaire voit
  l'historique de ce tchat ; les autres membres restent sans historique.
- Les panneaux « Mon vocal temporaire » des salons commandes sont supprimés et ne sont plus republiés.
- Modifiés : `systems/qgSchoolVoice.js`, `systems/qgSchoolSetup.js`, `systems/qgMaintenance.js`, tests.

## 85 — Musique de fond dans le vocal d'attente entretien

- Quand un candidat attend, le bot diffuse en boucle `assets/audio/qg/attente-entretien.mp3`
  (Kingdom Beat, Slowed) à plein volume ; la musique baisse pendant l'annonce puis remonte à fond.
- Une seule annonce : « accueil », à l'arrivée puis toutes les 30 secondes. Les annonces « recruteurs
  absents » et « recruteurs en bureau » ne sont plus diffusées.
- Modifiés : `systems/qgVoiceReception.js`, `tests/qgConferencesVoice.test.js`.

## 84 — Présentation du QG dans son salon

- La présentation (histoire, fondateurs, inspiration, valeurs, repères, rejoindre la famille) est publiée
  seule dans le salon 1561157179803701368, au démarrage du bot (un message, modifié ensuite).
- Le salon 📚・aide-et-faq retrouve son texte d'origine.

## 83 — Fiches de candidature traitées

- Fiche acceptée : embed vert ; refusée : rouge ; boutons (Accepter, Refuser, DDS, ticket) désactivés une
  fois la décision prise. Statut affiché en clair. Les anciennes fiches sont mises à jour au démarrage.

## 82 — Aide et FAQ version communautaire

- Salon 📚・aide-et-faq : présentation du QG (Qualité & Grandeur), histoire (ouverture, fondateurs,
  superviseurs, création du serveur), inspiration, valeurs, repères sur le serveur et, à la fin, comment
  rejoindre la famille (conditions et étapes). Textes modifiables dans `systems/qgCommunityHelp.js`.

## 81 — Plus de notifications par rôle

- Vérification d'entrée : après la tranche d'âge, le règlement s'affiche directement (plus de question
  sur les notifications). Les anciens rôles de notification encore détenus sont retirés à la validation.
- L'ancien panel « Tes notifications » ne donne plus de rôle et n'est plus republié ; `=actualite … | ping`
  ne mentionne un rôle que s'il existe encore.
- Modifiés : `systems/qgEntryVerification.js`, `systems/qgSchoolSetup.js`, `systems/qgSchoolNews.js`, tests.

## 80 — Familles actives et profils

- `activeFamilies` dans `config/qg.js` : les familles actives (49 depuis le retrait de BLACKLIST, inactive) (liste des gérants). Une communauté de
  « schoolfamily » absente de la liste est une famille inactive : ni signalée, ni affichée. Alias pour les
  communautés nommées autrement (LA NIGHTMARE → NIGHTMARE, CRPS → Crips). Diablos n'a pas de communauté.
- La famille s'affiche dans /profil (sous la carte) et dans /user (section Roblox).

## 79 — Fiche de réunion dès la programmation

- Journal de la direction : une fiche par réunion publiée dès la programmation (titre, date, durée,
  statut), puis modifiée à chaque étape (notes et décisions en préparation, validation, application,
  annulation) au lieu d'être republiée. Réunions déjà programmées comprises.

## 78 — Journal de la direction

- Salon 1570572219023630357 : actions importantes faites par une personne (rankup, derank, rétrogradation,
  avertissements avec niveau et motif, sanctions, notes, PDT, décisions et surveillances de la Fondation,
  candidatures, ouverture du recrutement, référent, annonces…). Pas les actions automatiques ni les logs.
- Après /notesmp : compte rendu complet de la réunion (notes, détails, décisions, motifs, résultats),
  une seule fois, découpé si besoin.
- Nouveau : `systems/qgDirectionJournal.js`, `tests/qgDirectionJournal.test.js`.
  Modifiés : `utils/qgAdmin.js`, `systems/qgMeetingDelivery.js`.

## 77 — Annonce de réunion programmée

- Fin de la programmation /réunion : annonce dans le salon d'annonces avec mention de la famille (titre,
  description, date et heure, durée, vocal, lien de l'événement Discord). Une seule fois ; barrée sans
  mention si la réunion est annulée ; nouvel essai chaque minute si l'envoi échoue (couvre aussi les
  réunions déjà programmées). Modifié : `systems/qgMeetings.js`, tests.

## 76 — Panel d'aide et emojis des gestions

- Le centre de commandement (salon 1565484861660069978) est remplacé par un panel d'aide : toutes les
  commandes slash (lues sur Discord, avec leurs sous-commandes) et les commandes = avec leur fonction,
  par rubrique (membres, staff, direction). Republié seulement quand la liste change.
- « Rejoindre une gestion » : chaque équipe (6, casino compris) avec l'emoji du badge de son rôle
  d'exécutant, dans le texte et dans le menu.
- Nouveau : `systems/qgHelp.js`, `tests/qgHelp.test.js`. Modifiés : `systems/qgPanels.js`,
  `systems/qgServer.js`, `systems/qgMaintenance.js`.

## 75 — Autres familles School

- Tous les membres du serveur dont le compte Roblox est connu sont vérifiés une fois par jour : une
  communauté créée par « schoolfamily » (@colonelrqt2), autre que le QG, est signalée dans le journal
  de modération avec le nom de la famille sans « SCHOOLRP » (`NOM | SCHOOLRP` → `NOM`).
- `=familles` (direction, responsable recrutement) : liste actuelle et nombre de comptes vérifiés.
- Données publiques Roblox, sans cookie. Nouveau : `systems/qgOtherFamilies.js`,
  `tests/qgOtherFamilies.test.js`. Modifié : `systems/qgServer.js`.

## 74 — Panel recruteur groupé, décisions sans confirmation

- Panel entretien en trois groupes : Déplacements (Déplacer vers soi, Attente, Ping), Décision
  (Accepter, Refuser), Dossier et entretien (Voir candidature, Compte rendu, Questions).
- Accepter / Refuser s'appliquent tout de suite, sans bouton de confirmation.
- Effectif : titre Responsables avec l'emoji :whitegavel:.

## 73 — Membres sous chaque grade dans l'effectif

- Salon effectifs : sous chaque grade de la famille, une ligne en petit par membre `@membre - date`
  (date d'arrivée dans la famille, du plus ancien au plus récent). Pas de détail dans le guide famille.
- L'effectif passe sur plusieurs messages s'il dépasse la limite de texte de Discord.

## 72 — Emojis du serveur dans les titres de l'effectif

- Direction :crown~1: (deuxième emoji « crown »), Responsables :gavel:, Grades de la famille
  :whitediamond:, Exécutants :support:. Repli sur les emojis Unicode si absents.

## 71 — Ordre des blocs de l'effectif

- Direction, Responsables, Grades de la famille, Exécutants (salon effectifs et guide famille).

## 70 — Casino dans « Devenir exécutant », rôle d'exécutant des responsables

- Panel « rejoindre une gestion » : sixième équipe **Exécutant du Casino** (candidature traitée par le
  Responsable du casino, deux places hors responsable comme les autres équipes).
- Un membre qui reçoit une responsabilité reçoit automatiquement le rôle d'exécutant de la même équipe
  (aussi pour le casino) ; rattrapage des responsables déjà en place toutes les 5 minutes. Jamais retiré.
- Modifiés : `systems/qgPanels.js`, `systems/qgSchoolApplications.js`, `systems/qgCommunityUpgrade.js`, tests.

## 69 — Casino dans l'effectif

- Responsable du casino et Exécutant du casino ajoutés aux blocs Responsables et Exécutants
  (salon effectifs et guide famille). Modifiés : `systems/qgCommunityUpgrade.js`, tests.

## 68 — Nouveaux emojis de rôle pris en compte

- La correspondance badge → emoji est recalculée quand un emoji est ajouté, retiré ou remplacé sur
  le serveur (avant : seulement si le badge du rôle changeait). Modifiés : `utils/qgRoleBadges.js`, tests.

## 67 — Effectif sans liste détaillée, responsables séparés

- Salon effectifs : un seul message (total, Direction, Grades, Responsables, Exécutants), sans la liste
  détaillée des membres ; les anciennes pages suivantes sont supprimées.
- Responsables et exécutants dans deux blocs séparés (salon effectifs et guide famille).
- Modifiés : `systems/qgCommunityUpgrade.js`, `tests/qgVoiceTools.test.js`

## 66 — Prestigieux au-dessus de Senior dans les promotions

- Ordre des grades : Test → Confirmé → Expert → Senior → Prestigieux pour /rankup, /derank, le panel
  membre, les demandes de promotion, la rétrogradation liée au tag et le menu des réunions.
- Modifiés : `systems/qgGrades.js`, `systems/qgUserPanel.js`, `systems/qgTagWatch.js`,
  `systems/qgSchoolFamily.js`, `systems/qgMeetings.js`, `systems/qgSchoolApplications.js`, tests

## 65 — Guide famille : effectif complet, Référent du QG, Prestigieux au-dessus de Senior

- « 📈 Grades et effectifs » du guide famille : direction, grades et exécutants en `EMOJI @Rôle - NOMBRE`,
  emojis retrouvés d'après les badges. Direction : Créateur, Gérant Global, Référent du QG.
- Membre Prestigieux affiché au-dessus de Membre Senior (guide, effectifs, organigramme).
- Modifiés : `systems/qgPanels.js`, `systems/qgCommunityUpgrade.js`, `systems/qgSchoolSetup.js`

## 64 — Badges de rôle reconnus dans l'effectif

- Le bot compare l'image du badge (icône) de chaque rôle aux emojis du serveur et affiche l'emoji
  correspondant : `EMOJI @Rôle - NOMBRE`. Correspondances mémorisées (`schoolRoleBadgeEmojis`),
  recalculées si un badge change. Repli : nom de l'emoji, puis emoji Unicode du rôle.
- Nouveau : `utils/qgRoleBadges.js`. Modifiés : `systems/qgCommunityUpgrade.js`, `tests/qgVoiceTools.test.js`

## 63 — Effectif complet avec les emojis du serveur

- Salon effectif : direction (Créateur, Gérant Global, Référent du QG), grades de la famille et exécutants (responsables compris), chaque rôle
  avec son emoji du serveur, le rôle et le nombre de personnes qui l'ont. L'emoji est trouvé par son
  nom (le même que le rôle) ; `rosterEmojis` dans `config/qg.js` permet d'en imposer un par clé de rôle.
- Modifiés : `systems/qgCommunityUpgrade.js`, `tests/qgVoiceTools.test.js`

## 62 — Panel intégré, effectif par grade, =clear et =mvvoc

- Panel entretien en composants intégrés : chaque bouton est à côté de sa fonction. Toutes les
  actions visent directement le candidat en Attente entretien du vocal ; une liste n'apparaît que
  s'il y en a plusieurs. L'ancien message du panel est remplacé une fois.
- Annonce « nouvelle recrue » envoyée dès l'acceptation (avant : jusqu'à 1 minute ou plus).
- Salon effectif : récapitulatif des grades (badge du rôle, rôle, nombre de membres) en tête,
  en composants intégrés ; les anciennes pages sont remplacées une fois.
- `=clear <nombre>` : supprime la commande et les messages précédents (1 à 100), sans réponse.
- `=mvvoc [#vocal]` : déplace tout un vocal dans le prochain vocal que l'auteur rejoint (2 min).
- Nouveaux : `systems/qgVoiceTools.js`, `tests/qgVoiceTools.test.js`. Modifiés : `systems/qgInterviews.js`,
  `systems/qgRecruitmentHub.js`, `systems/qgCommunityUpgrade.js`, `systems/qgServer.js`, tests.

## 61 — Panel recruteur direct et appel des candidats

- Le message du panel recruteur affiche directement tous les boutons, chacun décrit dans l'embed.
  Retirés : l'onglet « Entretiens et vocaux » et « Consulter les dossiers ».
- Nouveau bouton **Ping les candidats** : mentionne Attente entretien dans le salon 1562136833104547871
  et les invite à rejoindre le vocal d'attente (2 minutes minimum entre deux appels).
- **Voir candidature** et **Compte rendu** prennent directement le candidat s'il est seul dans le bureau.
- Modifiés : `systems/qgInterviews.js`, `systems/qgRecruitmentHub.js`, `tests/qgConferencesVoice.test.js`,
  `tests/qgAcceptLeaderboard.test.js`

## 60 — Rappels de communauté en MP et rattrapage

- Le rappel de bienvenue part en MP **et** dans le salon 1561157222032212059.
- Rattrapage automatique : les membres de la famille qui n'ont pas encore demandé à rejoindre la
  communauté Roblox reçoivent le rappel une fois (MP + salon, 5 au plus toutes les 10 minutes).
- Modifiés : `systems/qgInterviews.js`, `utils/qgRoblox.js`, `tests/qgAcceptLeaderboard.test.js`,
  `README-QG-ADMIN.md`

## 59 — Carte du classement et rappel de bienvenue

- `/classement` s'affiche en carte image « Journal du QG », comme `=niveau` (avatars, podium,
  « Ta position », page) ; repli sur l'embed si le rendu échoue. Nouveau : `utils/qgLeaderboardCard.js`.
- Entretien accepté depuis le panel recruteur : message dans le salon 1561157222032212059
  (tag du serveur obligatoire, demande à rejoindre la communauté Roblox avec le lien, importance
  de l'activité). Modifié : `systems/qgInterviews.js`.

## 58 — `=acp` et `/classement`

- `=acp @membre | ID | PseudoRoblox [motif]` : accepte la demande d'adhésion au groupe Roblox
  du QG (1031372038, `config/qg.js`) et donne le rang Membre confirmé.
  Doc : [README-QG-ADMIN.md](README-QG-ADMIN.md)
- `/classement [type] [periode]` : classement par niveaux, temps vocal ou messages
  (7, 30 ou 90 jours), avec pages, onglets et position personnelle.
- Nouveaux : `systems/qgAccept.js`, `systems/qgLeaderboard.js`, `commandes/classement.js`,
  `tests/qgAcceptLeaderboard.test.js`
- Modifiés : `systems/qgServer.js` (routage), `systems/qgLevels.js` (export `eligible`, panel),
  `index.js` (publication de `/classement` sur le QG), `README-QG-ADMIN.md`

## 57 — Soundboard

Doc : [sounds/README.md](sounds/README.md)

- `commandes/sound.js`, `commandes/stopsound.js`
- `systems/soundboard.js`, `utils/soundCatalog.js`
- `utils/musicVoiceGuard.js`, `utils/security.js`, `index.js`
- `sounds/demo_doux_10_secondes.wav`, `sounds/README.md`

## 56 — Grades et réunions

- `commandes/mrankup.js`, `commandes/rank.js`, `commandes/reunion.js`
- `config/ranks.js`, `config/soulSociety.js`
- `systems/prefixCommands.js`, `utils/replaceMainRank.js`, `index.js`

## 55 — Bannissements et expulsions

- `commandes/ban.js`, `commandes/kick.js`, `commandes/banlist.js`
- `utils/prefixOptions.js`

## 51 — Nettoyage et images du casino

- `commandes/clear.js`
- `systems/casino.js`, `utils/casinoImage.js`

## 49 — Casino

Doc : [CASINO-49.md](CASINO-49.md)

- `commandes/blackjack.js`, `casino.js`, `classement-casino.js`, `daily.js`,
  `mines.js`, `roulette.js`, `slots.js`, `solde.js`, `stats-casino.js`
- `systems/casino.js`, `systems/familyLife.js`, `systems/sanctionPanel.js`
- `utils/casinoCommand.js`, `utils/casinoStore.js`, `utils/security.js`
- `config/soulSociety.js`, `assets/casino/banner.png`

## 45 — Absences et réunions

Doc : [ABSENCES-REUNIONS.md](ABSENCES-REUNIONS.md)

- `commandes/absence.js`, `commandes/suivi-test.js`
- `systems/familyLife.js`, `systems/serverTagWatch.js`
- `utils/familyMeetings.js`, `utils/familyWeekly.js`,
  `utils/meetingAttendance.js`, `utils/memberAbsence.js`

## 43 — Commandes préfixe, musique et refonte générale

Docs : [COMMANDES-PREFIXE.md](COMMANDES-PREFIXE.md), [MUSIQUE.md](MUSIQUE.md)

- `commandes/` : `analyse`, `anniversaire`, `avert`, `back`, `badge`, `ban`,
  `candidature`, `del`, `delunion`, `derank`, `fintest`, `line`, `link`,
  `maintenance`, `mrankup`, `musique`, `mv`, `play`, `queue`, `rank`,
  `rollback`, `seelink`, `setupcandidature`, `setupinfos`, `setuplogs`,
  `setupstats`, `setuptpv`, `ship`, `skip`, `soulgames`, `suivi-test`,
  `surveillance`, `sync`, `test`, `unban`, `union`, `unioninfo`, `update`,
  `user`, `wanted`
- `systems/` : `candidateProfile`, `familyLife`, `foundationHelp`,
  `interviewPanel`, `lineControl`, `logs`, `loupgarouVoice`,
  `memberOnboarding`, `music`, `prefixCommands`, `recrutement`,
  `soulActivity`, `userActions`, `welcomeFollowup`
- `utils/` : `birthdayAnnouncements`, `birthdayBoard`, `birthdayConsent`,
  `familyBirthdays`, `familyWeekly`, `musicVoiceGuard`, `prefixContext`,
  `prefixOptions`, `rankHistory`, `security`, `userManagement`, `youtubeMusic`
- `scripts/install-music.cjs`, `index.js`, `package.json`, `package-lock.json`,
  `.gitignore`
