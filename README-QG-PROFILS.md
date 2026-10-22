# Compléter les anciens profils QG

Au premier démarrage de cette version, le bot prend un instantané des membres humains avec une acceptation enregistrée ou un ancien rôle communautaire/vérifié reconnu, mais sans profil Roblox + nom Discord + confirmation complète. Un rôle historique constitue une trace d'accès antérieur, pas une preuve de date d'acceptation. Les nouveaux arrivants continuent le parcours normal. Les membres déjà complètement vérifiés ne recommencent pas.

Le traitement commence automatiquement par lots de cinq. Les grades et gestions ne sont pas retirés. Des dérogations individuelles limitent temporairement la visibilité au règlement, avec déconnexion vocale. L'état antérieur des permissions est conservé avant écriture. Les nouveaux salons sont également traités. Une modification manuelle divergente du staff est conservée pendant la restauration.

Un MP contient un bouton persistant ouvrant uniquement les champs pseudo Roblox et nom souhaité sur Discord. Le membre confirme ensuite le profil Roblox trouvé. Aucune nouvelle acceptation du règlement, aucun nouveau message de bienvenue. Le compte Roblox est déclaré, sa propriété n'est pas authentifiée. Les accès antérieurs et le rôle communautaire sont rétablis, sans suppression des sanctions indépendantes.

Si les MP sont fermés ou leur livraison est incertaine, pas de relance automatique répétée : le bouton de vérification du règlement ouvre le même formulaire. Les données sont sauvegardées dans `data/qgServer.json`. Le volume de données existant doit être durable sur Railway. Sauvegarder data avant le déploiement.

`/setup-serveur suivi-profils` affiche l'avancement, les MP fermés et les erreurs (direction uniquement). Les échecs techniques sont retentés cinq minutes plus tard. Les confirmations expirent après trente minutes ; rouvrir le formulaire renouvelle la confirmation. Les restrictions en cours de restauration reprennent après redémarrage.

Exceptions : propriétaire et utilisateurs avec Administrator ne sont pas inclus, car les dérogations Discord ne peuvent pas leur retirer leurs accès. Les membres en prison restent soumis à leur sanction ; le traitement attend sa fin. Un bot incapable de modifier le surnom ou d'attribuer le rôle communautaire signale une erreur. La limite Discord de 100 dérogations par salon peut empêcher de restreindre de gros lots : le diagnostic conserve l'erreur, il ne prétend pas avoir appliqué les restrictions.

Contrôles : syntaxe Node des six fichiers concernés valide. Aucun test réel de MP, de restrictions ou de restauration n'a été exécuté. Le démarrage déployé déclenche la migration : contrôler le suivi et un premier profil sur le serveur. Ne pas supprimer `profileCatchup` du stockage tant qu'une restauration est en attente.

## Départ puis retour
La vérification est maintenant liée à joinedTimestamp. Un départ invalide le parcours actif et archive son acceptation dans schoolVerificationHistory, en conservant les informations Roblox pour préremplir le nouveau formulaire. Au retour, le membre doit confirmer son profil et accepter de nouveau le règlement. Une comparaison des dates couvre aussi les retours pendant une interruption du bot. Les anciens boutons ne peuvent pas accorder les accès. Un ancien rattrapage de profil est terminé et ses restrictions temporaires nettoyées pour que le nouveau séjour suive la vérification complète. Un redémarrage sans départ ne réinitialise pas la vérification. Validation : cinq tests ciblés qgVerificationRejoin.test.js réussis, aucun test réel sur Discord.
