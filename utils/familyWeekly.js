const {EmbedBuilder}=require('discord.js');
const {read,update}=require('./recruitmentData');const {COLORS}=require('../config/soulSociety');
const {Ledger}=require('./soulActivityLedger');const {eligible,duration}=require('./soulActivityHelpers');const {members}=require('./familyMembers');
const CHANNEL='1540838460884123718';let publishing=false;
async function build(guild,end=Date.now()){
 const from=end-7*86400000,ledger=guild.client.soulActivity?.ledger||new Ledger(read('soulActivityTimeline'));
 const roster=await members(guild);let messages=0,voiceMs=0;const active=[];
 for(const m of roster.values()){if(!eligible(m))continue;const stats=ledger.totals(m.id,from,end);messages+=stats.messages;voiceMs+=stats.voiceMs;if(stats.messages||stats.voiceMs)active.push({id:m.id,...stats});}
 const history=read('ranks'),ranks=(Array.isArray(history)?history:[]).filter(r=>r.category==='grade'&&r.timestamp>=from&&r.timestamp<=end);
 const tests=Object.values(read('memberTests')).filter(r=>r.guildId===guild.id&&r.startedAt>=from&&r.startedAt<=end);
 const absences=Object.values(read('memberAbsences')).filter(r=>r.guildId===guild.id&&require('./memberAbsence').overlaps(r,from,end));
 const welcomes=Object.values(read('welcomeProfiles')).filter(r=>Number(r.completedAt)>=from&&Number(r.completedAt)<=end);
 const e=new EmbedBuilder().setColor(COLORS.primary).setTitle('📊 Bilan de la semaine • La Soul Society')
 .setDescription(`Du <t:${Math.floor(from/1000)}:f> au <t:${Math.floor(end/1000)}:f>\nActivité des membres actuellement dans la famille. Données enregistrées par le bot ; les périodes hors ligne ne sont pas reconstituées.`)
 .addFields({name:'💬 Messages',value:messages.toLocaleString('fr-FR'),inline:true},{name:'🎙️ Temps vocal',value:duration(voiceMs),inline:true},{name:'👥 Membres actifs',value:String(active.length),inline:true},
 {name:'🌸 Recrutement et accueil',value:`${tests.length} début(s) de test enregistré(s)\n${welcomes.length} parcours =bienvenue terminé(s)`},
 {name:'📈 Grades et absences',value:`${ranks.length} action(s) de grade enregistrée(s) par =rank\n${absences.length} absence(s) recouvrant la période`});
 const top=active.sort((a,b)=>b.voiceMs-a.voiceMs||b.messages-a.messages).slice(0,5);
 e.addFields({name:'🏆 Top activité vocale',value:top.map((m,n)=>`${n+1}. <@${m.id}> — ${duration(m.voiceMs)} • ${m.messages} messages`).join('\n')||'Aucune activité enregistrée.'});
 if(!ledger.data.since||ledger.data.since>from)e.addFields({name:'⚠️ Historique partiel',value:'Le suivi daté ne couvre pas toute la période. Les anciens totaux sans date ne sont pas répartis artificiellement sur la semaine.'});
 return e;
}
async function publish(guild,end=Date.now(),automatic=false){if(publishing)throw Error('Un bilan est déjà en cours.');publishing=true;try{
 const key='week:'+end,previous=read('familySchedule').reports?.[key];if(automatic&&previous){if(previous.status!=='failed')return false;if(previous.retryAt>Date.now())throw Error('Nouvelle tentative du bilan différée');}
 const embed=await build(guild,end),c=await guild.channels.fetch(CHANNEL);
 if(automatic)update('familySchedule',s=>{s.reports||={};s.reports[key]={status:'pending',at:Date.now()};});
 try{const m=await c.send({embeds:[embed],allowedMentions:{parse:[]},...(automatic?{nonce:String(end),enforceNonce:true}:{})});
 if(automatic)update('familySchedule',s=>{s.reports[key]={status:'sent',messageId:m.id,at:Date.now()};});return true;
 }catch(e){if(automatic)update('familySchedule',s=>{s.reports[key]={status:typeof e.code==='number'?'failed':'uncertain',code:String(e.code||e.name),at:Date.now(),retryAt:Date.now()+60000};});throw e;}
 }finally{publishing=false;}}
module.exports={build,publish,CHANNEL};
