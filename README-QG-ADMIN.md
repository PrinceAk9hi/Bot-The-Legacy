# QG — Candidatures et administration des membres

## Fonctionnement livré

- `/cd on`, `/cd off`, `/cd statut` : ouverture persistante des nouvelles candidatures, actualisation du panel et de sa bannière GIF, comptage des dossiers conservés. Les questionnaires MP déjà commencés continuent lorsque le recrutement ferme. Le statut est contrôlé à nouveau après l'ouverture du MP.
- `/user membre` : profil administratif privé, menu de 12 actions, progression des grades, rétrogradation ciblée avec motif, statuts RP, équipes et responsabilités, statistiques disponibles et accès aux dossiers autorisés.
- Chaque modification demande confirmation. Les interactions sont liées à leur auteur et leur cible pendant dix minutes. Les rôles et la hiérarchie sont revérifiés au clic ; une confirmation consommée ne peut pas rejouer une action.
- Les réponses conversationnelles de l'IA dans les tickets sont du texte normal, sans embed. Les interfaces administratives restent des embeds blancs.
- L'identité officielle indique : famille QG issue de SchoolRP, réservée actuellement aux 18 ans et plus, tag QG obligatoire, respect et forte activité. Une éventuelle ouverture aux 13 ans et plus est une possibilité future, pas une règle actuelle. Ceci ne constitue pas une vérification automatisée de l'âge.

## Accès

Les rôles sont ceux déjà enregistrés dans la configuration QG, sans anciens identifiants d'un autre serveur.

| Action | Personnes autorisées, sous réserve de hiérarchie |
| --- | --- |
| Ouvrir le profil | Direction et équipes/responsables des gestions |
| `/cd`, rankup, derank | Direction et Responsable Recrutement |
| Rétrogradation ciblée, nomination/retrait de responsables | Direction |
| Ajouter/retirer un gestionnaire | Direction ou responsable de cette gestion |
| Statuts RP | Direction et Gestion Support |
| Dossiers confidentiels | Direction ou gestion concernée, avec accès réel au salon |

Le propriétaire du serveur, soi-même et les bots sont exclus des modifications. La cible et les rôles doivent être sous le rôle de l'exécutant et du bot. Les séparateurs existants sont synchronisés, sans en créer de nouveaux.

## Prison et autres statuts RP

Trois rôles sans permissions globales sont réutilisés ou créés au premier usage : `Prison`, `Menotté`, `Chien RP`. Le bot doit pouvoir les gérer.

Prison bloque l'envoi de messages, les fils, réactions, messages vocaux, sondages, la connexion et la parole en vocal ainsi que le streaming. Une connexion vocale existante est interrompue. Les dérogations individuelles évitent qu'un autre rôle autorisant l'écriture contourne le blocage.

Les accès précédents sont sauvegardés avant application. La libération restaure les permissions appartenant à cette restriction et conserve les refus préexistants, les timeouts, les autres rôles et les modifications différentes apportées entre-temps. Discord ne permet pas de distinguer une nouvelle interdiction manuelle strictement identique sur le même bit : éviter de superposer une modification manuelle identique pendant la prison ; utiliser un timeout ou un dispositif indépendant pour une sanction distincte.

Durée facultative en minutes ; sans durée, libération manuelle. Les expirations et opérations interrompues sont reprises au démarrage puis chaque minute. Les nouveaux salons sont protégés lors de leur création, avec nouvelle tentative en cas d'échec. Ce traitement est asynchrone : il ne garantit pas un blocage instantané pendant une panne ou avant traitement d'un nouveau salon.

La permission Discord Administrateur contourne les dérogations : une prison sur un administrateur est refusée. Menotté et Chien RP sont uniquement des rôles/statuts, sans restrictions de salons.

## Stockage et mesures

Réutilisation du stockage existant `data/qgServer.json` : `schoolRecruitmentControl`, `schoolUserSessions`, `schoolRpStatus`, `schoolAdminHistory` et identifiants RP dans `schoolRoles`. Historique limité aux 5 000 dernières actions. Sessions expirées nettoyées à l'ouverture d'un panel. Les dossiers RP restent nécessaires jusqu'à libération/restauration.

