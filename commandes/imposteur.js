const fs = require("fs");
const path = require("path");

const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    UserSelectMenuBuilder,
    MessageFlags
} = require("discord.js");

// ======================================================
// CONFIG
// ======================================================

const COLOR = 0x3B6475;
const SUCCESS = 0x57F287;
const WARNING = 0xFEE75C;
const ERROR = 0xED4245;

const MIN_PLAYERS = 3;
const RECENT_WORD_LIMIT = 20;

// ======================================================
// DATA
// ======================================================

const DATA_DIR =
    path.join(
        __dirname,
        "..",
        "data"
    );

const DATA_FILE =
    path.join(
        DATA_DIR,
        "imposteur.json"
    );

// ======================================================
// CATÉGORIES
// ======================================================

const WORD_BANK = {
    lieux: {
        emoji: "🏙️",
        name: "Lieux",
        words: [
            "Aéroport",
            "Hôpital",
            "Prison",
            "Cinéma",
            "Restaurant",
            "Plage",
            "École",
            "Université",
            "Supermarché",
            "Bibliothèque",
            "Musée",
            "Hôtel",
            "Gare",
            "Métro",
            "Stade",
            "Boîte de nuit",
            "Parc d'attractions",
            "Piscine",
            "Salle de sport",
            "Banque",
            "Commissariat",
            "Tribunal",
            "Château",
            "Camping",
            "Zoo",
            "Aquarium",
            "Centre commercial",
            "Coiffeur",
            "Garage",
            "Pharmacie",
            "Boulangerie",
            "Cimetière",
            "Forêt",
            "Montagne",
            "Désert",
            "Île",
            "Port",
            "Ferme",
            "Usine",
            "Laboratoire",
            "Bunker",
            "Casino",
            "Appartement",
            "Manoir",
            "Discothèque",
            "Station-service",
            "Cabinet médical",
            "Studio de télévision",
            "Restaurant rapide",
            "Parc",
            "Salle de classe",
            "Gymnase",
            "Toit d'immeuble",
            "Parking",
            "Ascenseur",
            "Cave",
            "Grenier",
            "Entrepôt",
            "Boutique",
            "Mairie",
            "Palais",
            "Arène",
            "Théâtre",
            "Concert",
            "Maison abandonnée",
            "Hélicoptère",
            "Train",
            "Bus",
            "Avion",
            "Bateau",
            "Sous-marin"
        ]
    },

    objets: {
        emoji: "📦",
        name: "Objets",
        words: [
            "Téléphone",
            "Ordinateur",
            "Clavier",
            "Souris",
            "Écran",
            "Casque",
            "Micro",
            "Télécommande",
            "Lampe",
            "Chaise",
            "Table",
            "Canapé",
            "Lit",
            "Oreiller",
            "Couverture",
            "Montre",
            "Bracelet",
            "Collier",
            "Bague",
            "Lunettes",
            "Sac",
            "Valise",
            "Bouteille",
            "Verre",
            "Fourchette",
            "Couteau",
            "Cuillère",
            "Assiette",
            "Tasse",
            "Poêle",
            "Casserole",
            "Clé",
            "Cadenas",
            "Parapluie",
            "Livre",
            "Cahier",
            "Stylo",
            "Crayon",
            "Gomme",
            "Règle",
            "Ballon",
            "Raquette",
            "Manette",
            "Console",
            "Caméra",
            "Appareil photo",
            "Enceinte",
            "Chargeur",
            "Batterie",
            "Ventilateur",
            "Miroir",
            "Poubelle",
            "Tapis",
            "Horloge",
            "Bougie",
            "Brosse",
            "Peigne",
            "Savon",
            "Serviette",
            "Boîte",
            "Coffre",
            "Marteau",
            "Tournevis",
            "Pince",
            "Corde",
            "Casquette",
            "Parfum",
            "Briquet"
        ]
    },

    nourriture: {
        emoji: "🍔",
        name: "Nourriture",
        words: [
            "Pizza",
            "Burger",
            "Tacos",
            "Kebab",
            "Frites",
            "Pâtes",
            "Riz",
            "Lasagnes",
            "Steak",
            "Poulet",
            "Poisson",
            "Sushi",
            "Salade",
            "Soupe",
            "Sandwich",
            "Hot-dog",
            "Croissant",
            "Pain au chocolat",
            "Baguette",
            "Crêpe",
            "Gaufre",
            "Donut",
            "Cookie",
            "Brownie",
            "Muffin",
            "Gâteau",
            "Tarte",
            "Glace",
            "Chocolat",
            "Bonbon",
            "Pop-corn",
            "Chips",
            "Fromage",
            "Yaourt",
            "Céréales",
            "Omelette",
            "Œuf",
            "Bacon",
            "Saucisse",
            "Pomme",
            "Banane",
            "Orange",
            "Fraise",
            "Framboise",
            "Raisin",
            "Pastèque",
            "Ananas",
            "Mangue",
            "Citron",
            "Tomate",
            "Carotte",
            "Pomme de terre",
            "Avocat",
            "Oignon",
            "Champignon",
            "Café",
            "Thé",
            "Soda",
            "Jus d'orange",
            "Milkshake",
            "Eau",
            "Chocolat chaud"
        ]
    },

    animaux: {
        emoji: "🐾",
        name: "Animaux",
        words: [
            "Chat",
            "Chien",
            "Lion",
            "Tigre",
            "Éléphant",
            "Girafe",
            "Zèbre",
            "Singe",
            "Gorille",
            "Panda",
            "Ours",
            "Loup",
            "Renard",
            "Lapin",
            "Hamster",
            "Souris",
            "Rat",
            "Cheval",
            "Vache",
            "Cochon",
            "Mouton",
            "Chèvre",
            "Poulet",
            "Canard",
            "Oie",
            "Aigle",
            "Faucon",
            "Hibou",
            "Perroquet",
            "Pingouin",
            "Flamant rose",
            "Requin",
            "Dauphin",
            "Baleine",
            "Orque",
            "Poulpe",
            "Méduse",
            "Crabe",
            "Homard",
            "Tortue",
            "Crocodile",
            "Alligator",
            "Serpent",
            "Lézard",
            "Grenouille",
            "Papillon",
            "Abeille",
            "Fourmi",
            "Araignée",
            "Scorpion",
            "Mouche",
            "Moustique",
            "Coccinelle",
            "Escargot",
            "Requin marteau",
            "Hippopotame",
            "Rhinocéros",
            "Koala",
            "Kangourou",
            "Chameau"
        ]
    },

    films_series: {
        emoji: "🎬",
        name: "Films & séries",
        words: [
            "Harry Potter",
            "Titanic",
            "Avatar",
            "Star Wars",
            "Marvel",
            "Spider-Man",
            "Batman",
            "Superman",
            "Wednesday",
            "Stranger Things",
            "Squid Game",
            "La Casa de Papel",
            "The Walking Dead",
            "Game of Thrones",
            "Breaking Bad",
            "Jurassic Park",
            "Fast and Furious",
            "Mission Impossible",
            "Matrix",
            "Shrek",
            "Cars",
            "Toy Story",
            "Frozen",
            "Le Roi Lion",
            "Aladdin",
            "Raiponce",
            "Encanto",
            "Coco",
            "Moi Moche et Méchant",
            "Kung Fu Panda",
            "Dragons",
            "Jumanji",
            "Pirates des Caraïbes",
            "Saw",
            "Scream",
            "Annabelle",
            "Ça",
            "Chucky",
            "Mercredi",
            "Lucifer",
            "The Boys",
            "The Last of Us",
            "Fallout",
            "Arcane",
            "One Piece",
            "Naruto",
            "Dragon Ball",
            "Pokémon",
            "Demon Slayer",
            "Death Note"
        ]
    },

    jeux_video: {
        emoji: "🎮",
        name: "Jeux vidéo",
        words: [
            "Minecraft",
            "Fortnite",
            "Roblox",
            "GTA",
            "Call of Duty",
            "Valorant",
            "Overwatch",
            "League of Legends",
            "Rocket League",
            "Fall Guys",
            "Among Us",
            "The Sims",
            "FIFA",
            "EA Sports FC",
            "Forza",
            "Gran Turismo",
            "Red Dead Redemption",
            "Cyberpunk",
            "Resident Evil",
            "The Last of Us",
            "God of War",
            "Spider-Man",
            "Hogwarts Legacy",
            "Assassin's Creed",
            "Far Cry",
            "Rainbow Six Siege",
            "Apex Legends",
            "PUBG",
            "Counter-Strike",
            "Dead by Daylight",
            "Phasmophobia",
            "Five Nights at Freddy's",
            "Terraria",
            "Stardew Valley",
            "Animal Crossing",
            "Mario Kart",
            "Super Mario",
            "Zelda",
            "Pokémon",
            "Clash Royale",
            "Brawl Stars",
            "Clash of Clans",
            "Geometry Dash",
            "Subway Surfers",
            "Genshin Impact",
            "Fallout",
            "Rust",
            "ARK",
            "Hitman",
            "Portal"
        ]
    },

    musique: {
        emoji: "🎵",
        name: "Musique",
        words: [
            "Piano",
            "Guitare",
            "Batterie",
            "Violon",
            "Saxophone",
            "Trompette",
            "Flûte",
            "Micro",
            "Concert",
            "Festival",
            "Rap",
            "Rock",
            "Pop",
            "Métal",
            "Jazz",
            "Classique",
            "Électro",
            "Techno",
            "Reggae",
            "Hip-hop",
            "DJ",
            "Chanteur",
            "Chanteuse",
            "Album",
            "Playlist",
            "Spotify",
            "YouTube Music",
            "Casque audio",
            "Enceinte",
            "Studio",
            "Karaoké",
            "Refrain",
            "Couplet",
            "Partition",
            "Note",
            "Accord",
            "Mélodie",
            "Rythme",
            "Basse",
            "Remix",
            "Vinyle",
            "Radio",
            "Clip",
            "Scène",
            "Tournée"
        ]
    },

    internet: {
        emoji: "💻",
        name: "Discord / Internet",
        words: [
            "Discord",
            "Serveur",
            "Salon vocal",
            "Salon textuel",
            "Bot",
            "Rôle",
            "Modérateur",
            "Administrateur",
            "Mute",
            "Ban",
            "Kick",
            "Ping",
            "Emoji",
            "Sticker",
            "Nitro",
            "Webhook",
            "Ticket",
            "Forum",
            "Thread",
            "Pseudo",
            "Avatar",
            "Bannière",
            "Message privé",
            "Mention",
            "Réaction",
            "Connexion",
            "Internet",
            "Wi-Fi",
            "Fibre",
            "Navigateur",
            "Google",
            "YouTube",
            "TikTok",
            "Instagram",
            "Snapchat",
            "Twitch",
            "Reddit",
            "Twitter",
            "Streaming",
            "VPN",
            "Mot de passe",
            "Compte",
            "Lien",
            "Téléchargement",
            "Bug",
            "Mise à jour",
            "Serveur privé",
            "Cloud",
            "Site web",
            "Application"
        ]
    },

    roblox: {
        emoji: "🟥",
        name: "Roblox",
        words: [
            "Roblox",
            "Robux",
            "Avatar Roblox",
            "Gamepass",
            "Serveur privé",
            "Studio Roblox",
            "Obby",
            "Tycoon",
            "Simulator",
            "Roleplay",
            "Brookhaven",
            "Bloxburg",
            "Adopt Me",
            "Dress to Impress",
            "Murder Mystery 2",
            "Jailbreak",
            "Arsenal",
            "Tower of Hell",
            "Blade Ball",
            "Doors",
            "Piggy",
            "Rainbow Friends",
            "Blox Fruits",
            "Pet Simulator",
            "Natural Disaster",
            "Work at a Pizza Place",
            "MeepCity",
            "Animation",
            "Emote",
            "UGC",
            "Limited",
            "Badge",
            "Groupe Roblox",
            "Rank",
            "Developer",
            "Explorer",
            "Toolbox",
            "Spawn",
            "Checkpoint",
            "Teleport",
            "Script",
            "LocalScript",
            "RemoteEvent",
            "Humanoid",
            "Part",
            "Mesh",
            "Terrain"
        ]
    },

    schoolrp: {
        emoji: "🏫",
        name: "SchoolRP",
        words: [
            "Professeur",
            "Élève",
            "Directeur",
            "Surveillant",
            "CPE",
            "Infirmière",
            "Cantine",
            "Salle de classe",
            "Récréation",
            "Retenue",
            "Examen",
            "Devoir",
            "Cours",
            "Casier",
            "Sac à dos",
            "Tableau",
            "Gymnase",
            "Bibliothèque",
            "Toilettes",
            "Bureau du directeur",
            "Couloir",
            "Escalier",
            "Cour",
            "Bus scolaire",
            "Infirmerie",
            "Cafétéria",
            "Uniforme",
            "Diplôme",
            "Conseil de classe",
            "Absence",
            "Punition",
            "Sanction",
            "Réunion",
            "Famille RP",
            "Session RP",
            "Serveur privé",
            "Whitelist",
            "Modérateur",
            "Staff",
            "Animation",
            "Événement",
            "Prison",
            "Police",
            "Hôpital",
            "Maison",
            "Appartement",
            "Voiture",
            "Téléphone RP",
            "Carte d'identité"
        ]
    },

    metiers: {
        emoji: "👔",
        name: "Métiers",
        words: [
            "Policier",
            "Pompier",
            "Médecin",
            "Infirmier",
            "Professeur",
            "Avocat",
            "Juge",
            "Vendeur",
            "Serveur",
            "Cuisinier",
            "Boulanger",
            "Coiffeur",
            "Mécanicien",
            "Pilote",
            "Conducteur",
            "Chauffeur",
            "Journaliste",
            "Photographe",
            "Architecte",
            "Ingénieur",
            "Développeur",
            "Designer",
            "Musicien",
            "Chanteur",
            "Acteur",
            "Réalisateur",
            "Agriculteur",
            "Vétérinaire",
            "Dentiste",
            "Pharmacien",
            "Psychologue",
            "Scientifique",
            "Astronaute",
            "Militaire",
            "Agent de sécurité",
            "Banquier",
            "Comptable",
            "Électricien",
            "Plombier",
            "Maçon",
            "Peintre",
            "Livreur",
            "Facteur",
            "Caissier",
            "Agent immobilier",
            "Influenceur",
            "Streamer",
            "YouTubeur",
            "DJ",
            "Gardien"
        ]
    },

    sports: {
        emoji: "⚽",
        name: "Sports",
        words: [
            "Football",
            "Basketball",
            "Tennis",
            "Rugby",
            "Handball",
            "Volleyball",
            "Golf",
            "Boxe",
            "MMA",
            "Judo",
            "Karaté",
            "Natation",
            "Athlétisme",
            "Cyclisme",
            "Ski",
            "Snowboard",
            "Surf",
            "Skateboard",
            "Formule 1",
            "MotoGP",
            "Hockey",
            "Baseball",
            "Badminton",
            "Ping-pong",
            "Escalade",
            "Gymnastique",
            "Danse",
            "Équitation",
            "Tir à l'arc",
            "Escrime",
            "Course",
            "Marathon",
            "Karting",
            "Bowling",
            "Musculation",
            "CrossFit"
        ]
    },

    vehicules: {
        emoji: "🚗",
        name: "Véhicules",
        words: [
            "Voiture",
            "Moto",
            "Vélo",
            "Trottinette",
            "Bus",
            "Train",
            "Métro",
            "Tramway",
            "Camion",
            "Fourgon",
            "Taxi",
            "Ambulance",
            "Camion de pompier",
            "Voiture de police",
            "Hélicoptère",
            "Avion",
            "Jet privé",
            "Bateau",
            "Yacht",
            "Sous-marin",
            "Fusée",
            "Kart",
            "Tracteur",
            "Pelleteuse",
            "Quad",
            "Scooter",
            "Limousine",
            "Camping-car",
            "Monospace",
            "SUV",
            "Cabriolet",
            "Voiture de sport",
            "Formule 1",
            "Jet-ski",
            "Montgolfière"
        ]
    },

    vetements: {
        emoji: "👕",
        name: "Vêtements",
        words: [
            "T-shirt",
            "Pull",
            "Sweat",
            "Chemise",
            "Veste",
            "Manteau",
            "Jean",
            "Pantalon",
            "Short",
            "Jupe",
            "Robe",
            "Costume",
            "Cravate",
            "Nœud papillon",
            "Chaussures",
            "Baskets",
            "Bottes",
            "Sandales",
            "Chaussettes",
            "Casquette",
            "Chapeau",
            "Bonnet",
            "Écharpe",
            "Gants",
            "Ceinture",
            "Pyjama",
            "Maillot de bain",
            "Uniforme",
            "Lunettes de soleil",
            "Sac à main",
            "Sac à dos"
        ]
    },

    pays_villes: {
        emoji: "🌍",
        name: "Pays & villes",
        words: [
            "France",
            "Espagne",
            "Italie",
            "Allemagne",
            "Belgique",
            "Suisse",
            "Portugal",
            "Royaume-Uni",
            "États-Unis",
            "Canada",
            "Brésil",
            "Argentine",
            "Mexique",
            "Japon",
            "Chine",
            "Corée du Sud",
            "Inde",
            "Australie",
            "Maroc",
            "Algérie",
            "Tunisie",
            "Égypte",
            "Turquie",
            "Grèce",
            "Norvège",
            "Suède",
            "Finlande",
            "Danemark",
            "Russie",
            "Paris",
            "Londres",
            "Madrid",
            "Rome",
            "Berlin",
            "Bruxelles",
            "Genève",
            "New York",
            "Los Angeles",
            "Miami",
            "Las Vegas",
            "Tokyo",
            "Séoul",
            "Dubaï",
            "Sydney",
            "Montréal",
            "Toronto"
        ]
    },

    maison: {
        emoji: "🏠",
        name: "Maison",
        words: [
            "Cuisine",
            "Salon",
            "Chambre",
            "Salle de bain",
            "Toilettes",
            "Garage",
            "Jardin",
            "Balcon",
            "Terrasse",
            "Cave",
            "Grenier",
            "Couloir",
            "Escalier",
            "Porte",
            "Fenêtre",
            "Canapé",
            "Lit",
            "Table",
            "Chaise",
            "Télévision",
            "Four",
            "Micro-ondes",
            "Réfrigérateur",
            "Congélateur",
            "Lave-vaisselle",
            "Machine à laver",
            "Douche",
            "Baignoire",
            "Lavabo",
            "Miroir",
            "Armoire",
            "Placard",
            "Bibliothèque",
            "Bureau",
            "Lampe",
            "Tapis",
            "Rideau",
            "Oreiller",
            "Couverture",
            "Piscine",
            "Barbecue"
        ]
    },

    technologie: {
        emoji: "📱",
        name: "Technologie",
        words: [
            "Smartphone",
            "Ordinateur",
            "Tablette",
            "Télévision",
            "Console",
            "Casque VR",
            "Montre connectée",
            "Clavier",
            "Souris",
            "Écran",
            "Micro",
            "Webcam",
            "Routeur",
            "Wi-Fi",
            "Bluetooth",
            "USB",
            "HDMI",
            "Chargeur",
            "Batterie",
            "Cloud",
            "Intelligence artificielle",
            "Robot",
            "Drone",
            "Imprimante 3D",
            "Serveur",
            "Application",
            "Site web",
            "Navigateur",
            "Mot de passe",
            "Empreinte digitale",
            "Face ID",
            "QR Code",
            "GPS",
            "Satellite",
            "Fibre optique",
            "Disque dur",
            "SSD",
            "Carte graphique",
            "Processeur",
            "RAM"
        ]
    },

    activites: {
        emoji: "🎉",
        name: "Activités",
        words: [
            "Cinéma",
            "Bowling",
            "Karting",
            "Shopping",
            "Restaurant",
            "Voyage",
            "Camping",
            "Randonnée",
            "Piscine",
            "Plage",
            "Ski",
            "Patinoire",
            "Concert",
            "Festival",
            "Karaoké",
            "Soirée",
            "Anniversaire",
            "Barbecue",
            "Pique-nique",
            "Jeux vidéo",
            "Lecture",
            "Dessin",
            "Peinture",
            "Cuisine",
            "Danse",
            "Chant",
            "Musique",
            "Sport",
            "Football",
            "Basketball",
            "Escape game",
            "Parc d'attractions",
            "Zoo",
            "Musée",
            "Aquarium",
            "Photographie",
            "Stream",
            "Vocal Discord",
            "Roleplay",
            "Tournoi"
        ]
    },

    absurde: {
        emoji: "😂",
        name: "Mots absurdes",
        words: [
            "Chaussette",
            "Cornichon",
            "Toilettes",
            "Poubelle",
            "Cactus",
            "Licorne",
            "Dinosaure",
            "Canard",
            "Banane",
            "Brosse à dents",
            "Pantoufle",
            "Slip",
            "Frigo",
            "Micro-ondes",
            "Pelle",
            "Brique",
            "Caddie",
            "Baguette",
            "Poireau",
            "Pastèque",
            "Pigeon",
            "Escargot",
            "Moustique",
            "Poulet",
            "Trompette",
            "Kangourou",
            "Parapluie",
            "Casserole",
            "Baignoire",
            "Grille-pain",
            "Pneu",
            "Brouette",
            "Ventilateur",
            "Télécommande",
            "Mouchoir",
            "Savon",
            "Cintre",
            "Tapis",
            "Coussin",
            "Poulpe",
            "Gnome",
            "Fantôme",
            "Alien",
            "Zombie",
            "Patate",
            "Croquette",
            "Paille",
            "Bouchon",
            "Cuvette",
            "Râteau"
        ]
    }
};

