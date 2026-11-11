# Bot-The-Legacy

Bot Discord de la famille QG (issue de SchoolRP). Le même processus gère aussi
l'ancien serveur Soul Society : les événements du QG sont routés vers leurs
propres modules par `systems/qgServer.js`.

## Démarrage

Prérequis : Node.js 22.12 ou plus récent.

```bash
npm install
```

```bash
node index.js
```

Le `npm install` lance aussi `scripts/install-music.cjs`, qui télécharge les
outils audio dans `.music-bin/`.

Variables d'environnement (fichier `.env`, jamais commité) :

| Variable | Rôle |
| --- | --- |
| `TOKEN` | Jeton du bot Discord |
| `OPENAI_API_KEY` | Fonctions IA |
| `ROBLOX_COOKIE` | Accès Roblox (grades du groupe) |
| `ROBLOX_GROUP_ID` | Identifiant du groupe Roblox de l'ancienne Soul Society |
| `QG_ROBLOX_GROUP_ID` | Facultatif : remplace le groupe Roblox du QG (1031372038, dans `config/qg.js`) utilisé par `=acp` |
| `QG_ROBLOX_CONFIRMED_RANK` | Facultatif : numéro du rang Membre confirmé pour `=acp` |

Variables facultatives de la soundboard : voir [sounds/README.md](sounds/README.md).

## Hébergement (Railway)

- Une seule instance : le stockage JSON et les verrous sont locaux au processus.
- Le dossier `data/` doit être sur un volume persistant monté sur `/app/data`.
  Sans volume, un redéploiement efface les données.
- Sauvegarder `data/` avant chaque déploiement important.

## Structure

| Dossier | Contenu |
| --- | --- |
| `index.js` | Point d'entrée, chargement des systèmes et des commandes slash |
| `commandes/` | Commandes slash et préfixe |
| `systems/` | Modules fonctionnels (`qg*` pour le QG) |
| `utils/` | Stockage, permissions, rendus d'images, helpers |
| `config/` | Identifiants de salons/rôles et paramètres par serveur |
| `data/` | Données JSON persistantes (privées) |
| `tests/` | Tests `node --test` avec doublures Discord |
| `hunter/` | Bot Hunter séparé (`npm run hunter`) |
| `scripts/` | Installation audio, polices, génération d'images |

## Tests

```bash
npm test
```

Les tests utilisent des stockages temporaires et ne se connectent pas à Discord.

## Documentation des modules QG

- [Accès](README-QG-ACCES.md), [Actualisation](README-QG-ACTUALISATION.md),
  [Administration](README-QG-ADMIN.md), [Modules et animations](README-QG-MODULES.md)
- [Panels](README-QG-PANELS.md), [Profils](README-QG-PROFILS.md),
  [Avatar de bienvenue](README-QG-AVATAR-BIENVENUE.md)
- [Casino](README-QG-CASINO.md), [Communauté](README-QG-COMMUNAUTE.md),
  [Conférences et vocal](README-QG-CONFERENCES-VOCAL.md)
- [Entretiens](README-QG-ENTRETIENS.md), [Réunions](README-QG-REUNIONS.md),
  [Sanctions /sp](README-QG-SP.md), [Support](README-QG-SUPPORT.md),
  [Tag et IA](README-QG-TAG-IA.md)
- Autres : [Commandes préfixe](COMMANDES-PREFIXE.md), [Musique](MUSIQUE.md),
  [Absences et réunions](ABSENCES-REUNIONS.md), [Mise à jour des panels](MISE-A-JOUR-PANELS.md)
- Historique des livraisons : [CHANGELOG.md](CHANGELOG.md)
