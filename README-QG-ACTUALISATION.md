# Actualisation QG et commandes propriétaire

## Commandes propriétaire, disponibles sur QG et Soul Society

Seul le compte `547192186547077130` peut les exécuter, y compris les boutons.

- `=bot` ouvre le panel existant de présence, adapté au serveur.
- `=bot joue texte`, `=bot regarde texte`, `=bot ecoute texte`, `=bot pense texte`, `=bot participe texte`.
- `=bot statut dnd` (également online, idle, invisible), `=bot stop`, `=bot auto`.
- `/mpall texte:...` prépare un envoi aux membres humains du serveur courant uniquement.
- `/mp ids:ID1 ID2 texte:...` sélectionne au maximum 25 membres humains du serveur courant.

Les MP affichent un aperçu avec le serveur et le nombre de destinataires. Confirmation valable cinq minutes ; double clic neutralisé ; un seul lot actif pour le bot. Les destinataires sont revérifiés avant chaque envoi. Espacement de 1,25 seconde, en plus du traitement des limites par Discord.js. Les comptes avec MP fermés sont comptés en échec. Pas de relance automatique des erreurs réseau incertaines. Le bilan est envoyé à l'auteur en MP et dans la réponse de commande si son jeton est encore valide. Les membres présents sur les deux serveurs peuvent recevoir un message si un lot est explicitement lancé sur chacun.

La présence est commune au compte bot, pas distincte par serveur. Stockage réutilisé : `data/botPresence.json`. Pause et maintenance prioritaires. Compteurs d'envoi : `data/ownerTools.json`, sans texte des MP ni liste des destinataires ; anciens bilans purgés après 30 jours lors d'un nouveau lot. Les aperçus sont en mémoire : un redémarrage les invalide et interrompt le lot sans le renvoyer automatiquement.

## Actualisation communautaire QG

Après déploiement : `/setup-serveur actualiser-qg`.

- Réutilise les rôles Gestion RP et Responsable RP ou crée uniquement ceux qui manquent.
- Panel des cinq gestions blanc, descriptif, capacité de deux membres hors responsable. Réponses réparties en champs pour respecter les limites des embeds ; soumissions sérialisées.
- Les rôles `1562188199072374854` et `1562188485010657341` justifient respectivement Accès Gestion et Accès Responsable. Les séparateurs existants sont recherchés ; aucune création de séparateur. Association manuelle possible via `/sync associer-separateur`.
- Le rôle Hors du QG `1561157108307861574` ne justifie aucun séparateur.
- Découverte des séparateurs Notifications, Status et Niveau, des rôles de statut et des paliers +5, +10, +20, +35, +50, +75, +100.
- Effectifs paginés actualisés toutes les cinq minutes : grades, dernière promotion enregistrée, arrivée familiale connue. Aucune reconstitution de dates absentes.
- Vérifications acceptées conservées dans le stockage QG et publiées dans `1562190797128990780`, qui doit être privé. Reprise des vérifications existantes dont les données sont encore présentes. Le compte Roblox est déclaré/confirmé par le membre, cela ne prouve pas la propriété du compte.
- Profil Roblox ajouté à `/user` ; suivi des invitations et liens personnalisés dans les arrivées. Attribution par corrélation prudente, sinon inconnu, notamment en cas d'arrivées simultanées ou de suivi indisponible.
- Nouvelle recrue : annonce dans `1562193740079038515`, mention `1561363081018474626`, conseil de participer en vocal et en jeu, lien vers `1561157212154372137`.
- Progression : total 25 × niveau² XP. 10 XP par message admissible toutes les 90 secondes ; minimum 20 caractères, quatre mots, répétitions exclues. 5 XP par tranche observée de deux minutes de vocal actif à plusieurs. Plafonds journaliers : 300 texte et 300 vocal. Les anciens XP sont divisés par quatre une seule fois pour conserver le niveau atteint avec l'ancienne courbe. Ne pas redéployer une ancienne version sans restaurer une sauvegarde cohérente.

## Permissions et limites

Conserver les intents GuildMembers, GuildVoiceStates et MessageContent existants. GuildMembers est nécessaire à l'énumération complète des destinataires de /mpall. Pour les panneaux/actualisations : Gérer les rôles, Voir les salons, Envoyer des messages, Intégrer des liens, Lire l'historique ; rôle bot au-dessus des rôles concernés. Le suivi des invitations nécessite l'accès aux invitations du serveur. Aucune nouvelle variable ni dépendance.

La migration `/sync separateurs` applique désormais les seules entrées de permissions modifiées et tente une restauration en cas d'erreur. Les erreurs Discord détaillées indiquent la cible fautive ; le suivi automatique reste désactivé après échec. L'erreur 50035 doit encore être contrôlée sur le serveur réel, son code seul ne démontre pas la cause exacte.

Sauvegarder le dossier data avant déploiement. Sa conservation nécessite le stockage persistant du déploiement existant, notamment un volume Railway : le code ne rend pas un disque éphémère durable. Ne pas committer data ni les secrets.

Contrôle réalisé : analyse syntaxique Node des 27 fichiers JavaScript modifiés/créés, zéro erreur. Aucun démarrage du bot ni test d'envoi réel. À valider sur Discord : panel de présence, visibilité des commandes, refus pour un autre compte, aperçu et annulation, un MP volontaire, MP fermés, séparation des serveurs, rôles et panels QG. L'animation et l'affichage dépendent du client Discord ; un embed blanc ne force pas son fond à être blanc.
