// Tous les messages du bot : style « licence Hunter », vert et or.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const cfg = require('./config');

const FOOTER = { text: 'Association des Hunters • Bureau des licences' };

const card = color => new EmbedBuilder().setColor(color ?? cfg.colors.hunter).setFooter(FOOTER);
const roleDef = key => cfg.roles.find(r => r.key === key);

// La charte tient en trois cartes : règlement du serveur, règles Discord, sanctions et signature.
function charter() {
    const server = card(cfg.colors.gold)
        .setTitle('📜 Charte du Hunter — Règlement de l’Association')
        .setDescription('Tout Hunter, du Candidat au Président, s’engage à respecter cette charte. La lire en entier fait partie de l’examen.')
        .addFields(
            { name: '① Le respect avant le Nen', value: '• Aucune insulte, menace, moquerie blessante ni harcèlement, en public comme en MP.\n• Aucune discrimination : origine, religion, genre, orientation, handicap, physique…\n• Pas de provocation ni d’embrouille volontaire. Un désaccord se règle calmement ou en ticket.' },
            { name: '② Les salons ont chacun leur rôle', value: '• Écris dans le bon salon : discussion à la taverne, images à la galerie, recherche de partenaires au bon endroit.\n• Pas de spam, de flood, de messages en majuscules ni de mentions inutiles.\n• `@everyone`, `@here` et les rôles staff ne se mentionnent pas sans raison sérieuse.' },
            { name: '③ Pas de pièges sur le territoire', value: '• Aucun contenu NSFW, gore, choquant ou illégal, même en lien ou caché en spoiler.\n• Aucune publicité (serveur, réseau, vente) sans accord de la Fondation, MP compris.\n• Aucun lien douteux, faux cadeau, arnaque ou fichier suspect.' },
            { name: '④ Les vocaux sont des lieux de chasse', value: '• Pas de cris, de micro saturé, de soundboard en boucle ni de bruit volontaire.\n• Pas d’enregistrement d’un vocal sans l’accord de toutes les personnes présentes.\n• Respecte ceux qui parlent et ceux qui veulent juste écouter.' },
            { name: '⑤ Identité et vie privée', value: '• Pseudo, avatar et statut corrects : rien d’insultant, de sexuel ou d’imitation d’un membre du staff.\n• Ne partage jamais les infos personnelles de quelqu’un (nom, adresse, photos, numéro…).\n• Un compte par personne : les doubles comptes pour contourner une sanction sont interdits.' },
            { name: '⑥ Le staff et les tickets', value: '• Le staff fait respecter la charte ; ses décisions se discutent en ticket, pas en public.\n• Un problème avec un membre ? Ouvre un ticket **Report** avec des preuves (captures, liens de messages).\n• Les fausses accusations et les abus de tickets sont sanctionnés.' }
        );

    const discord = card(cfg.colors.hunter)
        .setTitle('🌐 Les règles de Discord s’appliquent aussi')
        .setDescription('L’Association est un serveur indépendant, mais tout le monde reste soumis aux règles de Discord. En cas de doute, ce sont elles qui priment.')
        .addFields(
            { name: 'Âge minimum', value: 'Il faut avoir l’âge minimum fixé par Discord dans ton pays (au moins **13 ans**, **15 ans** dans certains pays). Un compte trop jeune peut être signalé à Discord.' },
            { name: 'Ce que Discord interdit partout', value: '• Harcèlement, menaces, discours haineux, incitation à la violence ou à l’automutilation.\n• Contenu sexuel impliquant des mineurs, partage d’images intimes sans consentement.\n• Arnaques, piratage, vol de comptes, vente de comptes ou de Nitro, triche organisée.\n• Spam, raids, faux comptes et selfbots.' },
            { name: 'Textes officiels', value: '[Conditions d’utilisation](https://discord.com/terms) • [Règles de la communauté](https://discord.com/guidelines) • [Centre de sécurité](https://discord.com/safety)' },
            { name: 'Protège ton compte', value: 'Active l’A2F, ne donne jamais ton mot de passe ni ton token, et méfie-toi des « Nitro gratuit » et des faux liens Steam. Le staff ne te demandera **jamais** tes identifiants.' }
        );

    const sanctions = card(cfg.colors.alert)
        .setTitle('⚖️ Sanctions et signature')
        .addFields(
            { name: 'Échelle des sanctions', value: '1. Avertissement oral\n2. Exclusion temporaire (mute de quelques minutes à quelques jours)\n3. Rétrogradation de grade\n4. Expulsion du serveur\n5. Bannissement définitif' },
            { name: 'À savoir', value: '• Le staff adapte la sanction à la gravité et aux récidives : une faute grave peut mener directement au ban.\n• Toute contestation se fait calmement dans un ticket **Contacter la Fondation**.\n• La charte peut évoluer ; les changements sont publiés dans ⚖️・annonces.' },
            { name: '✍️ Signer la charte', value: 'En appuyant sur **Je signe la charte**, tu confirmes l’avoir lue et acceptée, ainsi que les règles de Discord. Tu deviens **I Non-chasseur** : le serveur s’ouvre à toi, et tu peux postuler pour rejoindre la famille dans 📝・candidature.' }
        );

    return {
        embeds: [server, discord, sanctions],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hunter:accept').setLabel('Je signe la charte').setEmoji('✍️').setStyle(ButtonStyle.Success)
        )],
        allowedMentions: { parse: [] }
    };
}