// ======================================================
// DEFAULT DATA
// ======================================================

function defaultData() {
    return {
        version: 1,
        lobbies: {},
        recentWords: []
    };
}

function ensureFile() {
    if (
        !fs.existsSync(
            DATA_DIR
        )
    ) {
        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );
    }

    if (
        !fs.existsSync(
            DATA_FILE
        )
    ) {
        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(
                defaultData(),
                null,
                4
            ),
            "utf8"
        );
    }
}

function loadData() {
    ensureFile();

    try {
        const raw =
            fs.readFileSync(
                DATA_FILE,
                "utf8"
            );

        const data =
            raw.trim()
                ? JSON.parse(raw)
                : defaultData();

        if (
            !data.lobbies
        ) {
            data.lobbies = {};
        }

        if (
            !Array.isArray(
                data.recentWords
            )
        ) {
            data.recentWords = [];
        }

        return data;

    } catch (error) {
        console.error(
            "❌ imposteur.json :",
            error
        );

        return defaultData();
    }
}

function saveData(
    data
) {
    ensureFile();

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(
            data,
            null,
            4
        ),
        "utf8"
    );
}

// ======================================================
// UTILS
// ======================================================

function createId() {
    return (
        `${Date.now()}${Math.random()
            .toString(36)
            .slice(2, 7)}`
    );
}

