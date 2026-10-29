# Mise à jour des panels QG

- Correction des identifiants de pagination dupliqués dans animations, effectifs et notes.
- Centre animations permanent : 1562885442745929758. Installé au démarrage, entretenu sans doublons et accessible avec des sessions privées.
- Suppression : créateur initial, direction configurée ou responsable animation ; contrôle renouvelé à la confirmation.
- La commande /maj est supprimée : le QG se met à jour tout seul à chaque démarrage du bot. Les anciens composants restent traités pour compatibilité.
- Actualisation automatique au démarrage : rôles des gestions, séparateurs, niveaux, panneaux enregistrés, effectifs, support, entretiens, centre animations, calendrier et candidatures. Les erreurs sont détaillées sans bloquer les étapes indépendantes.
- Les installations et migrations particulières restent dans le menu avec leur confirmation. Les anciennes restrictions propriétaire sont conservées.
- La configuration des réunions passait par /maj ; elle n’est plus accessible par commande.
- Les commandes métier sont conservées ; les sous-commandes installer de support et entretien sont masquées.

## Déploiement
Déployer le bot principal, puis redémarrer le bot : l’actualisation est automatique (bilan dans la console). Le démarrage réenregistre les commandes QG. Le bot doit pouvoir voir, écrire et intégrer des liens dans le salon du centre animations.
Le bot musique est un projet séparé : déployer également Music-1. Son enregistrement préserve le point d’entrée Activity et le crée lorsqu’ACTIVITY_ENABLED=true. Les paramètres Activities, URL Mapping et accès testeurs du portail restent nécessaires. La visibilité réelle dans Discord doit être confirmée après déploiement.
