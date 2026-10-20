# QG — Réunions, activité et suivi Support

## Utilisation

1. Après déploiement, ouvrir `/config`. La commande est réservée à la direction QG. L'option `rapports` permet de choisir un salon privé ; par défaut, le salon rapports-fondation déjà configuré est utilisé.
2. Cliquer sur Créer une réunion. Saisir titre, date `JJ/MM/AAAA HH:MM` en heure de Paris, durée et description facultative.
3. Choisir Maintenant, 1 h, 3 h ou 6 h avant, puis créer l'événement. Ce choix définit l'ouverture de la préparation, pas une heure d'application des grades.
4. Reprendre la réunion via `/réunion`, ou `/réunion reunion:IDENTIFIANT`. Les identifiants figurent dans les panels. Après expiration d'un message éphémère, rouvrir la commande : les décisions sont stockées.
5. Attribuer une note de 1 à 10 étoiles, avec un détail facultatif. Recliquer la même note la retire. Un membre est affiché par page afin de garder les dix boutons lisibles.
6. Préparer les rankups, deranks, rétrogradations ciblées ou avertissements. Aucun rôle de note n'existe. Aucune modification de grade n'est appliquée durant cette étape.
7. Consulter le récapitulatif paginé des notes, détails et décisions, puis valider. La direction peut encore modifier les choix avant traitement, ce qui retire la validation.
8. Exécuter `/notesmp reunion:IDENTIFIANT`. Cette commande applique les décisions validées puis envoie à chaque membre sa note et son détail, ainsi que sa décision éventuelle. Elle ne transmet pas les notes des autres membres.

Les droits et la hiérarchie sont vérifiés au moment de l'application. Si un grade a changé depuis sa préparation, la décision est bloquée. Les résultats et les échecs de MP sont visibles dans `/réunion`. Un second `/notesmp` ne rejoue pas les actions déjà traitées et ne renvoie pas les messages déjà remis. Les MP explicitement refusés par Discord peuvent être réessayés ; un résultat réseau incertain reste à vérifier manuellement. Un arrêt pendant une modification laisse une indication pending/uncertain, jamais une prétendue réussite.

## Événement et salons

Le salon de réunion est `1562077941469552680`. Sa visibilité est accordée au rôle `1561363081018474626` ; les autres permissions existantes ne sont pas réécrites.

Si ce salon est vocal, l'événement Discord lui est rattaché. Sinon, un événement externe contient le lien de ce salon. Le bot crée `🖋️・discu-réunion` dans la même catégorie lorsqu'il est absent, avec accès au rôle familial et à la direction. Aucun salon ni rôle ancien n'est supprimé.

L'événement contient une référence unique pour retrouver une création interrompue sans créer volontairement un doublon. Une création incertaine sans événement correspondant reste bloquée pour contrôle. L'accès familial au salon n'est pas retiré automatiquement après la réunion, faute de demande en ce sens.

## Récap chaque semaine

Publication le lundi à 00 h, heure de Paris, correspondant à la nuit du dimanche au lundi. Vérification toutes les minutes par le bot, avec rattrapage le lundi lors d'un redémarrage. Si le bot reste arrêté tout le lundi, cette semaine n'est pas reconstruite rétroactivement.

Le rapport présente chaque membre familial (rôle fourni ou grade familial) : temps vocal observé, messages observés, grade actuel, dernier rankup enregistré. Les périodes antérieures à l'activation du suivi et celles où le bot est hors ligne ne sont pas reconstituées. La présence vocale est une durée connectée, pas une mesure de parole ou d'attention. Les messages sont comptés sans conserver leur contenu ; ce compteur n'est pas une preuve de qualité d'activité et inclut les messages supprimés ensuite.

Les derniers rankups proviennent des journaux `/user`, des décisions de réunion et des promotions enregistrées. Une modification manuelle ancienne non enregistrée reste inconnue.

