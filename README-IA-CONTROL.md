# Centre de contrôle IA `/ia`

La commande `/ia`, sans option, ouvre un panneau éphémère. L’accès est vérifié à chaque interaction : rôles d’accès ticket configurés dans `config/tickets.js`, rôles bypass/fondation, ou permission Administrateur sur le serveur Soul Society. Les options existantes `/ia question` et `/ia ameliorer` restent présentes et gardent leurs contrôles actuels.

## Sections

- **Vue d’ensemble / Statistiques** : événements collectés à partir de la mise en service du nouveau suivi. Les réponses ne sont pas comptées comme des résolutions. Le résultat des escalades n’est calculé que sur les dossiers clos par la gestion.
- **Contrôle / Configuration** : bascule des réponses automatiques et du mode maintenance, chacune avec confirmation. Les tickets restent créables et utilisables. Le mode maintenance du support suspend la génération de réponse dans les tickets.
- **Base de connaissances** : ajout validé, recherche, modification, désactivation/réactivation et suppression par saisie explicite de confirmation. Les connaissances personnalisées actives sont immédiatement incluses dans `ticketAiKnowledge.search()`.
- **Questions non résolues** : les anciennes lacunes sont importées à la première ouverture. Les statuts acceptés sont `in_progress`, `resolved`, `ignored`, `knowledge`. Une réponse fournie peut être convertie en connaissance validée.
- **Escalades** : notifications précédentes importées depuis `ticketAiStaffNotices`, nouvelles escalades avec ID stable par ticket, statut modifiable (`pending`, `in_progress`, `resolved`, `ignored`) et solution enregistrée. La consultation ne ping personne.
- **Erreurs** : erreurs fournisseur récentes, sans clé ni contenu de secret.
- **Tests et diagnostic** : contrôle local sans appel réseau, et test de réponse explicite qui effectue une seule requête au fournisseur configuré. Il ne publie pas, ne ping pas et n’exécute aucune action.

## Données et hébergement

Les fichiers dédiés sont créés au besoin dans `data/` : `iaControlConfig.json`, `iaControlMetrics.json`, `iaControlAudit.json`, `iaControlEscalations.json`, `iaControlIssues.json`, `iaControlErrors.json` et `iaControlKnowledge.json`. Les connaissances validées sont recherchées directement par le support. Écritures par fichier via remplacement temporaire, copie de sauvegarde `.bak`, valeur par défaut si le JSON est absent/corrompu, récupération signalée dans le diagnostic, et plafonds de rétention pour événements. Les transactions synchrones sont sérialisées dans un processus Node unique. **Ne lance pas plusieurs réplicas partageant ces JSON** : le dépôt ne contient pas de verrouillage interprocessus.

Le dépôt local ne permet pas de vérifier la présence d’un volume Railway attaché à ce service. Pour conserver l’état après un remplacement/redéploiement du conteneur, attache un volume persistant Railway au chemin ` /app/data ` (sans espaces autour dans le champ Railway). Si le service utilise un autre chemin de projet, monte le volume au dossier `data` réellement utilisé. Sans volume, les JSON locaux peuvent disparaître lors d’un remplacement d’instance. Pour plusieurs réplicas, utiliser un stockage partagé transactionnel avant activation.

Aucune nouvelle variable d’environnement ni dépendance n’est requise. Le fournisseur courant demeure `OPENAI_API_KEY` et `TICKET_AI_MODEL` (valeur par défaut actuelle `gpt-5.6-luna`).

## Déploiement et vérification Discord

Le chargeur existant collecte `commandes/*.js`. Après déploiement Railway, utilise `=update` une fois avec le propriétaire du bot : la commande republie les commandes serveur autorisées, dont `/ia`. Vérifie `/ia` avec un compte autorisé et un compte membre ordinaire. Les réponses automatiques sont activées par défaut si le fichier de configuration n’existe pas. La première ouverture du panneau importe les lacunes et avis d’escalade historiques disponibles.

Les tests locaux sont `npm test`. Ils n’appellent pas le fournisseur d’IA. Le test IA du panneau est optionnel et peut consommer le quota du fournisseur.
