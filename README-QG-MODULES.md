# QG — Accueil, administration et animations

## Déploiement

Cette mise à jour concerne le bot principal `MonBotDiscord`, pas `Music-1`.
Les commandes QG sont enregistrées par le démarrage habituel du bot. Le schéma
QG de `/derank` est sélectionné dans `index.js` sans remplacer le module de
l’autre serveur.

1. Sauvegarder le répertoire `data` du service actuellement déployé.
2. Envoyer les fichiers modifiés vers le dépôt relié à Railway.
3. Redéployer le service principal, avec une seule instance du processus.
4. Vérifier dans les logs l’enregistrement des commandes QG.
5. Ouvrir `/animation`, `/effectif`, `/note` et `/pdt` avec un compte habilité.

Pas de nouvelle dépendance ni de nouvelle clé API. Les données sont conservées
par `utils/recruitmentData.js` dans `data/qgServer.json` et `data/qgXp.json`.
Sur Railway, le répertoire `data` doit être sur un volume persistant : le disque
éphémère d’un déploiement ne garantit pas la conservation des informations.
Ne pas démarrer plusieurs instances avec le même stockage JSON.

## Salons et rôles

| Usage | Identifiant |
| --- | --- |
| Notifications de chaque niveau gagné | `1561157193951084646` |
| Calendrier permanent des animations | `1562845037799280650` |
| Annonces d’animations | `1562191460873404436` |
| Tranche d’âge +18 sur Roblox | `1562838566487326781` |
| Tranche d’âge +13 sur Roblox | `1562838771538468956` |

Le bot doit pouvoir voir les salons, lire leur historique, envoyer des messages,
intégrer des liens et joindre des fichiers. Il doit posséder Gérer les rôles et
être placé au-dessus des grades, séparateurs, notifications et tranches d’âge.
Les rôles existants sont utilisés, aucun rôle supplémentaire n’est créé ici.

Les permissions administratives utilisent les identifiants enregistrés dans
`schoolRoles` : `creator`, `globalManager`, `administrator`, `recruitmentLead`,
`recruitmentManagement`, `animationLead`, `animationManagement`.
Les journaux utilisent les salons de logs déjà configurés.

## Vérification et niveaux

Parcours : pseudo Roblox et nom Discord → confirmation du profil →
**tranche d’âge +18 sur Roblox / +13** → choix des notifications → règlement.
La tranche est déclarative, sans prétendre vérifier l’âge auprès de Roblox.
Les rôles ne sont attribués qu’après l’acceptation du règlement. Un seul des deux
rôles de tranche est conservé. Les notifications non choisies sont retirées.
Le choix est archivé avec la vérification. Les personnes déjà vérifiées ne sont
pas toutes forcées à recommencer ; les retours après un départ restent soumis à
une nouvelle vérification complète.

Chaque niveau gagné déclenche une annonce dans le salon demandé. Les rôles de
palier restent aux niveaux 5, 10, 20, 35, 50, 75 et 100. La progression et les
protections contre le spam existantes sont conservées.

Emoji ouvert/promotion : `<a:statusonline:1562837067782950924>`.
Emoji fermé/rétrogradation : `<a:statusoffline:1562836899226324992>`.
Ils sont utilisés dans le panel de candidature, `/cd`, les commandes de grades,
le panel `/user`, les journaux de grades et les décisions envoyées en réunion.

## Commandes administratives

| Commande | Fonctionnement | Accès |
| --- | --- | --- |
| `/rankup membre notifier` | Grade supérieur autorisé, motif, confirmation, historique, MP facultatif | Direction / responsable recrutement |
| `/derank membre notifier` | Grade inférieur, motif, date facultative de réexamen, confirmation | Direction / responsable recrutement |
| `/effectif` | Pages de membres, grades, activité sur 7/30 jours, PDT, arrivées récentes, classement | Direction / équipe recrutement |
| `/note membre auteur categorie depuis` | Filtres, création, consultation, révisions, archivage | Lecture recrutement / direction ; écriture responsables recrutement / direction |
| `/pdt membre` | Création, durée, référent, observations, statut et historique | Lecture recrutement / direction ; écriture responsables recrutement / direction |
| `/recrutement-stats jours` | Périodes 7, 30, 90 jours ou tout l’historique | Direction / équipe recrutement |

