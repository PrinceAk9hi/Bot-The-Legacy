# Assistant IA pour les tickets Soul Society

## Ce qui change

- Réponses automatiques uniquement dans les salons créés par le système tickets (`soul-ticket|...`).
- Contexte limité aux 12 derniers échanges du ticket, sauvegardés dans `data/ticketAiHistory.json` (purge après 30 jours). Les tickets sont déjà transcrits par le système existant lors de leur fermeture.
- Limite de 5 réponses IA par personne et par heure, plus un délai de 20 secondes par personne et ticket.
- Arrêt des réponses automatiques quand un membre de l’équipe écrit dans le ticket ou qu’un membre du staff a pris le ticket en charge.
- Signalements, sanctions, recours, urgences et décisions individuelles de candidature sont passés à l’équipe ; aucune sanction ni décision n’est prise par l’IA.
- Le prompt ignore les instructions contenues dans les messages de ticket et n’accepte que les réponses fondées sur les informations du serveur.

## Configuration Railway

1. Dans Railway, ouvrir le service du bot puis **Variables**.
2. Vérifier que `OPENAI_API_KEY` existe déjà. Le bot utilise déjà la bibliothèque `openai`; ne coller la clé que dans Railway ou dans le `.env` local, jamais dans le code ou Discord.
3. Ajouter `TICKET_AI_MODEL` avec la valeur `gpt-5.6-luna` (facultatif : c’est la valeur par défaut). Le modèle est facturé à l’usage : actuellement 0,20 $ / million de tokens en entrée et 1,20 $ / million en sortie. Il n’y a pas de niveau gratuit API ; avec les limites du bot, le coût est conçu pour rester très faible. Prix officiels : https://developers.openai.com/api/docs/models/gpt-5.6-luna
4. Enregistrer les variables et laisser Railway redéployer le bot.
5. Tester un ticket Support Général avec une question simple du règlement. Pour une question de sanction ou de candidature personnelle, l’équipe doit être mentionnée et l’IA doit lui laisser la main.

Le bot possède déjà l’intent Discord `MessageContent` et `OPENAI_API_KEY` est déjà utilisé par le projet. Aucun paquet npm supplémentaire n’est nécessaire. Les messages retenus comme contexte sont stockés dans le dossier `data` persistant du bot et envoyés à l’API OpenAI pour générer la réponse.

## Base de connaissances embarquée

Le résumé du règlement public, l’accès Membre par réaction, le questionnaire de 12 questions, les étapes d’entretien/admission, le parcours `=bienvenue`, les avertissements généraux et les règles de confidentialité des tickets sont dans `systems/ticketAssistant.js`. Les décisions individuelles sont systématiquement remontées au staff.
