// ======================================================
// LOUP-GAROU — THE LEGACY
// RÔLES / PRESETS / RÈGLES — V3
// ======================================================

// ======================================================
// CAMPS
// ======================================================

const CAMPS = {
    VILLAGE: "village",
    WOLVES: "wolves",
    SOLO: "solo",
    COUPLE: "couple"
};

// ======================================================
// TYPES
// ======================================================

const ROLE_TYPES = {
    PASSIVE: "passive",
    NIGHT: "night",
    DAY: "day",
    DEATH: "death",
    SPECIAL: "special"
};

// ======================================================
// PRIORITÉS DE NUIT
// ======================================================

const NIGHT_PRIORITY = {
    CUPID: 10,

    WOLF_DOG: 20,

    WILD_CHILD: 30,

    GUARD: 40,

    SEER: 50,

    FOX: 60,

    ACTOR: 62,

    RAVEN: 65,

    WOLVES: 70,

    LITTLE_GIRL: 72,

    ALPHA: 74,

    INFECTION: 75,

    BIG_BAD_WOLF: 80,

    WHITE_WOLF: 90,

    WITCH: 100,

    FLUTE_PLAYER: 110,

    BEAR_TAMER: 120
};

// ======================================================
// RÔLES
// ======================================================

const ROLES = {

    // ==================================================
    // VILLAGEOIS
    // ==================================================

    villager: {
        id: "villager",

        name: "Villageois",

        emoji: "👤",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.PASSIVE,

        implemented: true,

        unique: false,

        minPlayers: 5,

        nightPriority: null,

        description:
            "Un habitant sans pouvoir particulier. Il doit analyser les discussions et les votes.",

        objective:
            "Éliminer toutes les menaces hostiles au Village.",

        roleSummary:
`👤 **VILLAGEOIS**

**Camp :** 🏘️ Village

Tu ne possèdes aucun pouvoir particulier.

Ta force repose sur :
• les discussions ;
• les comportements ;
• les accusations ;
• les votes ;
• les informations obtenues pendant la partie.

### 🏆 Objectif

Éliminer toutes les menaces hostiles au Village.`,

        rules: [
            "Le Villageois ne possède aucune action nocturne.",
            "Il participe aux discussions et aux votes tant qu'il est vivant.",
            "Il peut devenir Maire.",
            "Il gagne avec le Village."
        ]
    },

    // ==================================================
    // VOYANTE
    // ==================================================

    seer: {
        id: "seer",

        name: "Voyante",

        emoji: "👁️",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 5,

        nightPriority:
            NIGHT_PRIORITY.SEER,

        description:
            "Chaque nuit, elle découvre secrètement le véritable rôle d'un joueur vivant.",

        objective:
            "Identifier les menaces et aider discrètement le Village.",

        roleSummary:
`👁️ **VOYANTE**

**Camp :** 🏘️ Village

Chaque nuit, tu peux observer secrètement un joueur vivant.

Le bot t'indiquera son véritable rôle.

Une personne infectée conserve cependant son rôle d'origine.

La Voyante peut néanmoins ressentir une présence lupine supplémentaire autour d'un joueur infecté.

### 🏆 Objectif

Aider le Village à éliminer toutes ses menaces.`,

        rules: [
            "La Voyante agit chaque nuit.",
            "Elle ne peut pas se sélectionner elle-même.",
            "Son résultat est privé.",
            "Une personne infectée conserve son rôle original."
        ]
    },

    // ==================================================
    // SORCIÈRE
    // ==================================================

    witch: {
        id: "witch",

        name: "Sorcière",

        emoji: "🧙",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 5,

        nightPriority:
            NIGHT_PRIORITY.WITCH,

        description:
            "Elle possède une potion de vie et une potion de mort, chacune utilisable une seule fois.",

        objective:
            "Utiliser ses potions au meilleur moment pour protéger le Village.",

        initialState: {
            healPotion: true,
            poisonPotion: true
        },

        roleSummary:
`🧙 **SORCIÈRE**

**Camp :** 🏘️ Village

Tu disposes de deux potions.

### 🧪 Potion de vie

Permet de sauver la victime principale de la Meute.

### ☠️ Potion de mort

Permet d'éliminer un joueur vivant de ton choix.

Chaque potion n'est utilisable qu'une seule fois pendant toute la partie.

### 🏆 Objectif

Aider le Village à éliminer toutes les menaces.`,

        rules: [
            "La potion de vie est utilisable une seule fois.",
            "La potion de mort est utilisable une seule fois.",
            "Les deux potions sont indépendantes.",
            "Leur état persiste après un redémarrage."
        ]
    },

    // ==================================================
    // SALVATEUR
    // ==================================================

    guard: {
        id: "guard",

        name: "Salvateur",

        emoji: "🛡️",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 5,

        nightPriority:
            NIGHT_PRIORITY.GUARD,

        description:
            "Chaque nuit, il protège un joueur contre l'attaque principale de la Meute.",

        objective:
            "Empêcher les Loups d'éliminer les joueurs importants.",

        initialState: {
            lastProtectedId: null
        },

        roleSummary:
`🛡️ **SALVATEUR**

**Camp :** 🏘️ Village

Chaque nuit, tu peux protéger un joueur vivant.

Si cette personne est la victime principale des Loups :

✅ l'attaque échoue.

### Restriction

Tu ne peux pas protéger la même personne deux nuits consécutives.

### 🏆 Objectif

Aider le Village à survivre.`,

        rules: [
            "Le Salvateur agit avant la Meute.",
            "Il ne peut pas protéger la même cible deux nuits consécutives.",
            "La protection concerne principalement l'attaque normale des Loups."
        ]
    },

    // ==================================================
    // CHASSEUR
    // ==================================================

    hunter: {
        id: "hunter",

        name: "Chasseur",

        emoji: "🏹",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.DEATH,

        implemented: true,

        unique: true,

        minPlayers: 5,

        nightPriority: null,

        description:
            "À sa mort, il peut emporter un dernier joueur avec lui.",

        objective:
            "Utiliser son dernier tir pour éliminer une menace.",

        initialState: {
            shotUsed: false
        },

        roleSummary:
`🏹 **CHASSEUR**

**Camp :** 🏘️ Village

Lorsque tu meurs, tu disposes d'un dernier tir.

Tu peux choisir un joueur encore vivant qui mourra également.

Si tu ne réponds pas avant la fin du délai :

ton tir est perdu.

### 🏆 Objectif

Aider le Village jusqu'à ton dernier souffle.`,

        rules: [
            "Le tir se déclenche à la mort du Chasseur.",
            "Il n'est utilisable qu'une fois.",
            "Un timeout signifie aucun tir."
        ]
    },

    // ==================================================
    // CUPIDON
    // ==================================================

    cupid: {
        id: "cupid",

        name: "Cupidon",

        emoji: "💘",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 5,

        firstNightOnly: true,

        nightPriority:
            NIGHT_PRIORITY.CUPID,

        description:
            "Lors de la première nuit, il désigne deux Amoureux.",

        objective:
            "Créer le couple puis continuer à jouer avec son camp.",

        initialState: {
            used: false
        },

        roleSummary:
`💘 **CUPIDON**

**Camp initial :** 🏘️ Village

Lors de la première nuit, tu choisis deux joueurs qui deviennent Amoureux.

Si l'un des deux meurt :

💔 l'autre meurt également.

Si le couple appartient à deux camps ennemis, il peut obtenir une condition de victoire particulière.

### 🏆 Objectif

Après ton action, tu continues normalement avec ton camp.`,

        rules: [
            "Cupidon agit uniquement pendant la première nuit.",
            "Le couple est secret.",
            "La mort d'un Amoureux entraîne celle de l'autre.",
            "Un couple mixte peut obtenir une victoire spéciale."
        ]
    },

    // ==================================================
    // RENARD
    // ==================================================

    fox: {
        id: "fox",

        name: "Renard",

        emoji: "🦊",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 6,

        nightPriority:
            NIGHT_PRIORITY.FOX,

        description:
            "Il inspecte un joueur ainsi que ses voisins vivants.",

        objective:
            "Réduire la liste des suspects du Village.",

        initialState: {
            abilityActive: true
        },

        roleSummary:
`🦊 **RENARD**

**Camp :** 🏘️ Village

Chaque nuit, tu choisis un joueur vivant.

Le bot inspecte :
• ce joueur ;
• son voisin précédent ;
• son voisin suivant.

Si au moins un Loup se trouve parmi eux :

✅ ton pouvoir reste actif.

Sinon :

❌ tu perds définitivement ton pouvoir.

### 🏆 Objectif

Aider le Village à localiser la Meute.`,

        rules: [
            "Le Renard obtient une information de groupe.",
            "Il ne connaît pas directement le Loup détecté.",
            "Une détection négative retire son pouvoir."
        ]
    },

    // ==================================================
    // MONTREUR D'OURS
    // ==================================================

    bear_tamer: {
        id: "bear_tamer",

        name: "Montreur d'Ours",

        emoji: "🐻",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.SPECIAL,

        implemented: true,

        unique: true,

        minPlayers: 6,

        nightPriority:
            NIGHT_PRIORITY.BEAR_TAMER,

        description:
            "Chaque matin, son Ours réagit publiquement si un Loup se trouve près de lui.",

        objective:
            "Utiliser les réactions de l'Ours pour orienter le Village.",

        roleSummary:
`🐻 **MONTREUR D'OURS**

**Camp :** 🏘️ Village

Chaque matin, ton Ours observe tes voisins vivants.

Si un membre de la Meute se trouve près de toi :

🐻 **l'Ours grogne.**

Sinon :

🐻 **l'Ours reste calme.**

L'information est publique.

### 🏆 Objectif

Aider le Village à identifier la Meute.`,

        rules: [
            "Le pouvoir est automatique.",
            "Il se déclenche chaque matin.",
            "Le bot ne révèle jamais quel voisin est suspect."
        ]
    },

    // ==================================================
    // ANCIEN
    // ==================================================

    elder: {
        id: "elder",

        name: "Ancien",

        emoji: "🧓",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.SPECIAL,

        implemented: true,

        unique: true,

        minPlayers: 7,

        nightPriority: null,

        description:
            "Il survit une fois à l'attaque principale de la Meute.",

        objective:
            "Profiter de sa résistance pour aider le Village plus longtemps.",

        initialState: {
            wolfProtection: true
        },

        roleSummary:
`🧓 **ANCIEN**

**Camp :** 🏘️ Village

La première attaque principale des Loups qui devrait te tuer échoue.

✅ Tu survis.

Ta protection est alors définitivement consommée.

Les autres formes de mort peuvent fonctionner normalement.

### 🏆 Objectif

Aider le Village à éliminer ses ennemis.`,

        rules: [
            "L'Ancien résiste à une attaque principale des Loups.",
            "La résistance n'est utilisable qu'une fois.",
            "Les autres causes de mort restent possibles."
        ]
    },

    // ==================================================
    // BOUC ÉMISSAIRE
    // ==================================================

    scapegoat: {
        id: "scapegoat",

        name: "Bouc Émissaire",

        emoji: "🐐",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.SPECIAL,

        implemented: true,

        unique: true,

        minPlayers: 6,

        nightPriority: null,

        description:
            "Lors d'une égalité non départagée, il peut mourir à la place des joueurs ex æquo.",

        objective:
            "Aider le Village tout en évitant les égalités dangereuses.",

        initialState: {
            usedRestrictions: 0
        },

        roleSummary:
`🐐 **BOUC ÉMISSAIRE**

**Camp :** 🏘️ Village

Lors d'une égalité du vote principal qui n'est pas départagée :

tu peux être éliminé à la place des joueurs ex æquo.

Avant de disparaître, tu choisis les joueurs autorisés à voter lors du **prochain vote principal**.

Cette restriction ne dure qu'un seul vote.

### 🏆 Objectif

Aider le Village à prendre des décisions plus nettes.`,

        rules: [
            "Le Bouc intervient lors d'une égalité non départagée.",
            "Il peut définir les votants du prochain vote principal.",
            "La restriction disparaît après ce vote."
        ]
    },

    // ==================================================
    // CORBEAU
    // ==================================================

    raven: {
        id: "raven",

        name: "Corbeau",

        emoji: "🦅",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 6,

        nightPriority:
            NIGHT_PRIORITY.RAVEN,

        description:
            "Il ajoute deux voix secrètes contre une cible pour le prochain vote.",

        objective:
            "Mettre davantage de pression sur un suspect.",

        initialState: {
            targetId: null
        },

        roleSummary:
`🦅 **CORBEAU**

**Camp :** 🏘️ Village

Chaque nuit, tu peux désigner un joueur.

Lors du prochain vote principal :

cette personne commence avec **deux voix supplémentaires contre elle**.

Ton identité reste secrète.

### 🏆 Objectif

Aider le Village à concentrer ses soupçons.`,

        rules: [
            "Le Corbeau agit chaque nuit.",
            "Sa cible reçoit deux voix supplémentaires.",
            "Ces voix sont ajoutées au prochain vote principal."
        ]
    },

    // ==================================================
    // JUGE BÈGUE
    // ==================================================

    stuttering_judge: {
        id: "stuttering_judge",

        name: "Juge Bègue",

        emoji: "⚖️",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.DAY,

        implemented: true,

        unique: true,

        minPlayers: 7,

        nightPriority: null,

        description:
            "Une fois par partie, il peut provoquer immédiatement un second vote.",

        objective:
            "Profiter d'une bonne journée pour obtenir une nouvelle élimination.",

        initialState: {
            used: false
        },

        roleSummary:
`⚖️ **JUGE BÈGUE**

**Camp :** 🏘️ Village

Une fois pendant toute la partie, tu peux réclamer un nouveau vote après le vote normal.

Si tu utilises ton pouvoir :

🗳️ une nouvelle phase de vote commence immédiatement.

### 🏆 Objectif

Aider le Village à profiter d'une situation favorable.`,

        rules: [
            "Le pouvoir est utilisable une seule fois.",
            "La décision du Juge est privée.",
            "Le second vote est une véritable nouvelle phase."
        ]
    },

    // ==================================================
    // IDIOT DU VILLAGE
    // ==================================================

    village_idiot: {
        id: "village_idiot",

        name: "Idiot du Village",

        emoji: "🤡",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.SPECIAL,

        implemented: true,

        unique: true,

        minPlayers: 6,

        nightPriority: null,

        description:
            "S'il est exécuté par le Village, il survit mais perd son vote.",

        objective:
            "Continuer à aider le Village après sa révélation.",

        initialState: {
            revealed: false,
            canVote: true
        },

        roleSummary:
`🤡 **IDIOT DU VILLAGE**

**Camp :** 🏘️ Village

Si le Village vote pour t'éliminer :

ton rôle est révélé et tu es gracié.

Tu restes vivant.

### ❌ Conséquence

Tu perds définitivement ton droit de vote.

Tu peux toujours parler et débattre.

### 🏆 Objectif

Aider le Village à gagner.`,

        rules: [
            "La grâce concerne uniquement le vote du Village.",
            "Après sa révélation, l'Idiot ne vote plus.",
            "Il reste vivant et peut continuer à discuter."
        ]
    },

    // ==================================================
    // PETITE FILLE
    // ==================================================

    little_girl: {
        id: "little_girl",

        name: "Petite Fille",

        emoji: "👧",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 6,

        nightPriority:
            NIGHT_PRIORITY.LITTLE_GIRL,

        description:
            "Elle peut risquer d'espionner la Meute pendant la nuit.",

        objective:
            "Obtenir des informations secrètes sur les Loups.",

        initialState: {
            successfulSpies: 0,
            failedSpies: 0
        },

        roleSummary:
`👧 **PETITE FILLE**

**Camp :** 🏘️ Village

Pendant la phase de la Meute, tu peux tenter secrètement de l'espionner.

Plusieurs résultats sont possibles :

• apercevoir un Loup ;
• ne rien distinguer ;
• te faire repérer.

Cette mécanique est adaptée au fonctionnement de Discord.

### 🏆 Objectif

Aider le Village à identifier la Meute.`,

        rules: [
            "L'espionnage est facultatif.",
            "Le résultat dépend d'une probabilité.",
            "La Meute peut apprendre qu'elle a été observée."
        ]
    },

    // ==================================================
    // CHEVALIER À L'ÉPÉE ROUILLÉE
    // ==================================================

    rusty_sword_knight: {
        id: "rusty_sword_knight",

        name: "Chevalier à l'Épée Rouillée",

        emoji: "🗡️",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.DEATH,

        implemented: true,

        unique: true,

        minPlayers: 7,

        nightPriority: null,

        description:
            "S'il est dévoré par la Meute, le prochain Loup vivant dans l'ordre des places meurt ensuite.",

        objective:
            "Punir la Meute lorsqu'elle te choisit comme victime.",

        initialState: {
            revengePending: false
        },

        roleSummary:
`🗡️ **CHEVALIER À L'ÉPÉE ROUILLÉE**

**Camp :** 🏘️ Village

Si l'attaque principale des Loups te tue :

ton épée contamine la Meute.

Le prochain Loup vivant dans l'ordre des places est condamné.

### 🏆 Objectif

Aider le Village même après ta mort.`,

        rules: [
            "Le pouvoir se déclenche uniquement sur l'attaque principale des Loups.",
            "Le moteur respecte l'ordre initial des joueurs.",
            "Le prochain Loup vivant dans cet ordre est visé."
        ]
    },

    // ==================================================
    // ACTEUR
    // ==================================================

    actor: {
        id: "actor",

        name: "Acteur",

        emoji: "🎭",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 8,

        nightPriority:
            NIGHT_PRIORITY.ACTOR,

        description:
            "Il reçoit plusieurs capacités empruntées à des rôles absents de la partie.",

        objective:
            "Utiliser intelligemment ses rôles empruntés pour aider le Village.",

        initialState: {
            borrowedRoleIds: [],
            usedRoleIds: []
        },

        roleSummary:
`🎭 **ACTEUR**

**Camp :** 🏘️ Village

Au début de la partie, le bot prépare jusqu'à **trois rôles empruntés** parmi certains pouvoirs absents de la composition.

Exemples possibles :
• Voyante ;
• Salvateur ;
• Renard ;
• Corbeau.

Chaque nuit, tu peux utiliser l'un des pouvoirs encore disponibles.

Chaque rôle emprunté n'est utilisable qu'une seule fois.

Lorsque tous tes rôles empruntés sont consommés :

tu deviens essentiellement un Villageois.

### 🏆 Objectif

Aider le Village à éliminer ses ennemis.`,

        rules: [
            "L'Acteur reçoit jusqu'à trois rôles empruntés.",
            "Les rôles empruntés doivent normalement être absents de la composition.",
            "Chaque pouvoir emprunté est utilisable une seule fois.",
            "Les rôles utilisés sont sauvegardés."
        ]
    },

    // ==================================================
    // DEUX SŒURS
    // ==================================================

    two_sisters: {
        id: "two_sisters",

        name: "Deux Sœurs",

        emoji: "👭",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.PASSIVE,

        implemented: true,

        unique: false,

        exactGroupSize: 2,

        minPlayers: 7,

        nightPriority: null,

        description:
            "Deux joueuses du Village qui connaissent secrètement l'identité de leur sœur.",

        objective:
            "Coopérer discrètement pour aider le Village.",

        roleSummary:
`👭 **DEUX SŒURS**

**Camp :** 🏘️ Village

Vous êtes exactement **deux Sœurs**.

Au début de la partie, chacune apprend secrètement l'identité de l'autre.

Vous ne possédez pas d'action nocturne supplémentaire.

Votre force vient de cette confiance mutuelle.

### 🏆 Objectif

Aider le Village à gagner.`,

        rules: [
            "Le rôle doit être présent exactement deux fois ou pas du tout.",
            "Les deux Sœurs connaissent mutuellement leur identité.",
            "Elles ne possèdent aucun pouvoir nocturne supplémentaire."
        ]
    },

    // ==================================================
    // TROIS FRÈRES
    // ==================================================

    three_brothers: {
        id: "three_brothers",

        name: "Trois Frères",

        emoji: "👨‍👨‍👦",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.PASSIVE,

        implemented: true,

        unique: false,

        exactGroupSize: 3,

        minPlayers: 9,

        nightPriority: null,

        description:
            "Trois joueurs du Village qui connaissent secrètement leurs deux frères.",

        objective:
            "Collaborer discrètement afin d'aider le Village.",

        roleSummary:
`👨‍👨‍👦 **TROIS FRÈRES**

**Camp :** 🏘️ Village

Vous êtes exactement **trois Frères**.

Au début de la partie, chacun apprend l'identité de ses deux frères.

Vous ne possédez pas de pouvoir actif supplémentaire.

### 🏆 Objectif

Aider le Village à gagner.`,

        rules: [
            "Le rôle doit être présent exactement trois fois ou pas du tout.",
            "Les trois Frères connaissent mutuellement leur identité.",
            "Ils ne disposent d'aucun pouvoir nocturne supplémentaire."
        ]
    },

    // ==================================================
    // LOUP-GAROU
    // ==================================================

    wolf: {
        id: "wolf",

        name: "Loup-Garou",

        emoji: "🐺",

        camp: CAMPS.WOLVES,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: false,

        minPlayers: 5,

        nightPriority:
            NIGHT_PRIORITY.WOLVES,

        description:
            "Chaque nuit, la Meute vote secrètement pour choisir une victime.",

        objective:
            "Prendre le contrôle du Village avec la Meute.",

        roleSummary:
`🐺 **LOUP-GAROU**

**Camp :** 🐺 Meute

Chaque nuit, tu votes secrètement avec les autres membres de la Meute.

Le vote vise un joueur qui n'appartient pas à la Meute.

Si personne ne vote avant le timeout :

aucune victime n'est choisie.

### 🏆 Objectif

Permettre à la Meute de prendre le contrôle du Village.`,

        rules: [
            "Les Loups votent secrètement.",
            "Les membres de la Meute ne sont pas proposés comme cibles normales.",
            "Un timeout sans aucun vote signifie aucune victime.",
            "Une égalité peut être influencée par le pouvoir du Loup Alpha."
        ]
    },

    // ==================================================
    // LOUP ALPHA
    // ==================================================

    alpha_wolf: {
        id: "alpha_wolf",

        name: "Loup Alpha",

        emoji: "👑",

        camp: CAMPS.WOLVES,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 7,

        nightPriority:
            NIGHT_PRIORITY.ALPHA,

        description:
            "Une fois pendant la partie, il peut renforcer son influence lors du vote de la Meute.",

        objective:
            "Utiliser son autorité au moment décisif pour faire gagner la Meute.",

        initialState: {
            alphaPowerAvailable: true
        },

        roleSummary:
`👑 **LOUP ALPHA**

**Camp :** 🐺 Meute

Tu participes normalement au vote nocturne des Loups.

### 👑 Autorité de l'Alpha

Une seule fois pendant toute la partie, tu peux utiliser ton pouvoir.

Pendant cette nuit :

ton vote de Meute compte **double**.

En cas d'égalité entre plusieurs victimes, ton choix peut donc faire basculer la décision.

⚠️ **Tu ne possèdes aucun pouvoir d'infection.**

### 🏆 Objectif

Faire gagner la Meute.`,

        rules: [
            "Le Loup Alpha vote normalement avec la Meute.",
            "Une fois par partie, il peut renforcer son vote.",
            "Son vote compte alors double pendant cette nuit.",
            "Le pouvoir est consommé après utilisation.",
            "Le Loup Alpha ne peut pas infecter."
        ]
    },

    // ==================================================
    // INFECT PÈRE DES LOUPS
    // ==================================================

    infect_father: {
        id: "infect_father",

        name: "Infect Père des Loups",

        emoji: "🩸",

        camp: CAMPS.WOLVES,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 8,

        nightPriority:
            NIGHT_PRIORITY.INFECTION,

        description:
            "Une fois pendant la partie, il peut remplacer la mort de la victime principale par une infection.",

        objective:
            "Agrandir secrètement la Meute.",

        initialState: {
            infectionAvailable: true
        },

        roleSummary:
`🩸 **INFECT PÈRE DES LOUPS**

**Camp :** 🐺 Meute

Tu participes normalement au vote des Loups.

### 🩸 Infection

Une seule fois pendant toute la partie, tu peux remplacer la mort de la victime principale par une infection.

La victime :
• reste vivante ;
• conserve son rôle ;
• conserve ses pouvoirs ;
• rejoint secrètement la Meute.

### 🏆 Objectif

Faire gagner la Meute.`,

        rules: [
            "Le pouvoir est utilisable une seule fois.",
            "L'infection remplace l'attaque principale.",
            "La victime conserve son rôle original.",
            "La victime rejoint secrètement la Meute.",
            "L'Infect Père des Loups est le seul rôle lupin possédant cette infection."
        ]
    },

    // ==================================================
    // GRAND MÉCHANT LOUP
    // ==================================================

    big_bad_wolf: {
        id: "big_bad_wolf",

        name: "Grand Méchant Loup",

        emoji: "🐺",

        camp: CAMPS.WOLVES,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 8,

        nightPriority:
            NIGHT_PRIORITY.BIG_BAD_WOLF,

        description:
            "Il dispose d'une seconde attaque tant qu'aucun membre de la Meute n'est mort.",

        objective:
            "Profiter du début de partie pour affaiblir rapidement le Village.",

        initialState: {
            extraKillActive: true
        },

        roleSummary:
`🐺 **GRAND MÉCHANT LOUP**

**Camp :** 🐺 Meute

Tant qu'aucun membre de la Meute n'est mort :

tu peux effectuer une seconde attaque pendant la nuit.

Dès qu'un membre de la Meute meurt :

❌ ton pouvoir supplémentaire est définitivement perdu.

### 🏆 Objectif

Faire gagner la Meute.`,

        rules: [
            "La seconde attaque est active tant qu'aucun membre de la Meute n'est mort.",
            "Après la première mort lupine, le pouvoir disparaît définitivement."
        ]
    },

    // ==================================================
    // LOUP BLANC
    // ==================================================

    white_wolf: {
        id: "white_wolf",

        name: "Loup Blanc",

        emoji: "🐺",

        camp: CAMPS.SOLO,

        apparentCamp:
            CAMPS.WOLVES,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 7,

        nightPriority:
            NIGHT_PRIORITY.WHITE_WOLF,

        description:
            "Il participe à la Meute mais possède une condition de victoire solitaire.",

        objective:
            "Être le dernier survivant.",

        initialState: {
            lastWhiteKillNight: 0
        },

        roleSummary:
`🐺 **LOUP BLANC**

**Camp réel :** 🎭 Solitaire
**Camp apparent :** 🐺 Meute

Tu participes normalement au vote des Loups.

Mais tu ne gagnes pas avec eux.

Une nuit sur deux, tu peux choisir secrètement d'éliminer un autre membre de la Meute.

### 🏆 Objectif

Être le dernier joueur vivant.`,

        rules: [
            "Le Loup Blanc participe au vote normal de la Meute.",
            "Il gagne uniquement s'il devient le dernier survivant.",
            "Il peut tuer un membre de la Meute une nuit sur deux."
        ]
    },

    // ==================================================
    // CHIEN-LOUP
    // ==================================================

    wolf_dog: {
        id: "wolf_dog",

        name: "Chien-Loup",

        emoji: "🐕",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 6,

        firstNightOnly: true,

        nightPriority:
            NIGHT_PRIORITY.WOLF_DOG,

        description:
            "Pendant la première nuit, il choisit définitivement entre le Village et la Meute.",

        objective:
            "Gagner avec le camp choisi.",

        initialState: {
            chosenCamp: null
        },

        roleSummary:
`🐕 **CHIEN-LOUP**

Pendant la première nuit, tu choisis définitivement ton camp :

🏘️ Village
ou
🐺 Meute

Si tu choisis la Meute, les Loups seront informés de ton appartenance.

### 🏆 Objectif

Gagner avec ton camp définitif.`,

        rules: [
            "Le choix a lieu pendant la première nuit.",
            "Le choix est définitif.",
            "Le camp est sauvegardé."
        ]
    },

    // ==================================================
    // ENFANT SAUVAGE
    // ==================================================

    wild_child: {
        id: "wild_child",

        name: "Enfant Sauvage",

        emoji: "🧒",

        camp: CAMPS.VILLAGE,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 6,

        firstNightOnly: true,

        nightPriority:
            NIGHT_PRIORITY.WILD_CHILD,

        description:
            "Il choisit un modèle. À la mort de ce modèle, il rejoint la Meute.",

        objective:
            "Gagner avec son camp actuel.",

        initialState: {
            modelId: null,
            transformed: false
        },

        roleSummary:
`🧒 **ENFANT SAUVAGE**

**Camp initial :** 🏘️ Village

Pendant la première nuit, tu choisis un modèle.

Tant que ton modèle est vivant :

tu appartiens au Village.

À sa mort :

🐺 tu rejoins secrètement la Meute.

Si tu ne choisis aucun modèle avant la fin du délai, le bot en choisit un vivant au hasard.

### 🏆 Objectif

Gagner avec ton camp actuel.`,

        rules: [
            "Le modèle est choisi pendant la première nuit.",
            "Le modèle ne peut pas être l'Enfant Sauvage lui-même.",
            "En cas de timeout, un modèle vivant est choisi au hasard.",
            "La transformation est automatique à la mort du modèle."
        ]
    },

    // ==================================================
    // ANGE
    // ==================================================

    angel: {
        id: "angel",

        name: "Ange",

        emoji: "👼",

        camp: CAMPS.SOLO,

        type: ROLE_TYPES.SPECIAL,

        implemented: true,

        unique: true,

        minPlayers: 6,

        nightPriority: null,

        description:
            "Il gagne s'il est éliminé par le premier vote du Village.",

        objective:
            "Se faire éliminer par le Village pendant le premier vote.",

        initialState: {
            victoryAchieved: false,
            transformedToVillager: false
        },

        roleSummary:
`👼 **ANGE**

**Camp initial :** 🎭 Solitaire

Tu dois réussir à te faire éliminer par le Village lors du **premier vote principal**.

Si tu es éliminé pendant ce vote :

🏆 tu remportes immédiatement ta victoire personnelle.

Si le premier vote se termine sans ton élimination :

tu deviens définitivement un **Villageois**.

### 🏆 Objectif initial

Être éliminé pendant le premier vote du Village.`,

        rules: [
            "L'Ange gagne uniquement s'il est éliminé par le premier vote principal.",
            "Une autre cause de mort ne déclenche pas sa victoire.",
            "S'il survit au premier vote, il rejoint définitivement le Village comme Villageois."
        ]
    },

    // ==================================================
    // JOUEUR DE FLÛTE
    // ==================================================

    flute_player: {
        id: "flute_player",

        name: "Joueur de Flûte",

        emoji: "🎶",

        camp: CAMPS.SOLO,

        type: ROLE_TYPES.NIGHT,

        implemented: true,

        unique: true,

        minPlayers: 7,

        nightPriority:
            NIGHT_PRIORITY.FLUTE_PLAYER,

        description:
            "Chaque nuit, il charme jusqu'à deux nouveaux joueurs.",

        objective:
            "Charmer tous les autres joueurs vivants.",

        initialState: {
            charmedIds: []
        },

        roleSummary:
`🎶 **JOUEUR DE FLÛTE**

**Camp :** 🎭 Solitaire

Chaque nuit, tu peux charmer jusqu'à deux joueurs encore non charmés.

### 🏆 Objectif

Lorsque tous les autres survivants nécessaires sont charmés :

tu remportes la partie.`,

        rules: [
            "Le Joueur de Flûte agit chaque nuit.",
            "Il peut charmer jusqu'à deux nouvelles personnes.",
            "Les morts ne comptent plus pour sa victoire."
        ]
    }
};

