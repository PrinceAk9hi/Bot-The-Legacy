# Commandes avec le préfixe =

Toutes les commandes existantes restent chargées par le bot, avec les mêmes actions et autorisations. Les commandes slash sont supprimées de Discord au démarrage et lors de `=update`.

## Commencer

- `=aide` affiche les commandes auxquelles tu as accès.
- `=aide rank` affiche les paramètres de `=rank`.
- `=mv @membre` ou `=mv 123456789012345678` déplace le membre dans ton vocal.
- `=derank @membre raison du derank` exécute le derank existant, y compris ses logs et son action Roblox.
- `=line off` et `=line on` restent réservés à Aven.
- `=user @membre`, `=bienvenue`, `=mon-profil`, `=anniversaire`, `=play titre à chercher` et toutes les autres commandes affichent un bouton pour ouvrir leur interface ou confirmer leur exécution. Ce clic permet de conserver les formulaires Discord et les réponses privées.

Les boutons de lancement appartiennent à l’auteur du message et expirent après dix minutes. Un lancement ne peut être utilisé qu’une seule fois. Pour `=mv`, `=derank` et `=line`, l’action est immédiate ; le bouton sert uniquement à lire le résultat privé pendant quinze minutes. Aucun MP supplémentaire n’est envoyé pour ces résultats.

## Paramètres

Les paramètres suivent l’ordre indiqué par `=aide nom`. Les membres, salons et rôles acceptent leur mention ou leur ID. Un nom de membre est également accepté s’il correspond à un seul membre déjà connu du bot.

Pour les textes de plusieurs mots suivis d’un autre paramètre, utiliser des guillemets :

```text
=convocation @membre "25/09/2026 20:30" "Point sur la période de test"
=avert @membre "Dernière chance" "Motif de la sanction"
=rank @membre grade add "Membre Aspirant"
```

Les noms et valeurs des choix doivent correspondre à ceux de `=aide` ; les choix de grade proposés par l’ancienne autocomplétion restent reconnus. La syntaxe avec options nommées évite les ambiguïtés :

```text
=derank membre:@membre raison:Motif de la décision note:Note interne facultative
=reunion creer titre:Réunion de famille date:25/09/2026 21:00 duree:60 description:Point hebdomadaire
```

Le bot utilise déjà l’intent Message Content dans son code. Cette option doit aussi rester activée dans Discord Developer Portal pour lire les commandes `=`.

## Anniversaires

Le calendrier du salon 1485319458561069056 tient dans un message avec un seul embed, sans pagination. Les anniversaires du jour et des sept prochains jours figurent en tête, puis le calendrier annuel. Une liste complète publique est jointe si la taille maximale Discord est dépassée.

Les dates privées ou sans accord ne sont ni affichées ni annoncées. Les années de naissance et les âges ne sont jamais publiés. Les annonces du jour sont envoyées dans le salon 1471562633802023115, à la première vérification du jour où le bot est actif, en heure de Paris. Un état persistant évite les doublons après redémarrage ; une réponse réseau incertaine ne provoque pas de renvoi automatique.
