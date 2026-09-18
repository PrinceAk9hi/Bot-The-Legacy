// Configuration fournie pour la migration progressive vers Soul Society.
// Les rôles du catalogue ne donnent aucun accès à eux seuls.
// Conserver les règles métier existantes jusqu'à confirmation de leurs équivalences.

const IDENTITY = Object.freeze({
    guildId: "1080943923691782154",
    guildName: "𝖲oulSociety🏯🌸",
    botName: "Seireitei Gestion",
    embedName: "Soul Society"
});

const COLORS = Object.freeze({
    primary: 0xF8BBD0,
    secondary: 0xFF1493,
    sanction: 0xFF1744,
    success: 0x57F287,
    error: 0xFFB3B3
});

const EMOJIS = Object.freeze({
    logo: "<:Soul_Society:1548783936010977380>",
    loading: "<a:Loading:1548784199782244382>",
    success: "✅",
    refusal: "❌",
    ticket: "<:Ticket:1501602282171531435>",
    warning: "⚠️",
    direction: "<:crown:1548785045047607416>",
    announcement: "<a:speaker:1548785378276810844>",
    roblox: "<:roblox:1550573304258236426>",
    certification: "<:certification:1550573424080977930>",
    rankUp: "<:arrow_up:1548785968499261621>",
    rankDown: "<:arrow_down:1548786185189466132>",
    derank: "<a:PepeExit:1548786617685381234>"
});

const ROLES = Object.freeze({
    interviewWaiting: "1468703799995666636",
    member: "1513698444588482650",
    test: "1468701337243090954",
    aspirant: "1468701415475118282",
    advanced: "1495439502637006949",
    senior: "1495439710619963512",
    veteran: "1495439941621121280",
    distinguished: "1540851347459412108",
    elite: "1540851378447196231",
    prestigious: "1540851419618218064",
    ambassador: "1540851401968721980",
    legendary: "1540851580243546263",
    referent: "1497669939882885182",
    founderMalach: "1471546243653304392",
    founderMrLarbi: "1504782476319526932",
    rightHand: "1527996778727870496",
    serverManager: "1471583642395344998",
    recruitmentManagement: "1473356789453029376",
    animationManagement: "1477056805103206450",
    roleplayManagement: "1505974229118750851",
    ticketManagement: "1471557970079912047",
    staffReferent: "1471889647570260030",
    formerMembers: "1490049554538823861",
    vipVisitor: "1493546824626077817",
    visitor: "1468701262102134891"
});

const SECURITY = Object.freeze({
    enabled: true,
    bypassRoleIds: Object.freeze([
        "1469803353964810250", // all perm
        "1522357970778718249", // 😗
        "1497660642436448266", // Soul Society🌸🏯
        "1471546243653304392", // Fondateur Suprême malach
        "1504782476319526932"  // Fondateur Suprême Mr Larbi
    ]),
    bypassUserIds: Object.freeze(["547192186547077130"]), // Aven
    protectedUserIds: Object.freeze([
        "1376211193433428069", // malach
        "1273044755504169083", // Zerka
        "1217728350886432841", // Mr Larbi
        "1505573613045153873", // moreseument
        "957735260668448939",  // Miza
        "883087428016046150"   // Protection préexistante conservée
    ]),
    derankProtectedUserIds: Object.freeze(["547192186547077130"])
});

const CHANNELS = Object.freeze({
    general: "1471562633802023115",
    tagReminder: "1471562633802023115",
    ticketPanel: "1468699265671889110",
    announcements: "1479760394300948531",
    rankups: "1540832394217529447",
    sanctions: "1478798666470002929",
    logs: "1506723822840315957",
    commandLogs: "1468699162890600697",
    ticketLogs: "1471556441218224209",
    recruitmentLogs: "1468699236475474032",
    candidatures: "1468699202027655179",
    forms: "1550247801437290607",
    recruitmentWaiting: "1468699345443356885",
    ranking: "1517874710350921830",
    interviewRooms: Object.freeze(["1468699347129598053","1471560657370615879","1471560687405764871","1471560726660255765","1471560766250422556"])
});

const ROBLOX = Object.freeze({
    groupId: 925445053,
    groupName: "Soul Society",
    groupUrl: "https://www.roblox.com/share/g/925445053",
    // Rôles publics vérifiés : Membre (rang 5) et badge (rang 6), dès Membre Test.
    rankMappings: Object.freeze(Object.fromEntries(["novice", "confirme", "expert", "senior", "veteran", "distingue", "elite", "prestigieux", "ambassadeur", "legendaire", "referent"].map(key => [key, 6]))),
    memberRoleIds: Object.freeze(["640063029", "714651144"])
});

module.exports = { IDENTITY, COLORS, EMOJIS, ROLES, SECURITY, CHANNELS, ROBLOX };