function randomItem(
    array
) {
    return array[
        Math.floor(
            Math.random() *
            array.length
        )
    ];
}

function shuffle(
    array
) {
    const clone =
        [...array];

    for (
        let i =
            clone.length - 1;
        i > 0;
        i--
    ) {
        const j =
            Math.floor(
                Math.random() *
                (
                    i + 1
                )
            );

        [
            clone[i],
            clone[j]
        ] = [
            clone[j],
            clone[i]
        ];
    }

    return clone;
}

function getLobby(
    id
) {
    return (
        loadData()
            .lobbies[
                id
            ] ||
        null
    );
}

function updateLobby(
    lobby
) {
    const data =
        loadData();

    if (
        !data.lobbies[
            lobby.id
        ]
    ) {
        return false;
    }

    data.lobbies[
        lobby.id
    ] =
        lobby;

    saveData(
        data
    );

    return true;
}

function deleteLobby(
    id
) {
    const data =
        loadData();

    delete data.lobbies[
        id
    ];

    saveData(
        data
    );
}

function getRandomCategory() {
    return randomItem(
        Object.keys(
            WORD_BANK
        )
    );
}

function pickWord(
    requestedCategory = null
) {
    const data =
        loadData();

    const categoryKey =
        requestedCategory &&
        WORD_BANK[
            requestedCategory
        ]
            ? requestedCategory
            : getRandomCategory();

    const category =
        WORD_BANK[
            categoryKey
        ];

    const recent =
        new Set(
            data.recentWords
        );

    let available =
        category.words.filter(
            word =>
                !recent.has(
                    `${categoryKey}:${word}`
                )
        );

    if (
        available.length ===
        0
    ) {
        available =
            [...category.words];
    }

    const word =
        randomItem(
            available
        );

    data.recentWords.push(
        `${categoryKey}:${word}`
    );

    if (
        data.recentWords.length >
        RECENT_WORD_LIMIT
    ) {
        data.recentWords =
            data.recentWords.slice(
                -RECENT_WORD_LIMIT
            );
    }

    saveData(
        data
    );

    return {
        categoryKey,
        category,
        word
    };
}