// ======================================================
// GROUPES DE RÔLES
// ======================================================

const ROLE_GROUPS = {
    village: {
        id: "village",

        name:
            "Rôles du Village",

        emoji:
            "🏘️",

        roles: [
            "villager",
            "seer",
            "witch",
            "guard",
            "hunter",
            "cupid",
            "fox",
            "bear_tamer",
            "elder",
            "scapegoat",
            "raven",
            "stuttering_judge",
            "village_idiot",
            "little_girl",
            "rusty_sword_knight",
            "actor",
            "two_sisters",
            "three_brothers"
        ]
    },

    wolves: {
        id:
            "wolves",

        name:
            "Loups & Meute",

        emoji:
            "🐺",

        roles: [
            "wolf",
            "alpha_wolf",
            "infect_father",
            "big_bad_wolf"
        ]
    },

    special: {
        id:
            "special",

        name:
            "Rôles spéciaux",

        emoji:
            "🎭",

        roles: [
            "white_wolf",
            "wolf_dog",
            "wild_child",
            "angel",
            "flute_player"
        ]
    }
};

// ======================================================
// PRESETS
//
// IMPORTANT :
// Hardcore N'EST PAS un preset.
// Personnalisé est créé côté commande.
// ======================================================

const PRESETS = {

    // ==================================================
    // CLASSIQUE
    // ==================================================

    classic: {
        id:
            "classic",

        name:
            "Classique",

        emoji:
            "🌱",

        minPlayers:
            5,

        mayorElection:
            true,

        anonymousVotes:
            false,

        hardcore:
            false,

        roleCounts: {
            wolf:
                1,

            seer:
                1,

            witch:
                1
        },

        scaling: [
            {
                minPlayers:
                    7,

                add: {
                    wolf:
                        1,

                    hunter:
                        1
                }
            },

            {
                minPlayers:
                    10,

                add: {
                    guard:
                        1
                }
            },

            {
                minPlayers:
                    13,

                add: {
                    wolf:
                        1
                }
            }
        ],

        summary:
            "Une partie facile à comprendre et proche du Loup-Garou classique.",

        changes: [
            "👁️ Voyante active.",
            "🧙 Sorcière active.",
            "🐺 Nombre de Loups adapté au nombre de joueurs.",
            "🏹 Chasseur ajouté à partir de 7 joueurs.",
            "🛡️ Salvateur ajouté sur les grandes parties.",
            "👑 Maire activé.",
            "👁️ Votes visibles."
        ]
    },

    // ==================================================
    // AVANCÉ
    // ==================================================

    advanced: {
        id:
            "advanced",

        name:
            "Avancé",

        emoji:
            "🔥",

        minPlayers:
            7,

        mayorElection:
            true,

        anonymousVotes:
            false,

        hardcore:
            false,

        roleCounts: {
            wolf:
                2,

            seer:
                1,

            witch:
                1,

            guard:
                1,

            hunter:
                1,

            cupid:
                1
        },

        scaling: [
            {
                minPlayers:
                    9,

                add: {
                    fox:
                        1
                }
            },

            {
                minPlayers:
                    11,

                add: {
                    alpha_wolf:
                        1,

                    raven:
                        1
                },

                remove: {
                    wolf:
                        1
                }
            },

            {
                minPlayers:
                    14,

                add: {
                    bear_tamer:
                        1,

                    actor:
                        1
                }
            },

            {
                minPlayers:
                    17,

                add: {
                    wolf:
                        1
                }
            }
        ],

        summary:
            "Plus de pouvoirs et d'informations sans devenir totalement chaotique.",

        changes: [
            "💘 Cupidon actif.",
            "🛡️ Salvateur actif.",
            "🏹 Chasseur actif.",
            "🦊 Renard possible.",
            "👑 Loup Alpha possible.",
            "🦅 Corbeau possible.",
            "🐻 Montreur d'Ours possible.",
            "🎭 Acteur possible."
        ]
    },

    // ==================================================
    // CHAOS
    // ==================================================

    chaos: {
        id:
            "chaos",

        name:
            "Chaos",

        emoji:
            "🌙",

        minPlayers:
            10,

        mayorElection:
            true,

        anonymousVotes:
            true,

        hardcore:
            false,

        roleCounts: {
            wolf:
                1,

            alpha_wolf:
                1,

            white_wolf:
                1,

            seer:
                1,

            witch:
                1,

            cupid:
                1,

            hunter:
                1,

            fox:
                1,

            wild_child:
                1,

            raven:
                1
        },

        scaling: [
            {
                minPlayers:
                    12,

                add: {
                    flute_player:
                        1,

                    guard:
                        1
                }
            },

            {
                minPlayers:
                    14,

                add: {
                    big_bad_wolf:
                        1,

                    elder:
                        1
                }
            },

            {
                minPlayers:
                    16,

                add: {
                    stuttering_judge:
                        1,

                    little_girl:
                        1
                }
            },

            {
                minPlayers:
                    18,

                add: {
                    infect_father:
                        1,

                    bear_tamer:
                        1
                }
            },

            {
                minPlayers:
                    21,

                add: {
                    actor:
                        1
                }
            }
        ],

        summary:
            "Plusieurs conditions de victoire et beaucoup de retournements possibles.",

        changes: [
            "🐺 Loup Blanc actif.",
            "👑 Loup Alpha actif.",
            "🎶 Joueur de Flûte possible.",
            "💘 Amoureux actifs.",
            "🧒 Transformations possibles.",
            "⚖️ Juge Bègue possible.",
            "🐺 Grand Méchant Loup possible.",
            "🩸 Infection possible.",
            "🔒 Votes anonymes."
        ]
    },

    // ==================================================
    // LOUPS RENFORCÉS
    // ==================================================

    wolves_power: {
        id:
            "wolves_power",

        name:
            "Loups renforcés",

        emoji:
            "🐺",

        minPlayers:
            8,

        mayorElection:
            true,

        anonymousVotes:
            false,

        hardcore:
            false,

        roleCounts: {
            wolf:
                1,

            alpha_wolf:
                1,

            big_bad_wolf:
                1,

            seer:
                1,

            witch:
                1,

            guard:
                1,

            hunter:
                1
        },

        scaling: [
            {
                minPlayers:
                    10,

                add: {
                    wolf:
                        1,

                    fox:
                        1
                }
            },

            {
                minPlayers:
                    13,

                add: {
                    infect_father:
                        1,

                    raven:
                        1
                },

                remove: {
                    wolf:
                        1
                }
            },

            {
                minPlayers:
                    16,

                add: {
                    wolf:
                        1,

                    bear_tamer:
                        1
                }
            },

            {
                minPlayers:
                    19,

                add: {
                    actor:
                        1
                }
            }
        ],

        summary:
            "La Meute possède davantage de pouvoirs, compensés par un Village puissant.",

        changes: [
            "👑 Loup Alpha actif avec autorité renforcée.",
            "🐺 Grand Méchant Loup actif.",
            "🩸 Infect Père des Loups possible.",
            "🛡️ Défenses du Village renforcées.",
            "🦊 Renard possible.",
            "🦅 Corbeau possible."
        ]
    },

    // ==================================================
    // RÔLES SPÉCIAUX
    // ==================================================

    special: {
        id:
            "special",

        name:
            "Rôles spéciaux",

        emoji:
            "🎭",

        minPlayers:
            8,

        mayorElection:
            true,

        anonymousVotes:
            false,

        hardcore:
            false,

        roleCounts: {
            wolf:
                2,

            seer:
                1,

            witch:
                1,

            cupid:
                1,

            wild_child:
                1,

            little_girl:
                1,

            hunter:
                1
        },

        scaling: [
            {
                minPlayers:
                    10,

                add: {
                    wolf_dog:
                        1,

                    raven:
                        1
                }
            },

            {
                minPlayers:
                    12,

                add: {
                    white_wolf:
                        1
                },

                remove: {
                    wolf:
                        1
                }
            },

            {
                minPlayers:
                    14,

                add: {
                    fox:
                        1,

                    bear_tamer:
                        1
                }
            },

            {
                minPlayers:
                    16,

                add: {
                    actor:
                        1,

                    wolf:
                        1
                }
            },

            {
                minPlayers:
                    18,

                add: {
                    two_sisters:
                        2
                }
            },

            {
                minPlayers:
                    21,

                add: {
                    three_brothers:
                        3
                }
            }
        ],

        summary:
            "Une partie centrée sur les rôles atypiques, les liens secrets et les transformations.",

        changes: [
            "💘 Amoureux actifs.",
            "🧒 Enfant Sauvage actif.",
            "👧 Petite Fille active.",
            "🐕 Chien-Loup possible.",
            "🐺 Loup Blanc possible.",
            "🎭 Acteur possible.",
            "👭 Deux Sœurs possibles.",
            "👨‍👨‍👦 Trois Frères possibles."
        ]
    }
};

