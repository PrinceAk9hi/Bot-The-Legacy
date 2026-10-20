const a=require('../utils/qgAdmin'),metrics=require('./qgMemberMetrics'),{embed}=require('./qgPanels'),{PermissionFlagsBits:P}=require('discord.js');
const {parseParis}=require('../utils/convocationTime');
const family=member=>member.roles.cache.has('1561363081018474626')||require('./qgSchoolFamily')._test.family(member);
async function rows(guild,end=Date.now(),previous=false){
 const members=await require('../utils/qgMembers')(guild);return[...members.values()].filter(m=>!m.user.bot&&family(m)).sort((a,b)=>a.displayName.localeCompare(b.displayName)).map(m=>{
  const activity=metrics.week(m.id,end,previous),rank=metrics.lastRankup(m.id);
  let grade;try{grade=require('./qgUserPanel').rank(m)||'aucun grade enregistré';}catch{grade='grades multiples à corriger';}
  return{ id:m.id,name:m.displayName,voiceMs:activity.voiceMs,messages:activity.messages,lastRankup:rank,grade };
 });
}
async function destination(guild){
 const id=a.state().schoolMeetingConfig?.reportChannelId||a.state().schoolChannels?.foundationReports;
 const ch=id&&await guild.channels.fetch(id);if(!ch?.isTextBased()||ch.permissionsFor(guild.roles.everyone)?.has(P.ViewChannel))throw Error('Configure un salon privé de rapports dans /config.');
 return ch;
}
function describe(r){return `<@${r.id}> • ${r.grade}\n🎙️ ${Math.floor(r.voiceMs/3600000)} h ${Math.floor(r.voiceMs/60000)%60} min • 💬 ${r.messages} messages\nDernier rankup enregistré : ${r.lastRankup?`<t:${Math.floor(r.lastRankup/1000)}:d>`:'inconnu'}`;}
async function tick(guild){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',weekday:'long',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(Date.now()).map(x=>[x.type,x.value]));
 if(p.weekday!=='Monday')return;const key=`${p.year}-${p.month}-${p.day}`;
 return a.serial('weekly-report',async()=>{
  let rec=a.state().schoolWeeklyReports?.[key];if(rec?.complete)return;
  const ch=await destination(guild),end=parseParis(`${p.day}/${p.month}/${p.year} 00:00`);
  if(!rec){const list=await rows(guild,end,true);a.save(s=>{s.schoolWeeklyReports||={};s.schoolWeeklyReports[key]={rows:list,next:0,end,createdAt:Date.now()};for(const k of Object.keys(s.schoolWeeklyReports).sort().slice(0,-16))delete s.schoolWeeklyReports[k];});rec=a.state().schoolWeeklyReports[key];}
  if(rec.sending)throw Error('Envoi hebdomadaire interrompu : vérifier le salon avant toute reprise manuelle.');
  const count=Math.max(1,Math.ceil(rec.rows.length/10));
  for(let page=rec.next;page<count;page++){
   a.save(s=>{s.schoolWeeklyReports[key].sending=page+1;});
   await ch.send({embeds:[embed(`Récap familial • Semaine terminée le ${p.day}/${p.month} • ${page+1}/${count}`,`Activité observée uniquement, sans reconstitution des périodes hors ligne.\n\n${rec.rows.slice(page*10,page*10+10).map(describe).join('\n\n')||'Aucun membre familial.'}`)],allowedMentions:{parse:[]}});
   a.save(s=>{s.schoolWeeklyReports[key].next=page+1;delete s.schoolWeeklyReports[key].sending;});
  }
  a.save(s=>{s.schoolWeeklyReports[key].complete=true;});
 });
}
module.exports={rows,destination,describe,tick,family};