// ======================================================
// CATEGORY OPTIONS
// ======================================================

function categoryOptions() {
    return Object.entries(
        WORD_BANK
    ).map(
        (
            [
                key,
                category
            ]
        ) => ({
            name:
                `${category.emoji} ${category.name}`,

            value:
                key
        })
    );
}

// ======================================================
// LOBBY EMBED
// ======================================================

function buildLobbyEmbed(
    lobby
) {
    const category =
        lobby.category
            ? WORD_BANK[
                lobby.category
            ]
            : null;

    const categoryText =
        category
            ? `${category.emoji} ${category.name}`
            : "🎲 Aléatoire";

    const players =
        lobby.players.length
            ? lobby.players
                .map(
                    (
                        id,
                        index
                    ) =>
                        `${index + 1}. <@${id}>`
                )
                .join(
                    "\n"
                )
            : "Aucun joueur.";

    return new EmbedBuilder()
        .setColor(
            COLOR
        )
        .setTitle(
            "🕵️ Imposteur — The Legacy"
        )
        .setDescription(
`### 🎲 Catégorie
${categoryText}

### 👥 Joueurs • ${lobby.players.length}

${players}

**Minimum requis :** ${MIN_PLAYERS} joueurs

━━━━━━━━━━━━━━━━━━━━

Quand la partie démarre, tous les joueurs recevront le même mot en MP...

**sauf l'Imposteur.**

L'Imposteur devra se fondre dans la discussion sans connaître le mot.`
        )
        .setFooter({
            text:
                "The Legacy • Imposteur"
        })
        .setTimestamp();
}

