# Mise à jour QG — signatures, fils publics et casino

## Installation

Déployer le code puis utiliser `/maj` → Tout actualiser dans le QG.
Le bot doit disposer de Gérer les rôles et Gérer les salons ; son rôle doit être au-dessus des rôles à gérer.
Attribuer ensuite manuellement les rôles Exécutant du casino et Responsable du casino aux personnes choisies.

## Signatures

Les embeds et panels utilisent Direction du QG avec l’emblème fourni comme icône de pied de page. Les composants texte utilisent l’emoji personnalisé. La bannière d’arrivée utilise le fichier assets/qg-direction-emblem.png.
Les panels maintenus sont actualisés par /maj. Les anciens messages historiques et anciennes images envoyées ne sont pas réécrits.
Aucun renommage de rôle Direction n’est prévu par cette mise à jour.

## Fils publics

Un fil public est créé pour chaque nouveau message normal ou réponse d’un membre dans le salon 1563864872385781890. Les bots et webhooks sont ignorés. Les anciens messages ne sont pas repris.
Permissions nécessaires : Voir le salon, Voir les anciens messages, Créer des fils publics et Envoyer des messages dans les fils.

## Casino

- Trois catégories : CASINO, GESTION CASINO et TICKETS CASINO.
- Huit salons : accueil, règlement, classement, support, vocal public, pilotage, équipe et bureau vocal.
- Cinq panels persistants, modifiés à leur emplacement lors des mises à jour.
- `/casino` ouvre un espace personnel privé : machines à sous, roulette, blackjack, mines, solde, historique et récompense quotidienne.
- 1 000 jetons initiaux ; 500 jetons gratuits toutes les 24 heures ; mises de 10 à 10 000 jetons.
- Jetons fictifs : aucun achat, transfert ou conversion en argent.
- Une partie interactive par joueur ; résolution après 30 minutes d’inactivité.
- Le Responsable et la Direction peuvent suspendre les nouvelles mises. Les parties engagées restent jouables.
- Les Exécutants, le Responsable et la Direction gèrent les tickets privés via le système existant. Un échec d’archivage empêche la suppression d’un ticket casino.

## Visuels

- Accueil du salon casino : une bannière animée et les boutons Jouer, Mon compte, Récompense du jour, Classement, Règles et Support.
- Parcours privé : Jouer → choix de la table → fiche du jeu avec son GIF, puis **Miser** ou **Règles du jeu**.
- Règlement, classement et support ont chacun leur bannière ; les machines à sous et la roulette affichent une animation avant le résultat privé.
- Les images des parties sont dessinées en direct par utils/qgCasinoDraw.js, avec les polices libres d’assets/fonts (Abril Fatface, Bebas Neue, licence OFL).
- GIF et bannières dans assets/casino/qg, générés par `node scripts/generate-casino-art.cjs` (à relancer seulement pour modifier l’art).

## Persistance Railway

Le casino utilise qgCasino.json dans le répertoire de données persistant existant, distinct du casino Soul Society. Les rôles, salons, panels et tickets utilisent le stockage QG existant.
Conserver le volume Railway du bot de gestion ; ne pas utiliser le volume du bot musique.
Les formulaires de mise ouverts avant un redémarrage doivent être rouverts ; les parties déjà engagées sont sauvegardées.

## Validation et limites

Aucun test automatisé ni essai Discord réel n’a été exécuté pour cette modification. Le code n’est pas déployé par sa simple modification locale.
Après déploiement, contrôler le bilan /maj, les accès aux salons privés, l’ouverture et l’archivage d’un ticket, puis une partie et un fil public.
