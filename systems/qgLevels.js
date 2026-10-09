const {createHash}=require('node:crypto');
const {read,update}=require('../utils/recruitmentData');
const config=require('../config/qg'),layout=require('../config/qgLayout');
const level=xp=>Math.floor(Math.sqrt(Math.max(0,xp)/100));
const threshold=n=>100*n*n;
const day=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const locks=new Map();let voiceAt=0,voiceBusy=false;const voicePrevious=new Map();
const serial=(id,fn)=>{const next=(locks.get(id)||Promise.resolve()).catch(()=>{}).then(fn);locks.set(id,next);next.finally(()=>{if(locks.get(id)===next)locks.delete(id);}).catch(()=>{});return next;};
function award(id,source,now,hash){
 let gained=0;
 update('qgXp',all=>{
  const p=all[id]||={xp:0,day:day(now),messageDaily:0,voiceDaily:0,recent:[]};
  if(p.day!==day(now)){p.day=day(now);p.messageDaily=0;p.voiceDaily=0;}
  if(source==='message'){
   if(now-(p.lastMessage||0)<90000||p.recent.some(x=>x.hash===hash&&now-x.at<3600000))return;
   gained=Math.min(10,300-p.messageDaily);if(gained<=0)return;
   p.lastMessage=now;p.messageDaily+=gained;p.recent=[...p.recent,{hash,at:now}].slice(-20);
  }else{
   if(now-(p.lastVoice||0)<110000)return;
   gained=Math.min(5,300-p.voiceDaily);if(gained<=0)return;p.voiceDaily+=gained;p.lastVoice=now;
  }
  p.xp+=gained;p.updatedAt=now;
 });return gained;
}
async function sync(member,state){
 const p=read('qgXp')[member.id];if(!p)return;
 const current=level(p.xp),milestone=layout.levelMilestones.filter(n=>n<=current).pop(),ids=state.levelRoles||{},target=milestone?ids[milestone]:null;
 const remove=Object.values(ids).filter(id=>id!==target&&member.roles.cache.has(id));
 if(target&&!member.roles.cache.has(target))await member.roles.add(target,'Niveau d’activité QG');
 if(remove.length)await member.roles.remove(remove,'Conserver uniquement le meilleur rôle de niveau QG');
 if(milestone&&(p.announcedMilestone||0)<milestone){
  const channel=await member.guild.channels.fetch(state.channels.levels);
  await channel.send({embeds:[layout.embed('🏆 Nouveau palier',`<@${member.id}> atteint le **niveau ${current}** et reçoit **« I Niveau ${milestone}** !`)],allowedMentions:{parse:[]}});
  update('qgXp',all=>{all[member.id].announcedMilestone=milestone;});
 }
}
function eligible(member,state){return member&&!member.user.bot&&member.roles.cache.has(state.roles.member);}
async function message(m,state){
 if(m.guildId!==config.guildId||m.author.bot||m.webhookId||!eligible(m.member,state))return;
 const text=m.content.normalize('NFKC').toLowerCase().replace(/https?:\/\/\S+/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
 if(m.content.startsWith('=')||text.length<20||new Set(text.replace(/\s/g,'')).size<8||![state.channels.chat,state.channels.media,state.channels.introductions,state.channels.gaming].includes(m.channelId))return;
 const hash=createHash('sha256').update(text).digest('hex');
 await serial(m.author.id,async()=>{award(m.author.id,'message',Date.now(),hash);await sync(m.member,state);});
}
async function voice(guild,state,now=Date.now()){
 if(guild.id!==config.guildId||voiceBusy)return;voiceBusy=true;
 try{
  const elapsed=now-voiceAt;voiceAt=now;const previous=new Map(voicePrevious);voicePrevious.clear();const validInterval=elapsed>=110000&&elapsed<=180000;
  const groups=new Map();
  for(const v of guild.voiceStates.cache.values()){
   if(!v.channelId||v.channel?.parentId!==state.categories.voice||v.channelId===state.channels.createVoice||v.mute||v.deaf||v.suppress||!eligible(v.member,state))continue;
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
 if(match){const id=match[1]||match[2]||m.author.id,p=all[id]||{xp:0},n=level(p.xp);await m.reply({embeds:[layout.embed('Niveau QG',`<@${id}>\n**Niveau ${n}** • ${p.xp} XP\nProchain niveau : **${threshold(n+1)} XP**\nEncore **${threshold(n+1)-p.xp} XP**.\n\n10 XP par message éligible, au maximum toutes les 90 secondes. 5 XP par tranche de 2 minutes de vocal actif à plusieurs. Plafond : 300 XP texte + 300 XP vocal par jour.`)],allowedMentions:{parse:[]}});return true;}
 const rows=[];
 for(const [id,p] of Object.entries(all).sort((a,b)=>b[1].xp-a[1].xp)){
  const member=await m.guild.members.fetch(id).catch(e=>{if(e.code===10007)return null;throw e;});
  if(!eligible(member,state))continue;rows.push(`**${rows.length+1}.** <@${id}> — niveau **${level(p.xp)}** · ${p.xp} XP`);if(rows.length===10)break;
 }
 await m.reply({embeds:[layout.embed('🏆 Classement QG',rows.join('\n')||'Le classement attend ses premiers participants.')],allowedMentions:{parse:[]}});return true;
}
const panel=()=>({embeds:[layout.embed('🏆 Progression et niveaux',
'Les niveaux récompensent une participation régulière, sans donner de permissions de modération.\n\n**Messages** : 10 XP, au maximum une fois toutes les 90 secondes, dans le chat, les médias, les présentations ou la recherche de joueurs. Réponses de 20 caractères minimum ; commandes, liens seuls et répétitions ne rapportent rien. Plafond : **300 XP par jour**.\n\n**Vocal** : 5 XP toutes les 2 minutes dans les vocaux communautaires, avec au moins deux membres vérifiés non muets et non assourdis. Pas d’XP en attente aide, dans le créateur de vocal, en solo ou pendant une interruption du bot. Plafond : **300 XP par jour**.\n\n**Progression** : atteindre le niveau N nécessite **100 × N² XP** au total. Niveau 10 : 10 000 XP ; niveau 25 : 62 500 XP ; niveau 50 : 250 000 XP. Même avec le maximum quotidien, le niveau 50 demande au moins **417 jours**.\n\nRôles aux niveaux **5, 10, 15, 20, 30, 40 et 50** : seul ton meilleur palier est conservé.\n\n`=niveau` ou `=niveau @membre` • `=classement`\nRemise à zéro des plafonds à minuit, heure de Paris.')],allowedMentions:{parse:[]}});
module.exports={resetVoice:id=>voicePrevious.delete(id),message,voice,command,panel,level,threshold,award};
