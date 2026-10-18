# Mise à jour communautaire du QG

Serveur ciblé : `1558167237200973967`. Les événements de la Soul Society ne passent pas par ces protections.

## Déploiement et activation

Après le déploiement Railway, utiliser `/setup-serveur mise-a-jour` puis le bouton de confirmation. La prévisualisation annonce les changements de permissions et la suppression du seul salon giveaways communautaire enregistré (ses messages disparaissent). Les tirages actifs de ce salon sont annulés ; leur historique reste enregistré. Les autres giveaways sont conservés. Aucun séparateur n'est créé ou modifié par cette mise à jour.

Le bot doit avoir Gérer les salons, Gérer les rôles, Gérer les messages, Modérer les membres, Bannir des membres, Créer des fils publics, Envoyer des messages dans les fils et Déplacer des membres pour les vocaux. Son rôle doit dépasser Gestion Support et les membres à modérer. Les intents déjà utilisés GuildMembers, GuildMessages, MessageContent, GuildMessageReactions et GuildVoiceStates restent nécessaires. Aucune dépendance ou variable d'environnement supplémentaire.

## Fonctionnement

- Un nouvel arrivant avec uniquement @everyone ne voit que le règlement. La vérification Roblox suivie de la confirmation du règlement attribue Membre Communautaire via le système existant.
- Accueil et Informations sont en lecture seule pour les membres. Les réactions existantes sont également retirées par le bot ; les boutons des panels restent utilisables. La Direction peut publier.
- Les invitations Discord (y compris celles du QG) et mentions everyone/here sont supprimées pour les membres ordinaires et les gestions. Direction et Fondation sont exemptées : propriétaire, propriétaire configuré, Créateur, Gérant Global, Administrateur. Les séparateurs ne donnent pas cette exemption.
- Spam : 6 messages en moins de 8 secondes, ou 4 textes identiques non vides en moins de 20 secondes, tous salons QG confondus. Les messages des bots et les modifications ne comptent pas. Une même rafale ne donne qu'une sanction : timeout 15 minutes, bannissement 24 heures, puis bannissement définitif. Les antécédents ne sont pas remis à zéro. Un échec de sanction est journalisé et ne compte pas comme une sanction confirmée.
- Le bot vérifie les bans échus au démarrage puis chaque minute. Un ban dont le motif diffère est conservé pour examen humain. Un résultat API incertain nécessite un examen humain ; aucun débannissement automatique n'est inventé. Un membre débanni doit revenir avec une invitation, le bot ne peut pas le réintégrer.
- Médias communautaires et familiaux : image, vidéo, audio ou lien média reconnu ; suppression des messages texte seuls et création d'un fil. Les légendes accompagnant un média sont autorisées. Les pièces jointes non identifiées comme média ne sont pas acceptées. Les fils permettent les discussions.
- Suggestions : un fil, deux votes et un ping ciblé de Gestion Support. La commande `=suggestion` existante bénéficie aussi du fil et du ping.
- Les salons commandes acceptent les messages préfixés par `=` ; les interactions slash et boutons restent disponibles.
- Vocaux : nom, nombre de places, verrouillage et sélection native des membres à autoriser ou retirer via un panneau dans les salons commandes. Les accès famille sont vérifiés. Retirer une autorisation bloque une prochaine connexion, sans expulser un participant déjà connecté. Limite de création : un salon par propriétaire et type ; 30 secondes entre créations. Le contrôle natif Gérer le salon n'est plus donné au propriétaire.

## Persistance et limites

La configuration et les antécédents sont enregistrés dans `data/qgServer.json` avec le mécanisme JSON atomique existant. Il faut un seul processus/réplica et un volume Railway monté sur le dossier réel `data` (souvent `/app/data`) pour les conserver lors des redéploiements. La présence de ce volume n'est pas vérifiable depuis ce dépôt. Ne pas ajouter les fichiers de données privés au commit.

Les permissions ne masquent pas nécessairement l'onglet chat d'un vocal : elles bloquent l'écriture et la lecture de l'historique. Discord Administrator et le propriétaire du serveur contournent les restrictions Discord. Une attribution manuelle de rôles peut ouvrir des salons à un utilisateur ; l'installation ne retire pas ces rôles. Les salons privés existants gardent leurs accès manuels. Réexécuter la mise à jour après un ajout manuel de salons pour appliquer les mêmes restrictions.

## Vérifications

Tests locaux sans connexion à Discord :

```powershell
node --test tests/qgCommunityPolicy.test.js tests/qgSchoolSetup.test.js tests/qgEntryVerification.test.js
```

Sur Discord après déploiement :

1. Vérifier avec un compte test sans rôle qu'il ne voit que le règlement ; terminer sa vérification et contrôler l'accès communautaire et le message de bienvenue.
2. Vérifier l'absence d'écriture, fils et réactions dans Accueil / Informations ; cliquer sur un bouton de panel pour vérifier qu'il fonctionne.
3. Envoyer un texte seul puis une image dans médias ; publier une suggestion et vérifier son fil et son unique notification Support.
4. Créer un vocal, ouvrir le panneau depuis commandes, renommer, changer les places, verrouiller et sélectionner un membre ; vérifier que le vocal famille refuse un non-membre.
5. Sur un compte de test exclusivement, contrôler les sanctions et leur journal. Ne pas faire ce test avec un vrai membre non prévenu. Les scénarios temporels et le ban définitif sont couverts par les simulations locales.
6. Relancer la mise à jour : aucun doublon ni nouvelle suppression ne doit apparaître. Vérifier la conservation des antécédents après redémarrage sur le volume.

Les tests automatisés ne prouvent pas le fonctionnement sur le serveur réel : permissions effectives, rôles plus hauts que le bot et volume doivent être vérifiés après déploiement.
