# Historique des migrations

Ce fichier regroupe les anciennes listes `MIGRATION-xx-FICHIERS.txt`. Chaque
entrée indique le thème de la livraison et les fichiers envoyés à ce moment-là.
Certains fichiers cités ont depuis été supprimés ou remplacés : la liste reflète
l'état de la livraison, pas le dépôt actuel. Pour le détail de chaque version,
consulter l'historique Git.

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