// ======================================================
// CLONE COUNTS
// ======================================================

function cloneRoleCounts(
    roleCounts
) {
    return JSON.parse(
        JSON.stringify(
            roleCounts ||
            {}
        )
    );
}

// ======================================================
// APPLY COUNT CHANGE
// ======================================================

function applyCountChange(
    roleCounts,
    changes,
    mode
) {
    for (
        const [
            roleId,
            rawAmount
        ]
        of Object.entries(
            changes ||
            {}
        )
    ) {
        const amount =
            Number(
                rawAmount
            ) ||
            0;

        if (
            mode ===
            "add"
        ) {
            roleCounts[
                roleId
            ] =
                (
                    Number(
                        roleCounts[
                            roleId
                        ]
                    ) ||
                    0
                ) +
                amount;
        }

        if (
            mode ===
            "remove"
        ) {
            roleCounts[
                roleId
            ] =
                Math.max(
                    0,
                    (
                        Number(
                            roleCounts[
                                roleId
                            ]
                        ) ||
                        0
                    ) -
                    amount
                );
        }
    }
}

// ======================================================
// COUNT COMPOSITION
// ======================================================

function countComposition(
    roleCounts
) {
    return Object.values(
        roleCounts ||
        {}
    ).reduce(
        (
            total,
            rawAmount
        ) =>
            total +
            Math.max(
                0,
                Number(
                    rawAmount
                ) ||
                0
            ),
        0
    );
}

