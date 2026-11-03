const {createHash}=require('node:crypto');
const {read,update}=require('../utils/recruitmentData');
const config=require('../config/qg'),layout=require('../config/qgLayout');
// Courbe v3 : premiers niveaux rapides, puis de plus en plus longs (niveau 1 : 40 XP, 10 : 2 600 XP, 50 : 101 000 XP).
const threshold=n=>n<=0?0:Math.round(20*n+20*n*n+0.4*n*n*n);
const level=xp=>{let n=0;while(n<1000&&threshold(n+1)<=Math.max(0,xp))n++;return n;};
const oldLevel=xp=>Math.floor(Math.sqrt(Math.max(0,xp)/25));
const MILESTONES=[5,10,20,35,50,75,100];
const MESSAGE_XP=20,MESSAGE_COOLDOWN=45000,VOICE_XP=10,DAILY_CAP=500;
// Passage en v3 : personne ne perd de niveau avec la nouvelle courbe.
function upgrade(p){if(p.progressionVersion===3)return;if(p.progressionVersion!==2)p.xp=p.xp/4;p.xp=Math.max(Math.round(p.xp),threshold(oldLevel(p.xp)));p.progressionVersion=3;}
function migrate(){update('qgXp',all=>{for(const p of Object.values(all))if(p&&typeof p.xp==='number')upgrade(p);});}