// ======================================================
// LOBBY BUTTONS
// ======================================================

function lobbyButtons(
    lobby,
    disabled = false
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `imp_join_${lobby.id}`
                    )
                    .setLabel(
                        "Rejoindre"
                    )
                    .setEmoji(
                        "✅"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(
                        disabled
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `imp_leave_${lobby.id}`
                    )
                    .setLabel(
                        "Quitter"
                    )
                    .setEmoji(
                        "🚪"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setDisabled(
                        disabled
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `imp_start_${lobby.id}`
                    )
                    .setLabel(
                        "Démarrer"
                    )
                    .setEmoji(
                        "▶️"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
                    .setDisabled(
                        disabled
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `imp_cancel_${lobby.id}`
                    )
                    .setLabel(
                        "Annuler"
                    )
                    .setEmoji(
                        "❌"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
                    .setDisabled(
                        disabled
                    )
            )
    ];
}

// ======================================================
// DISCUSSION EMBED
// ======================================================

function buildDiscussionEmbed(
    lobby
) {
    const category =
        WORD_BANK[
            lobby.selectedCategory
        ];

    return new EmbedBuilder()
        .setColor(
            WARNING
        )
        .setTitle(
            "🕵️ La partie commence"
        )
        .setDescription(
`Les rôles ont été envoyés en MP.

### ${category.emoji} Catégorie
**${category.name}**

### 👥 Participants

${lobby.players
    .map(
        id =>
            `• <@${id}>`
    )
    .join("\n")}

━━━━━━━━━━━━━━━━━━━━

Discutez maintenant entre vous.

Les joueurs connaissant le mot doivent donner des indices **sans être trop évidents**.

L'Imposteur doit essayer de comprendre le mot sans se faire repérer.

Quand vous êtes prêts, l'hôte peut lancer le vote.`
        )
        .setFooter({
            text:
                "The Legacy • Imposteur"
        })
        .setTimestamp();
}

// ======================================================
// DISCUSSION BUTTON
// ======================================================

function discussionButtons(
    lobby
) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `imp_vote_start_${lobby.id}`
                    )
                    .setLabel(
                        "Passer au vote"
                    )
                    .setEmoji(
                        "🗳️"
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `imp_cancel_${lobby.id}`
                    )
                    .setLabel(
                        "Arrêter la partie"
                    )
                    .setEmoji(
                        "❌"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    )
            )
    ];
}