// ======================================================
// RESOLVE PRESET
// ======================================================

function resolvePreset(
    presetId,
    playerCount
) {
    const preset =
        PRESETS[
            presetId
        ];

    if (!preset) {
        return null;
    }

    const count =
        Number(
            playerCount
        ) ||
        0;

    const roleCounts =
        cloneRoleCounts(
            preset.roleCounts
        );

    const scaling =
        [
            ...(
                preset.scaling ||
                []
            )
        ].sort(
            (
                a,
                b
            ) =>
                a.minPlayers -
                b.minPlayers
        );

    for (
        const step
        of scaling
    ) {
        if (
            count <
            step.minPlayers
        ) {
            continue;
        }

        applyCountChange(
            roleCounts,
            step.add,
            "add"
        );

        applyCountChange(
            roleCounts,
            step.remove,
            "remove"
        );
    }

    const cardsBeforeFill =
        countComposition(
            roleCounts
        );

    if (
        cardsBeforeFill <
        count
    ) {
        roleCounts.villager =
            (
                roleCounts.villager ||
                0
            ) +
            (
                count -
                cardsBeforeFill
            );
    }

    return {
        ...preset,

        playerCount:
            count,

        roleCounts
    };
}

// ======================================================
// VALIDATION
// ======================================================

function validateComposition(
    roleCounts,
    playerCount
) {
    const errors =
        [];

    const warnings =
        [];

    const count =
        Number(
            playerCount
        ) ||
        0;

    const total =
        countComposition(
            roleCounts
        );

    if (
        count <
        5
    ) {
        errors.push(
            "Il faut au minimum 5 joueurs."
        );
    }

    if (
        count >
        25
    ) {
        errors.push(
            "Une partie est limitée à 25 joueurs."
        );
    }

    if (
        total !==
        count
    ) {
        errors.push(
            `La composition possède ${total} carte(s) pour ${count} joueur(s).`
        );
    }

    let wolfAlignedCount =
        0;

    let soloCount =
        0;

    for (
        const [
            roleId,
            rawAmount
        ]
        of Object.entries(
            roleCounts ||
            {}
        )
    ) {
        const amount =
            Number(
                rawAmount
            ) ||
            0;

        if (
            amount <
            0
        ) {
            errors.push(
                `La quantité de ${roleId} ne peut pas être négative.`
            );

            continue;
        }

        if (
            amount ===
            0
        ) {
            continue;
        }

        const role =
            ROLES[
                roleId
            ];

        if (!role) {
            errors.push(
                `Rôle inconnu : ${roleId}`
            );

            continue;
        }

        if (
            role.implemented !==
            true
        ) {
            errors.push(
                `${role.name} n'est pas disponible dans le moteur.`
            );
        }

        if (
            role.unique &&
            amount >
            1
        ) {
            errors.push(
                `${role.emoji} ${role.name} est unique.`
            );
        }

        if (
            role.exactGroupSize &&
            amount !==
            role.exactGroupSize
        ) {
            errors.push(
                `${role.emoji} ${role.name} doit être présent exactement ${role.exactGroupSize} fois ou pas du tout.`
            );
        }

        if (
            count <
            role.minPlayers
        ) {
            warnings.push(
                `${role.emoji} ${role.name} est conseillé à partir de ${role.minPlayers} joueurs.`
            );
        }

        if (
            role.camp ===
                CAMPS.WOLVES ||
            role.apparentCamp ===
                CAMPS.WOLVES
        ) {
            wolfAlignedCount +=
                amount;
        }

        if (
            role.camp ===
            CAMPS.SOLO
        ) {
            soloCount +=
                amount;
        }
    }

    const sisters =
        Number(
            roleCounts
                ?.two_sisters
        ) ||
        0;

    if (
        sisters !==
            0 &&
        sisters !==
            2
    ) {
        errors.push(
            "👭 Les Deux Sœurs doivent être présentes exactement 2 fois ou pas du tout."
        );
    }

    const brothers =
        Number(
            roleCounts
                ?.three_brothers
        ) ||
        0;

    if (
        brothers !==
            0 &&
        brothers !==
            3
    ) {
        errors.push(
            "👨‍👨‍👦 Les Trois Frères doivent être présents exactement 3 fois ou pas du tout."
        );
    }

    if (
        wolfAlignedCount ===
        0
    ) {
        errors.push(
            "La partie doit contenir au moins un rôle lié à la Meute."
        );
    }

    if (
        count >
            0 &&
        wolfAlignedCount >=
            Math.ceil(
                count /
                2
            )
    ) {
        warnings.push(
            "La Meute représente au moins la moitié des joueurs."
        );
    }

    if (
        soloCount >=
        3
    ) {
        warnings.push(
            "La composition contient au moins trois rôles solitaires."
        );
    }

    const whiteWolfCount =
        Number(
            roleCounts
                ?.white_wolf
        ) ||
        0;

    if (
        whiteWolfCount &&
        wolfAlignedCount <
        2
    ) {
        warnings.push(
            "Le Loup Blanc possède très peu de partenaires lupins."
        );
    }

    return {
        valid:
            errors.length ===
            0,

        errors,

        warnings,

        total,

        wolfAlignedCount,

        soloCount
    };
}

