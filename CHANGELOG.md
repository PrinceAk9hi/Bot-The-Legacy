# Historique des migrations

Ce fichier regroupe les anciennes listes `MIGRATION-xx-FICHIERS.txt`. Chaque
entrée indique le thème de la livraison et les fichiers envoyés à ce moment-là.
Certains fichiers cités ont depuis été supprimés ou remplacés : la liste reflète
l'état de la livraison, pas le dépôt actuel. Pour le détail de chaque version,
consulter l'historique Git.

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
