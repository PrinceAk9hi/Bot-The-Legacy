# QG — Assistant officiel

## Diagnostic et périmètre

Le parcours QG était distinct du support historique : `qgTicketAssistant.js` utilisait OpenAI directement, le règlement complet et 25 messages récents, sans recherche documentaire ni corrections QG. Son filtre remplaçait même le mot « membre » par « QG ». Les erreurs du fournisseur provoquaient une escalade immédiate.

L'ancien `/ia` et `ticketAiKnowledge` utilisent des sources historiques non isolées par serveur, un classement lexical et un bonus aux entrées personnalisées. Ce mécanisme pouvait sélectionner un texte sans rapport avec la question. Sans trace d'exécution de la capture, on ne peut pas établir quel parcours avait produit ce message exact. Le nouveau parcours QG ne consulte plus ces données pour répondre. Les fonctions de l'autre serveur sont conservées.

## Fichiers

- `utils/qgAiStore.js` : stockage dédié, transactions synchrones atomiques, sauvegarde, contrôle du schéma, conservation.
- `utils/qgAiKnowledge.js` : sujets, sélection, provenance, validité, rédaction validée, propositions et validation des corrections, migration en brouillons.
- `utils/qgAiContext.js` : mémoire par serveur/ticket/demandeur, extraits anciens, faits vérifiés du code QG et navigation accessible.
- `systems/qgAiService.js` : fournisseur OpenAI existant, réponse JSON, contrôle des sources et références, garde-fous, limites de concurrence.
- `systems/qgAiControlPanel.js` : interface administrative `/ia`, pages, modales, confirmations et contrôles d'accès.
- `systems/qgTicketAssistant.js` : intégration aux tickets existants, réponses, historique, incidents et escalades.
- `systems/qgServer.js` : routage des interactions QG et nettoyage horaire des données expirées.
- `index.js` : enregistrement de `/ia` avec une définition propre au QG ; autres commandes préservées.
- `.gitignore` : exclusion des données privées `data/qg-ai/`.
- `tests/qgAi.test.js` : tests locaux dédiés.
- `README-QG-IA.md` : ce guide.

Aucune dépendance ajoutée. Versions déclarées conservées : Discord.js ^14.27.0, OpenAI ^7.5.0, Node >=22.12.0.

## Fonctionnement des réponses

1. Vérifier le serveur, le propriétaire du ticket, l'état de prise en charge et les réglages.
2. Identifier le sujet, en conservant celui de la conversation pour les questions de suivi.
3. Récupérer jusqu'à 12 messages récents du demandeur et de l'assistant, dans ce ticket uniquement. Les réponses historiques ne sont pas des règles officielles.
4. Sélectionner au maximum quatre connaissances valides et pertinentes : sujet, mots-clés, correspondances de titre et contenu. Les sujets responsable du bot, direction et effectifs sont strictement séparés, même si une entrée est mal classée comme générale.
5. Envoyer les données pertinentes dans une enveloppe JSON non privilégiée, séparée du prompt système. Le modèle reformule ; le code ne renvoie pas directement le contenu d'une connaissance comme réponse.
6. Contrôler la structure, les références aux sources, les références Discord, certaines incohérences et les affirmations d'actions administratives. Une réponse rejetée devient une demande de précision, sans nouvel appel automatique.
7. Publier la réponse ou transmettre le ticket via le routage existant ; enregistrer les mesures et le contexte.

Le contexte conserve 12 messages et six extraits de 350 caractères d'anciens messages du demandeur. Ces extraits sont une mémoire partielle, pas un résumé exhaustif. Les pièces jointes sont signalées mais ne sont pas analysées. Le bot ne lit pas toutes les conversations des salons du serveur.

Les faits du code couvrent vérification, recrutement MP, gestions, règlement, absences, grades, vocaux, commandes administratives existantes et compte total du serveur. Le nombre total de comptes inclut les bots ; il ne représente pas l'effectif familial. Le nom du développeur et le responsable technique ne sont pas déduits de l'identité du propriétaire Discord.

## Escalades

- Question courante : réponse directe avec les faits disponibles ou les connaissances générales.
- Détail manquant : question ciblée, sans ping.
- Demande de staff, action sensible, incident grave : relais humain sans exécution administrative par l'IA.
- Animation/signalement/Fondation : collecte adaptée, puis transfert selon le routage existant.
- Problème persistant ou fait local indispensable introuvable : le modèle peut proposer le relais ; une incertitude générale seule ne suffit pas.
- Panne, quota ou délai du fournisseur : message compréhensible, au plus un avis d'indisponibilité par ticket en dix minutes, sans ping automatique.

Le routage existant conserve son verrou et son état `escalatedAt`. Une seule notification de gestion est envoyée par ticket. Les réponses automatiques s'arrêtent après prise en charge humaine. Une demande explicite d'équipe reste traitable quand les réponses automatiques sont désactivées, dans les tickets autorisés.

