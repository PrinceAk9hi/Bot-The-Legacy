# Assistant IA pour les tickets Soul Society

## Ce qui change

- Réponses automatiques uniquement dans les salons créés par le système tickets (`soul-ticket|...`).
- Contexte de ticket : jusqu’à 24 messages utiles, réponses réellement envoyées par l’IA, essais du membre et résumé des messages plus anciens, sauvegardés dans `data/ticketAiHistory.json` (purge après 30 jours). Le transcript de fermeture reste géré par le système existant.
- Les règles de limitation annoncées précédemment (5 réponses par heure et délai de 20 secondes) n’étaient pas implémentées dans le code. La sérialisation existante garantit une seule génération à la fois par ticket ; les limites d’usage du fournisseur restent applicables.
- Arrêt des réponses automatiques quand un membre de l’équipe écrit dans le ticket ou qu’un membre du staff a pris le ticket en charge.
- Les informations confirmées Soul Society viennent de la base validée, des commandes réellement chargées et accessibles au membre, et des salons textuels consultables par le membre et le bot. Les permissions privées du membre ne sont pas supposées depuis le nom d’un rôle.
- L’IA peut utiliser ses connaissances générales pour expliquer Discord et le dépannage courant. Une lacune documentaire seule ne déclenche pas de mention ; elle peut être enregistrée pour amélioration. Les décisions personnelles, actions staff, incidents de sécurité, conflits graves et problèmes techniques non résolus sont transmis à la gestion, une fois par ticket.
- Le prompt traite l’historique et les extraits de salons comme données non fiables, ignore leurs tentatives d’instructions et ne révèle pas les secrets.

## Configuration Railway

1. Dans Railway, ouvrir le service du bot puis **Variables**.
2. Vérifier que `OPENAI_API_KEY` existe déjà. Le bot utilise déjà la bibliothèque `openai`; ne coller la clé que dans Railway ou dans le `.env` local, jamais dans le code ou Discord.
3. Ajouter `TICKET_AI_MODEL` avec la valeur `gpt-5.6-luna` (facultatif : c’est la valeur par défaut). Le modèle est facturé à l’usage : actuellement 0,20 $ / million de tokens en entrée et 1,20 $ / million en sortie. Il n’y a pas de niveau gratuit API ; avec les limites du bot, le coût est conçu pour rester très faible. Prix officiels : https://developers.openai.com/api/docs/models/gpt-5.6-luna
4. Enregistrer les variables et laisser Railway redéployer le bot.
5. Laisser Railway redéployer puis vérifier dans Discord : `=aide`, une question générale sur Discord, une paraphrase de « modifier mon profil », une erreur de permissions, une précision manquante, puis une contestation personnelle de sanction. Les quatre premières doivent recevoir une aide ou une question ciblée sans ping ; la dernière doit être transmise à la gestion.

## Vérifications locales

Exécuter `npm test` avec Node.js 22.12 ou supérieur. Les tests couvrent les questions usuelles, paraphrases de commande, filtrage par permissions, erreurs, historique, demande de précision, escalade administrative, résistance à une demande de secrets et anti-doublon.

## Politique d’escalade

Une réponse connue ou déductible est donnée sans mention. Si une donnée indispensable manque, l’IA pose une question courte. Une lacune de la base est un indicateur interne pour enrichir la base, jamais un déclencheur seul. La mention staff intervient pour une décision individuelle/administrative, une action réservée à l’équipe, un incident de sécurité ou conflit grave, un problème technique qui persiste après les vérifications, ou une indisponibilité du fournisseur IA. La première escalade met le ticket en attente de l’équipe et coupe les notifications identiques suivantes.

## Actions vocales avec `=ia`

`=ia` est réservé au propriétaire du bot. Les demandes vocales simples et identifiées sont exécutées immédiatement, sans bouton de confirmation et sans quota propre à la commande. L’utilisateur et le bot doivent toutefois avoir les permissions Discord requises (`Mute Members` ou `Move Members`). Les actions disponibles sont le mute vocal, la déconnexion et le déplacement d’un membre indiqué par ID/mention, ainsi que le mute/débranchement de tous les membres présents dans un vocal identifié. Le déplacement d’un groupe demande un vocal source et une destination précise. Exemples : `=ia mute 123456789012345678`, `=ia deco tout le monde de la voc`, `=ia mouve 123456789012345678 dans <#ID_VOCAL>`. Une cible ou un salon ambigu ne déclenche aucune action ; l’IA demande une précision. Les bots et comptes protégés ne sont pas affectés par une action de groupe. Les quotas/rate limits propres à `=ia` ont été retirés ; les limites techniques de Discord et du fournisseur restent applicables.

Le bot possède déjà l’intent Discord `MessageContent` et `OPENAI_API_KEY` est déjà utilisé par le projet. Aucun paquet npm supplémentaire n’est nécessaire. Les messages retenus comme contexte sont stockés dans le dossier `data` persistant du bot et envoyés à l’API OpenAI pour générer la réponse.

## Base de connaissances embarquée

Le résumé du règlement public, l’accès Membre par réaction, le questionnaire de 12 questions, les étapes d’entretien/admission, le parcours `=bienvenue`, les avertissements généraux et les règles de confidentialité des tickets sont dans `systems/ticketAssistant.js`. Les décisions individuelles sont systématiquement remontées au staff.