Écritures synchrones atomiques selon l'utilitaire existant, verrous en mémoire pour les actions concurrentes : une seule instance du bot doit écrire ces fichiers. La présence réelle du volume Railway n'a pas été vérifiée. Confirmer le montage persistant de `/app/data` et sauvegarder ce volume avant déploiement. Ne pas committer les données privées.

Les statistiques présentent les données réellement conservées : XP, niveau, candidatures accessibles, tickets et actions administratives. Le nombre total de messages et le temps vocal ne sont pas mesurés par ce module. Les compteurs historiques sont limités aux données encore conservées.

## Fichiers

Créés :
- `config/qgFamily.js` : identité et conditions actuelles.
- `utils/qgAdmin.js` : autorisations, hiérarchie, verrouillage et audit QG.
- `commandes/cd.js`, `systems/qgRecruitmentControl.js` : commande et contrôle des candidatures.
- `systems/qgUserPanel.js` : interface administrative.
- `systems/qgRpStatus.js` : statuts et restauration des accès.
- `tests/qgAdministration.test.js` : scénarios automatisés.
- `README-QG-ADMIN.md` : ce guide.

Modifiés :
- `index.js` : enregistrement des schémas slash QG.
- `systems/qgServer.js` : routage et reprise des restrictions.
- `systems/qgSchoolApplications.js` : contrôle du recrutement avant création.
- `systems/qgSchoolSetup.js` : état public et conditions du panel.
- `systems/qgTicketAssistant.js` : messages texte et historique des réponses.
- `systems/qgAiService.js`, `utils/qgAiContext.js`, `utils/qgAiKnowledge.js` : identité QG, connaissances et reconnaissance des questions sur les conditions.

Aucune dépendance ni variable d'environnement supplémentaire. Le fournisseur IA existant est conservé. Aucun nouvel intent n'est ajouté : les intents membres, messages/MP, contenu des messages et voix déjà utilisés restent nécessaires. Le bot doit disposer des permissions de gestion de rôles et dérogations, de déplacement vocal, et d'accès/envoi dans les salons configurés. Son rôle doit être suffisamment haut.

## Déploiement et validation Discord

Le démarrage existant enregistre `/cd` et le schéma `/user membre` pour le QG. Ne pas lancer un second processus local pendant l'exécution Railway. Après push, vérifier le déploiement et l'enregistrement des commandes dans ses journaux.

1. Confirmer le volume persistant, sauvegarder les données et vérifier la hiérarchie du bot.
2. Tester `/cd off` : panel fermé et nouveau dossier refusé ; terminer un questionnaire déjà commencé.
3. Tester `/cd on` et `/cd statut`, puis redémarrer via l'hébergement et vérifier l'état.
4. Ouvrir `/user membre` sur un compte de test inférieur au staff ; vérifier annulation, confirmation, grades et rôles.
5. Appliquer Prison avec une courte durée : tester l'écriture, les fils et le vocal ; vérifier ensuite les accès restaurés et les sanctions indépendantes conservées.
6. Vérifier les accès d'un membre ordinaire et d'un responsable d'une autre gestion ; les dossiers privés ne doivent pas apparaître.
7. Vérifier GIF, embeds, journaux et réponses IA en texte sur Discord.

Les tests automatisés utilisent des doublures Discord et des fichiers temporaires. Ils ne prouvent pas le rendu réel, les permissions installées ni la persistance Railway. Aucun appel IA payant ni action sur le serveur réel n'a été exécuté pour ces tests.

Résultat exécuté : npm test — 115 tests réussis, 0 échec. Vérifications de syntaxe réussies pour index.js, qgServer.js, qgUserPanel.js et qgRpStatus.js.

## Nouvelle présentation /user
Trois onglets Profil, Vocal, Gestion, composants Discord V2 et signature Fondateur - QG. Modules ajoutés : systems/qgUserView.js et systems/qgUserVoice.js. Bring déplace la cible vers le vocal du gestionnaire ; Back revient au vocal précédent enregistré pour cette session ; déplacement et déconnexion demandent confirmation. Les permissions MoveMembers, ViewChannel et Connect sont contrôlées. Les boutons anciens de verrouillage de pseudo, convocation, validation du test et sanctions générales ne sont pas ajoutés : ces fonctions ne sont pas implémentées dans ce panneau QG. La suite de tests et le rendu Discord n'ont pas été réexécutés pour cette refonte visuelle ; le résultat 115 tests ci-dessus concerne la version précédente.