Les contrôles sont refaits lors de chaque interaction. Les confirmations sont
liées à leur auteur, au serveur et au membre ciblé ; une modification des rôles
entre préparation et confirmation invalide une décision de grade. La hiérarchie
Discord, les rôles gérés et les séparateurs sont contrôlés avant l’application.
Le propriétaire, l’exécutant lui-même et les bots ne peuvent pas être modifiés.

Une date de réexamen ne rétablit **pas** automatiquement un ancien grade. À
l’échéance, un journal demande une décision humaine ; utiliser `/rankup` si le
rétablissement est décidé. Les notes « direction » ne sont jamais visibles par
le recrutement. Leur contenu reste dans le dossier privé, pas dans les logs
généraux. L’historique des modifications reste consultable.

### PDT

Le membre doit être Membre Test pour démarrer une PDT. Durée personnalisée de
1 à 365 jours, référent membre de l’équipe recrutement. Le formulaire permet de
prolonger ou raccourcir la période avec motif. Les évaluations distinguent
activité, comportement et implication. Un export privé donne le dossier complet.

Statuts : En cours, À surveiller, En attente d’évaluation, Validée, Refusée,
Prolongée. Un rappel privé est tenté auprès du référent dans les 24 dernières
heures. À l’échéance, le dossier passe En attente d’évaluation ; jamais Validée.
Valider/refuser le dossier nécessite confirmation et ne modifie pas un grade
implicitement : une promotion passe par `/rankup`.

### Mesures disponibles

L’activité utilise exclusivement `schoolDailyActivity`, déjà alimenté par les
événements de messages et de vocal. « Inactif » signifie aucune activité observée
sur les sept jours calendaires ; cela ne mesure pas le temps de jeu Roblox.
Les dates d’entrée familiale absentes restent inconnues. Le classement trie le
temps vocal, puis les messages, sans inventer un score de qualité.
Les statistiques de recrutement utilisent les dossiers réellement conservés.
Les candidatures remplacées sont désormais archivées avant un nouveau dossier ;
les anciens dossiers déjà perdus ne peuvent pas être reconstitués.

## Centre d’animations

`/animation` ouvre le centre ; l’option `id` ouvre une animation précise.
Les membres vérifiés peuvent proposer une animation et s’inscrire depuis le
calendrier. L’animateur gère ses propres animations ; le responsable animations
et la direction peuvent toutes les gérer. Les changements de responsable et
la suppression administrative nécessitent cette autorité supérieure.

### Création et suivi

Créer → informations → participants / organisateurs → détails → confirmer.
Champs : titre, descriptions courte/détaillée, date, durée estimée, type,
organisateur, coanimateurs, capacité, inscription facultative, lieu, récompenses,
conditions et récurrence. Les conflits horaires sont signalés avant validation.
Une modification de date avertit les inscrits. L’annulation et la suppression
nécessitent un motif et une confirmation, et gardent l’historique.

Les dates sont au format `JJ/MM/AAAA HH:mm`, en Europe/Paris. Les heures
inexistantes ou ambiguës lors du changement d’heure sont refusées. Les
récurrences conservent l’heure locale ; une nouvelle occurrence est créée après
la clôture humaine de la précédente. Les occurrences manquées pendant un arrêt
ne sont pas artificiellement déclarées réalisées.

Le calendrier est trié chronologiquement et paginé en messages persistants.
Les messages sont modifiés seulement lorsque leur contenu change.

### Annonces

Depuis une animation : **Publier une annonce**. Ajouter autant de parties de
texte que nécessaire ; chaque formulaire suit la limite native Discord de
4 000 caractères, sans limite totale ajoutée par le bot. L’aperçu permet de
remplacer ou compléter le texte, choisir le titre, l’image HTTPS, la couleur,
la date de publication et la notification Annonces.