// ======================================================
// CREATE ROLE STATE
// ======================================================

function createRoleState(
    roleId
) {
    const role =
        ROLES[
            roleId
        ];

    if (!role) {
        return {};
    }

    return JSON.parse(
        JSON.stringify(
            role.initialState ||
            {}
        )
    );
}

// ======================================================
// BUILD DECK
// ======================================================

function buildRoleDeck(
    roleCounts
) {
    const deck =
        [];

    for (
        const [
            roleId,
            rawAmount
        ]
        of Object.entries(
            roleCounts ||
            {}
        )
    ) {
        const role =
            ROLES[
                roleId
            ];

        if (!role) {
            continue;
        }

        const amount =
            Math.max(
                0,
                Number(
                    rawAmount
                ) ||
                0
            );

        for (
            let i =
                0;
            i <
            amount;
            i++
        ) {
            deck.push(
                roleId
            );
        }
    }

    return deck;
}

// ======================================================
// GET ROLE
// ======================================================

function getRole(
    roleId
) {
    return (
        ROLES[
            roleId
        ] ||
        null
    );
}

// ======================================================
// CAMP DISPLAY
// ======================================================

function getCampDisplay(
    camp
) {
    switch (
        camp
    ) {
        case CAMPS.VILLAGE:
            return "🏘️ Village";

        case CAMPS.WOLVES:
            return "🐺 Meute";

        case CAMPS.SOLO:
            return "🎭 Solitaire";

        case CAMPS.COUPLE:
            return "💘 Amoureux";

        default:
            return "❔ Inconnu";
    }
}