function gradesInfo(ids) {
    const mention = key => ids.roles[key] ? `<@&${ids.roles[key]}>` : roleDef(key).name;
    const ladder = [...cfg.ladder].reverse().map(key => mention(key)).join('\n');
    const association = cfg.staffKeys.map(key => mention(key)).join('\n');
    return {
        embeds: [card(cfg.colors.gold)
            .setTitle('🎖️ Les grades de l’Association')
            .setDescription('On commence tous **Candidat** en bas de l’échelle. L’activité et l’implication font grimper les étoiles.')
            .addFields(
                { name: '🏛️ Direction', value: association, inline: true },
                { name: '📈 Échelle des Hunters (du plus haut au plus bas)', value: ladder, inline: true },
                { name: '🧭 Hors famille', value: `${mention('visitor')} — a signé la charte, accès à la partie publique.` },
                { name: 'Le parcours', value: '🔓 I Non-chasseur → 📝 candidature écrite → ⏳ entretien oral → 🎟️ Candidat = **membre test** → 🌱 Novice = **membre de la famille** → puis les étoiles.' }
            )],
        allowedMentions: { parse: [] }
    };
}

const conditionsText = () => cfg.family.conditions.map(c => '▸ ' + c).join('\n');

// 🗃️・recrutement : explique le parcours et renvoie vers le salon de candidature.
function recruitInfo(ids) {
    const ch = key => ids.channels[key] ? `<#${ids.channels[key]}>` : key;
    return {
        embeds: [card(cfg.colors.gold)
            .setTitle('🗃️ Comment rejoindre la famille ?')
            .setDescription(`${cfg.family.pitch}\n\n**Conditions**\n${conditionsText()}`)
            .addFields(
                { name: '① Signe le règlement', value: `Dans ${ch('charter')}, appuie sur **Je signe la charte** : tu deviens I Non-chasseur et le serveur s’ouvre.` },
                { name: '② Dépose ta candidature', value: `Dans ${ch('recruitPanel')}, appuie sur **Postuler**. Le bot t’envoie ${cfg.applicationQuestions.length} questions en **message privé** : garde tes MP ouverts.` },
                { name: '③ Correction de l’écrit', value: 'Un Examinateur lit ton dossier. Accepté : tu reçois le rôle ⏳ Attente entretien. Refusé : tu es prévenu en MP.' },
                { name: '④ Entretien oral', value: `Indique tes disponibilités dans ${ch('availability')}, puis rejoins ${ch('interviewWaiting')}. Un Examinateur viendra te chercher dans un bureau.` },
                { name: '⑤ Période de test', value: 'Entretien réussi : tu deviens 🎟️ Candidat (membre test). Le staff te passe ensuite 🌱 Novice, membre de la famille.' }
            )],
        components: ids.channels.recruitPanel ? [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Aller postuler').setEmoji('📝').setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${cfg.guildId}/${ids.channels.recruitPanel}`)
        )] : [],
        allowedMentions: { parse: [] }
    };
}