const day=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const locks=new Map();let voiceAt=0,voiceBusy=false;const voicePrevious=new Map();
const serial=(id,fn)=>{const next=(locks.get(id)||Promise.resolve()).catch(()=>{}).then(fn);locks.set(id,next);next.finally(()=>{if(locks.get(id)===next)locks.delete(id);}).catch(()=>{});return next;};
function award(id,source,now,hash){
 let gained=0;
 update('qgXp',all=>{
  const p=all[id]||={xp:0,day:day(now),messageDaily:0,voiceDaily:0,recent:[],progressionVersion:3};
  upgrade(p);
  if(p.day!==day(now)){p.day=day(now);p.messageDaily=0;p.voiceDaily=0;}
  if(source==='message'){
   if(now-(p.lastMessage||0)<MESSAGE_COOLDOWN||p.recent.some(x=>x.hash===hash&&now-x.at<3600000))return;
   gained=Math.min(MESSAGE_XP,DAILY_CAP-p.messageDaily);if(gained<=0)return;
   p.lastMessage=now;p.messageDaily+=gained;p.recent=[...p.recent,{hash,at:now}].slice(-20);
  }else{
   if(now-(p.lastVoice||0)<110000)return;
   gained=Math.min(VOICE_XP,DAILY_CAP-p.voiceDaily);if(gained<=0)return;p.voiceDaily+=gained;p.lastVoice=now;
  }
  p.xp+=gained;p.updatedAt=now;
 });return gained;
}
async function sync(member,state){
 const p=read('qgXp')[member.id];if(!p)return;
 const current=level(p.xp),milestone=MILESTONES.filter(n=>n<=current).pop(),ids=state.levelRoles||{},target=milestone?ids[milestone]:null;
 const validTarget=target&&member.guild.roles.cache.has(target);
 if(!milestone||validTarget){
  const remove=Object.values(ids).filter(id=>id!==target&&member.roles.cache.has(id));
  if(validTarget&&!member.roles.cache.has(target))await member.roles.add(target,'Niveau d’activité QG');
  if(remove.length)await member.roles.remove(remove,'Conserver uniquement le meilleur rôle de niveau QG');
 }
 if(current>(p.announcedLevel??p.announcedMilestone??0)){
  const channel=await member.guild.channels.fetch('1561157193951084646');
  if(!channel?.isTextBased()||channel.guildId!==config.guildId)return;
  // Claim before delivery: a process interruption must not flood the channel on restart.
  update('qgXp',all=>{all[member.id].announcedLevel=current;all[member.id].levelDelivery='pending';});
  try{await channel.send({embeds:[layout.embed('🏆 Nouveau niveau',`<@${member.id}> atteint le **niveau ${current}** !${validTarget?' Son rôle de niveau : <@&'+target+'>.':''}`)],allowedMentions:{parse:[]}});update('qgXp',all=>{all[member.id].levelDelivery='sent';});}
  catch(error){update('qgXp',all=>{all[member.id].levelDelivery='failed';});throw error;}
 }

}
function eligible(member,state){if(!member||member.user.bot)return false;const ids=[state.roles?.member,state.schoolRoles?.community,...['senior','prestigious','expert','confirmed','test'].map(k=>state.schoolRoles?.[k])].filter(id=>id&&id!=='1561157108307861574');return ids.some(id=>member.roles.cache.has(id));}
async function message(m,state){
 if(m.guildId!==config.guildId||m.author.bot||m.webhookId||!eligible(m.member,state))return;
 const text=m.content.normalize('NFKC').toLowerCase().replace(/https?:\/\/\S+/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
 const eligibleChannels=[state.channels?.chat,state.channels?.media,state.channels?.introductions,state.channels?.gaming,state.schoolChannels?.communityChat,state.schoolChannels?.communityMedia,state.schoolChannels?.familyChat,state.schoolChannels?.familyMedia].filter(Boolean);
 if(m.content.startsWith('=')||text.length<10||text.split(' ').filter(w=>/[\p{L}\p{N}]/u.test(w)).length<2||new Set(text.replace(/\s/g,'')).size<5||!eligibleChannels.includes(m.channelId))return;
 const hash=createHash('sha256').update(text).digest('hex');
 await serial(m.author.id,async()=>{award(m.author.id,'message',Date.now(),hash);await sync(m.member,state);});
}
async function voice(guild,state,now=Date.now()){
 if(guild.id!==config.guildId||voiceBusy)return;voiceBusy=true;
 try{
  const elapsed=now-voiceAt;voiceAt=now;const previous=new Map(voicePrevious);voicePrevious.clear();const validInterval=elapsed>=110000&&elapsed<=180000;
  const groups=new Map();
  const voiceParents=[state.categories?.voice,state.schoolCategories?.communityVoice,state.schoolCategories?.familyVoice].filter(Boolean),creators=[state.channels?.createVoice,state.schoolChannels?.createCommunityVoice,state.schoolChannels?.createFamilyVoice].filter(Boolean);
  for(const v of guild.voiceStates.cache.values()){
   if(!v.channelId||!voiceParents.includes(v.channel?.parentId)||creators.includes(v.channelId)||v.mute||v.deaf||v.suppress||!eligible(v.member,state))continue;
   const group=groups.get(v.channelId)||[];group.push(v.member);groups.set(v.channelId,group);
  }
  for(const [channelId,group] of groups)if(group.length>=2)for(const member of group){voicePrevious.set(member.id,channelId);if(validInterval&&group.filter(m=>previous.get(m.id)===channelId).length>=2&&previous.get(member.id)===channelId)await serial(member.id,async()=>{award(member.id,'voice',now);await sync(member,state);});}
 }finally{voiceBusy=false;}
}
async function command(m,state){
 const match=/^=niveau(?:\s+(?:<@!?(\d+)>|(\d+)))?\s*$/.exec(m.content),leader=/^=classement\s*$/.test(m.content);
 if(!match&&!leader)return false;
 if(!eligible(m.member,state)&&m.author.id!==m.guild.ownerId){await m.reply({content:'Accepte le règlement pour accéder aux niveaux.',allowedMentions:{parse:[]}});return true;}
 const all=read('qgXp');
 if(match){
  const id=match[1]||match[2]||m.author.id,p=all[id]||{xp:0},n=level(p.xp),today=p.day===day(Date.now());
  const target=await m.guild.members.fetch(id).catch(e=>{if(e.code===10007)return null;throw e;});
  if(!target){await m.reply({content:'Membre introuvable sur le QG.',allowedMentions:{parse:[]}});return true;}
  const ranking=Object.entries(all).filter(([,x])=>x?.xp>0).sort((a,b)=>b[1].xp-a[1].xp),rank=ranking.findIndex(([x])=>x===id)+1;
  const card={name:target.displayName,username:target.user.username,avatar:target.displayAvatarURL({extension:'png',size:256}),level:n,xp:Math.round(p.xp),current:threshold(n),next:threshold(n+1),rank:rank||null,ranked:ranking.length,
   messageDaily:today?p.messageDaily||0:0,voiceDaily:today?p.voiceDaily||0:0,milestone:MILESTONES.find(x=>x>n)||null};
  card.today=card.messageDaily+card.voiceDaily;
  try{const {AttachmentBuilder}=require('discord.js'),png=await require('../utils/qgLevelCard').render(card);await m.reply({files:[new AttachmentBuilder(png,{name:'niveau.png'})],allowedMentions:{parse:[]}});}
  catch(e){console.warn('Carte niveau QG :',e.code||e.message);await m.reply({embeds:[layout.embed('Niveau QG',`<@${id}>\n**Niveau ${n}** • ${card.xp} XP\nEncore **${card.next-card.xp} XP** pour le niveau ${n+1}.`)],allowedMentions:{parse:[]}});}
  return true;
 }
 const rows=[];
 for(const [id,p] of Object.entries(all).sort((a,b)=>b[1].xp-a[1].xp)){
  const member=await m.guild.members.fetch(id).catch(e=>{if(e.code===10007)return null;throw e;});
  if(!eligible(member,state))continue;rows.push(`**${rows.length+1}.** <@${id}> — niveau **${level(p.xp)}** · ${p.xp} XP`);if(rows.length===10)break;
 }
 await m.reply({embeds:[layout.embed('🏆 Classement QG',rows.join('\n')||'Le classement attend ses premiers participants.')],allowedMentions:{parse:[]}});return true;
}
const panel=()=>({embeds:[layout.embed('🏆 Progression et niveaux',
'Les niveaux récompensent une participation régulière, sans donner de permissions de modération.\n\n**Messages** : 20 XP, au maximum une fois toutes les 45 secondes, dans le chat, les médias, les présentations ou la recherche de joueurs. 10 caractères et 2 mots minimum ; commandes, liens seuls et répétitions ne rapportent rien. Plafond : **500 XP par jour**.\n\n**Vocal** : 10 XP toutes les 2 minutes dans les vocaux communautaires, avec au moins deux membres vérifiés non muets et non assourdis. Pas d’XP en attente aide, dans le créateur de vocal, en solo ou pendant une interruption du bot. Plafond : **500 XP par jour**.\n\n**Progression** : les premiers niveaux arrivent vite, les suivants demandent de plus en plus d’activité. Niveau 1 : 40 XP (2 messages) ; niveau 5 : 650 XP ; niveau 10 : 2 600 XP ; niveau 20 : 11 600 XP ; niveau 50 : 101 000 XP ; niveau 100 : 602 000 XP.\n\nRôles aux niveaux **5, 10, 20, 35, 50, 75 et 100** : seul ton meilleur palier est conservé.\n\n`=niveau` ou `=niveau @membre` • `=classement`\nRemise à zéro des plafonds à minuit, heure de Paris.')],allowedMentions:{parse:[]}});
module.exports={migrate,resetVoice:id=>voicePrevious.delete(id),message,voice,command,panel,level,threshold,award};