// ======================================================
// NIGHT ROLES
// ======================================================

function getNightRoles(
    roleIds
) {
    return (
        roleIds ||
        []
    )
        .map(
            roleId =>
                ROLES[
                    roleId
                ]
        )
        .filter(
            role =>
                role &&
                Number.isFinite(
                    role.nightPriority
                )
        )
        .sort(
            (
                a,
                b
            ) =>
                a.nightPriority -
                b.nightPriority
        );
}

// ======================================================
// GENERAL RULES
// ======================================================

const GENERAL_RULES = {
    flow: {
        id:
            "flow",

        emoji:
            "🎮",

        name:
            "Déroulement",

        text:
`### 🎮 Déroulement

1. L'hôte crée le lobby.
2. Les joueurs rejoignent le vocal.
3. L'hôte choisit un preset ou une composition personnalisée.
4. Le bot vérifie les DM.
5. Les rôles sont distribués.
6. Le narrateur rejoint le vocal.
7. La première nuit commence.
8. Les actions secrètes sont effectuées en DM.
9. Le jour se lève.
10. Les événements publics sont annoncés.
11. Le Village discute.
12. Le Village vote.
13. Une nouvelle nuit commence.

Le cycle continue jusqu'à une condition de victoire.`
    },

    wolves: {
        id:
            "wolves",

        emoji:
            "🐺",

        name:
            "Rôles Loups",

        text:
`### 🐺 La Meute

Les membres de la Meute se connaissent normalement entre eux.

Chaque nuit :

• ils votent secrètement ;
• les cibles lupines normales ne sont pas proposées ;
• chaque membre répond en DM ;
• un joueur peut ne pas répondre ;
• si personne ne vote, aucune victime n'est sélectionnée.

Certains Loups possèdent des pouvoirs supplémentaires.`
    },

    village: {
        id:
            "village",

        emoji:
            "🏘️",

        name:
            "Rôles Village",

        text:
`### 🏘️ Village

Les rôles du Village doivent découvrir les menaces sans révéler trop rapidement leurs informations.

Les pouvoirs privés restent secrets sauf décision du joueur.

Les Villageois gagnent lorsque les menaces hostiles restantes sont éliminées.`
    },

    special: {
        id:
            "special",

        emoji:
            "🎭",

        name:
            "Rôles spéciaux",

        text:
`### 🎭 Rôles spéciaux

Certains joueurs peuvent :

• changer de camp ;
• appartenir à un camp solitaire ;
• obtenir une condition de victoire particulière ;
• former un couple ;
• rejoindre secrètement la Meute.

Le moteur tient compte du camp actuel et pas uniquement du rôle d'origine.`
    },

    mayor: {
        id:
            "mayor",

        emoji:
            "👑",

        name:
            "Maire",

        text:
`### 👑 Maire

Le Maire est un statut public et indépendant du rôle secret.

Lorsque l'option est activée :

• l'élection se déroule après la première nuit ;
• seuls les candidats peuvent être élus ;
• le Maire possède un vote comptant double ;
• il peut départager certaines égalités ;
• à sa mort, il désigne secrètement un successeur ;
• sans réponse, le bot choisit un successeur vivant au hasard.

Une égalité d'élection entraîne un second tour entre les candidats concernés.

Si le second tour est encore parfaitement égalitaire, aucun Maire n'est élu.`
    },

    night: {
        id:
            "night",

        emoji:
            "🌙",

        name:
            "Nuit",

        text:
`### 🌙 Nuit

Pendant la nuit :

• les joueurs vivants sont server mute ;
• les actions secrètes sont envoyées en DM ;
• le narrateur n'annonce jamais une cible secrète ;
• une action non effectuée avant le timeout est généralement passée ;
• les actions déjà validées ne doivent pas être rejouées après un redémarrage.`
    },

    day: {
        id:
            "day",

        emoji:
            "☀️",

        name:
            "Jour & Votes",

        text:
`### ☀️ Jour & Votes

Pendant le jour :

• les joueurs vivants autorisés sont unmute ;
• les morts restent spectateurs mute ;
• le Village dispose d'un temps de discussion ;
• les joueurs vivants autorisés peuvent voter ;
• les votes peuvent être visibles ou anonymes ;
• le Maire compte double s'il existe.`
    },

    hardcore: {
        id:
            "hardcore",

        emoji:
            "☠️",

        name:
            "Hardcore",

        text:
`### ☠️ Hardcore

Hardcore est une **option de partie**, pas un preset.

Lorsqu'elle est activée :

• les rôles des morts restent cachés ;
• le journal public reste volontairement limité ;
• les rôles complets sont révélés seulement à la fin.`
    },

    victory: {
        id:
            "victory",

        emoji:
            "🏆",

        name:
            "Conditions de victoire",

        text:
`### 🏆 Conditions de victoire

🏘️ **Village**
Éliminer toutes les menaces hostiles pertinentes.

🐺 **Meute**
Contrôler suffisamment de survivants.

🐺 **Loup Blanc**
Être le dernier survivant.

🎶 **Joueur de Flûte**
Charmer tous les autres survivants nécessaires.

👼 **Ange**
Être éliminé pendant le premier vote du Village.

💘 **Amoureux mixtes**
Un couple appartenant à des camps opposés peut obtenir une victoire spéciale.

Les conditions solitaires sont vérifiées avant de déclarer trop rapidement une victoire classique.`
    }
};

