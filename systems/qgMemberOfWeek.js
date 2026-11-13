// Membre de la semaine : chaque lundi à partir de 10 h (heure de Paris), le membre de la famille le plus actif
// de la semaine passée est annoncé dans le salon 1561157222032212059 et reçoit le rôle « ⭐ Membre de la semaine »
// (retiré au gagnant précédent). Score : 1 point par minute de vocal, 2 par message, 30 par animation
// où sa présence a été notée. La Direction n'est pas éligible.
const {EmbedBuilder}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const CHANNEL='1561157222032212059',ROLE_NAME='⭐ Membre de la semaine',DAY=86400000;
const medals=['🥇','🥈','🥉'];

function score({voiceMs=0,messages=0,animations=0}){return Math.floor(voiceMs/60000)+messages*2+animations*30;}
// Animations de la semaine où la présence du membre a été notée.
function animationsOf(id,from,to,s=a.state()){
 return Object.values(s.schoolAnimations?.events||{}).filter(e=>e.startAt>=from&&e.startAt<to&&e.attendance?.[id]===true).length;
}
function ranking(members,end,s=a.state()){
 const metrics=require('./qgMemberMetrics'),family=require('./qgWeeklyReport').family;
 return members.filter(m=>!m.user.bot&&!a.isDirection(m)&&family(m)).map(m=>{
  const w=metrics.week(m.id,end,true),animations=animationsOf(m.id,end-7*DAY,end,s);
  return{id:m.id,voiceMs:w.voiceMs,messages:w.messages,animations,score:score({...w,animations})};
 }).filter(x=>x.score>0).sort((x,y)=>y.score-x.score||y.voiceMs-x.voiceMs);
}
const line=r=>`🎙️ ${Math.floor(r.voiceMs/3600000)} h ${Math.floor(r.voiceMs/60000)%60} min · 💬 ${r.messages} messages${r.animations?` · 🎉 ${r.animations} animation${r.animations>1?'s':''}`:''}`;
function payload(top){
 const [w]=top;
 const text=[`Bravo <@${w.id}>, membre le plus actif de la famille cette semaine ! 🎉`,line(w),'',
  '**Podium**',...top.slice(0,3).map((r,n)=>`${medals[n]} <@${r.id}> — ${r.score} pts`),'',
  '-# 1 point par minute de vocal, 2 par message, 30 par animation. Le rôle reste jusqu’au prochain lundi.'].join('\n');
 return{content:`<@${w.id}>`,embeds:[new EmbedBuilder().setColor(0xf1c40f).setTitle('⭐ Membre de la semaine').setDescription(text).setFooter(require('../utils/qgBrand').footer()).setTimestamp()],allowedMentions:{parse:[],users:[w.id]}};
}

async function role(guild){
 const id=a.state().schoolRoles?.memberOfWeek;
 let r=id&&(guild.roles.cache.get(id)||await guild.roles.fetch(id).catch(()=>null));
 if(!r){r=await guild.roles.create({name:ROLE_NAME,color:0xf1c40f,hoist:false,mentionable:false,permissions:[],reason:'Membre de la semaine'});a.save(s=>{s.schoolRoles||={};s.schoolRoles.memberOfWeek=r.id;});}
 return r;
}

async function tick(guild,{now=Date.now()}={}){
 if(guild.id!==config.guildId)return false;
 const p=require('./qgBackup')._test.parisParts(now);
 const weekday=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',weekday:'long'}).format(now);
 const key=`${p.year}-${p.month}-${p.day}`;
 if(weekday!=='Monday'||Number(p.hour)<10||a.state().schoolMemberOfWeek?.week===key)return false;
 a.save(s=>{s.schoolMemberOfWeek={...(s.schoolMemberOfWeek||{}),week:key};});
 const end=require('../utils/convocationTime').parseParis(`${p.day}/${p.month}/${p.year} 00:00`);
 const members=[...(await require('../utils/qgMembers')(guild)).values()];
 const top=ranking(members,end);
 if(!top.length)return false;
 const ch=await guild.channels.fetch(CHANNEL).catch(()=>null);
 if(!ch?.isTextBased?.())return false;
 let warning='';
 try{
  const r=await role(guild);
  for(const m of r.members?.values?.()||[])if(m.id!==top[0].id)await m.roles.remove(r,'Nouveau membre de la semaine').catch(()=>{});
  await guild.members.cache.get(top[0].id)?.roles.add(r,'Membre de la semaine');
 }catch(e){warning=e.code||e.message;console.error('Membre de la semaine (rôle) :',warning);}
 await ch.send(payload(top));
 a.save(s=>{s.schoolMemberOfWeek={week:key,memberId:top[0].id,score:top[0].score,at:now,...(warning?{roleError:warning}:{})};});
 return true;
}
module.exports={tick,_test:{score,ranking,payload,animationsOf}};
