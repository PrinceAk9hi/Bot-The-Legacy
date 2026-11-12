const {EmbedBuilder,ActionRowBuilder,StringSelectMenuBuilder,ButtonBuilder,ButtonStyle}=require('discord.js');
const {read}=require('../utils/recruitmentData');
const icons={questions:{id:'1561415725485260840',name:'mail'},event:{id:'1561417105218215996',name:'staff'},report:{id:'1561415502125862922',name:'whitediamond'},foundation:{id:'1561417429999952033',name:'papercrown'},notifications:{id:'1561427092262883559',name:'notification'}};
const icon=k=>`<:${icons[k].name}:${icons[k].id}>`;
const embed=(title,description)=>new EmbedBuilder().setFooter(require('../utils/qgBrand').footer()).setColor(0xffffff).setTitle(title).setDescription(description);
// Équipes d'exécutants (anciennement « gestions ») : [rôle, rôle du responsable, libellé, mission, emoji].
const teams=[['rpManagement','rpLead','Exécutant du RP','Scènes roleplay, accompagnement des joueurs et projets RP.','🎭'],['ticketsManagement','ticketsLead','Exécutant Support','Accueil des membres, réponses aux questions et suivi des tickets.','🎫'],['recruitmentManagement','recruitmentLead','Exécutant des Recrutements','Étude des candidatures, entretiens et intégration des recrues.','📋'],['animationManagement','animationLead','Exécutant des Animations','Animations, événements et vie de la communauté.','🎉'],['networksManagement','networksLead','Exécutant des Réseaux','Publications et présence de la famille sur les réseaux.','🌐']];function tickets(guild){
 const find=(name,fallback)=>{const e=guild?.emojis?.cache?.find(e=>e.name===name&&e.available!==false);return e?{id:e.id,name:e.name,animated:e.animated}:fallback;};
 const ticketIcons={...icons,event:find('announcement',{name:'📣'}),report:find('staff',{id:'1561417105218215996',name:'staff'})};
 const ticketIcon=key=>ticketIcons[key].id?`<${ticketIcons[key].animated?'a':''}:${ticketIcons[key].name}:${ticketIcons[key].id}>`:ticketIcons[key].name;
 const brand=find('QG',null);const brandText=brand?`<${brand.animated?'a':''}:${brand.name}:${brand.id}> `:'';
 const options=[['questions','Questions/Aide','Une question ou besoin d’accompagnement.'],['event','Demander une animation','Proposer un événement ou une animation.'],['report','Signaler un comportement','Transmettre un signalement confidentiel à la Fondation.'],['foundation','Contacter la Fondation','Une demande privée destinée à la Fondation.']];
 const art=require('../utils/discordPanelImage').localImage(require('node:path').join(__dirname,'..','assets','qg-support.gif'),'qg-support.gif');
 return {embeds:[embed('Support du QG',`${brandText}Besoin d’un renseignement, envie de proposer un projet ou de nous faire part d’une situation ?\nNous sommes là pour t’accompagner. Choisis le sujet qui correspond à ta demande : un espace privé sera ouvert pour toi.\n\n${options.map(([key,label,desc])=>`${ticketIcon(key)} **${label}**\n${desc}`).join('\n\n')}\n\nDécris ta demande avec précision et joins les éléments utiles. L’équipe concernée est prévenue dès l’ouverture.`).setImage(art.url)],files:[art.file],attachments:[],components:[new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('qg:ticket-type').setPlaceholder('Quel est le sujet de ta demande ?').addOptions(options.map(([value,label,description])=>({value,label,description,emoji:ticketIcons[value]}))))],allowedMentions:{parse:[]}};
}
function notifications(){return {embeds:[embed('Tes notifications',`${icon('notifications')} **Reste informé de ce qui t’intéresse.**\n\n**Annonces** — les informations importantes du QG.\n**Roleplay** — les nouveautés et rendez-vous RP.\n**Réseaux** — nos contenus et publications.\n**Serveur** — les évolutions de la communauté.\n\nSélectionne les notifications souhaitées. Tu peux en choisir plusieurs, modifier ton choix ou tout retirer à tout moment.`)],components:[new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('qgs:notifs').setPlaceholder('Choisir mes notifications').setMinValues(0).setMaxValues(4).addOptions(['Announcements','Rp','Networks','Servers'].map((key,i)=>({value:'notif'+key,label:['Annonces','Roleplay','Réseaux','Serveur'][i],emoji:icons.notifications}))))],allowedMentions:{parse:[]}};}
async function management(guild){
 let members; if(guild)members=await require('../utils/qgMembers')(guild);const roles=read('qgServer').schoolRoles||{};
 const seats=teams.map(([key,lead])=>members?[...members.values()].filter(m=>!m.user.bot&&m.roles.cache.has(roles[key])&&!m.roles.cache.has(roles[lead])).length:null);
 // Deux places par équipe : ● occupée, ○ libre.
 const status=n=>n===null?'Places non mesurées':`${'●'.repeat(Math.min(n,2))}${'○'.repeat(Math.max(0,2-n))}  ${n>=2?'**Complet**':`**${2-n}** place${2-n>1?'s':''} libre${2-n>1?'s':''}`}`;
 const fields=teams.map(([,,label,desc,emoji],n)=>({name:`${emoji} ${label}`,value:`${desc}\n${status(seats[n])}`}));
 const e=embed('🛡️ Devenir exécutant',`${brand(guild)}Cinq équipes d’exécutants font vivre le QG au quotidien.\nDécouvre leurs missions, puis choisis celle qui te ressemble.\n​`).addFields(...fields,{name:'​',value:'📝 **Avant de candidater**\nÊtre membre de la famille et disposer de temps. Ton dossier présentera tes motivations, ton expérience, tes disponibilités et ce que tu souhaites apporter.\n\n🎮 **Sur Roblox**\nUn exécutant reçoit le rang **Membre gestion** dans la communauté.\n\n*Deux places par équipe, hors responsable · Dossiers étudiés par le responsable concerné.*'});
 const menu=new StringSelectMenuBuilder().setCustomId('qgs:management-apply').setPlaceholder('Choisir une équipe').addOptions(teams.map(([value,,label,,emoji],n)=>({value,label,emoji:{name:emoji},description:seats[n]===null?undefined:seats[n]>=2?'Complet':`${2-seats[n]} place${2-seats[n]>1?'s':''} libre${2-seats[n]>1?'s':''}`})));
 return {embeds:[e],components:[new ActionRowBuilder().addComponents(menu)],allowedMentions:{parse:[]}};
}
async function refreshManagement(guild){const rec=read('qgServer').schoolPanels?.joinManagement;if(!rec)return;const ch=await guild.channels.fetch(rec.channelId);const m=await ch.messages.fetch(rec.messageId);await m.edit(await management(guild));}