## Utilisation de `/ia`

Accès vérifié à chaque commande, bouton et modale : propriétaire du serveur, propriétaire configuré du bot, ou rôles QG Créateur, Gérant Global et Administrateur. Un nom de rôle similaire n'accorde aucun accès. Les informations sont éphémères. Les identifiants de composants sont stables après redémarrage ; une interaction Discord déjà expirée nécessite de relancer `/ia`.

### Pages

- **Vue d'ensemble** : état, questions ayant reçu une réponse, escalades, signalements, issues manuelles, temps moyen, tokens et sujets.
- **Qualité et tendances** : questions fréquentes regroupées par texte normalisé et types d'erreurs récurrents, sur la période conservée.
- **Connaissances** : ajouter, modifier par référence, rechercher, archiver après confirmation, importer d'anciennes entrées en brouillons. Modifier une entrée archivée la réactive après validation explicite de son contenu.
- **Corrections** : question, réponse incorrecte, problème, correction proposée et sujet ; examen, validation ou refus. Une proposition non validée ne sert jamais de vérité.
- **Demandes non résolues** : références et statut ; enregistrer une issue `resolved`, `ignored` ou `pending` ne ferme aucun ticket.
- **Incidents** : erreurs techniques et anomalies détectées avant publication.
- **Configuration** : activer/désactiver avec confirmation, limiter aux IDs de certains tickets, conservation de 1 à 365 jours, effacer un contexte, diagnostic du stockage.
- **Test sans publication** : réponse proposée, sujet, sources, temps, information manquante et décision théorique. Aucun message de ticket, ping, déplacement ou sanction. Un appel logique au modèle, avec au maximum une reprise réseau par le SDK.

### Ajouter une information

Ouvrir Connaissances → Ajouter / modifier. Laisser la référence vide pour créer ; saisir celle d'une entrée pour la remplacer. Le contenu doit être public et validé pour QG. Ne pas y placer un dossier privé, un secret ou des instructions destinées à modifier le comportement interne du modèle.

Sujets :

| Valeur | Usage |
|---|---|
| `bot-owner` | Responsable technique du bot |
| `direction` | Direction du serveur |
| `members` | Effectifs |
| `recruitment` | Candidature familiale |
| `management` | Candidatures aux gestions |
| `rules` | Règlement et vérification |
| `moderation` | Procédures de modération |
| `discord` | Discord et commandes |
| `absence` | Absences |
| `grades` | Grades et promotions |
| `voice` | Vocaux |
| `general` | Autres informations, classer plus précisément si possible |

Exemple : titre « Qui gère le bot QG ? », sujet `bot-owner`, contenu factuel sur la personne ou l'équipe réellement responsable. Ne pas déduire cette personne de l'exemple du cahier des charges.

### Corriger une réponse

Corrections → Signaler / proposer → remplir les cinq champs. Copier la référence reçue, puis Examiner une correction. Vérifier le sujet et le contenu avant Valider. La connaissance validée est immédiatement recherchable, y compris après redémarrage. Une ancienne entrée ayant le même titre/question et le même sujet est marquée remplacée. Si le titre diffère, modifier ou archiver explicitement l'ancienne connaissance contradictoire.

Il ne s'agit pas d'un réentraînement du modèle. Aucun bouton demandant systématiquement au membre si la réponse est utile n'est ajouté.

## Migration

L'ancienne base reste intacte et n'est pas chargée dans les réponses QG. Importer en brouillons examine uniquement `ticketKnowledgeEntries` et `iaControlKnowledge` et ne retient que les entrées portant explicitement le `guildId` QG et le statut `validated`, actives et non expirées. Les références à l'autre serveur et les entrées sans provenance sont exclues. Chaque import est idempotent et doit être validé dans Corrections avant publication. Les entrées non attribuées doivent être réexaminées et ajoutées manuellement après vérification ; aucune attribution automatique au QG.

## Stockage et Railway

Fichier dédié : `data/qg-ai/state.json`, ou `QG_AI_DATA_DIR/state.json` si configuré. Schéma 1 : configuration, connaissances, corrections, conversations, événements, audit, références de migration. Une sauvegarde `.bak` conserve l'état précédent. Des fichiers invalides ne sont pas remplacés silencieusement par une base vide : sauvegarde valide utilisée avec diagnostic, sinon les réponses échouent de manière fermée.

Transactions synchrones et renommage atomique : adapté à **un seul processus/une seule réplique**. Pas de verrou multiprocessus. Conservation par défaut 30 jours, nettoyage au démarrage, toutes les heures et à chaque écriture ; événements limités à 5 000 et audit à 1 000. Les connaissances validées restent jusqu'à archivage. Les contenus privés des anciennes corrections sont purgés ; les propositions non validées expirent. Sauvegarder le volume de façon indépendante ; `.bak` n'est pas un historique complet.

