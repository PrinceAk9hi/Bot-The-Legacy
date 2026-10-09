const {PermissionFlagsBits:P,ChannelType:T,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle}=require('discord.js');
const roles=[
 ['creator','Creator',[P.Administrator]],['admin','Administrateur',[P.Administrator]],
 ['senior','Modérateur Senior',[P.ViewAuditLog,P.KickMembers,P.BanMembers,P.ModerateMembers,P.ManageMessages,P.MoveMembers,P.MuteMembers,P.DeafenMembers]],
 ['plus','Modérateur +',[P.KickMembers,P.ModerateMembers,P.ManageMessages,P.MoveMembers]],
 ['confirmed','Modérateur confirmé',[P.ModerateMembers,P.ManageMessages,P.MoveMembers]],
 ['test','Modérateur test',[P.ManageMessages]],['member','Membre',[]]
];
const staffKeys=roles.map(r=>r[0]).filter(k=>k!=='member');
const categories=[['welcome','ACCUEIL'],['community','COMMUNAUTÉ'],['voice','SALONS VOCAUX'],['help','ASSISTANCE'],['staff','ÉQUIPE'],['stats','STATISTIQUES']];
const channels=[
 ['rules','règlement','welcome',T.GuildText],['tos','conditions-discord','welcome',T.GuildText],
 ['arrivals','arrivées','welcome',T.GuildText],['departures','départs','welcome',T.GuildText],
 ['chat','chat','community',T.GuildText],['media','médias','community',T.GuildText],['commands','commandes','community',T.GuildText],['suggestions','suggestions','community',T.GuildText],
 ...Array.from({length:5},(_,i)=>['voice'+(i+1),'Vocal '+(i+1),'voice',T.GuildVoice]),
 ['createVoice','➕ Crée ton vocal','voice',T.GuildVoice],['tickets','tickets','help',T.GuildText],['waiting','Attente aide','help',T.GuildVoice],
 ['logs','logs','staff',T.GuildText],['team','discussion-équipe','staff',T.GuildText],['memberCount','Membres : 0 • .gg/QG','stats',T.GuildVoice]
];
const embed=(title,description)=>new EmbedBuilder().setColor(0xffffff).setTitle(title).setDescription(description).setFooter({text:'QG • Communauté'});
const rules=()=>({embeds:[embed('Bienvenue au QG — Règlement',
'Bienvenue dans notre communauté ! Lis ces règles avant de participer.\n\n'+
'**1. Respect**\nAucune insulte, discrimination, menace, intimidation ou harcèlement. Respecte les limites et la vie privée de chacun.\n\n'+
'**2. Échanges et contenus**\nPas de spam, flood, arnaque, lien dangereux, contenu sexuel explicite ou violence graphique. Utilise les salons adaptés et partage uniquement des contenus que tu as le droit de diffuser.\n\n'+
'**3. Publicité et messages privés**\nPas de publicité ni de démarchage sans accord de l’équipe, y compris en MP aux membres.\n\n'+
'**4. Vocaux**\nPas de cris, saturation du micro ou diffusion gênante. Ne déplace pas la conversation contre la volonté des autres.\n\n'+
'**5. Assistance et modération**\nOuvre un ticket pour un problème ou un signalement. Fournis des éléments précis et évite les accusations publiques. Les mesures prises dépendent de la gravité et des récidives ; elles peuvent être discutées en ticket.\n\n'+
'**6. Accès au serveur**\nRéagis avec ✅ sous ce message pour confirmer avoir lu le règlement et recevoir le rôle **Membre**. Les autres espaces seront alors accessibles.\n\n'+
'Les règles officielles de Discord s’appliquent également. Ce contrôle vérifie la réaction au règlement ; il ne détecte pas les doubles comptes.')],allowedMentions:{parse:[]}});
const tos=()=>({embeds:[embed('Conditions d’utilisation et confidentialité',
'Ce serveur est une communauté indépendante, sans affiliation officielle avec Discord.\n\n'+
'**Règles de la plateforme**\nRespecte les [Conditions d’utilisation de Discord](https://discord.com/terms) et les [Règles de la communauté](https://discord.com/guidelines), notamment les conditions d’âge applicables à ton pays.\n\n'+
'**Fonctionnement du bot**\nLe bot utilise ton identifiant Discord, ton rôle Membre et les événements d’arrivée et de départ pour gérer les accès et les statistiques. Les tickets sont archivés dans un salon réservé à l’équipe lors de leur fermeture. Ne partage jamais de mot de passe, de token ou de donnée sensible dans un ticket.\n\n'+
'**Contact**\nContacte l’équipe dans un ticket pour une question, un signalement ou une demande concernant tes données. Ces informations expliquent le fonctionnement du serveur ; elles ne remplacent pas les règles officielles de Discord.')],allowedMentions:{parse:[]}});
const ticket=()=>({embeds:[embed('Contacter l’équipe','Une question, un souci ou un signalement ? Ouvre un ticket privé.\n\nDécris ta demande et joins les éléments utiles. Un seul ticket ouvert par membre. Le contenu sera archivé à la fermeture, dans un salon réservé à l’équipe.')],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qg:ticket').setLabel('Ouvrir un ticket').setEmoji('✉️').setStyle(ButtonStyle.Primary))],allowedMentions:{parse:[]}});
function overwrites(guildId,botId,r,kind){
 const read=[P.ViewChannel,P.ReadMessageHistory],write=[...read,P.SendMessages,P.AddReactions,P.AttachFiles,P.EmbedLinks,P.Connect,P.Speak,P.UseVAD];
 const everyone=kind==='welcome'?{id:guildId,allow:read,deny:[P.SendMessages,P.CreatePublicThreads,P.CreatePrivateThreads,P.SendMessagesInThreads]}:{id:guildId,deny:[P.ViewChannel]};
 const staff=staffKeys.map(k=>({id:r[k],allow:write}));
 return [everyone,{id:botId,allow:[...write,P.ManageChannels,P.ManageRoles,P.ManageMessages]},...staff,...(kind!=='staff'&&kind!=='welcome'?[{id:r.member,allow:kind==='stats'?read:write,...(kind==='stats'?{deny:[P.Connect]}:{})}]:[])];
}
module.exports={roles,staffKeys,categories,channels,embed,rules,tos,ticket,overwrites};