## Support et outils membres

Le tableau automatique du salon suivi-tickets présente les tickets Questions/Aide, leur ancienneté et le gestionnaire assigné. Actualisation toutes les minutes. Les boutons ouvrent une vue privée paginée filtrée par les permissions réelles. Les dossiers Fondation et autres gestions ne sont pas inclus.

Dans `/user` :
- Convoquer : date et motif, confirmation puis MP. Aucun rendez-vous vocal n'est inventé ; le membre contacte le convocateur pour le lieu. Pas de rappel automatique supplémentaire pour cette convocation.
- Valider le test : passage de Membre Test à Membre Confirmé par le mécanisme de promotion existant, avec confirmation et contrôles de hiérarchie.
- Sanctions : ouvre le panneau `/sp` sur le membre déjà sélectionné.
- Lock/Unlock pseudo : direction uniquement. Le verrou restaure le pseudonyme lors des changements tant que le bot peut gérer le membre.

## Invitations

Le bot compare les utilisations d'invitations autour des arrivées. Une corrélation est affichée seulement lorsqu'une arrivée et une seule augmentation d'utilisation sont observées, sans changement de la liste des invitations. Elle est explicitement présentée comme une déduction, pas une information fournie directement par Discord.

Arrivées groupées, invitation disparue, absence de référence au démarrage, erreurs d'accès et situations ambiguës : **inconnu**. Les invitations vanity et les événements manqués ne permettent pas une attribution certaine. Aucune attribution historique n'est inventée. Le bot doit pouvoir consulter les invitations (permission Gérer le serveur).

## Stockage et limites

Réutilisation de `data/qgServer.json` et des utilitaires existants : réunions, résultats, livraisons, activités quotidiennes, attributions d'invitations, convocations, verrous de pseudo et références de messages.

Activité quotidienne conservée sur environ 90 jours par membre actif ; rapports hebdomadaires limités à 16 semaines ; convocations limitées à 1000 entrées. Les notes et dossiers de réunion restent conservés pour consultation et prévention des doublons. Un seul processus doit écrire le stockage. La persistance du volume Railway n'a pas été vérifiée depuis cette session.

Si un rapport est interrompu juste après un envoi, il est marqué à vérifier plutôt que réexpédié aveuglément. Les envois incertains requièrent une vérification des messages et des données sauvegardées par l'administrateur. Les interactions expirées se reprennent avec une nouvelle commande.

## Permissions et déploiement

Aucune nouvelle dépendance ou variable d'environnement. Intents membres, voix et messages déjà présents réutilisés. Permissions nécessaires selon les fonctions : gérer les événements, gérer les salons et leurs dérogations, gérer les rôles, gérer les pseudonymes, consulter les invitations, envoyer des messages/embeds et lire l'historique des salons concernés.

Le démarrage normal enregistre les schémas QG de `/config`, `/réunion` et `/notesmp`. Ne pas démarrer un second bot local pendant l'exécution Railway.

Créés : commandes/config.js, commandes/notesmp.js, systems/qgMeetings.js, systems/qgMeetingDelivery.js, systems/qgWeeklyReport.js, systems/qgInvites.js, systems/qgUserTools.js, systems/qgSupportDashboard.js, README-QG-REUNIONS.md.

Modifiés : index.js, systems/qgServer.js, systems/qgMemberMetrics.js, systems/qgUserPanel.js, systems/qgUserView.js, systems/qgSanctionPanel.js.

## Validation restante

Aucun test automatisé ni essai sur Discord exécuté pour cette livraison. Après déploiement, vérifier avec un membre de test : accès du panneau, création d'un événement et de la discussion, note sur 10, récapitulatif, validation puis `/notesmp`, refus des accès non autorisés, seconde exécution sans double action, MP fermés, disponibilité des invitations et rapports hebdomadaires. Ne pas considérer les anciens résultats de tests comme une validation de ces nouveaux modules.
