# Sons du bot

Dépose les MP3, WAV ou OGG directement dans ce dossier (pas dans des sous-dossiers). Les fichiers sont détectés à chaque recherche /sound, sans redéployer les commandes slash. Les nouveaux fichiers locaux doivent être envoyés avec Git puis déployés sur Railway pour y devenir disponibles.

Un son doux de démonstration de 10 secondes est inclus : demo_doux_10_secondes.wav.
Les noms affichés retirent l'extension et remplacent les tirets et underscores par des espaces. Les identifiants sont dérivés du vrai nom de fichier. Les fichiers portant le même nom d'affichage restent différenciés.

Dépendances : aucune nouvelle. Le projet utilise déjà discord.js ^14.27.0, @discordjs/voice ^0.19.2, ffmpeg-static 5.3.0, prism-media ^1.3.5 et opusscript ^0.0.8. Node >=22.12.0. Railway installe les dépendances avec le package existant ; aucune installation système FFmpeg ni modification du postinstall musical n'est nécessaire.

Variables Railway facultatives :
- SOUND_COOLDOWN=3 : secondes entre demandes par utilisateur (bypass et administrateurs exemptés).
- DEFAULT_VOLUME=0.5 : volume entre 0 et 1.
- SOUND_IDLE_SECONDS=5 : secondes avant départ après la dernière lecture.
- SOUND_DIRECTORY=/app/data/sounds : autre dossier, par exemple sur le volume persistant. Sans cette variable : /app/sounds. Le dossier personnalisé remplace le catalogue par défaut et doit contenir ses propres fichiers.

Utilisation : /sound son:<choix de l'autocomplete>, puis /stopsound pour interrompre et vider la file. Rejoins le vocal du bot pour ajouter un son ou arrêter. Accès identique à la musique (membres de la famille et bypass). Chaque serveur a sa propre session. Maximum 50 sons en attente. Une activité vocale existante n'est pas interrompue ; arrête-la avant de lancer la soundboard. Un son en erreur est ignoré et le suivant est essayé. La file est temporaire et n'est pas restaurée après redémarrage.

Permissions du bot dans le vocal : Voir le salon, Se connecter, Parler. Le salon doit être un vocal classique. Le bot quitte si sa connexion est coupée ou s'il est déplacé. Les slash /rank, /mrankup et /réunion restent disponibles, ainsi que toutes les commandes en =.

Vérification après déploiement : rejoindre un vocal, lancer le son de démonstration, ajouter un deuxième son, constater leur lecture entière et le départ automatique. Relancer puis /stopsound : arrêt et départ immédiats. Les tests locaux couvrent la logique simulée et le décodage réel FFmpeg ; aucune connexion réelle à Discord n'a été lancée pendant le développement.
