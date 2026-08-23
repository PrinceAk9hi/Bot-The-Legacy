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
// ROLE TYPES
// ======================================================

const ROLE_TYPES = {
    PASSIVE: "passive",
    NIGHT: "night",
    DAY: "day",
    DEATH: "death",
    SPECIAL: "special"
};

// ======================================================
// NIGHT PRIORITY
// ======================================================

const NIGHT_PRIORITY = {
    CUPID: 10,
    WOLF_DOG: 20,
    WILD_CHILD: 30,
    ACTOR: 35,
    GUARD: 40,
    SEER: 50,
    FOX: 60,
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
// ROLES
// ======================================================

const ROLES = {
    // ==================================================
    // VILLAGE
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
            "Un habitant sans pouvoir particulier. Il doit observer, débattre et voter intelligemment.",

        objective:
            "Éliminer toutes les menaces hostiles au Village.",

        roleSummary:
`👤 **VILLAGEOIS**

**Camp :** 🏘️ Village

Tu ne possèdes aucun pouvoir particulier.

Ta force repose sur les discussions, les comportements, les accusations et les votes.

### 🏆 Objectif

Éliminer toutes les menaces hostiles au Village.`,

        rules: [
            "Le Villageois ne possède aucune action nocturne.",
            "Il participe normalement aux discussions.",
            "Il possède une voix tant qu'il est vivant et autorisé à voter.",
            "Il peut devenir Maire."
        ]
    },

    // ==================================================
    // SEER
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
        nightPriority: NIGHT_PRIORITY.SEER,

        description:
            "Chaque nuit, elle découvre secrètement le rôle exact d'un joueur vivant.",

        objective:
            "Identifier les Loups et aider discrètement le Village.",

        roleSummary:
`👁️ **VOYANTE**

**Camp :** 🏘️ Village

Chaque nuit, tu peux observer secrètement un joueur vivant.

Le bot te révèle son véritable rôle.

Une personne infectée conserve son rôle original, mais une présence lupine pourra également être détectée.

### 🏆 Objectif

Aider le Village à éliminer toutes les menaces.`,

        rules: [
            "La Voyante agit chaque nuit.",
            "Elle ne peut pas se sélectionner elle-même.",
            "Le résultat reste privé.",
            "Une infection ne remplace pas le rôle original."
        ]
    },

    // ==================================================
    // WITCH
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
        nightPriority: NIGHT_PRIORITY.WITCH,

        initialState: {
            healPotion: true,
            poisonPotion: true
        },

        description:
            "Elle possède une potion de vie et une potion de mort utilisables une seule fois chacune.",

        objective:
            "Utiliser ses potions au meilleur moment pour aider le Village.",

        roleSummary:
`🧙 **SORCIÈRE**

**Camp :** 🏘️ Village

Tu possèdes deux potions.

🧪 **Potion de vie**
Sauve la victime principale des Loups.

☠️ **Potion de mort**
Élimine un joueur vivant de ton choix.

Chaque potion ne peut être utilisée qu'une seule fois.

### 🏆 Objectif

Aider le Village à éliminer ses ennemis.`,

        rules: [
            "La potion de vie est utilisable une fois.",
            "La potion de mort est utilisable une fois.",
            "Les deux potions sont indépendantes.",
            "Leur état est sauvegardé."
        ]
    },

    // ==================================================
    // GUARD
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
        nightPriority: NIGHT_PRIORITY.GUARD,

        initialState: {
            lastProtectedId: null
        },

        description:
            "Chaque nuit, il protège un joueur contre l'attaque principale de la Meute.",

        objective:
            "Protéger les joueurs importants du Village.",

        roleSummary:
`🛡️ **SALVATEUR**

**Camp :** 🏘️ Village

Chaque nuit, tu protèges un joueur vivant.

Si la victime principale des Loups correspond à ta cible, l'attaque échoue.

Tu ne peux pas protéger la même personne deux nuits consécutives.

### 🏆 Objectif

Aider le Village à survivre.`,

        rules: [
            "Le Salvateur agit avant les Loups.",
            "Il ne peut pas protéger la même cible deux nuits consécutives.",
            "Sa protection bloque l'attaque principale des Loups.",
            "Elle ne bloque pas nécessairement les autres causes de mort."
        ]
    },

    // ==================================================
    // HUNTER
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

        initialState: {
            shotUsed: false
        },

        description:
            "Lorsqu'il meurt, il peut immédiatement tuer un dernier joueur.",

        objective:
            "Utiliser son dernier tir contre une menace.",

        roleSummary:
`🏹 **CHASSEUR**

**Camp :** 🏘️ Village

Lorsque tu meurs, tu disposes d'un dernier tir.

Tu peux éliminer un joueur encore vivant.

Si tu ne réponds pas avant la fin du délai, ton tir est perdu.

### 🏆 Objectif

Aider le Village jusqu'à ton dernier souffle.`,

        rules: [
            "Le tir se déclenche à la mort du Chasseur.",
            "Il ne peut être utilisé qu'une seule fois.",
            "Sans réponse avant le délai, personne n'est tué."
        ]
    },

    // ==================================================
    // CUPID
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
        nightPriority: NIGHT_PRIORITY.CUPID,

        initialState: {
            used: false
        },

        description:
            "Lors de la première nuit, il lie deux joueurs qui deviennent Amoureux.",

        objective:
            "Créer les Amoureux puis continuer avec son propre camp.",

        roleSummary:
`💘 **CUPIDON**

**Camp :** 🏘️ Village

Pendant la première nuit, tu choisis deux joueurs qui deviennent **Amoureux**.

Si l'un meurt, l'autre meurt de chagrin.

Un couple réunissant deux camps ennemis peut obtenir une victoire spéciale.

### 🏆 Objectif

Après ton choix, tu continues avec ton camp.`,

        rules: [
            "Cupidon agit uniquement pendant la première nuit.",
            "Deux joueurs sont liés.",
            "Les Amoureux connaissent leur partenaire.",
            "La mort de l'un provoque normalement la mort de l'autre."
        ]
    },

    // ==================================================
    // FOX
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
        nightPriority: NIGHT_PRIORITY.FOX,

        initialState: {
            abilityActive: true
        },

        description:
            "Il inspecte un joueur et ses deux voisins vivants pour détecter la présence d'un Loup.",

        objective:
            "Réduire progressivement le nombre de suspects.",

        roleSummary:
`🦊 **RENARD**

**Camp :** 🏘️ Village

Chaque nuit, tu choisis un joueur.

Le bot inspecte :
• cette personne ;
• son voisin vivant précédent ;
• son voisin vivant suivant.

Tu apprends si au moins un membre de la Meute se trouve dans le groupe.

Si aucun Loup n'est présent, tu perds définitivement ton pouvoir.`,

        rules: [
            "Le Renard reçoit une information de groupe.",
            "Il ne connaît pas directement l'identité du Loup.",
            "Une détection négative désactive définitivement son pouvoir."
        ]
    },

    // ==================================================
    // BEAR TAMER
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
        nightPriority: NIGHT_PRIORITY.BEAR_TAMER,

        description:
            "Chaque matin, son Ours indique publiquement si un Loup se trouve près de lui.",

        objective:
            "Utiliser les grognements de son Ours pour guider le Village.",

        roleSummary:
`🐻 **MONTREUR D'OURS**

**Camp :** 🏘️ Village

Chaque matin, ton pouvoir est résolu automatiquement.

Si un de tes deux voisins vivants appartient à la Meute :

🐻 **l'Ours grogne.**

Sinon, il reste calme.`,

        rules: [
            "Le pouvoir est automatique.",
            "Il se déclenche au lever du jour.",
            "Le bot ne révèle jamais quel voisin est suspect."
        ]
    },

    // ==================================================
    // ELDER
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

        initialState: {
            wolfProtection: true
        },

        description:
            "Il survit une fois à l'attaque principale de la Meute.",

        objective:
            "Résister suffisamment longtemps pour aider le Village.",

        roleSummary:
`🧓 **ANCIEN**

**Camp :** 🏘️ Village

La première attaque principale des Loups qui devrait te tuer échoue.

Ta protection est ensuite consommée définitivement.

Les autres causes de mort fonctionnent normalement.`,

        rules: [
            "L'Ancien résiste une fois à l'attaque principale des Loups.",
            "La protection disparaît après son utilisation."
        ]
    },

    // ==================================================
    // VILLAGE IDIOT
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

        initialState: {
            revealed: false,
            canVote: true
        },

        description:
            "La première fois que le Village veut l'exécuter, il est gracié mais perd son vote.",

        objective:
            "Continuer à aider le Village après sa révélation.",

        roleSummary:
`🤡 **IDIOT DU VILLAGE**

**Camp :** 🏘️ Village

Si le Village vote pour ton élimination, ton rôle est révélé et tu es gracié.

Tu restes vivant mais tu perds définitivement ton droit de vote.

Tu peux toujours parler et participer aux débats.`,

        rules: [
            "La grâce fonctionne uniquement sur l'exécution du Village.",
            "Après sa révélation, l'Idiot reste vivant.",
            "Il perd définitivement son vote."
        ]
    },

    // ==================================================
    // SCAPEGOAT
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

        initialState: {
            tieDeaths: 0
        },

        description:
            "En cas d'égalité non départagée, il peut mourir et choisir qui pourra voter au tour suivant.",

        objective:
            "Éviter les votes indécis tout en aidant le Village.",

        roleSummary:
`🐐 **BOUC ÉMISSAIRE**

**Camp :** 🏘️ Village

Lorsqu'un vote du Village se termine sur une égalité qui n'est pas départagée, tu peux être condamné à la place des joueurs ex æquo.

Avant de mourir, tu choisis quels joueurs pourront voter lors du **prochain vote uniquement**.`,

        rules: [
            "Le Maire peut départager avant l'intervention du Bouc.",
            "La restriction choisie ne doit durer qu'un seul vote.",
            "Après ce vote, tous les joueurs normalement autorisés retrouvent leur droit."
        ]
    },

    // ==================================================
    // RAVEN
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
        nightPriority: NIGHT_PRIORITY.RAVEN,

        initialState: {
            targetId: null
        },

        description:
            "Chaque nuit, il ajoute deux voix contre un joueur lors du vote suivant.",

        objective:
            "Mettre davantage de pression sur un suspect.",

        roleSummary:
`🦅 **CORBEAU**

**Camp :** 🏘️ Village

Chaque nuit, tu désignes secrètement un joueur.

Lors du prochain vote du Village, cette personne reçoit automatiquement **deux voix supplémentaires**.`,

        rules: [
            "Le Corbeau agit chaque nuit.",
            "Sa cible reçoit deux voix supplémentaires.",
            "L'identité du Corbeau reste secrète."
        ]
    },

    // ==================================================
    // STUTTERING JUDGE
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

        initialState: {
            used: false
        },

        description:
            "Une fois dans la partie, il peut imposer immédiatement un second vote.",

        objective:
            "Profiter d'une journée favorable pour lancer un nouveau vote.",

        roleSummary:
`⚖️ **JUGE BÈGUE**

**Camp :** 🏘️ Village

Une seule fois pendant la partie, tu peux réclamer secrètement un **nouveau vote du Village** après le vote principal.

Ce nouveau vote est une véritable seconde phase de vote.`,

        rules: [
            "Le pouvoir est utilisable une seule fois.",
            "Le choix est demandé secrètement.",
            "Le second vote est indépendant du premier."
        ]
    },

    // ==================================================
    // LITTLE GIRL
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
        nightPriority: NIGHT_PRIORITY.LITTLE_GIRL,

        initialState: {
            successfulSpies: 0,
            failedSpies: 0
        },

        description:
            "Pendant le réveil des Loups, elle peut tenter secrètement de les espionner.",

        objective:
            "Prendre des risques pour obtenir des informations sur la Meute.",

        roleSummary:
`👧 **PETITE FILLE**

**Camp :** 🏘️ Village

Pendant la phase de la Meute, tu peux tenter d'espionner.

Selon le hasard :
• tu peux apercevoir un Loup ;
• ne rien distinguer ;
• ou faire du bruit et avertir la Meute.`,

        rules: [
            "L'espionnage est facultatif.",
            "Les résultats sont probabilistes.",
            "Une réussite peut révéler un membre de la Meute.",
            "Un échec grave avertit les Loups."
        ]
    },

    // ==================================================
    // RUSTY SWORD KNIGHT
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

        initialState: {
            revengePending: false
        },

        description:
            "S'il est directement dévoré par les Loups, le prochain Loup dans l'ordre peut mourir à son tour.",

        objective:
            "Punir la Meute lorsqu'elle choisit la mauvaise victime.",

        roleSummary:
`🗡️ **CHEVALIER À L'ÉPÉE ROUILLÉE**

**Camp :** 🏘️ Village

Si l'attaque principale des Loups te tue, ton épée contaminée condamne le prochain Loup vivant dans l'ordre des places.

Sa mort est résolue automatiquement.`,

        rules: [
            "Le pouvoir fonctionne uniquement si les Loups le tuent directement.",
            "L'ordre original des joueurs est utilisé.",
            "La vengeance est automatique."
        ]
    },

    // ==================================================
    // ACTOR
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
        nightPriority: NIGHT_PRIORITY.ACTOR,

        initialState: {
            borrowedRoleIds: [],
            usedRoleIds: []
        },

        description:
            "Il dispose d'un petit choix de pouvoirs de rôles absents de la composition et peut en jouer un par nuit.",

        objective:
            "Utiliser intelligemment ses pouvoirs empruntés pour aider le Village.",

        roleSummary:
`🎭 **ACTEUR**

**Camp :** 🏘️ Village

Au début de la partie, le bot prépare jusqu'à **trois rôles empruntés** absents de la composition.

Chaque nuit, tu peux utiliser l'un de ces rôles qui n'a pas encore été joué.

Chaque pouvoir emprunté ne peut servir qu'une seule fois.

Lorsque toutes tes cartes ont été utilisées, tu continues comme un Villageois.`,

        rules: [
            "L'Acteur reçoit jusqu'à trois pouvoirs compatibles.",
            "Chaque pouvoir emprunté n'est utilisable qu'une seule fois.",
            "Les pouvoirs sont choisis parmi des rôles absents de la composition.",
            "Les pouvoirs recommandés sont Voyante, Salvateur, Renard ou Corbeau."
        ]
    },

    // ==================================================
    // TWO SISTERS
    // ==================================================

    two_sisters: {
        id: "two_sisters",
        name: "Deux Sœurs",
        emoji: "👭",
        camp: CAMPS.VILLAGE,
        type: ROLE_TYPES.PASSIVE,
        implemented: true,
        unique: false,
        exactCountWhenPresent: 2,
        minPlayers: 7,
        nightPriority: null,

        description:
            "Deux joueuses du Village qui connaissent secrètement l'identité l'une de l'autre.",

        objective:
            "S'entraider discrètement pour faire gagner le Village.",

        roleSummary:
`👭 **DEUX SŒURS**

**Camp :** 🏘️ Village

Vous êtes exactement **deux Sœurs**.

Au début de la partie, le bot vous révèle secrètement l'identité de votre sœur.

Vous ne possédez pas d'autre pouvoir particulier.`,

        rules: [
            "Il doit y avoir exactement deux cartes Deux Sœurs.",
            "Les deux Sœurs connaissent leur partenaire.",
            "Elles gagnent normalement avec le Village."
        ]
    },

    // ==================================================
    // THREE BROTHERS
    // ==================================================

    three_brothers: {
        id: "three_brothers",
        name: "Trois Frères",
        emoji: "👬",
        camp: CAMPS.VILLAGE,
        type: ROLE_TYPES.PASSIVE,
        implemented: true,
        unique: false,
        exactCountWhenPresent: 3,
        minPlayers: 9,
        nightPriority: null,

        description:
            "Trois habitants qui connaissent secrètement l'identité des deux autres Frères.",

        objective:
            "Coordonner leurs observations pour aider le Village.",

        roleSummary:
`👬 **TROIS FRÈRES**

**Camp :** 🏘️ Village

Vous êtes exactement **trois Frères**.

Au début de la partie, chacun découvre secrètement l'identité des deux autres.

Vous ne possédez pas d'autre pouvoir.`,

        rules: [
            "Il doit y avoir exactement trois cartes Trois Frères.",
            "Les Frères connaissent les deux autres membres du groupe.",
            "Ils gagnent normalement avec le Village."
        ]
    },

    // ==================================================
    // STANDARD WOLF
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
        nightPriority: NIGHT_PRIORITY.WOLVES,

        description:
            "Chaque nuit, la Meute vote secrètement pour choisir une victime.",

        objective:
            "Prendre le contrôle du Village avec la Meute.",

        roleSummary:
`🐺 **LOUP-GAROU**

**Camp :** 🐺 Meute

Chaque nuit, tu votes secrètement avec les autres Loups pour choisir une victime.

Les membres de la Meute connaissent leurs alliés.

### 🏆 Objectif

Devenir suffisamment nombreux pour contrôler les survivants.`,

        rules: [
            "Les Loups votent secrètement.",
            "Un joueur qui ne répond pas avant le délai passe son vote.",
            "Si aucun Loup ne vote, aucune victime n'est choisie."
        ]
    },

    // ==================================================
    // ALPHA WOLF
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
        nightPriority: NIGHT_PRIORITY.ALPHA,

        initialState: {
            alphaPowerAvailable: true
        },

        description:
            "Une fois dans la partie, il peut renforcer son vote nocturne afin d'imposer davantage le choix de la Meute.",

        objective:
            "Faire gagner la Meute en utilisant son autorité au bon moment.",

        roleSummary:
`👑 **LOUP ALPHA**

**Camp :** 🐺 Meute

Tu participes normalement au vote de la Meute.

### 👑 Autorité Alpha

Une seule fois pendant la partie, tu peux activer ton pouvoir.

Pendant ce vote nocturne :
• ton vote compte double ;
• en cas d'égalité persistante impliquant ta cible, ton choix est prioritaire.

⚠️ **Tu n'infectes personne.**

L'infection appartient uniquement à l'**Infect Père des Loups**.`,

        rules: [
            "Le Loup Alpha participe normalement au vote nocturne.",
            "Son pouvoir est utilisable une seule fois.",
            "Lorsqu'il l'active, son vote compte double.",
            "Son choix peut départager une égalité compatible.",
            "Le Loup Alpha ne possède aucun pouvoir d'infection."
        ]
    },

    // ==================================================
    // BIG BAD WOLF
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
        nightPriority: NIGHT_PRIORITY.BIG_BAD_WOLF,

        initialState: {
            extraKillActive: true
        },

        description:
            "Tant qu'aucun membre du camp lupin n'est mort, il peut effectuer une seconde attaque nocturne.",

        objective:
            "Profiter du début de partie pour affaiblir rapidement le Village.",

        roleSummary:
`🐺 **GRAND MÉCHANT LOUP**

**Camp :** 🐺 Meute

Tant qu'aucun membre du camp lupin n'est mort, tu peux choisir une **deuxième victime** après l'attaque principale.

À la première mort d'un membre de la Meute, tu perds définitivement ce pouvoir.`,

        rules: [
            "Le pouvoir fonctionne tant qu'aucun membre lupin n'est mort.",
            "La seconde victime est choisie secrètement.",
            "Le pouvoir disparaît définitivement après une mort lupine."
        ]
    },

    // ==================================================
    // INFECT FATHER
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
        nightPriority: NIGHT_PRIORITY.INFECTION,

        initialState: {
            infectionAvailable: true
        },

        description:
            "Une seule fois, il peut remplacer la mort de la victime principale par une infection.",

        objective:
            "Agrandir secrètement la Meute.",

        roleSummary:
`🩸 **INFECT PÈRE DES LOUPS**

**Camp :** 🐺 Meute

Une seule fois pendant la partie, après le choix de la victime principale des Loups, tu peux décider de **l'infecter au lieu de la tuer**.

La victime :
• reste vivante ;
• conserve son rôle ;
• conserve ses pouvoirs ;
• rejoint secrètement la Meute.

L'infection appartient uniquement à toi.`,

        rules: [
            "Le pouvoir est utilisable une seule fois.",
            "L'infection remplace la mort principale des Loups.",
            "Le joueur conserve son rôle original.",
            "Les Loups apprennent l'identité du nouvel allié."
        ]
    },

    // ==================================================
    // WHITE WOLF
    // ==================================================

    white_wolf: {
        id: "white_wolf",
        name: "Loup Blanc",
        emoji: "🐺",
        camp: CAMPS.SOLO,
        apparentCamp: CAMPS.WOLVES,
        type: ROLE_TYPES.NIGHT,
        implemented: true,
        unique: true,
        minPlayers: 7,
        nightPriority: NIGHT_PRIORITY.WHITE_WOLF,

        initialState: {
            lastWhiteKillNight: 0
        },

        description:
            "Il participe avec la Meute mais cherche secrètement à devenir le dernier survivant.",

        objective:
            "Être le dernier joueur vivant.",

        roleSummary:
`🐺 **LOUP BLANC**

**Camp réel :** 🎭 Solitaire
**Camp apparent :** 🐺 Meute

Tu participes au vote des Loups.

Une nuit sur deux, tu peux tuer secrètement un autre membre de la Meute.

### 🏆 Objectif

Être le dernier survivant.`,

        rules: [
            "Le Loup Blanc participe au vote des Loups.",
            "Il ne gagne pas avec eux.",
            "Son attaque personnelle est disponible une nuit sur deux.",
            "Il peut choisir de passer."
        ]
    },

    // ==================================================
    // WOLF DOG
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
        nightPriority: NIGHT_PRIORITY.WOLF_DOG,

        initialState: {
            chosenCamp: null
        },

        description:
            "Pendant la première nuit, il choisit définitivement entre Village et Meute.",

        objective:
            "Gagner avec le camp qu'il choisit.",

        roleSummary:
`🐕 **CHIEN-LOUP**

Pendant la première nuit, tu choisis définitivement :

🏘️ **Village**
ou
🐺 **Meute**

Si tu ne réponds pas avant la fin du délai, tu restes au Village.`,

        rules: [
            "Le choix est effectué pendant la première nuit.",
            "Le choix est définitif.",
            "Sans réponse, le Village est choisi par défaut."
        ]
    },

    // ==================================================
    // WILD CHILD
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
        nightPriority: NIGHT_PRIORITY.WILD_CHILD,

        initialState: {
            modelId: null,
            transformed: false
        },

        description:
            "Pendant la première nuit, il choisit un modèle. Si ce modèle meurt, il rejoint la Meute.",

        objective:
            "Gagner avec son camp actuel.",

        roleSummary:
`🧒 **ENFANT SAUVAGE**

**Camp initial :** 🏘️ Village

Pendant la première nuit, tu choisis un autre joueur comme modèle.

Si ton modèle meurt, tu rejoins secrètement la Meute.

Si tu ne choisis personne avant la fin du délai, un modèle vivant est choisi aléatoirement.`,

        rules: [
            "Le modèle est choisi lors de la première nuit.",
            "Le joueur ne peut pas se choisir lui-même.",
            "Sans réponse, un modèle valide est choisi aléatoirement.",
            "La mort du modèle transforme automatiquement l'Enfant Sauvage."
        ]
    },

    // ==================================================
    // ANGEL
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

        initialState: {
            victoryAchieved: false,
            becameVillager: false
        },

        description:
            "Il gagne s'il est éliminé par le Village lors du premier vote. Sinon, il devient Villageois.",

        objective:
            "Se faire condamner lors du premier vote du Village.",

        roleSummary:
`👼 **ANGE**

**Camp initial :** 🎭 Solitaire

Tu dois être éliminé par le **premier vote du Village**.

Si cela arrive :

🏆 tu gagnes immédiatement.

Si tu survis à ce premier vote, ton objectif solitaire disparaît et tu deviens un **Villageois normal**.`,

        rules: [
            "La victoire personnelle ne fonctionne que lors du premier vote du Village.",
            "Une mort nocturne ne déclenche pas sa victoire.",
            "S'il survit au premier vote, il devient définitivement Villageois."
        ]
    },

    // ==================================================
    // FLUTE PLAYER
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
        nightPriority: NIGHT_PRIORITY.FLUTE_PLAYER,

        initialState: {
            charmedIds: []
        },

        description:
            "Chaque nuit, il charme jusqu'à deux joueurs et gagne lorsque tous les autres survivants sont charmés.",

        objective:
            "Charmer tous les autres survivants.",

        roleSummary:
`🎶 **JOUEUR DE FLÛTE**

**Camp :** 🎭 Solitaire

Chaque nuit, tu peux charmer jusqu'à deux nouvelles personnes.

Lorsque tous les autres joueurs encore vivants sont charmés, tu remportes immédiatement la partie.`,

        rules: [
            "Il peut charmer jusqu'à deux nouvelles personnes par nuit.",
            "Les morts ne comptent plus pour sa condition de victoire.",
            "Sa condition de victoire doit être vérifiée avant de conclure automatiquement à une victoire classique."
        ]
    }
};