// ======================================================
// ACTIVE ROLE IDS
// ======================================================

function getActiveRoleIds(
    roleCounts
) {
    return Object.entries(
        roleCounts ||
        {}
    )
        .filter(
            (
                [
                    ,
                    amount
                ]
            ) =>
                Number(
                    amount
                ) >
                0
        )
        .map(
            (
                [
                    roleId
                ]
            ) =>
                roleId
        )
        .filter(
            roleId =>
                Boolean(
                    ROLES[
                        roleId
                    ]
                )
        );
}

// ======================================================
// ACTIVE RULES
// ======================================================

function getActiveRules(
    roleCounts,
    config = {}
) {
    const activeRoleIds =
        getActiveRoleIds(
            roleCounts
        );

    const activeRoles =
        activeRoleIds
            .map(
                roleId =>
                    ROLES[
                        roleId
                    ]
            )
            .filter(
                Boolean
            );

    const sections = [
        {
            title:
                "🎮 Déroulement",

            text:
                GENERAL_RULES.flow.text
        }
    ];

    const hasWolfRole =
        activeRoles.some(
            role =>
                role.camp ===
                    CAMPS.WOLVES ||
                role.apparentCamp ===
                    CAMPS.WOLVES
        );

    const hasVillageRole =
        activeRoles.some(
            role =>
                role.camp ===
                CAMPS.VILLAGE
        );

    const hasSpecialRole =
        activeRoles.some(
            role =>
                role.camp ===
                    CAMPS.SOLO ||
                [
                    "cupid",
                    "wolf_dog",
                    "wild_child"
                ].includes(
                    role.id
                )
        );

    if (
        hasWolfRole
    ) {
        sections.push({
            title:
                "🐺 Rôles Loups",

            text:
                GENERAL_RULES.wolves.text
        });
    }

    if (
        hasVillageRole
    ) {
        sections.push({
            title:
                "🏘️ Rôles Village",

            text:
                GENERAL_RULES.village.text
        });
    }

    if (
        hasSpecialRole
    ) {
        sections.push({
            title:
                "🎭 Rôles spéciaux",

            text:
                GENERAL_RULES.special.text
        });
    }

    if (
        config.mayorElection
    ) {
        sections.push({
            title:
                "👑 Maire",

            text:
                GENERAL_RULES.mayor.text
        });
    }

    sections.push({
        title:
            "🌙 Nuit",

        text:
            GENERAL_RULES.night.text
    });

    sections.push({
        title:
            "☀️ Jour & Votes",

        text:
            GENERAL_RULES.day.text
    });

    if (
        config.anonymousVotes
    ) {
        sections.push({
            title:
                "🔒 Votes anonymes",

            text:
`### 🔒 Votes anonymes

Les choix individuels ne sont pas révélés publiquement pendant le vote.

Le résultat final reste calculé normalement.`
        });
    }

    if (
        config.hardcore
    ) {
        sections.push({
            title:
                "☠️ Hardcore",

            text:
                GENERAL_RULES.hardcore.text
        });
    }

    sections.push({
        title:
            "🏆 Conditions de victoire",

        text:
            GENERAL_RULES.victory.text
    });

    return {
        sections,

        roles:
            activeRoles
    };
}

