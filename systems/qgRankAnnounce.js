// Salon « rank-up » (schoolChannels.rankUp) : annonce publique de chaque changement de grade et de chaque
// avertissement, quelle que soit l'origine — /rankup, /derank, décisions de réunion, fin de période de test,
// sanctions. Appelé par chaque audit réussi (utils/qgAdmin). Le motif n'est pas affiché (il reste dans les logs
// et le journal de la direction).
const {EmbedBuilder}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const GRADES={test:'Membre Test',confirmed:'Membre Confirmé',expert:'Membre Expert',senior:'Membre Senior',prestigious:'Membre Prestigieux'};
const WARNINGS=['Aucun avertissement','Avertissement 1','Avertissement 2','Dernière Chance'];
const gradeOf=v=>typeof v==='string'?v:v?.grade||v?.choice||null;

// Contenu de l'annonce pour une entrée d'audit, ou null si elle ne concerne pas ce salon.
async function describe(guild,e){
 if(e.result!=='success'||!e.targetId)return null;
 const meeting=e.action.startsWith('meeting.')?' · décidé en réunion':'';
 const kind=e.action.replace(/^meeting\./,'');
 if(['rankup','derank','demote'].includes(kind)){
  let grade=gradeOf(e.after);
  // Réunion : le grade final est lu sur le membre.
  if(!grade||meeting){const m=await guild.members.fetch({user:e.targetId,force:true}).catch(()=>null);try{grade=m&&require('./qgUserPanel').rank(m)||grade;}catch{}}
  const up=kind==='rankup';
  return{color:up?0x2ecc71:0xe67e22,title:up?'📈 Rankup':'📉 Derank',text:`<@${e.targetId}> passe **${GRADES[grade]||grade||'nouveau grade'}**${meeting}.`};
 }
 if(e.action==='discipline'&&Number.isInteger(e.after)){
  const before=Number.isInteger(e.before)?e.before:0;
  if(e.after===before)return null;
  return e.after>before
   ?{color:0xd62f2f,title:'⚠️ Avertissement',text:`<@${e.targetId}> reçoit **${WARNINGS[e.after]||'un avertissement'}**.`}
   :{color:0x95a5a6,title:'✅ Avertissement levé',text:`<@${e.targetId}> passe à **${WARNINGS[e.after]}**.`};
 }
 return null;
}
async function fromAudit(guild,e,{meetingDate=null}={}){
 if(guild?.id!==config.guildId)return false;
 const d=await describe(guild,e);if(!d)return false;
 // Rattrapage : date de la réunion à la place de « décidé en réunion ».
 if(meetingDate)d.text=d.text.replace(' · décidé en réunion','').replace(/.$/,'')+` · décidé en réunion du <t:${Math.floor(meetingDate/1000)}:D>.`;
 const id=a.state().schoolChannels?.rankUp;if(!id)return false;
 const ch=await guild.channels.fetch(id).catch(()=>null);if(!ch?.isTextBased?.())return false;
 await ch.send({content:`<@${e.targetId}>`,embeds:[new EmbedBuilder().setColor(d.color).setTitle(d.title).setDescription(d.text).setFooter(require('../utils/qgBrand').footer()).setTimestamp(e.at||Date.now())],allowedMentions:{parse:[],users:[e.targetId]}});
 return true;
}
// Rattrapage, une seule fois : décisions de la dernière réunion appliquée avant l'ouverture des annonces,
// publiées avec la date de la réunion.
async function backfill(guild){
 if(guild.id!==config.guildId||a.state().schoolRankAnnounce?.backfilled)return{detail:'Rattrapage rank-up déjà fait'};
 const meetings=Object.values(a.state().schoolMeetings||{}).filter(r=>r.status==='finished').sort((x,y)=>(y.start||0)-(x.start||0));
 const r=meetings[0];let sent=0;
 if(r&&a.state().schoolChannels?.rankUp){
  const history=a.state().schoolAdminHistory||[],cases=Object.values(a.state().discipline?.cases||{});
  for(const [memberId,decision] of Object.entries(r.actions||{})){
   if(r.results?.[memberId]?.status!=='done')continue;
   let e=null;
   if(['rankup','derank','demote'].includes(decision.action)){
    // Grade enregistré au moment de la réunion (le grade actuel a pu changer depuis).
    const logged=history.filter(x=>x.action==='meeting.'+decision.action&&x.targetId===memberId&&x.after?.meetingId===r.id).at(-1);
    e={action:decision.action,targetId:memberId,result:'success',after:{grade:logged?.after?.grade||decision.choice||null}};
   }else if(decision.action==='warn'){
    const c=cases.find(x=>x.sourceKey===`meeting:${r.id}:${memberId}`);
    if(c&&Number.isInteger(c.level))e={action:'discipline',targetId:memberId,result:'success',before:Number.isInteger(c.before)?c.before:0,after:c.level};
   }
   if(e&&await fromAudit(guild,{...e,at:r.start},{meetingDate:r.start}).catch(()=>false))sent++;
  }
 }
 a.save(s=>{s.schoolRankAnnounce={...(s.schoolRankAnnounce||{}),backfilled:Date.now(),meetingId:r?.id||null,sent};});
 return{detail:`Rattrapage rank-up : ${sent} annonce(s) de la réunion ${r?.name||'—'}`};
}
module.exports={fromAudit,backfill,_test:{describe}};
