# Mise à jour 49 — La Soul Society

## Commandes casino (monnaie fictive)
- =casino : accueil illustré et boutons des quatre jeux.
- =solde : portefeuille et historique récent.
- =daily : 500 Yens toutes les 24 heures.
- =slots 50
- =roulette 50 rouge : rouge, noir, pair, impair ou numéro de 0 à 36.
- =blackjack 50 : tirer, rester ou doubler.
- =mines 50 : 16 cases, 3 mines, encaissement au choix.
- =classement-casino : les 15 meilleurs soldes.
- =stats-casino : statistiques personnelles.

Le casino apparaît uniquement sur commande. Accès aux membres et bypass. Solde initial : 1 000 Yens. Mises de 10 à 10 000. Aucun achat ni conversion en argent réel.
Les données sont conservées dans data/casino.json, donc /app/data/casino.json sur Railway. Une partie interactive à la fois par joueur. Après 30 minutes, le blackjack termine la main en restant et les mines encaissent le montant atteint. Une partie active se reprend avec =casino après redémarrage.

## Permissions
1474804870757220554 dispose du bypass des commandes. Les protections des cibles restent appliquées.
1323507074885488755 ne dispose plus du bypass général, même avec un rôle bypass. Ses commandes ordinaires de membre restent disponibles. Aucun rôle Discord n'est supprimé.
=ad et =line restent réservées à Aven (547192186547077130).

## Panel de sanctions
Publié au démarrage dans 1554953804796010697, puis maintenu toutes les 5 minutes. Sélection d'un membre, choix d'un avertissement, saisie d'une raison. Accès bypass/fondation ; protection des comptes conservée.
Avertissement 1 : 1468698882002387044.
Avertissement 2 : 1468698901077823653.
Dernière chance : 1468698902428516524.
Les niveaux précédents ne sont pas retirés, conformément à la commande existante. Publication dans le Carnet existant.
Le bouton Derank est en attente de clarification : rôle 1471879707875344566 seul ou derank complet. Il n'est pas encore ajouté.

## Validation
Tests locaux du portefeuille, des doublons, de la reprise persistante, des règles des jeux, des permissions, de la syntaxe des commandes et des composants Discord. Tests du panel de sanctions avec interactions simulées.
Pas de bot lancé localement ni de déploiement Railway exécuté par cette mise à jour.
