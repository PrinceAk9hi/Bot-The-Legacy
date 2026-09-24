# Absences et réunions

Le panel permanent est créé ou actualisé au démarrage dans le salon `1479835698793156833`. `=absence` renvoie vers ce panel : les déclarations sont regroupées dans son embed, sans publier un message par membre.

- Moins de 24h : durée de 1 à 23 heures.
- 3 jours et 1 semaine : commencent à la validation.
- Personnalisé : début et fin au format JJ/MM/AAAA HH:MM, heure de Paris. Le début peut être « maintenant ». Pas de déclaration rétroactive.
- Une absence en cours ou prévue à la fois par membre. Le bouton de retour permet de terminer ou annuler avant de redéclarer.
- Le rôle Absent `1479835820348145877` est ajouté pendant la période. Frozen `1486369745488969818` est ajouté si la durée prévue atteint sept jours.
- Le bot retire à la fin uniquement les rôles qu'il a ajoutés. Les rôles présents avant la déclaration sont conservés. La vérification s'effectue chaque minute quand le bot est actif.
- Les anciens enregistrements d'absence restent lisibles. Les anciens paramètres `=absence debut:JJ/MM/AAAA fin:JJ/MM/AAAA raison:...` restent disponibles.

## Réunions organisées avec =reunion

Le suivi concerne les réunions futures enregistrées par le bot dans le vocal conférence `1477006110912413777`. Une présence observée pendant la réunion suffit. À la fin prévue, un membre attendu n'ayant jamais été présent reçoit le prochain niveau d'avertissement, sauf absence couvrant la réunion ou compte protégé : Avertissement 1, puis Avertissement 2, puis Dernière chance. Le dernier niveau n'est pas dépassé et les anciens niveaux ne sont pas retirés.

Une seule action par membre et par réunion est enregistrée. Les annonces vont dans le Carnet `1478798666470002929`. Le suivi incomplet (redémarrage, interruption, perte de connexion, réunion déplacée) ne déclenche pas de sanctions automatiques. Les réunions historiques ne sont pas sanctionnées rétroactivement.

Les données d'absence, de propriété des rôles et de présence restent dans le dossier persistant `/app/data` sur Railway. Une erreur de permissions pour les rôles doit être corrigée dans Discord ; le rôle du bot doit être au-dessus des rôles qu'il attribue.

## Exemption de tag

Aven (`547192186547077130`) est exclu des rappels et sanctions automatiques de tag. Son ancien compteur est effacé au prochain passage du scanner. Aucun rôle d'avertissement existant n'est retiré au hasard, car il peut provenir d'une autre sanction.