function recruitPanel(open) {
    return {
        embeds: [card(open ? cfg.colors.hunter : cfg.colors.alert)
            .setTitle(open ? '📝 Candidature famille — ouverte' : '📝 Candidature famille — fermée')
            .setDescription(`${cfg.family.pitch}\n\n**Conditions**\n${conditionsText()}\n\n` +
                (open
                    ? `Appuie sur **Postuler** : ${cfg.applicationQuestions.length} questions t’arrivent en message privé, réponds-y une par une. Écris \`annuler\` pour arrêter.`
                    : 'Les candidatures sont fermées pour le moment. Surveille ⚖️・annonces pour la réouverture.'))],
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hunter:apply').setLabel('Postuler').setEmoji('📝').setStyle(ButtonStyle.Success).setDisabled(!open)
        )],
        allowedMentions: { parse: [] }
    };
}

function interviewPanel() {
    const btn = (id, label, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId('hunter:rec:' + id).setLabel(label).setStyle(style);
    return {
        embeds: [card(cfg.colors.nen)
            .setTitle('📋 ESPACE RECRUTEUR')
            .setDescription('**Chaque candidature mérite un suivi clair et une décision expliquée.**')
            .addFields(
                { name: '01 · Examiner le dossier', value: 'Dans 📋・cd-en-attente : **Accepter** donne ⏳ Attente entretien, **Refuser** donne 🚫 Membre refusé. **DDS** interroge le Conseil sur les sanctions. **Ouvrir un ticket** crée un échange privé avec le candidat.' },
                { name: '02 · Faire passer l’entretien', value: 'Rejoins un 🔐 bureau, puis **Déplacer vers soi** pour choisir un candidat en attente. **Questions** affiche le guide, **Voir candidature** les réponses écrites.' },
                { name: '03 · Décider et transmettre', value: 'Après l’oral : **Accepter** donne 🎟️ Candidat (membre test), **Refuser** donne 🚫 Membre refusé. **Attente** renvoie le candidat dans la salle d’attente. Fais ensuite le **Compte rendu**.' }
            )],
        components: [
            new ActionRowBuilder().addComponents(btn('oralaccept', 'Accepter', ButtonStyle.Success), btn('oralrefuse', 'Refuser', ButtonStyle.Danger), btn('wait', 'Attente')),
            new ActionRowBuilder().addComponents(btn('bring', 'Déplacer vers soi', ButtonStyle.Primary), btn('cr', 'Compte rendu'), btn('view', 'Voir candidature'), btn('questions', 'Questions'))
        ],
        allowedMentions: { parse: [] }
    };
}

function boostsInfo() {
    return {
        embeds: [card(0xF47FFF)
            .setTitle('🔮 Les boosteurs de l’Association')
            .setDescription('Booster le serveur, c’est donner du Nen à toute la famille 💜\n\nChaque boost est annoncé ici. Merci à tous ceux qui soutiennent l’Association !')],
        allowedMentions: { parse: [] }
    };
}

function levelsInfo() {
    return {
        embeds: [card(cfg.colors.gold)
            .setTitle('🌟 Niveaux')
            .setDescription('Chaque message te rapporte de l’XP (une fois par minute, pour éviter le spam). Les passages de niveau sont annoncés ici.\n\n`/niveau` affiche ta progression • `/classement` le top 10 du serveur.')],
        allowedMentions: { parse: [] }
    };
}

function guide(ids) {
    const ch = key => ids.channels[key] ? `<#${ids.channels[key]}>` : key;
    return {
        embeds: [card(cfg.colors.gold)
            .setTitle('📖 Guide du Hunter — vivre dans la famille')
            .setDescription('Tu as réussi l’examen, bienvenue dans la Guilde ! Voici comment fonctionne la famille, en jeu et sur Discord.')
            .addFields(
                { name: '🎮 En jeu (School RP)', value: '• Tu représentes la famille : ton comportement en RP compte autant qu’ici.\n• Pas de freekill, de troll ni de provocation gratuite envers les autres familles.\n• Les conflits entre familles se règlent par le staff, jamais en jeu ni en public.' },
                { name: '🎭 Sessions RP', value: `Les sessions de la famille sont annoncées dans ${ch('rpSessions')}. Réagis pour indiquer ta présence et sois à l’heure.` },
                { name: '📣 Ordres de mission', value: `Les consignes de la famille sont publiées dans ${ch('missions')}. Lis-les : elles comptent pour ta progression.` },
                { name: '📆 Absences', value: `Absent plusieurs jours ? Préviens dans ${ch('absences')} avec la date de retour. Une absence prévenue ne pénalise jamais.` },
                { name: '⭐ Monter en grade', value: 'L’activité en jeu, la présence aux sessions, l’entraide et l’attitude font gagner des étoiles. Le staff fait le point régulièrement ; `/licence` montre où tu en es.' }
            )],
        allowedMentions: { parse: [] }
    };
}

function ticketPanel() {
    const menu = new StringSelectMenuBuilder()
        .setCustomId('hunter:ticket')
        .setPlaceholder('Choisis le guichet…')
        .addOptions(cfg.ticketTypes.map(t => ({ label: t.label, value: t.key, emoji: t.emoji, description: t.description })));
    return {
        embeds: [card()
            .setTitle('🎫 Bureau d’accueil de l’Association')
            .setDescription('Choisis le bon guichet dans le menu ci-dessous. Un salon privé s’ouvre avec l’équipe.\n\n' +
                cfg.ticketTypes.map(t => `${t.emoji} **${t.label}** — ${t.description}`).join('\n') +
                '\n\n-# Un ticket ouvert par guichet. Ne partage jamais de mot de passe.')],
        components: [new ActionRowBuilder().addComponents(menu)],
        allowedMentions: { parse: [] }
    };
}

// `invite` : { inviterId, uses } ou { vanity: true } ou null si inconnu.
function welcome(member, count, invite) {
    const by = invite?.inviterId ? `<@${invite.inviterId}> (**${invite.uses}** invitation${invite.uses > 1 ? 's' : ''})`
        : invite?.vanity ? 'le lien personnalisé du serveur' : 'une invitation inconnue';
    return {
        content: `${member}`,
        embeds: [card()
            .setAuthor({ name: 'Nouveau Hunter en vue', iconURL: member.displayAvatarURL() })
            .setDescription(`Bienvenue **${member.displayName}** à l’Association des Hunters !\nSigne le règlement pour entrer, puis postule pour rejoindre la famille School RP.`)
            .setThumbnail(member.displayAvatarURL({ size: 256 }))
            .addFields({ name: 'Invité par', value: by, inline: true }, { name: 'Membre n°', value: String(count), inline: true })],
        allowedMentions: { users: [member.id] }
    };
}

function progressBar(index) {
    const total = cfg.ladder.length;
    return '▰'.repeat(index + 1) + '▱'.repeat(total - index - 1) + `  ${index + 1}/${total}`;
}

function licence(member, ids) {
    const key = cfg.ladder.slice().reverse().find(k => member.roles.cache.has(ids.roles[k]));
    const staff = cfg.staffKeys.find(k => member.roles.cache.has(ids.roles[k]));
    const index = key ? cfg.ladder.indexOf(key) : -1;
    const embed = card(staff ? cfg.colors.nen : cfg.colors.gold)
        .setTitle('🪪 Licence Hunter')
        .setThumbnail(member.displayAvatarURL({ size: 256 }))
        .addFields(
            { name: 'Titulaire', value: `${member}`, inline: true },
            { name: 'Grade', value: key ? roleDef(key).name : 'Aucune licence', inline: true },
            { name: 'Fonction', value: staff ? roleDef(staff).name : '—', inline: true },
            { name: 'Progression', value: index >= 0 ? progressBar(index) : 'Signe la charte pour commencer.' },
            { name: 'Arrivé le', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : '—', inline: true }
        );
    return { embeds: [embed], allowedMentions: { parse: [] } };
}

module.exports = { card, roleDef, charter, gradesInfo, recruitInfo, recruitPanel, interviewPanel, boostsInfo, levelsInfo, guide, ticketPanel, welcome, licence };
