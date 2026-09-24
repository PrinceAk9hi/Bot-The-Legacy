# Musique YouTube — La Soul Society

Le système s’ajoute au bot existant. Aucun ID, fichier de données ou commande de gestion n’est supprimé.

## Utilisation

- Rejoindre un salon vocal classique, puis `=play recherche:titre` : choisir parmi cinq résultats YouTube.
- `=play recherche:https://youtu.be/...` : ajouter directement la vidéo.
- `=musique` : publier le panel de contrôle dans le salon courant.
- `=queue` : consulter les vingt premiers titres en attente (file limitée à cinquante).
- `=skip` : voter pour passer au morceau suivant. Un vote par personne ; au moins la moitié des auditeurs présents est nécessaire. Aven, la fondation et les bypass passent immédiatement.

Le créateur de la session, la fondation et les bypass disposent de Pause/Reprendre, Volume −/+, Arrêter. Les contrôles nécessitent d’être dans le même vocal que le bot. Les membres de la famille peuvent ajouter des titres et voter ; les visiteurs ne peuvent pas utiliser la musique. Les permissions des autres commandes restent identiques.

La musique quitte le vocal après une minute sans auditeur, deux minutes sans titre ou trente minutes en pause. `=line off` et la maintenance globale arrêtent aussi la session. Un jeu vocal et la musique ne peuvent pas utiliser le bot simultanément.

## Installation et Railway

`npm install` installe FFmpeg et le binaire officiel yt-dlp, avec contrôle SHA256. Node 22.12 ou plus est requis ; Node 24 convient au projet. Le moteur vocal et le chiffrement DAVE existants sont conservés. Aucune clé YouTube, aucun cookie et aucun autre service ne sont nécessaires.

Le script `scripts/install-music.cjs` doit être présent dans Git avec `package.json` et `package-lock.json`. Le dossier `.music-bin` est généré pendant l’installation et ignoré par Git ; il ne se trouve pas dans `/app/data`. Ne pas désactiver les scripts d’installation npm sur Railway. Si le téléchargement yt-dlp échoue, les autres systèmes du bot démarrent quand même ; relancer l’installation ou le déploiement répare la partie musicale.

La file musicale est temporaire : un redémarrage termine la session. Les vidéos privées, les directs, les vidéos de plus de deux heures et les liens de playlist sans vidéo ne sont pas pris en charge. Une URL vidéo contenant aussi une playlist lit uniquement cette vidéo.

YouTube peut refuser certaines vidéos ou bloquer l’adresse IP d’un hébergeur. Le bot indique l’erreur et passe au titre suivant ; il ne contourne pas les demandes de connexion ou les restrictions. Le moteur est fixé à yt-dlp 2026.08.19. Une évolution de YouTube peut nécessiter sa mise à jour avec de nouveaux contrôles SHA256.

## Validation

Recherche réelle de cinq résultats, résolution d’un lien et réception de quelques secondes d’audio PCM vérifiées sans connecter le bot à Discord. Les contrôles, votes, permissions, expiration, limite de file, ajouts simultanés et annulation pendant la connexion sont testés en simulation. L’écoute en vocal et le réseau sortant de Railway restent à confirmer après déploiement.
