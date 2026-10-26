# QG — Tag Discord et assistant officiel

## Déploiement
Déployer les fichiers, puis attendre le démarrage Railway. Aucun changement de rôle n’est exécuté par les tests locaux.
Le suivi du tag démarre automatiquement ; ne pas démarrer une seconde copie du bot avec le même stockage.

## Tag obligatoire
Le badge de serveur doit appartenir au serveur QG configuré et être activé sur le profil Discord. Un pseudo contenant QG ne suffit pas.
Les grades familiaux concernés sont Test, Confirmé, Expert, Prestigieux et Senior.
Un rappel mentionnant le membre est envoyé dans 1561157222032212059. Le délai de 48 heures commence après l’envoi réussi et reste enregistré sur le volume persistant.
Contrôle au démarrage, toutes les 15 minutes et lors des mises à jour de profil reçues. L’application peut donc intervenir après l’échéance, au contrôle suivant.
Avant rétrogradation, le profil est relu via l’API Discord. Une réponse sans donnée de tag ne déclenche aucune sanction.
Une seule rétrogradation par épisode : le dossier reste appliqué tant que le tag manque. Le retour du tag clôt le dossier ; un nouvel abandon déclenche un nouveau rappel.
Au grade Test, pour la Direction, ou après une interruption ambiguë du changement : examen humain, pas d’exclusion automatique. Les limites de hiérarchie Discord restent appliquées.
Le rappel n’ajoute pas de rôle Avertissement 1/2/Dernière Chance. L’historique de rétrogradation utilise les journaux administratifs existants. Les séparateurs sont resynchronisés.

## IA
Les modules existants sont réutilisés. Ajouts : connaissances officielles préchargées, sélection sémantique des sources par le modèle, contexte temporel Europe/Paris, statut actuel des candidatures, réponses publiques configurables et historique des modifications de connaissances.
Dans /ia → Configuration → Réponses publiques : sélectionner les salons publics et indiquer si une mention est obligatoire. Par défaut, les mentions sont autorisées dans tous les salons accessibles au bot. Une liste non vide limite les réponses aux salons choisis ; une liste vide réactive les mentions partout.
La mémoire reste isolée par serveur, salon et utilisateur. Les tickets conservent leur fonctionnement et leur transfert humain. Les corrections validées restent administrées dans /ia.

Variables :
- OPENAI_API_KEY ou QG_AI_API_KEY : clé fournisseur, jamais dans Git.
- QG_AI_MODEL : modèle disponible sur le compte fournisseur.
- QG_AI_BASE_URL : facultatif, API compatible chat completions JSON en HTTPS.
- QG_AI_DAILY_REQUEST_LIMIT : plafond quotidien d’appels (500 par défaut). Une réponse ordinaire utilise deux appels.
- QG_AI_DATA_DIR : facultatif, doit rester sur le volume persistant ; défaut /app/data/qg-ai dans le conteneur.

## Tests et limites
29 tests locaux réussis : suite IA existante adaptée aux fiches préchargées et au nouveau contrat de sélection, plus tests du tag, délai, absence de double sanction et isolation des sources.
Les appels fournisseur sont simulés dans ces tests. Aucun test réel de compréhension des 30 formulations, aucun essai de rétrogradation sur Discord et aucun déploiement n’ont été effectués.
La refonte exhaustive du cahier des charges reste à compléter : évaluation réelle des 30 questions, coût monétaire configurable, satisfaction utilisateur, revue normalisée des corrections, traitement de toutes les annonces/animations en temps réel et tests Discord complets. Les régressions proposées après correction sont conservées comme cas à vérifier, pas automatiquement exécutées contre le fournisseur.
La sélection sémantique examine au maximum 250 titres de fiches et retient 8 sources. Elle ne garantit pas l’absence absolue d’erreurs du modèle.
