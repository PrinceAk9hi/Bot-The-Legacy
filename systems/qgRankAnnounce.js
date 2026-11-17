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
async function fromAudit(guild,e){
 if(guild?.id!==config.guildId)return false;
 const d=await describe(guild,e);if(!d)return false;
 const id=a.state().schoolChannels?.rankUp;if(!id)return false;
 const ch=await guild.channels.fetch(id).catch(()=>null);if(!ch?.isTextBased?.())return false;
 await ch.send({content:`<@${e.targetId}>`,embeds:[new EmbedBuilder().setColor(d.color).setTitle(d.title).setDescription(d.text).setFooter(require('../utils/qgBrand').footer()).setTimestamp(e.at||Date.now())],allowedMentions:{parse:[],users:[e.targetId]}});
 return true;
}
module.exports={fromAudit,_test:{describe}};