// ======================================================
// VOTE EMBED
// ======================================================

function buildVoteEmbed(
    lobby
) {
    const voteCounts = {};

    for (
        const playerId
        of lobby.players
    ) {
        voteCounts[
            playerId
        ] =
            0;
    }

    for (
        const targetId
        of Object.values(
            lobby.votes ||
            {}
        )
    ) {
        voteCounts[
            targetId
        ] =
            (
                voteCounts[
                    targetId
                ] ||
                0
            ) + 1;
    }

    const ranking =
        Object.entries(
            voteCounts
        )
            .sort(
                (
                    [, a],
                    [, b]
                ) =>
                    b - a
            )
            .map(
                (
                    [
                        id,
                        count
                    ]
                ) =>
                    `<@${id}> — **${count} vote(s)**`
            )
            .join(
                "\n"
            );

    return new EmbedBuilder()
        .setColor(
            COLOR
        )
        .setTitle(
            "🗳️ Vote — Qui est l'Imposteur ?"
        )
        .setDescription(
`Chaque joueur doit voter pour la personne qu'il pense être l'Imposteur.

### 📊 Votes actuels

${ranking}

### 🗳️ Participation

**${Object.keys(lobby.votes || {}).length}/${lobby.players.length}** joueur(s) ont voté.

-# Ton vote peut être modifié tant que tout le monde n'a pas voté.`
        )
        .setFooter({
            text:
                "The Legacy • Imposteur"
        })
        .setTimestamp();
}

// ======================================================
// VOTE MENU
// ======================================================

function voteMenu(
    lobby
) {
    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `imp_vote_${lobby.id}`
            )
            .setPlaceholder(
                "🕵️ Choisir l'Imposteur"
            )
            .setMinValues(
                1
            )
            .setMaxValues(
                1
            );

    for (
        const playerId
        of lobby.players
    ) {
        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(
                    `Joueur ${lobby.players.indexOf(playerId) + 1}`
                )
                .setValue(
                    playerId
                )
                .setDescription(
                    `Voter pour ce joueur`
                )
        );
    }

    return [
        new ActionRowBuilder()
            .addComponents(
                menu
            )
    ];
}

// ======================================================
// FIN DE PARTIE
// ======================================================

async function finishGame(
    interaction,
    lobby
) {
    const counts = {};

    for (
        const playerId
        of lobby.players
    ) {
        counts[
            playerId
        ] =
            0;
    }

    for (
        const targetId
        of Object.values(
            lobby.votes
        )
    ) {
        counts[
            targetId
        ] =
            (
                counts[
                    targetId
                ] ||
                0
            ) + 1;
    }

    const sorted =
        Object.entries(
            counts
        ).sort(
            (
                [, a],
                [, b]
            ) =>
                b - a
        );

    const highest =
        sorted[
            0
        ]?.[
            1
        ] ||
        0;

    const top =
        sorted.filter(
            (
                [, count]
            ) =>
                count ===
                highest
        );

    let eliminatedId =
        null;

    let tie =
        false;

    if (
        top.length ===
        1
    ) {
        eliminatedId =
            top[
                0
            ][
                0
            ];
    } else {
        tie =
            true;
    }

    const impostorFound =
        !tie &&
        eliminatedId ===
        lobby.impostorId;

    let resultText;

    if (
        tie
    ) {
        resultText =
`## 🤝 Égalité

Aucun joueur n'a obtenu suffisamment de votes pour être désigné seul.

L'Imposteur survit à cette manche.`;

    } else if (
        impostorFound
    ) {
        resultText =
`## ✅ IMPOSTEUR TROUVÉ

<@${lobby.impostorId}> était bien l'Imposteur.

Les autres joueurs remportent la partie.`;

    } else {
        resultText =
`## 😈 VICTOIRE DE L'IMPOSTEUR

Le groupe a accusé <@${eliminatedId}>...

Mais l'Imposteur était en réalité <@${lobby.impostorId}>.`;
    }

    const voteResults =
        sorted
            .map(
                (
                    [
                        playerId,
                        count
                    ]
                ) =>
                    `<@${playerId}> — **${count} vote(s)**`
            )
            .join(
                "\n"
            );

    const category =
        WORD_BANK[
            lobby.selectedCategory
        ];

    lobby.phase =
        "finished";

    lobby.finishedAt =
        Date.now();

    await interaction.message.edit({
        embeds: [
            new EmbedBuilder()
                .setColor(
                    impostorFound
                        ? SUCCESS
                        : ERROR
                )
                .setTitle(
                    "🕵️ Résultat de la partie"
                )
                .setDescription(
`${resultText}

━━━━━━━━━━━━━━━━━━━━

### 🎭 Révélation

**Imposteur :** <@${lobby.impostorId}>

${category.emoji} **Catégorie :**
${category.name}

🔐 **Mot secret :**
## ${lobby.word}

### 🗳️ Votes

${voteResults}`
                )
                .setFooter({
                    text:
                        "The Legacy • Imposteur"
                })
                .setTimestamp()
        ],

        components:
            []
    });

    deleteLobby(
        lobby.id
    );
}

// ======================================================
// START GAME
// ======================================================

