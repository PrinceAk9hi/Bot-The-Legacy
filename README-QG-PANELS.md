# Panels et assistance du QG

## Mise en service

Déployer les fichiers puis exécuter `/setup-serveur mise-a-jour` sur le QG et confirmer. La commande actualise les panels enregistrés, prépare les catégories privées de tickets et crée le rôle Absent s'il manque. Les séparateurs ne sont pas modifiés. Les permissions communautaires de la mise à jour précédente restent appliquées.

Le bot doit disposer de Gérer les salons, Gérer les rôles, Expulser des membres, ainsi que des permissions déjà nécessaires aux tickets, messages, sanctions et vocaux. Son rôle doit être au-dessus des personnes à exclure et du rôle Absent. Un rôle Absent déjà existant avec des permissions est refusé afin de ne pas attribuer des privilèges par une déclaration d'absence.

## Panels

Les nouveaux embeds QG et les panels actualisés utilisent une couleur blanche et la signature `Fondateur - QG`. La couleur native du fond Discord dépend du thème du membre. Les archives et anciens messages historiques ne sont pas réécrits.

Ordre du menu Support :

1. Questions/Aide — emoji mail fourni.
2. Demander une animation — emoji staff fourni.
3. Signaler un comportement — emoji whitediamond fourni.
4. Contacter la Fondation — emoji papercrown fourni.

Les emojis personnalisés sont configurés avec leurs identifiants fournis. Leur disponibilité sur Discord doit être vérifiée en production. La bannière GIF existante est conservée.

Le panel notifications détaille les quatre groupes et utilise l'emoji notification fourni. Celui des gestions décrit les missions et calcule les places restantes sur deux membres, hors responsable, depuis les rôles réels. Le compteur est actualisé pendant la mise à jour et chaque minute. Les acceptations de candidatures sont sérialisées par gestion et refusées si les deux places sont occupées ; aucun membre existant n'est retiré pour respecter cette limite.

## Tickets et IA

Les nouveaux tickets sont créés dans `✦・TICKETS EN COURS`, catégorie positionnée en bas lors de la mise à jour. Chaque ticket possède ses propres permissions. Le transfert conserve celles-ci et ne les synchronise jamais sur la catégorie de destination :

| Type | Destination à la prise de relais IA |
|---|---|
| Questions/Aide | Gestion Support |
| Animation | Gestion Animation |
| Signalement | Fondation |
| Contacter la Fondation | Fondation |

Discord ne propose pas de catégories imbriquées. Gestion Support et Gestion Animation sont donc des catégories ; Fondation réutilise celle déjà configurée. Le propriétaire Discord et les rôles possédant réellement Administrator contournent les permissions natives.

L'ancien assistant n'écoutait que l'autre serveur. Le module QG réutilise le fournisseur et `OPENAI_API_KEY`, `TICKET_AI_MODEL` et `TICKET_AI_ENABLED` déjà utilisés. Aucune nouvelle dépendance ni nouvelle clé n'est nécessaire. Il lit jusqu'à 30 messages récents, en transmet au plus 25 avec une longueur bornée, le règlement et les noms des salons visibles au demandeur. Il ne lit pas les pièces jointes : leur présence est indiquée sans prétendre comprendre leur contenu. Il utilise les connaissances générales pour les questions simples et demande les précisions manquantes.

L'IA renvoie une réponse JSON vérifiée par le code. Elle ne choisit ni un identifiant de rôle ni un salon arbitraire : les transferts sont déterminés par le type de ticket enregistré. Une seule escalade est enregistrée par ticket et l'assistant cesse de répondre après la prise en charge ou le transfert. Sans clé, lorsque l'assistance est désactivée, ou en cas d'échec du fournisseur, la demande passe à l'équipe. Les appels réels restent soumis à la facturation et aux quotas du fournisseur existant. Aucun appel facturé n'est exécuté par les tests locaux.

Référence technique utilisée : [documentation officielle OpenAI sur les sorties structurées et le mode JSON](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat). Le mode JSON est accompagné d'une validation des champs côté bot.

## Aide à la vérification

Le bouton Besoin d'aide est accessible avant vérification. Il demande le problème puis ouvre un ticket privé pour Gestion Support. Un membre ne peut avoir qu'une demande d'aide ouverte.

Quatre clics en trente secondes constituent une rafale abusive : avertissement en MP, puis exclusion lors d'une nouvelle rafale après avertissement. La Direction et la Fondation restent exemptées de cette automatisation. Si le MP échoue, aucun avertissement remis n'est enregistré et aucun kick automatique ne suit. Les demandes inutiles nécessitent une validation du staff avec le bouton `Staff : confirmer un abus`. Chaque dossier ne peut être validé qu'une fois ; un membre ordinaire ne peut pas utiliser ce bouton. L'avertissement et le kick sont conservés dans le stockage.

## Arrivées et absences

Une carte PNG noir/blanc est générée avec le nom et l'avatar Discord et jointe à l'embed de bienvenue uniquement après vérification terminée. Si l'avatar ne se charge pas en cinq secondes, des initiales sont utilisées. Les octets sont envoyés comme pièce jointe à Discord, sans service de génération payant.

Le rôle Absent est attribué pendant les dates déclarées, retiré après annulation ou expiration, et recalculé chaque minute et au démarrage. Plusieurs absences qui se chevauchent ne retirent pas prématurément le rôle. Les dates conservent le fonctionnement UTC du système existant, fin de journée incluse. Le motif privé n'est pas publié avec le rôle.

Les états sont enregistrés dans `data/qgServer.json`. La conservation lors d'un redéploiement nécessite le volume persistant du projet sur son dossier `data` et un seul processus bot. Le dépôt ne permet pas de confirmer la configuration Railway réelle.

## Fichiers

- `systems/qgPanels.js` : présentation des tickets, notifications et gestions.
- `systems/qgTicketRouting.js` : catégories privées, permissions et transfert unique.
- `systems/qgTicketAssistant.js` : assistant QG avec historique borné et décisions validées.
- `systems/qgVerificationHelp.js` : aide avant vérification, avertissement et kick contrôlés.
- `utils/qgArrivalCard.js` : rendu local de la carte PNG.
- `systems/qgSchoolSetup.js`, `qgServer.js`, `qgEntryVerification.js`, `qgVerifiedWelcome.js` : branchements et mises à jour des panels.
- `systems/qgSchoolFamily.js`, `qgSchoolApplications.js` : rôle Absent, dates et capacité des gestions.
- `config/qgLayout.js`, `config/qg.js`, `systems/qgSchoolGiveaways.js`, `qgSchoolNews.js`, `qgSchoolManagementBoard.js`, `qgCommunityPolicy.js`, `qgVoiceControls.js` : harmonisation QG des textes et embeds.
- `tests/qgSchoolSetup.test.js`, `tests/qgPanelsRouting.test.js` : tests des nouvelles exigences.

`index.js` n'est pas modifié.

## Vérification

```powershell
node --test tests/qgPanelsRouting.test.js tests/qgSchoolSetup.test.js tests/qgEntryVerification.test.js tests/qgCommunityPolicy.test.js
```

À contrôler sur Discord après déploiement : affichage des emojis et GIF, création d'un ticket de chaque type, réponse réelle du fournisseur et transfert, confidentialité des signalements avec un compte Gestion Support, bouton d'aide d'un compte non vérifié, disponibilité des places, absence puis annulation, carte de bienvenue après validation. Les tests locaux utilisent des simulations ; ils ne prouvent pas la disponibilité du modèle, les permissions effectives, ni le rendu mobile de Discord.
