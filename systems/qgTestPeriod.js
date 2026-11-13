// Fin de période de test (PDT) automatique, dans le salon 1562090387588390942.
// Chaque Membre Test a une fin de période :
// - celle de sa PDT en cours (/pdt), si elle existe ;
// - sinon son arrivée dans la famille + config.testPeriodDays (7 jours par défaut).
// À l'échéance, une fiche est publiée une fois : dates, activité sur la période, observations, avec
// trois boutons (Direction et responsable recrutement) : Valider → Membre Confirmé, Prolonger 7 jours,
// Retirer de la famille (motif demandé). Une prolongation republie une fiche à la nouvelle échéance.
const {EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const CHANNEL='1562090387588390942',DAY=86400000,EXTEND_DAYS=7;
const days=()=>Number(config.testPeriodDays)||7;
const openPdt=r=>!['Validée','Refusée'].includes(r.status);
const ts=(at,f='f')=>`<t:${Math.floor(at/1000)}:${f}>`;

// Période de test d'un membre : PDT en cours, sinon arrivée dans la famille + durée par défaut.
function period(id,s=a.state()){
 const pdt=Object.values(s.schoolPdt||{}).filter(r=>r.targetId===id&&openPdt(r)).sort((x,y)=>y.createdAt-x.createdAt)[0];
 if(pdt)return{start:pdt.startAt,end:pdt.endAt,pdtId:pdt.id};
 const rec=s.schoolTestPeriods?.[id]||{};
 const app=Object.values(s.schoolFamilyRecruitment||{}).filter(x=>x.applicantId===id&&x.interviewFinishedAt).sort((x,y)=>y.interviewFinishedAt-x.interviewFinishedAt)[0];
 const start=rec.startAt||s.schoolFamilyMembership?.[id]?.joinedAt||app?.interviewFinishedAt||null;
 if(!start)return null;
 return{start,end:rec.endAt||start+days()*DAY,estimated:!!rec.estimated};
}
// Activité (messages, vocal) jour par jour entre le début et la fin de la période.
function activity(id,start,end,s=a.state()){
 const day=require('./qgMemberMetrics').day,from=day(start),to=day(end);
 const rows=Object.entries(s.schoolDailyActivity?.[id]||{}).filter(([k])=>k>=from&&k<=to);
 return{messages:rows.reduce((n,[,r])=>n+(r.messages||0),0),voiceMs:rows.reduce((n,[,r])=>n+(r.voiceMs||0),0)};
}

function buttons(id,disabled=false){return[new ActionRowBuilder().addComponents(
 new ButtonBuilder().setCustomId('qgte:validate:'+id).setLabel('Valider → Membre Confirmé').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(disabled),
 new ButtonBuilder().setCustomId('qgte:extend:'+id).setLabel(`Prolonger ${EXTEND_DAYS} jours`).setEmoji('⏳').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
 new ButtonBuilder().setCustomId('qgte:remove:'+id).setLabel('Retirer de la famille').setEmoji('🚪').setStyle(ButtonStyle.Danger).setDisabled(disabled))];}

function payload(id,p,s=a.state()){
 const act=activity(id,p.start,p.end,s),pdt=p.pdtId?s.schoolPdt[p.pdtId]:null,obs=pdt?.observations||[],last=obs.at(-1);
 const lines=[
  `Membre : <@${id}>`,
  `📅 Du ${ts(p.start,'D')} au ${ts(p.end,'D')} (${Math.max(1,Math.round((p.end-p.start)/DAY))} jours)${p.estimated?' · début estimé':''}`,
  pdt?`🧑‍🏫 Référent : <@${pdt.referentId}>`:'-# Aucune PDT ouverte avec /pdt : durée par défaut depuis l’arrivée dans la famille.',
  `💬 ${act.messages} message${act.messages>1?'s':''} · 🎙️ ${Math.floor(act.voiceMs/3600000)} h ${Math.floor(act.voiceMs/60000)%60} min de vocal sur la période`,
  `📝 ${obs.length} observation${obs.length>1?'s':''}`,
  last&&`> Activité : ${String(last.activity).slice(0,200)}\n> Comportement : ${String(last.behavior).slice(0,200)}\n> Implication : ${String(last.involvement).slice(0,200)}`,
  '','La période de test est terminée : choisis la suite.',
 ].filter(x=>x!==null&&x!==undefined&&x!==false);
 return{content:null,embeds:[new EmbedBuilder().setColor(0xf1c40f).setTitle('🧪 Fin de période de test').setDescription(lines.join('\n')).setFooter(require('../utils/qgBrand').footer()).setTimestamp(p.end)],components:buttons(id),allowedMentions:{parse:[]}};
}

let busy=false;
async function tick(guild,{now=Date.now()}={}){
 if(busy||guild.id!==config.guildId)return 0;busy=true;
 try{
  const rank=require('./qgUserPanel').rank,members=await require('../utils/qgMembers')(guild);
  let sent=0,ch=null;
  for(const m of members.values()){
   if(m.user.bot)continue;
   let r;try{r=rank(m);}catch{continue;}
   if(r!=='test')continue;
   let p=period(m.id);
   // Membre Test sans date d'arrivée connue : la période démarre maintenant (début estimé).
   if(!p){a.save(s=>{s.schoolTestPeriods||={};s.schoolTestPeriods[m.id]={...(s.schoolTestPeriods[m.id]||{}),startAt:now,estimated:true};});continue;}
   const rec=a.state().schoolTestPeriods?.[m.id];
   if(now<p.end||rec?.alertedEnd===p.end)continue;
   ch||=await guild.channels.fetch(CHANNEL).catch(()=>null);
   if(!ch?.isTextBased?.())return sent;
   const msg=await ch.send(payload(m.id,p));
   a.save(s=>{s.schoolTestPeriods||={};s.schoolTestPeriods[m.id]={...(s.schoolTestPeriods[m.id]||{}),alertedEnd:p.end,messageId:msg.id};});
   sent++;
  }
  return sent;
 }finally{busy=false;}
}

// Fiche après décision : couleur du résultat, boutons désactivés.
async function close(i,id,color,line){
 const old=i.message.embeds[0];
 const e=EmbedBuilder.from(old).setColor(color).setDescription(old.description.replace('La période de test est terminée : choisis la suite.',line));
 await i.message.edit({embeds:[e],components:buttons(id,true),allowedMentions:{parse:[]}});
}
function closePdt(id,status,actorId){a.save(s=>{for(const r of Object.values(s.schoolPdt||{}))if(r.targetId===id&&openPdt(r)){r.history||=[];r.history.push({at:Date.now(),actorId,status:r.status});r.status=status;r.updatedAt=Date.now();r.updatedBy=actorId;}});}

async function handle(i){
 const [kind,op,id]=(i.customId||'').split(':');
 if(kind!=='qgte'&&kind!=='qgte-form')return false;
 const actor=await i.guild.members.fetch({user:i.user.id,force:true});
 if(!a.can(actor,'rankup')){await i.reply({content:'Réservé à la Direction et au responsable recrutement.',flags:MessageFlags.Ephemeral});return true;}
 if(kind==='qgte'&&op==='remove'){
  await i.showModal(new ModalBuilder().setCustomId('qgte-form:remove:'+id).setTitle('Retirer de la famille').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Motif (envoyé en MP au membre)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800))));
  return true;
 }
 await i.deferReply({flags:MessageFlags.Ephemeral});
 try{
  return await a.serial('member:'+id,async()=>{
   const member=await i.guild.members.fetch({user:id,force:true}).catch(()=>null);
   if(!member)throw Error('Ce membre n’est plus sur le serveur.');
   if(require('./qgUserPanel').rank(member)!=='test')throw Error('Ce membre n’est plus Membre Test : décision déjà prise.');
   if(op==='validate'){
    const grades=require('./qgGrades'),panel=require('./qgUserPanel');
    const p=await grades.prepare(actor,member,'rankup','confirmed');
    await panel.changeRoles(member,p);
    try{await require('./qgSchoolSeparators').syncMember(await i.guild.members.fetch({user:id,force:true}));}catch{}
    closePdt(id,'Validée',actor.id);
    await a.audit(i.guild,{action:'rankup',actorId:actor.id,targetId:id,before:'test',after:{grade:'confirmed'},reason:'Fin de période de test validée'});
    const dm=await member.send({embeds:[new EmbedBuilder().setColor(0x2ecc71).setTitle('Période de test validée • QG').setDescription('Félicitations, ta période de test est validée : tu passes **Membre Confirmé** !').setFooter(require('../utils/qgBrand').footer())]}).then(()=>true,()=>false);
    await close(i,id,0x2ecc71,`✅ **Validée** par <@${actor.id}> ${ts(Date.now(),'R')} → Membre Confirmé`);
    await i.editReply(`<@${id}> passe Membre Confirmé.${dm?'':' MP non remis.'}`);return true;
   }
   if(op==='extend'){
    const p=period(id),end=Math.max(Date.now(),p?.end||0)+EXTEND_DAYS*DAY;
    if(p?.pdtId)a.save(s=>{const r=s.schoolPdt[p.pdtId];r.history||=[];r.history.push({at:Date.now(),actorId:actor.id,endAt:r.endAt,reason:'Prolongation en fin de période de test'});r.endAt=end;r.status='Prolongée';delete r.reminder;});
    else a.save(s=>{s.schoolTestPeriods||={};s.schoolTestPeriods[id]={...(s.schoolTestPeriods[id]||{}),startAt:p?.start||Date.now(),endAt:end};});
    await a.audit(i.guild,{action:'pdt.extend',actorId:actor.id,targetId:id,after:{endAt:end},reason:`Période de test prolongée de ${EXTEND_DAYS} jours`});
    await close(i,id,0x95a5a6,`⏳ **Prolongée** de ${EXTEND_DAYS} jours par <@${actor.id}>, jusqu’au ${ts(end,'D')}. Une nouvelle fiche arrivera à l’échéance.`);
    await i.editReply(`Période de test de <@${id}> prolongée jusqu’au ${ts(end,'D')}.`);return true;
   }
   if(op==='remove'){
    const reason=i.fields.getTextInputValue('reason').trim();
    const r=await require('./qgExpel').expel(i.guild,actor,member,reason);
    closePdt(id,'Refusée',actor.id);
    await close(i,id,0xd62f2f,`🚪 **Retiré de la famille** par <@${actor.id}> ${ts(Date.now(),'R')}\n**Motif :** ${reason.slice(0,500)}`);
    await i.editReply(`<@${id}> a été retiré de la famille. Communauté Roblox : ${r.robloxText}${r.warning}`);return true;
   }
   throw Error('Action inconnue.');
  });
 }catch(e){await i.editReply(e.code?`Action impossible (code ${e.code}). Vérifie les permissions du bot.`:e.message);return true;}
}
module.exports={CHANNEL,tick,handle,_test:{period,activity,payload}};