// ======================================================
// BUILD PRESET DESCRIPTION
// ======================================================

function buildPresetDescription(
    presetId,
    playerCount = null
) {
    const preset =
        PRESETS[
            presetId
        ];

    if (!preset) {
        return null;
    }

    const numericCount =
        Number(
            playerCount
        );

    const resolved =
        Number.isFinite(
            numericCount
        ) &&
        numericCount >
        0
            ? resolvePreset(
                presetId,
                numericCount
            )
            : null;

    let compositionText =
        "La composition exacte dépendra du nombre de joueurs.";

    if (
        resolved
    ) {
        compositionText =
            Object.entries(
                resolved.roleCounts
            )
                .filter(
                    (
                        [
                            ,
                            amount
                        ]
                    ) =>
                        Number(
                            amount
                        ) >
                        0
                )
                .map(
                    (
                        [
                            roleId,
                            amount
                        ]
                    ) => {
                        const role =
                            ROLES[
                                roleId
                            ];

                        return (
                            `${role?.emoji || "❔"} ${role?.name || roleId} ×${amount}`
                        );
                    }
                )
                .join(
                    "\n"
                );
    }

    return (
`## ${preset.emoji} ${preset.name}

${preset.summary}

### Ce que ce preset change

${preset.changes
    .map(
        change =>
            `• ${change}`
    )
    .join(
        "\n"
    )}

### Composition${resolved ? ` — ${resolved.playerCount} joueurs` : ""}

${compositionText}`
    );
}

// ======================================================
// COMPARE CONFIGS
// ======================================================

function compareConfigs(
    before = {},
    after = {}
) {
    const changes =
        [];

    if (
        before.mayorElection !==
        after.mayorElection
    ) {
        changes.push(
            after.mayorElection
                ? "👑 Élection du Maire activée."
                : "👑 Élection du Maire désactivée."
        );
    }

    if (
        before.anonymousVotes !==
        after.anonymousVotes
    ) {
        changes.push(
            after.anonymousVotes
                ? "🔒 Les votes deviennent anonymes."
                : "👁️ Les votes deviennent visibles."
        );
    }

    if (
        before.hardcore !==
        after.hardcore
    ) {
        changes.push(
            after.hardcore
                ? "☠️ Hardcore activé : rôles des morts cachés."
                : "☠️ Hardcore désactivé."
        );
    }

    if (
        before.ambience !==
        after.ambience
    ) {
        changes.push(
            after.ambience
                ? "🌙 Ambiances sonores activées."
                : "🔇 Ambiances sonores désactivées."
        );
    }

    if (
        before.discreteMode !==
        after.discreteMode
    ) {
        changes.push(
            after.discreteMode
                ? "🤫 Mode audio discret activé."
                : "🔊 Mode audio discret désactivé."
        );
    }

    return changes;
}

// ======================================================
// ROLE CHANGES
// ======================================================

function compareRoleCounts(
    before = {},
    after = {}
) {
    const roleIds =
        new Set([
            ...Object.keys(
                before
            ),

            ...Object.keys(
                after
            )
        ]);

    const changes =
        [];

    for (
        const roleId
        of roleIds
    ) {
        const oldAmount =
            Number(
                before[
                    roleId
                ]
            ) ||
            0;

        const newAmount =
            Number(
                after[
                    roleId
                ]
            ) ||
            0;

        if (
            oldAmount ===
            newAmount
        ) {
            continue;
        }

        const role =
            ROLES[
                roleId
            ];

        changes.push(
            `${newAmount > oldAmount ? "➕" : "➖"} ` +
            `${role?.emoji || "❔"} ` +
            `${role?.name || roleId} : ` +
            `${oldAmount} → ${newAmount}`
        );
    }

    return changes;
}

// ======================================================
// ACTOR — POUVOIRS EMPRUNTABLES
// ======================================================

const ACTOR_BORROWABLE_ROLES = [
    "seer",
    "guard",
    "fox",
    "raven"
];

function getActorBorrowableRoles(
    roleCounts
) {
    const active =
        new Set(
            getActiveRoleIds(
                roleCounts
            )
        );

    return ACTOR_BORROWABLE_ROLES
        .filter(
            roleId =>
                !active.has(
                    roleId
                )
        )
        .filter(
            roleId =>
                Boolean(
                    ROLES[
                        roleId
                    ]
                )
        );
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
    CAMPS,

    ROLE_TYPES,

    NIGHT_PRIORITY,

    ROLES,

    ROLE_GROUPS,

    PRESETS,

    GENERAL_RULES,

    ACTOR_BORROWABLE_ROLES,

    getRole,

    getCampDisplay,

    getNightRoles,

    resolvePreset,

    validateComposition,

    countComposition,

    createRoleState,

    buildRoleDeck,

    getActiveRoleIds,

    getActiveRules,

    getActorBorrowableRoles,

    buildPresetDescription,

    compareConfigs,

    compareRoleCounts
};