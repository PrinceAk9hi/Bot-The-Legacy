const {ModalBuilder:Modal,TextInputBuilder:Input,TextInputStyle:T,ActionRowBuilder:Row,ButtonBuilder:Button,ButtonStyle:S,MessageFlags:F,PermissionFlagsBits:P}=require('discord.js');
const a=require('../utils/qgAdmin'),{embed}=require('./qgPanels'),{parseParis}=require('../utils/convocationTime');
const clean=require('../utils/qgAiKnowledge').clean;
const {randomUUID}=require('node:crypto');
async function context(i,id,action){
 const s=require('./qgUserPanel').session(i,id),actor=await a.actor(i),member=await i.guild.members.fetch({user:s.targetId,force:true});
 if(!a.isDirection(actor)&&!(action==='convocation'&&a.has(actor,['recruitmentLead','recruitmentManagement'])))throw Error('Action réservée à la direction ou au recrutement habilité.');
 a.hierarchy(actor,member,await i.guild.members.fetchMe());return{s,actor,member};
}
async function handle(i,id,action,op='open'){
 const [name,nonce]=action.split('.');action=name;
 if(!['convocation','locknick','unlocknick'].includes(action))throw Error('Action inconnue.');
 const ctx=await context(i,id,action);
 if(op==='open'&&action==='convocation'){
  const m=new Modal().setCustomId(`qgu:toolform:${id}:convocation`).setTitle('Convoquer le membre');
  for(const [key,label,required]of [['date','JJ/MM/AAAA HH:MM — Paris',true],['reason','Motif (facultatif)',false]])m.addComponents(new Row().addComponents(new Input().setCustomId(key).setLabel(label).setStyle(T.Short).setRequired(required).setMaxLength(key==='date'?16:300)));
  return i.showModal(m);
 }
 await i.deferReply({flags:F.Ephemeral});
 if(op==='confirm')return a.serial('member:'+ctx.member.id,async()=>{
  const latest=await context(i,id,action),p=latest.s.toolPending;if(!p||p.action!==action||p.nonce!==nonce)throw Error('Confirmation déjà utilisée ou remplacée.');
  a.save(s=>{delete s.schoolUserSessions[id].toolPending;});
  if(action==='convocation'){
   if(p.at<=Date.now())throw Error('La date de convocation est passée.');
   const msg=await latest.member.send({embeds:[embed('Convocation • QG',`Tu es convoqué le <t:${Math.floor(p.at/1000)}:F>.\nMotif : ${p.reason||'Communiqué pendant l’entretien.'}\nContacte <@${latest.actor.id}> pour confirmer ta disponibilité et connaître le lieu de rendez-vous.`)],allowedMentions:{parse:[]}});
   a.save(s=>{s.schoolConvocations||=[];s.schoolConvocations.push({targetId:latest.member.id,actorId:latest.actor.id,at:p.at,reason:p.reason,messageId:msg.id});s.schoolConvocations=s.schoolConvocations.slice(-1000);});
  }else{
   const bot=await i.guild.members.fetchMe();if(!bot.permissions.has(P.ManageNicknames)||!latest.member.manageable)throw Error('Le bot ne peut pas gérer ce pseudonyme.');
   a.save(s=>{s.schoolNicknameLocks||={};if(action==='locknick')s.schoolNicknameLocks[latest.member.id]={nickname:latest.member.nickname,actorId:latest.actor.id,at:Date.now()};else delete s.schoolNicknameLocks[latest.member.id];});
  }
  await a.audit(i.guild,{action,actorId:latest.actor.id,targetId:latest.member.id,reason:p.reason});return i.editReply({content:'Action effectuée.',components:[],embeds:[]});
 });
 const pending={action,nonce:randomUUID().slice(0,12)};if(action==='convocation'){pending.at=parseParis(i.fields.getTextInputValue('date'));pending.reason=clean(i.fields.getTextInputValue('reason'));if(!pending.at||pending.at<=Date.now())throw Error('Date future valide requise, heure de Paris.');}
 a.save(s=>{s.schoolUserSessions[id].toolPending=pending;});
 return i.editReply({embeds:[embed('Confirmer • Gestion du membre',`${action==='convocation'?`Envoyer une convocation pour <t:${Math.floor(pending.at/1000)}:F>`:action==='locknick'?'Verrouiller le pseudonyme actuel':'Déverrouiller le pseudonyme'} de <@${ctx.member.id}> ?`)],components:[new Row().addComponents(new Button().setCustomId(`qgu:toolconfirm:${id}:${action}.${pending.nonce}`).setLabel('Confirmer').setStyle(S.Danger))],allowedMentions:{parse:[]}});
}
const busy=new Set();
async function enforce(oldMember,member){
 const lock=a.state().schoolNicknameLocks?.[member.id];if(!lock||member.nickname===lock.nickname||busy.has(member.id))return;
 busy.add(member.id);try{if(member.manageable)await member.setNickname(lock.nickname,'Pseudonyme verrouillé par la direction QG');}finally{busy.delete(member.id);}
}
module.exports={handle,enforce};