async function startGame(
    interaction,
    lobby
) {
    if (
        lobby.players.length <
        MIN_PLAYERS
    ) {
        return interaction.reply({
            content:
                `❌ Il faut au minimum **${MIN_PLAYERS} joueurs** pour démarrer.`,

            flags:
                MessageFlags.Ephemeral
        });
    }

    const result =
        pickWord(
            lobby.category
        );

    lobby.selectedCategory =
        result.categoryKey;

    lobby.word =
        result.word;

    lobby.impostorId =
        randomItem(
            lobby.players
        );

    lobby.phase =
        "playing";

    lobby.startedAt =
        Date.now();

    // ==================================================
    // TEST DMs
    // ==================================================

    const failedDMs =
        [];

    for (
        const playerId
        of lobby.players
    ) {
        const user =
            await interaction.client.users
                .fetch(
                    playerId
                )
                .catch(
                    () => null
                );

        if (
            !user
        ) {
            failedDMs.push(
                playerId
            );

            continue;
        }

        const embed =
            playerId ===
                lobby.impostorId
                ? new EmbedBuilder()
                    .setColor(
                        ERROR
                    )
                    .setTitle(
                        "🕵️ Tu es l'Imposteur"
                    )
                    .setDescription(
`Tu ne connais **pas le mot secret**.

### ${result.category.emoji} Catégorie
**${result.category.name}**

Ton objectif :

- écoute les indices des autres ;
- fais semblant de connaître le mot ;
- essaie de le deviner ;
- surtout, ne te fais pas repérer.

Bonne chance.`
                    )
                    .setFooter({
                        text:
                            "The Legacy • Imposteur"
                    })

                : new EmbedBuilder()
                    .setColor(
                        SUCCESS
                    )
                    .setTitle(
                        "✅ Tu n'es pas l'Imposteur"
                    )
                    .setDescription(
`### ${result.category.emoji} Catégorie
**${result.category.name}**

### 🔐 Mot secret
## ${result.word}

Donne des indices suffisamment utiles pour prouver que tu connais le mot...

mais pas trop évidents, sinon l'Imposteur pourrait le comprendre.`
                    )
                    .setFooter({
                        text:
                            "The Legacy • Imposteur"
                    });

        const sent =
            await user.send({
                embeds: [
                    embed
                ]
            }).then(
                () => true
            ).catch(
                () => false
            );

        if (
            !sent
        ) {
            failedDMs.push(
                playerId
            );
        }
    }

    // ==================================================
    // DM FAILED
    // ==================================================

    if (
        failedDMs.length >
        0
    ) {
        lobby.phase =
            "lobby";

        lobby.word =
            null;

        lobby.impostorId =
            null;

        lobby.selectedCategory =
            null;

        updateLobby(
            lobby
        );

        return interaction.reply({
            content:
`❌ Impossible de démarrer la partie.

Les MP de certains joueurs sont fermés :

${failedDMs
    .map(
        id =>
            `• <@${id}>`
    )
    .join("\n")}

Ils doivent autoriser les messages privés du serveur avant de recommencer.`,

            flags:
                MessageFlags.Ephemeral
        });
    }

    updateLobby(
        lobby
    );

    await interaction.update({
        content:
            "🕵️ **Les rôles viennent d'être envoyés en MP !**",

        embeds: [
            buildDiscussionEmbed(
                lobby
            )
        ],

        components:
            discussionButtons(
                lobby
            )
    });
}

// ======================================================
// COMMAND
// ======================================================

