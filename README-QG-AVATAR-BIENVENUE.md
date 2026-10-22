# Avatar Roblox dans la bienvenue QG

Le système existant `systems/qgVerifiedWelcome.js` reste le seul émetteur de bienvenue : après la vérification, une fois par arrivée, avec l'embed, la mention et les informations d'invitation existantes. Aucun événement supplémentaire ajouté.

Il transmet `schoolEntryVerification[discordId].robloxId` au générateur `utils/qgArrivalCard.js`. Il n'y a ni recherche par pseudo, ni modification de la liaison existante. Le personnage représente le compte déclaré/confirmé dans ce système ; cela ne constitue pas une nouvelle preuve de propriété Roblox.

`utils/qgRobloxAvatar.js` appelle l'API officielle `/v1/users/avatar` (personnage entier, 420 × 420, PNG, non circulaire). L'identifiant retourné doit correspondre à l'identifiant demandé. Jusqu'à trois tentatives pour les réponses Pending/InReview, les limitations ou erreurs serveur, avec une limite totale réseau de douze secondes. Aucun cache local de l'apparence : le résultat reste soumis au cache de génération Roblox.

Téléchargement limité à 4 Mo, HTTPS et domaine rbxcdn.com uniquement, redirections refusées, signature PNG vérifiée. Le canvas existant conserve la transparence et ajuste le personnage dans une zone de 270 × 314 sans couper les accessoires présents dans le rendu fourni par Roblox. Les pixels entièrement transparents autour du personnage sont exclus du calcul de taille. Une image opaque ou inexploitable utilise le secours au lieu d'ajouter un rectangle autour du personnage.

Secours : avatar Discord dans la présentation historique ; si Discord est également indisponible, initiales dessinées localement. La bannière reste une pièce jointe `bienvenue-qg.png` référencée par `setImage('attachment://bienvenue-qg.png')` dans le même message.

Aucune nouvelle dépendance, variable ou permission. `@napi-rs/canvas` est réutilisé. Les textes, couleurs, dimensions et identité QG sont conservés ; les pseudos longs sont ajustés à la zone de texte.

Validation : `node --test tests/qgRobloxAvatar.test.js` : 5 tests réussis. Contrôle syntaxique de qgVerifiedWelcome.js réussi. Appel réel Roblox effectué avec un compte public de démonstration, PNG reçu et aperçu inspecté. Aucun envoi Discord effectué : l'affichage final desktop/mobile reste à valider lors d'une nouvelle bienvenue.
