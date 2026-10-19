# Boosts et espace Support du QG

## Déploiement

Le démarrage normal du bot enregistre `/support` sur le QG et complète la catégorie `1561446326120615966`. Il réutilise les identifiants sauvegardés ou les salons de même nom dans cette catégorie. Aucun salon existant n'est supprimé. Les permissions des salons existants ne sont pas réécrites.

Salons créés si absents : annonces-support, discussion-support, suivi-tickets et guide-support. Les nouveaux salons sont privés à la direction et à la Gestion Support. Les comptes ayant Administrateur contournent les permissions Discord. Les dossiers Fondation restent soumis à leurs permissions propres.

Le bot doit pouvoir gérer les salons, lire les messages et envoyer des embeds/pièces jointes. Les rôles QG de Support doivent déjà être configurés. `/support installer` permet à la direction ou au responsable Support de relancer l'installation en cas d'erreur. Les opérations partielles sont reprises sans recréer les éléments enregistrés.

## Commandes

- `/support suivi` : liste privée des tickets effectivement accessibles à l'exécutant (35 premiers maximum).
- `/support prendre` : réutilise la prise en charge du ticket actuel.
- `/support renommer` : réutilise le formulaire existant.
- `/support fermer` : confirmation puis archivage et fermeture existants.
- `/support installer` : complète les salons et actualise le panel de tickets enregistré.

Les commandes sont réservées à la direction et à la Gestion Support ; les contrôles propres aux tickets sont conservés. Le guide n'est pas un tableau automatique : le suivi à jour se consulte avec la commande.

## Présentation

Le panel utilise l'emoji du serveur nommé `announcement` pour les animations, `staff` pour les signalements et `QG` en introduction. Les GIFs sont réattachés à l'édition. Si announcement est introuvable, une icône standard est utilisée. Le panel ne peut être actualisé automatiquement que si son message figure dans la configuration existante.

Le salon `1561834231473246381` reçoit un embed blanc avec avatar, remerciement, nombre de boosts disponible et niveau du serveur. Signature : Fondateur - QG. Aucune mention ne déclenche de notification.

Le déclencheur est le passage de non-booster à booster fourni par Discord dans guildMemberUpdate. Il ne prétend pas détecter un second boost d'une personne déjà booster, ni reconstituer les boosts survenus pendant l'arrêt du bot. Les événements partiels sont ignorés pour éviter une fausse attribution. Les remerciements envoyés sont dédupliqués via la date de début du boost dans le stockage existant.

## Fichiers et limites

Créés : commandes/support.js, systems/qgSupportWorkspace.js et ce guide.
Modifiés : index.js, systems/qgServer.js, systems/qgPanels.js, systems/qgSchoolSetup.js.
Aucune dépendance ni variable d'environnement ajoutée. Stockage existant data/qgServer.json ; durabilité dépend du volume persistant de l'hébergement, non vérifié ici.

Aucun test automatisé ni essai sur Discord exécuté pour cette modification. Après déploiement, vérifier les accès des salons créés, les emojis, `/support suivi`, la prise en charge et la fermeture sur un ticket de test. Vérifier ensuite le prochain événement de boost réel. Le serveur n'a pas été modifié directement depuis cette session.
