# /sp joueur — état de l'intégration

La commande est enregistrée pour le QG au démarrage normal du bot. Accès : direction et Gestion Support, avec contrôles de hiérarchie et confirmations avant sanction. La fiche est privée, liée à son auteur et expire après dix minutes.

Actions implémentées : avertissement enregistré et notifié en MP si possible ; prison Discord temporaire via le système existant ; timeout Discord temporaire (28 jours maximum, un timeout actif n'est pas écrasé). Le timeout Discord bloque notamment l'écriture et les interactions vocales : il ne s'agit pas uniquement d'une coupure de microphone serveur.

Le bannissement est codé sans suppression des anciens messages, mais reste désactivé jusqu'à confirmation des responsables habilités. Tempjail reste également désactivé en attente de définition de sa différence avec tempprison. Aucune action désactivée ne peut être exécutée en forgeant le composant.

Les sanctions sont conservées dans schoolSanctions du stockage QG existant, avec auteur, cible, motif, durée, résultat et statut de notification privée. Historique plafonné à 5000 entrées. Une interruption peut laisser un résultat pending : cela ne signifie pas une sanction réussie et elle n'est pas rejouée automatiquement. Les erreurs de MP ne suppriment pas les sanctions effectivement appliquées.

Le suivi vocal mesure la présence connectée (pas la parole ni l'écoute). Il débute à l'activation de ce module et ignore les périodes où le bot était hors ligne. Sauvegarde chaque minute et lors des changements vocaux ; jusqu'à une minute peut être perdue lors d'un arrêt brutal. Le stockage exige toujours un volume durable et une instance unique. Pas de rétroactivité.

Invité par : non déterminé. Aucun mécanisme fiable d'attribution des invitations n'a été trouvé dans le QG ; le panneau ne prétend donc pas connaître l'invitant.

Créés : commandes/sp.js, systems/qgSanctionPanel.js, systems/qgMemberMetrics.js, README-QG-SP.md. Modifiés : index.js et systems/qgServer.js. Aucune dépendance supplémentaire. Le bot nécessite les permissions existantes des rôles/prison, ainsi que ModerateMembers pour les timeouts et BanMembers lorsque le ban sera activé.

Aucun test automatisé ou test Discord exécuté pour cette modification. L'intégration reste à compléter après les deux précisions demandées à l'utilisateur.