// Emoji du serveur « QG » s'il existe.
function brand(guild){const e=guild?.emojis?.cache?.find(e=>e.name==='QG'&&e.available!==false);return e?`<${e.animated?'a':''}:${e.name}:${e.id}> `:'';}

// ---------- #help-qg : guide de la famille ----------
// Du plus haut grade au plus bas.
const grades=[['prestigious','💎'],['senior','👑'],['expert','🎯'],['confirmed','✅'],['test','🧪']];
// Présentation des salons, reconnus par un mot de leur nom.
const channelInfo=[[/help-qg|guide-famille/,'Ce guide : salons, grades et communauté.'],[/rejoindre-une-gestion/,'Candidater pour devenir exécutant.'],[/nouvelle-recrue/,'Accueil des nouvelles recrues de la famille.'],[/annonces-famille/,'Annonces officielles de la famille.'],[/rankup|avertissement/,'Promotions, rétrogradations et avertissements.'],[/absences/,'Déclarer et gérer tes absences.'],[/effectifs/,'Liste à jour des membres et de leur grade.'],[/reunion|réunion/,'Convocations et comptes rendus des réunions.'],[/annonces-ann?imation/,'Annonces des animations à venir.'],[/planning-ann?imation/,'Planning des prochaines animations.'],[/general|général/,'Discussion entre membres de la famille.'],[/medias|médias/,'Captures, vidéos et souvenirs de la famille.'],[/suggestions/,'Tes idées pour améliorer la famille.'],[/commandes/,'Commandes du bot : vocal temporaire, profil…'],[/organigramme/,'Qui fait quoi dans la famille.'],[/giveaway/,'Giveaways réservés à la famille.']];
function describeChannel(c){const n=c.name.normalize('NFC').toLowerCase();return channelInfo.find(([re])=>re.test(n))?.[1]||null;}
async function guide(guild){
 const s=read('qgServer'),r=s.schoolRoles||{},link=require('../config/qg').robloxGroupUrl,b=brand(guild);
 const members=guild?await require('../utils/qgMembers')(guild).catch(()=>null):null;
 const humans=members?[...members.values()].filter(m=>!m.user.bot):null;
 const count=id=>humans&&id?humans.filter(m=>m.roles.cache.has(id)).length:null;
 const roleName=(key,fallback)=>guild?.roles?.cache?.get(r[key])?.name?.replace(/^«\s*I\s*/,'')||fallback;
 // 1. Présentation + communauté Roblox
 const intro=embed('⛩️ Guide de la famille QG',`${b}Bienvenue dans le guide de la famille ! Retrouve ici nos salons, nos grades et le lien de notre communauté Roblox.\n\n🎮 **Communauté Roblox**\n${link}\nEnvoie ta demande d’adhésion : elle est acceptée quand tu passes **Membre Confirmé**.\n\n🏛️ **Direction**\n${['creator','globalManager','referent'].map(k=>r[k]?`<@&${r[k]}>`:null).filter(Boolean).join(' → ')||'Créateur → Gérant Global → Référent du QG'}\nLa Direction encadre la famille et valide les décisions importantes.`);
 // 2. Grades et effectifs
 const lines=grades.map(([key,emoji])=>{const n=count(r[key]);return `${emoji} **${roleName(key,key)}** — ${n===null?'?':n} membre${n>1?'s':''}`;});
 const total=humans?humans.filter(m=>grades.some(([k])=>r[k]&&m.roles.cache.has(r[k]))).length:null;
 // Effectif complet (direction, grades, exécutants) : EMOJI @Rôle - NOMBRE, emoji retrouvé d'après le badge du rôle.
 let full=null;
 if(guild&&humans){const up=require('./qgCommunityUpgrade');full=up.fullRoster(guild,humans,await up.badgeMap(guild)).map(p=>`**${p.title}**\n${p.lines.join('\n')}`).join('\n\n');}
 const gradesEmbed=embed('📈 Grades et effectifs',`${full||lines.join('\n')}\n\n**Total famille : ${total===null?'?':total}**\n\nLes promotions sont décidées par les responsables habilités selon l’activité, l’investissement et le comportement. Aucune promotion n’est automatique.\n-# Effectifs mis à jour automatiquement.`);
 // 3. Les salons de la famille (catégories contenant « FAMILLE » + celle de ce guide)
 const embeds=[intro,gradesEmbed];
 if(guild){
  await guild.channels.fetch().catch(()=>null);
  const guideParent=guild.channels.cache.get(s.schoolChannels?.familyGuide)?.parentId;
  const cats=[...guild.channels.cache.values()].filter(c=>c.type===4&&(c.id===guideParent||/famille/i.test(c.name))).sort((x,y)=>x.rawPosition-y.rawPosition);
  const fields=[];
  for(const cat of cats){
   const kids=[...guild.channels.cache.values()].filter(c=>c.parentId===cat.id).sort((x,y)=>x.rawPosition-y.rawPosition);
   const text=kids.filter(c=>![2,13].includes(c.type)).map(c=>`<#${c.id}>${describeChannel(c)?' — '+describeChannel(c):''}`);
   const voice=kids.filter(c=>[2,13].includes(c.type));
   if(voice.length)text.push(`🔊 ${voice.map(c=>`<#${c.id}>`).join(' ')} — vocaux de la famille.`);
   if(text.length)fields.push({name:cat.name.slice(0,256),value:text.join('\n').slice(0,1024)});
  }
  if(fields.length)embeds.splice(1,0,embed('🗺️ Les salons de la famille','Chaque salon a son rôle : voici où trouver quoi.').addFields(...fields.slice(0,25)));
 }
 const button=new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(link).setLabel('Rejoindre la communauté Roblox').setEmoji('🎮');
 return {embeds,components:[new ActionRowBuilder().addComponents(button)],allowedMentions:{parse:[]}};
}
async function refreshGuide(guild){const rec=read('qgServer').schoolPanels?.familyGuide;if(!rec)return;const ch=await guild.channels.fetch(rec.channelId);const m=await ch.messages.fetch(rec.messageId);await m.edit(await guide(guild));}
module.exports={embed,icons,tickets,notifications,management,refreshManagement,guide,refreshGuide,teams};
