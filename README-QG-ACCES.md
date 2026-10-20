# Vérification, premières 24 heures et séparateurs

## Après déploiement

Les commandes sont enregistrées par le démarrage existant. Aucun nouveau package ni variable d’environnement.

- Le bouton de vérification existant ouvre désormais deux champs : pseudo Roblox et nom souhaité sur le serveur. Le motif de venue n’est plus demandé. Le profil Roblox reste une déclaration confirmée par le membre, pas une preuve cryptographique de propriété.
- Après acceptation du règlement, le surnom est appliqué et Membre Communautaire attribué, puis son séparateur synchronisé. Le bot doit pouvoir gérer le surnom et les rôles. Aucun rôle Membre Vérifié ajouté.
- Les vérifications déjà terminées ne sont pas relancées.

## Nouveaux membres

La fenêtre de 24 heures part de l’arrivée Discord sur le serveur, pas de l’acceptation du règlement. Elle utilise `joinedTimestamp` et reste valable après redémarrage.

Une tentative textuelle `@everyone` / `@here` ou une invitation Discord détectée dans un message (y compris une modification) ou dans le formulaire entraîne une tentative d’avertissement MP puis une exclusion. La direction et la Fondation conservent leur exemption. Le message est supprimé lorsque le bot le peut.

Les MP fermés ne bloquent pas l’exclusion. Un échec de kick ou un résultat réseau incertain est signalé au staff, sans répétition aveugle. Le bot nécessite **Expulser des membres** et une hiérarchie suffisante, plus **Gérer les messages**.

Aucune détection générale de fraude n’est prétendue. La liste `schoolCommunityPolicy.blockedDomains` du stockage existant peut contenir des domaines interdits exacts, en minuscules, sans protocole (leurs sous-domaines sont également bloqués). Elle est vide par défaut : les domaines doivent être fournis et validés avant ajout. Les autres cas suspects relèvent du staff.

Les incidents sont enregistrés dans `schoolNewcomerIncidents`, sans recopier le contenu du message.

## Permissions

Utiliser `/sync separateurs`, examiner la prévisualisation, puis confirmer.

La commande synchronise d’abord les membres, puis remplace les entrées de permissions identiques de chaque groupe par son séparateur correspondant. Aucun rôle n’est créé ou supprimé.

Les catégories communes reconnues sont Accueil, Informations, Communauté, Vocaux communautaires, Support public, Famille, Informations famille, Vocaux famille, Responsables et Intergestions.

Exceptions conservées :

- Fondation, Bureau Aven, recrutement, gestions privées, logs et espaces non reconnus ;
- tickets individuels, autorisations de membres, prison et autres restrictions spécifiques ;
- droits différents entre les rôles d’un groupe ;
- séparateur déjà configuré avec des droits différents.

Un séparateur commun ne peut pas distinguer deux équipes : les exceptions maintiennent cette confidentialité. Les rôles ordinaires restent sur les membres pour les grades et vérifications métier ; seules les entrées d’accès communes sont remplacées.

Après activation, les changements/créations de salons communs sont reconvertis lorsque les droits des rôles sont identiques. La synchronisation initiale des séparateurs au démarrage et sur les changements de rôles reste en place.

`@everyone`, les permissions du bot et les exceptions individuelles ne sont pas supprimés. La permission native Administrateur contourne toujours les restrictions de salon.

## Erreur /sync 50035

La copie catégorie vers salons utilise maintenant des entrées explicites avec bitfields BigInt et type d’overwrite conservé. Les références à des rôles supprimés sont exclues après actualisation des rôles du serveur.

En cas d’erreur Discord, le résultat affiche désormais le chemin du champ rejeté et son motif, lorsqu’ils sont fournis. La capture contenant seulement `50035` ne permet pas d’affirmer la cause exacte. Aucun succès sur le serveur réel n’est annoncé avant exécution.

## Validation

Contrôle de syntaxe Node effectué sur les cinq fichiers JavaScript concernés. Aucun test fonctionnel automatisé ni action réelle sur Discord pour cette livraison. Le bot n’a pas été lancé localement et aucun déploiement effectué par l’agent.