La configuration du volume Railway n'est pas accessible depuis ce dépôt. **Persistance non vérifiée en production.** Vérifier que `/app/data` est réellement monté sur un volume persistant, ou définir `QG_AI_DATA_DIR` vers un autre montage durable. Ne jamais committer ces fichiers privés. Ne pas créer une nouvelle réplique qui écrirait simultanément ce JSON.

Variables :

- `OPENAI_API_KEY` : clé existante, jamais affichée.
- `TICKET_AI_MODEL` : modèle existant conservé.
- `QG_AI_MODEL` : optionnel, remplace le modèle seulement pour QG. Sans valeur, reprend `TICKET_AI_MODEL`, puis le repli historique `gpt-5.6-luna`. La disponibilité réelle de ce modèle pour le compte n'a pas été testée ; configurer un modèle accessible si nécessaire.
- `TICKET_AI_ENABLED=false` : arrêt existant respecté, prioritaire sur l'activation du panneau.
- `QG_AI_DATA_DIR` : optionnel, chemin persistant dédié.

Aucun nouvel intent ni permission Discord n'est requis. Les permissions existantes de lecture d'historique, envoi/embeds, gestion des salons et des rôles restent nécessaires selon les fonctions de support. Les informations de salons sont filtrées par accès du demandeur et du bot. L'envoi des messages récents et données QG pertinentes au fournisseur a été explicitement autorisé dans cette conversation.

## Tests et vérification réelle

`npm test` exécute les tests avec faux fournisseur et objets Discord simulés. Les tests QG IA couvrent les douze cas demandés, les transactions, la corruption, l'expiration, la migration, les références Discord, la sérialisation des pages, l'autorisation et le traitement complet d'un ticket. Aucun appel OpenAI payant ni connexion à Discord durant ces tests.

Dernière exécution complète le 19 octobre 2026 : **99 tests réussis, 0 échec**, dont 25 tests dédiés à l'IA QG. Les vérifications de syntaxe des huit modules créés/modifiés et `git diff --check` ont également réussi. Aucun test sur un serveur Discord réel ni validation de disponibilité du modèle n'a été effectué.

Après déploiement :

1. Confirmer la présence du volume et des variables existantes, puis ouvrir `/ia` sur le QG.
2. Essayer la commande avec un membre ordinaire : accès refusé.
3. Ajouter une connaissance publique, utiliser Rechercher puis Test. Une question simple doit être reformulée ; une source hors sujet doit être absente du diagnostic.
4. Ouvrir un ticket Questions/Aide : demander le règlement, puis comment rejoindre la famille, puis « Et combien de temps ça prend ? ».
5. Demander un gestionnaire : vérifier un seul transfert et une seule notification.
6. Proposer une correction, vérifier qu'elle n'apparaît pas dans la recherche avant validation, la valider puis retester.
7. Désactiver les réponses et vérifier qu'une question ordinaire ne reçoit plus de réponse automatique.
8. Redémarrer Railway, puis confirmer que connaissance, correction, configuration et contexte sont conservés.

## Limites honnêtes

La recherche est lexicale avec classification de sujets, pas un moteur d'embeddings. Les contrôles détectent certaines incohérences mais ne prouvent pas toutes les affirmations d'un modèle. Les tests simulés valident les mécanismes, pas la qualité linguistique d'un modèle réel. Les images ne sont pas analysées, les documents externes ne sont pas parcourus et les noms des responsables non documentés restent inconnus. Le support automatique demeure limité aux tickets QG. Le coût n'est pas inventé : tokens enregistrés lorsque fournis, montant non estimé. Une réponse envoyée n'est pas comptée comme une résolution ; les issues connues proviennent de la saisie du staff.

L'API conserve le mode JSON existant avec validation applicative ; le mode JSON seul ne garantit pas le schéma : [documentation officielle OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat).

## Déploiement

L'enregistrement de `/ia` QG se fait au démarrage normal du bot. Aucune installation de structure ni commande `/setup-serveur` n'est nécessaire. Le centre IA historique de l'autre serveur garde sa propre définition. Ne pas ajouter les fichiers de données à Git.

```powershell
cd "C:\Users\wferr\OneDrive\Documents\MonBotDiscord"
git add .gitignore index.js systems/qgServer.js systems/qgTicketAssistant.js systems/qgAiService.js systems/qgAiControlPanel.js utils/qgAiStore.js utils/qgAiKnowledge.js utils/qgAiContext.js tests/qgAi.test.js README-QG-IA.md
git commit -m "Refond l assistant IA QG et isole ses connaissances"
git push origin main
```