// ======================================================
// ROLE GROUPS
// ======================================================

const ROLE_GROUPS = {
    village: {
        id: "village",
        name: "Rôles du Village",
        emoji: "🏘️",

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
            "village_idiot",
            "scapegoat",
            "raven",
            "stuttering_judge",
            "little_girl",
            "rusty_sword_knight",
            "actor",
            "two_sisters",
            "three_brothers"
        ]
    },

    wolves: {
        id: "wolves",
        name: "Loups & Meute",
        emoji: "🐺",

        roles: [
            "wolf",
            "alpha_wolf",
            "big_bad_wolf",
            "infect_father"
        ]
    },

    special: {
        id: "special",
        name: "Rôles spéciaux",
        emoji: "🎭",

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
// EXACTEMENT :
// - Classique
// - Avancé
// - Chaos
// - Loups renforcés
// - Rôles spéciaux
//
// "Personnalisé" est créé par commandes/loupgarou.js.
// Hardcore est un réglage, PAS un preset.
// ======================================================

const PRESETS = {
    classic: {
        id: "classic",
        name: "Classique",
        emoji: "🌱",
        minPlayers: 5,

        mayorElection: true,
        anonymousVotes: false,

        roleCounts: {
            wolf: 1,
            seer: 1,
            witch: 1
        },

        scaling: [
            {
                minPlayers: 7,

                add: {
                    wolf: 1,
                    hunter: 1
                }
            },

            {
                minPlayers: 10,

                add: {
                    guard: 1
                }
            },

            {
                minPlayers: 13,

                add: {
                    wolf: 1
                }
            }
        ],

        summary:
            "Une partie simple et équilibrée, idéale pour découvrir le système.",

        changes: [
            "👁️ Voyante active.",
            "🧙 Sorcière active.",
            "🐺 Nombre de Loups adapté au nombre de joueurs.",
            "🏹 Chasseur ajouté sur les parties plus grandes.",
            "🛡️ Salvateur ajouté ensuite.",
            "👑 Maire activé.",
            "👁️ Votes visibles."
        ]
    },

    advanced: {
        id: "advanced",
        name: "Avancé",
        emoji: "🔥",
        minPlayers: 7,

        mayorElection: true,
        anonymousVotes: false,

        roleCounts: {
            wolf: 2,
            seer: 1,
            witch: 1,
            guard: 1,
            hunter: 1,
            cupid: 1
        },

        scaling: [
            {
                minPlayers: 9,

                add: {
                    fox: 1
                }
            },

            {
                minPlayers: 11,

                add: {
                    alpha_wolf: 1,
                    raven: 1
                },

                remove: {
                    wolf: 1
                }
            },

            {
                minPlayers: 14,

                add: {
                    bear_tamer: 1,
                    actor: 1,
                    wolf: 1
                }
            }
        ],

        summary:
            "Davantage de pouvoirs et d'informations tout en restant équilibré.",

        changes: [
            "💘 Cupidon actif.",
            "🛡️ Salvateur actif.",
            "🏹 Chasseur actif.",
            "🦊 Renard possible.",
            "👑 Loup Alpha possible.",
            "🦅 Corbeau possible.",
            "🎭 Acteur possible.",
            "🐻 Montreur d'Ours possible."
        ]
    },

    chaos: {
        id: "chaos",
        name: "Chaos",
        emoji: "🌙",
        minPlayers: 10,

        mayorElection: true,
        anonymousVotes: true,

        roleCounts: {
            wolf: 1,
            alpha_wolf: 1,
            white_wolf: 1,
            seer: 1,
            witch: 1,
            cupid: 1,
            hunter: 1,
            fox: 1,
            wild_child: 1,
            raven: 1
        },

        scaling: [
            {
                minPlayers: 12,

                add: {
                    flute_player: 1,
                    guard: 1
                }
            },

            {
                minPlayers: 14,

                add: {
                    big_bad_wolf: 1,
                    elder: 1
                }
            },

            {
                minPlayers: 16,

                add: {
                    stuttering_judge: 1,
                    little_girl: 1
                }
            },

            {
                minPlayers: 18,

                add: {
                    infect_father: 1,
                    bear_tamer: 1
                }
            },

            {
                minPlayers: 20,

                add: {
                    actor: 1
                }
            }
        ],

        summary:
            "De nombreux rôles et plusieurs conditions de victoire produisent des parties imprévisibles.",

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

    wolves_power: {
        id: "wolves_power",
        name: "Loups renforcés",
        emoji: "🐺",
        minPlayers: 8,

        mayorElection: true,
        anonymousVotes: false,

        roleCounts: {
            wolf: 1,
            alpha_wolf: 1,
            big_bad_wolf: 1,
            seer: 1,
            witch: 1,
            guard: 1,
            hunter: 1
        },

        scaling: [
            {
                minPlayers: 10,

                add: {
                    wolf: 1,
                    fox: 1
                }
            },

            {
                minPlayers: 13,

                add: {
                    infect_father: 1,
                    raven: 1
                },

                remove: {
                    wolf: 1
                }
            },

            {
                minPlayers: 16,

                add: {
                    wolf: 1,
                    bear_tamer: 1
                }
            }
        ],

        summary:
            "La Meute possède davantage de pouvoirs, avec un Village renforcé pour compenser.",

        changes: [
            "👑 Loup Alpha actif avec autorité nocturne.",
            "🐺 Grand Méchant Loup actif.",
            "🩸 Infect Père des Loups possible.",
            "🛡️ Village renforcé.",
            "🦊 Renard possible.",
            "🦅 Corbeau possible."
        ]
    },

    special: {
        id: "special",
        name: "Rôles spéciaux",
        emoji: "🎭",
        minPlayers: 8,

        mayorElection: true,
        anonymousVotes: false,

        roleCounts: {
            wolf: 2,
            seer: 1,
            witch: 1,
            cupid: 1,
            wild_child: 1,
            little_girl: 1,
            hunter: 1
        },

        scaling: [
            {
                minPlayers: 10,

                add: {
                    wolf_dog: 1,
                    raven: 1
                }
            },

            {
                minPlayers: 12,

                add: {
                    white_wolf: 1
                },

                remove: {
                    wolf: 1
                }
            },

            {
                minPlayers: 14,

                add: {
                    fox: 1,
                    bear_tamer: 1
                }
            },

            {
                minPlayers: 16,

                add: {
                    actor: 1,
                    wolf: 1
                }
            },

            {
                minPlayers: 18,

                add: {
                    two_sisters: 2
                }
            }
        ],

        summary:
            "Transformations, espionnage, groupes liés et conditions de victoire particulières.",

        changes: [
            "💘 Amoureux actifs.",
            "🧒 Enfant Sauvage actif.",
            "👧 Petite Fille active.",
            "🐕 Chien-Loup possible.",
            "🐺 Loup Blanc possible.",
            "🎭 Acteur possible.",
            "👭 Deux Sœurs possibles.",
            "🦅 Corbeau possible."
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

    if (
        !preset
    ) {
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

        if (
            !role
        ) {
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
                `${role.emoji} ${role.name} n'est pas disponible.`
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
            role.exactCountWhenPresent &&
            amount !==
            role.exactCountWhenPresent
        ) {
            errors.push(
                `${role.emoji} ${role.name} doit être présent exactement ${role.exactCountWhenPresent} fois ou pas du tout.`
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

    if (
        wolfAlignedCount ===
        0
    ) {
        errors.push(
            "La composition doit contenir au moins un rôle lié à la Meute."
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
            "La Meute représente au moins la moitié des cartes."
        );
    }

    if (
        soloCount >=
        3
    ) {
        warnings.push(
            "La partie contient au moins trois rôles solitaires."
        );
    }

    if (
        Number(
            roleCounts
                ?.white_wolf
        ) >
            0 &&
        wolfAlignedCount <
            2
    ) {
        warnings.push(
            "Le Loup Blanc fonctionne mieux avec plusieurs autres rôles liés à la Meute."
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

    if (
        !role
    ) {
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
        if (
            !ROLES[
                roleId
            ]
        ) {
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
            let i = 0;
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
        id: "flow",
        emoji: "🎮",
        name: "Déroulement",

        text:
`### 🎮 Déroulement

1. Création du lobby.
2. Tous les joueurs rejoignent le même vocal.
3. Configuration de la partie.
4. Vérification des messages privés.
5. Distribution des rôles.
6. Le narrateur rejoint le vocal.
7. La première nuit commence.
8. Les actions secrètes sont effectuées par DM.
9. Le jour se lève.
10. Les événements publics sont annoncés.
11. Discussion.
12. Vote.
13. Nouvelle nuit.

Le cycle continue jusqu'à une condition de victoire.`
    },

    wolves: {
        id: "wolves",
        emoji: "🐺",
        name: "Rôles Loups",

        text:
`### 🐺 La Meute

Les membres de la Meute se connaissent secrètement.

Chaque nuit, les Loups vivants reçoivent leur vote privé.

Un joueur qui ne répond pas avant la fin du délai passe simplement son vote.

Si aucun vote valide n'est envoyé, aucune victime principale n'est sélectionnée.`
    },

    village: {
        id: "village",
        emoji: "🏘️",
        name: "Rôles Village",

        text:
`### 🏘️ Village

Le Village doit identifier les menaces grâce aux discussions, aux pouvoirs et aux votes.

Les informations privées reçues par certains rôles ne sont jamais annoncées automatiquement à tout le monde.`
    },

    special: {
        id: "special",
        emoji: "🎭",
        name: "Rôles spéciaux",

        text:
`### 🎭 Rôles spéciaux

Certains joueurs peuvent changer de camp ou posséder leur propre condition de victoire.

Le moteur vérifie ces conditions pendant toute la partie.`
    },

    mayor: {
        id: "mayor",
        emoji: "👑",
        name: "Maire",

        text:
`### 👑 Maire

Le Maire est un statut public indépendant du rôle secret.

Si l'option est activée, l'élection a lieu après la première nuit.

Le Maire :
• possède un vote comptant double ;
• départage certaines égalités en privé ;
• choisit secrètement son successeur lorsqu'il meurt.

Si l'élection du Maire se termine sur une égalité :
1. un second tour est organisé entre les ex æquo ;
2. si le second tour est encore à égalité, aucun Maire n'est élu.`
    },

    night: {
        id: "night",
        emoji: "🌙",
        name: "Nuit",

        text:
`### 🌙 Nuit

Tous les joueurs vivants présents dans le vocal sont server mute.

Les rôles reçoivent leurs actions secrètes en DM.

Le narrateur annonce uniquement les phases générales.

Il ne révèle jamais publiquement une cible ou le résultat privé d'un pouvoir.

Sans réponse avant le délai, l'action utilise sa règle par défaut ou est passée.`
    },

    day: {
        id: "day",
        emoji: "☀️",
        name: "Jour & Votes",

        text:
`### ☀️ Jour & Votes

Les survivants autorisés sont unmute pendant la journée.

Les morts restent spectateurs et mute.

Les votes peuvent être visibles ou anonymes selon la configuration.

Le Maire possède une voix double lorsqu'il est vivant.`
    },

    hardcore: {
        id: "hardcore",
        emoji: "☠️",
        name: "Hardcore",

        text:
`### ☠️ Hardcore

Le rôle des morts reste caché.

Le journal public évite toute information secrète.

Les identités complètes sont révélées à la fin de la partie.`
    },

    victory: {
        id: "victory",
        emoji: "🏆",
        name: "Conditions de victoire",

        text:
`### 🏆 Conditions de victoire

🏘️ **Village**
Éliminer les menaces lupines.

🐺 **Meute**
Atteindre une situation où elle contrôle les autres survivants.

🐺 **Loup Blanc**
Être le dernier survivant.

🎶 **Joueur de Flûte**
Charmer tous les autres survivants requis.

👼 **Ange**
Être éliminé pendant le premier vote du Village.

💘 **Amoureux mixtes**
Peuvent obtenir une victoire spéciale s'ils deviennent les derniers survivants ensemble.`
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

    const sections = [
        {
            title:
                "🎮 Déroulement",

            text:
                GENERAL_RULES.flow.text
        },

        {
            title:
                "🌙 Nuit",

            text:
                GENERAL_RULES.night.text
        },

        {
            title:
                "☀️ Jour & Votes",

            text:
                GENERAL_RULES.day.text
        }
    ];

    const hasWolfRole =
        activeRoleIds.some(
            roleId => {
                const role =
                    ROLES[
                        roleId
                    ];

                return (
                    role?.camp ===
                        CAMPS.WOLVES ||
                    role?.apparentCamp ===
                        CAMPS.WOLVES
                );
            }
        );

    const hasVillageRole =
        activeRoleIds.some(
            roleId =>
                ROLES[
                    roleId
                ]?.camp ===
                CAMPS.VILLAGE
        );

    const hasSpecialRole =
        activeRoleIds.some(
            roleId =>
                ROLES[
                    roleId
                ]?.camp ===
                CAMPS.SOLO ||
                [
                    "wolf_dog",
                    "wild_child",
                    "cupid"
                ].includes(
                    roleId
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
            activeRoleIds.map(
                roleId =>
                    ROLES[
                        roleId
                    ]
            )
    };
}

// ======================================================
// PRESET DESCRIPTION
// ======================================================

function buildPresetDescription(
    presetId,
    playerCount = null
) {
    const preset =
        PRESETS[
            presetId
        ];

    if (
        !preset
    ) {
        return null;
    }

    const count =
        Number(
            playerCount
        );

    const resolved =
        Number.isFinite(
            count
        ) &&
        count >
        0
            ? resolvePreset(
                presetId,
                count
            )
            : null;

    let compositionText =
        "La composition exacte dépend du nombre de joueurs.";

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
    before,
    after
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
                ? "☠️ Hardcore activé : les rôles des morts seront cachés."
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
                ? "🤫 Mode discret activé."
                : "🔊 Mode discret désactivé."
        );
    }

    return changes;
}

// ======================================================
// COMPARE ROLE COUNTS
// ======================================================

function compareRoleCounts(
    before,
    after
) {
    const roleIds =
        new Set([
            ...Object.keys(
                before ||
                {}
            ),

            ...Object.keys(
                after ||
                {}
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
                before
                    ?.[
                        roleId
                    ]
            ) ||
            0;

        const newAmount =
            Number(
                after
                    ?.[
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
            `${newAmount > oldAmount ? "➕" : "➖"} ${role?.emoji || "❔"} ${role?.name || roleId} : ${oldAmount} → ${newAmount}`
        );
    }

    return changes;
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
    CAMPS,
    ROLE_TYPES,
    NIGHT_PRIORITY,

    ROLES,
    ROLE_GROUPS,

    PRESETS,
    GENERAL_RULES,

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

    buildPresetDescription,

    compareConfigs,
    compareRoleCounts
};