module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                "imposteur"
            )
            .setDescription(
                "Lancer une partie d'Imposteur"
            )

            .addSubcommand(
                subcommand =>
                    subcommand
                        .setName(
                            "lancer"
                        )
                        .setDescription(
                            "Créer un lobby Imposteur"
                        )
                        .addStringOption(
                            option => {
                                option
                                    .setName(
                                        "categorie"
                                    )
                                    .setDescription(
                                        "Catégorie du mot — aléatoire si non choisie"
                                    )
                                    .setRequired(
                                        false
                                    );

                                for (
                                    const choice
                                    of categoryOptions()
                                ) {
                                    option.addChoices(
                                        choice
                                    );
                                }

                                return option;
                            }
                        )
            ),

    // ==================================================
    // EXECUTE
    // ==================================================

    async execute(
        interaction
    ) {
        const subcommand =
            interaction.options
                .getSubcommand();

        if (
            subcommand !==
            "lancer"
        ) {
            return;
        }

        const category =
            interaction.options
                .getString(
                    "categorie"
                ) ||
            null;

        const id =
            createId();

        const lobby = {
            id,

            guildId:
                interaction.guild.id,

            channelId:
                interaction.channel.id,

            messageId:
                null,

            hostId:
                interaction.user.id,

            category,

            selectedCategory:
                null,

            word:
                null,

            impostorId:
                null,

            players: [
                interaction.user.id
            ],

            votes:
                {},

            phase:
                "lobby",

            createdAt:
                Date.now(),

            startedAt:
                null,

            finishedAt:
                null
        };

        const message =
            await interaction.reply({
                content:
                    "🕵️ **Une nouvelle partie d'Imposteur se prépare !**",

                embeds: [
                    buildLobbyEmbed(
                        lobby
                    )
                ],

                components:
                    lobbyButtons(
                        lobby
                    ),

                fetchReply:
                    true
            });

        lobby.messageId =
            message.id;

        const data =
            loadData();

        data.lobbies[
            lobby.id
        ] =
            lobby;

        saveData(
            data
        );
    },

    // ==================================================
    // HANDLE BUTTON
    // ==================================================

    async handleButton(
        interaction
    ) {
        // ==================================================
        // JOIN
        // ==================================================

        if (
            interaction.customId
                .startsWith(
                    "imp_join_"
                )
        ) {
            const id =
                interaction.customId
                    .replace(
                        "imp_join_",
                        ""
                    );

            const lobby =
                getLobby(
                    id
                );

            if (
                !lobby ||
                lobby.phase !==
                "lobby"
            ) {
                return true;
            }

            if (
                lobby.players.includes(
                    interaction.user.id
                )
            ) {
                await interaction.reply({
                    content:
                        "⚠️ Tu participes déjà à cette partie.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            lobby.players.push(
                interaction.user.id
            );

            updateLobby(
                lobby
            );

            await interaction.update({
                embeds: [
                    buildLobbyEmbed(
                        lobby
                    )
                ],

                components:
                    lobbyButtons(
                        lobby
                    )
            });

            return true;
        }

        // ==================================================
        // LEAVE
        // ==================================================

        if (
            interaction.customId
                .startsWith(
                    "imp_leave_"
                )
        ) {
            const id =
                interaction.customId
                    .replace(
                        "imp_leave_",
                        ""
                    );

            const lobby =
                getLobby(
                    id
                );

            if (
                !lobby ||
                lobby.phase !==
                "lobby"
            ) {
                return true;
            }

            if (
                !lobby.players.includes(
                    interaction.user.id
                )
            ) {
                await interaction.reply({
                    content:
                        "❌ Tu ne participes pas à cette partie.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            if (
                interaction.user.id ===
                lobby.hostId
            ) {
                await interaction.reply({
                    content:
                        "❌ L'hôte ne peut pas quitter. Utilise **Annuler**.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            lobby.players =
                lobby.players.filter(
                    id =>
                        id !==
                        interaction.user.id
                );

            updateLobby(
                lobby
            );

            await interaction.update({
                embeds: [
                    buildLobbyEmbed(
                        lobby
                    )
                ],

                components:
                    lobbyButtons(
                        lobby
                    )
            });

            return true;
        }

        // ==================================================
        // START
        // ==================================================

        if (
            interaction.customId
                .startsWith(
                    "imp_start_"
                )
        ) {
            const id =
                interaction.customId
                    .replace(
                        "imp_start_",
                        ""
                    );

            const lobby =
                getLobby(
                    id
                );

            if (
                !lobby ||
                lobby.phase !==
                "lobby"
            ) {
                return true;
            }

            if (
                interaction.user.id !==
                lobby.hostId
            ) {
                await interaction.reply({
                    content:
                        "❌ Seul l'hôte peut démarrer la partie.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            await startGame(
                interaction,
                lobby
            );

            return true;
        }

        // ==================================================
        // CANCEL
        // ==================================================

        if (
            interaction.customId
                .startsWith(
                    "imp_cancel_"
                )
        ) {
            const id =
                interaction.customId
                    .replace(
                        "imp_cancel_",
                        ""
                    );

            const lobby =
                getLobby(
                    id
                );

            if (
                !lobby
            ) {
                return true;
            }

            if (
                interaction.user.id !==
                lobby.hostId
            ) {
                await interaction.reply({
                    content:
                        "❌ Seul l'hôte peut arrêter cette partie.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            deleteLobby(
                lobby.id
            );

            await interaction.update({
                content:
                    "❌ **La partie d'Imposteur a été annulée.**",

                embeds:
                    [],

                components:
                    []
            });

            return true;
        }

        // ==================================================
        // START VOTE
        // ==================================================

        if (
            interaction.customId
                .startsWith(
                    "imp_vote_start_"
                )
        ) {
            const id =
                interaction.customId
                    .replace(
                        "imp_vote_start_",
                        ""
                    );

            const lobby =
                getLobby(
                    id
                );

            if (
                !lobby ||
                lobby.phase !==
                "playing"
            ) {
                return true;
            }

            if (
                interaction.user.id !==
                lobby.hostId
            ) {
                await interaction.reply({
                    content:
                        "❌ Seul l'hôte peut lancer le vote.",

                    flags:
                        MessageFlags.Ephemeral
                });

                return true;
            }

            lobby.phase =
                "voting";

            lobby.votes =
                {};

            updateLobby(
                lobby
            );

            await interaction.update({
                embeds: [
                    buildVoteEmbed(
                        lobby
                    )
                ],

                components:
                    voteMenu(
                        lobby
                    )
            });

            return true;
        }

        return false;
    },

    // ==================================================
    // HANDLE SELECT
    // ==================================================

    async handleSelect(
        interaction
    ) {
        if (
            !interaction.isStringSelectMenu() ||
            !interaction.customId
                .startsWith(
                    "imp_vote_"
                )
        ) {
            return false;
        }

        const id =
            interaction.customId
                .replace(
                    "imp_vote_",
                    ""
                );

        const lobby =
            getLobby(
                id
            );

        if (
            !lobby ||
            lobby.phase !==
            "voting"
        ) {
            return true;
        }

        if (
            !lobby.players.includes(
                interaction.user.id
            )
        ) {
            await interaction.reply({
                content:
                    "❌ Tu ne participes pas à cette partie.",

                flags:
                    MessageFlags.Ephemeral
            });

            return true;
        }

        const targetId =
            interaction.values[
                0
            ];

        if (
            !lobby.players.includes(
                targetId
            )
        ) {
            return true;
        }

        lobby.votes[
            interaction.user.id
        ] =
            targetId;

        updateLobby(
            lobby
        );

        await interaction.update({
            embeds: [
                buildVoteEmbed(
                    lobby
                )
            ],

            components:
                voteMenu(
                    lobby
                )
        });

        if (
            Object.keys(
                lobby.votes
            ).length >=
            lobby.players.length
        ) {
            setTimeout(
                async () => {
                    const latest =
                        getLobby(
                            lobby.id
                        );

                    if (
                        !latest ||
                        latest.phase !==
                        "voting"
                    ) {
                        return;
                    }

                    await finishGame(
                        interaction,
                        latest
                    ).catch(
                        error => {
                            console.error(
                                "❌ Fin Imposteur :",
                                error
                            );
                        }
                    );

                },
                1200
            );
        }

        return true;
    },

    // ==================================================
    // SYSTEM
    // ==================================================

    imposteurSystem: {
        WORD_BANK,
        getLobby
    }
};