Le contenu est découpé en plusieurs messages ; les blocs de code sont refermés
et rouverts entre les parties. Le texte source reste conservé intégralement.
Les mentions libres `everyone`/`here` ne déclenchent aucun ping. Seul le rôle
configuré `notifAnnouncements` peut être explicitement notifié.

**Publications** permet de retrouver une annonce, la modifier ou annuler une
programmation. Une publication bloquée affiche sa cause. En cas d’envoi réseau
incertain, le bot recherche son marqueur dans les messages récents et ne renvoie
pas aveuglément un doublon. Il faut vérifier le salon si la recherche ne permet
pas de confirmer l’envoi.

### Inscriptions, comptes rendus et propositions

Participer / Se désinscrire / Voir les participants : une seule inscription par
membre, places limitées, attente FIFO. Un désistement libère une place pour la
première personne en attente. L’organisateur peut aussi gérer les inscriptions
et renseigner les présences réellement constatées.

Le compte rendu saisit nombre réel de participants, durée réelle, déroulement,
résultats/récompenses, points positifs, difficultés, améliorations et note sur 5.
Une confirmation marque l’animation Terminée. Le responsable peut ensuite
ajouter un avis. Le compte rendu et l’historique restent consultables.

Les propositions peuvent être acceptées et transformées en brouillon officiel,
refusées ou renvoyées pour modification ; l’auteur est informé en MP si possible.
Les statistiques séparent volumes organisés, terminés/annulés, participants
déclarés, présences renseignées, comptes rendus et notes moyennes.

### Automatisations et limites opérationnelles

La boucle existante du bot contrôle ces modules toutes les 60 secondes :
publication programmée, rappel dans l’heure précédant le début, statut En cours,
puis À clôturer à la fin estimée, demande de compte rendu, alertes organisateur
absent et archivage des animations terminées après 30 jours.
Un arrêt du service retarde les actions jusqu’à son redémarrage.

Les MP peuvent être fermés ; leur échec est conservé, sans contourner Discord.
Les confirmations administratives expirent après 15 minutes d’inactivité.
Les dossiers, inscriptions, publications et historiques sont persistants.
La conservation JSON et les verrouillages locaux nécessitent une instance unique.

## Fichiers

Créés :

- `utils/qgModuleUi.js` : composants, sessions persistantes, dates et découpage.
- `systems/qgGrades.js` : commandes de grades, confirmations et réexamens.
- `systems/qgFamilyAdmin.js` : effectifs, notes, PDT et statistiques recrutement.
- `systems/qgAnimations.js` : calendrier, organisation, publications et suivi.
- `commandes/rankup.js`, `effectif.js`, `note.js`, `pdt.js`,
  `recrutement-stats.js`, `animation.js` : intégration au chargeur existant.
- `tests/qgAdminAnimations.test.js` et ce document.

Adaptés : `index.js`, `systems/qgServer.js`, `qgEntryVerification.js`,
`qgCommunityUpgrade.js`, `qgLevels.js`, `qgRecruitmentControl.js`,
`qgSchoolSetup.js`, `qgSchoolApplications.js`, `qgUserPanel.js`, `qgUserView.js`,
`qgMeetingDelivery.js`, `utils/qgAdmin.js` et les tests existants concernés.

## Vérifications

Exécuter `node --test tests/*.test.js` depuis le dépôt.
Les tests utilisent des stockages temporaires isolés et des doubles Discord ;
ils ne connectent pas le bot et ne modifient pas le serveur réel.
Les scénarios couvrent les parcours complets, permissions, hiérarchies,
confirmations rejouées, persistance, échéances, changement d’heure,
inscriptions, publications longues, confidentialité et erreurs réseau.
Après déploiement, une recette Discord réelle reste nécessaire pour confirmer
les permissions effectives des rôles/salons et la remise des messages privés.
