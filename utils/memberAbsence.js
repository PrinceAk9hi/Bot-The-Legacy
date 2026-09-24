const {randomUUID}=require('node:crypto');
const {EmbedBuilder,ActionRowBuilder,StringSelectMenuBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags,Events,AttachmentBuilder}=require('discord.js');
const {IDENTITY,COLORS}=require('../config/soulSociety');
const {allowed}=require('./memberCare');
const {read,update,ensurePanel}=require('./recruitmentData');
const {parseParis}=require('./convocationTime');
const {isOff}=require('./lineState');
const CHANNEL='1479835698793156833',ABSENT='1479835820348145877',FROZEN='1486369745488969818',DAY=86400000;
const busy=new Set();let ticking=false,publishing=Promise.resolve();
function end(r){return Math.min(r.endExclusive??r.end+DAY,r.cancelledAt??Infinity);}
function overlaps(r,start,finish){return r.start<finish&&end(r)>start;}
function records(guildId,now=Date.now()){return Object.values(read('memberAbsences')).filter(r=>r.guildId===guildId&&end(r)>now).sort((a,b)=>a.start-b.start);}
function excused(guildId,userId,start,finish){return Object.values(read('memberAbsences')).some(r=>r.guildId===guildId&&r.userId===userId&&r.createdAt<=finish&&overlaps(r,start,finish));}
function row(...components){return new ActionRowBuilder().addComponents(...components);}
function payload(guildId){
 const all=records(guildId),lines=all.map(r=>`<@${r.userId}> • <t:${Math.floor(r.start/1000)}:f> → <t:${Math.floor(end(r)/1000)}:f>${(r.endExclusive??r.end+DAY)-r.start>=7*DAY?' • ❄️ Frozen':''}`);
 let list='',shown=0;for(const line of lines){if(list.length+line.length>3000)break;list+=line+'\n';shown++;}
 const embed=new EmbedBuilder().setColor(COLORS.primary).setTitle('📅 Absences • La Soul Society').setDescription('Déclare ton absence avec le menu ci-dessous.\n**Absent** pendant toute la période ; **Frozen** pour une absence d’une semaine ou plus. Les rôles ajoutés par ce système sont retirés au retour.\nUne absence couvrant une réunion dispense de l’avertissement pour non-présence.\n\n**Absences en cours et prévues**\n'+(list||'Aucune absence déclarée.')+(shown<all.length?`\n${all.length-shown} autre(s) absence(s) dans la liste jointe.`:''));
 return {embeds:[embed],components:[row(new StringSelectMenuBuilder().setCustomId('absence_panel').setPlaceholder('Déclarer une absence').addOptions(
  {label:'Moins de 24h',value:'short'},{label:'3 jours',value:'three'},{label:'1 semaine',value:'week'},{label:'Personnalisé',value:'custom'})),row(new ButtonBuilder().setCustomId('absence_return').setLabel('Je suis de retour / annuler mon absence').setStyle(ButtonStyle.Success))],allowedMentions:{parse:[]},attachments:[],files:shown<all.length?[new AttachmentBuilder(Buffer.from(all.map(r=>`${r.userId} : ${new Date(r.start).toISOString()} → ${new Date(end(r)).toISOString()}`).join('\n')),{name:'absences-completes.txt'})]:[]};
}
function publish(client){publishing=publishing.catch(()=>{}).then(()=>ensurePanel(client,CHANNEL,'absence_panel',payload(IDENTITY.guildId)));return publishing;}
async function syncMember(guild,userId,now=Date.now()){
 const member=await guild.members.fetch(userId).catch(e=>{if(e.code===10007)return null;throw e;});if(!member)return;
 const active=records(guild.id,now).filter(r=>r.userId===userId&&r.start<=now);
 const desired=new Set(active.length?[ABSENT]:[]);if(active.some(r=>(r.endExclusive??r.end+DAY)-r.start>=7*DAY))desired.add(FROZEN);
 for(const role of [ABSENT,FROZEN]){
  if(isOff())return;const key=guild.id+':'+userId+':'+role,own=read('absenceRoleOwners')[key];
  if(desired.has(role)){
   if(member.roles.cache.has(role))continue;
   // Persist ownership before the REST call so an uncertain response can be reconciled.
   if(!own)update('absenceRoleOwners',all=>{all[key]={guildId:guild.id,userId,role,at:now};});
   await member.roles.add(role,'Absence déclarée dans le panel');
  }else if(own){
   if(member.roles.cache.has(role))await member.roles.remove(role,'Fin de l’absence déclarée');
   update('absenceRoleOwners',all=>{delete all[key];});
  }
 }
}
async function declare(guild,userId,start,finish,reason=''){
 const now=Date.now();if(!Number.isFinite(start)||!Number.isFinite(finish)||start<now-60000||finish<=Math.max(start,now)||finish-start>366*DAY)throw Error('Vérifie les dates : début présent ou futur, fin après le début, durée maximale de 366 jours.');
 if(records(guild.id,now).some(r=>r.userId===userId))throw Error('Tu as déjà une absence en cours ou prévue. Utilise « Je suis de retour / annuler » avant de la remplacer.');
 const id=randomUUID();update('memberAbsences',all=>{all[id]={userId,guildId:guild.id,start,end:finish-1,endExclusive:finish,reason:reason.slice(0,900),createdAt:now,source:'absence-panel'};});
 let roles=true,panel=true;try{await syncMember(guild,userId);}catch(e){roles=false;console.error('Rôles absence :',e.code||e.message);}try{await publish(guild.client);}catch(e){panel=false;console.error('Panel absence :',e.code||e.message);}
 return `✅ Absence enregistrée jusqu’au <t:${Math.floor(finish/1000)}:f>.${roles?'':' ⚠️ Rôles non actualisés : la gestion doit vérifier leur hiérarchie et les permissions du bot.'}${panel?'':' ⚠️ Actualisation du panel en attente.'}`;
}
function field(id,label,value='',required=true){const f=new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(required).setMaxLength(id==='reason'?900:40);if(value)f.setValue(value);return row(f);}
async function handle(i){if(!i.customId?.startsWith('absence_'))return;if(!allowed(i)||isOff())return i.reply({content:'❌ Ce panel est réservé aux membres et le bot doit être actif.',flags:MessageFlags.Ephemeral});
 if(i.isStringSelectMenu()&&i.customId==='absence_panel'){
  const kind=i.values[0];if(!['short','three','week','custom'].includes(kind))return;
  const m=new ModalBuilder().setCustomId('absence_submit:'+kind).setTitle('Déclarer mon absence');
  if(kind==='short')m.addComponents(field('hours','Durée en heures (1 à 23)','12'));
  if(kind==='custom')m.addComponents(field('start','Début : JJ/MM/AAAA HH:MM ou maintenant','maintenant'),field('end','Fin : JJ/MM/AAAA HH:MM (heure de Paris)'));
  m.addComponents(field('reason','Motif (facultatif)','',false));return i.showModal(m);
 }
 if(!i.isModalSubmit()&&i.customId!=='absence_return')return;
 if(busy.has(i.user.id))return i.reply({content:'⏳ Ta demande est déjà en cours.',flags:MessageFlags.Ephemeral});busy.add(i.user.id);
 try{await i.deferReply({flags:MessageFlags.Ephemeral});
  if(i.customId==='absence_return'){
   const now=Date.now();update('memberAbsences',all=>{for(const r of Object.values(all))if(r.guildId===i.guildId&&r.userId===i.user.id&&end(r)>now)r.cancelledAt=now;});
   await syncMember(i.guild,i.user.id);await publish(i.client);return i.editReply('✅ Ton retour est enregistré. Les rôles ajoutés par le système ont été retirés.');
  }
  const kind=i.customId.split(':')[1],now=Date.now();let start=now,finish;
  if(kind==='short'){const h=Number(i.fields.getTextInputValue('hours'));if(!Number.isInteger(h)||h<1||h>23)throw Error('Choisis une durée entière de 1 à 23 heures.');finish=now+h*3600000;}
  else if(kind==='three'||kind==='week')finish=now+(kind==='three'?3:7)*DAY;
  else if(kind==='custom'){const s=i.fields.getTextInputValue('start').trim();start=s.toLowerCase()==='maintenant'?now:parseParis(s);finish=parseParis(i.fields.getTextInputValue('end').trim());}
  else throw Error('Choix inconnu.');
  return i.editReply(await declare(i.guild,i.user.id,start,finish,i.fields.getTextInputValue('reason').trim()));
 }catch(e){const p={content:'❌ '+e.message};if(i.deferred||i.replied)await i.editReply(p);else await i.reply({...p,flags:MessageFlags.Ephemeral});}finally{busy.delete(i.user.id);}
}
async function tick(client){if(ticking||isOff())return;ticking=true;try{const guild=client.guilds.cache.get(IDENTITY.guildId);if(!guild)return;
 const ids=new Set([...records(guild.id).map(r=>r.userId),...Object.values(read('absenceRoleOwners')).filter(r=>r.guildId===guild.id).map(r=>r.userId)]);
 for(const id of ids){if(isOff())return;try{await syncMember(guild,id);}catch(e){console.error('Synchronisation absence :',e.code||e.message);}}
 await publish(client);
 }finally{ticking=false;}}
function register(client){if(client.absenceRegistered)return;client.absenceRegistered=true;client.on(Events.InteractionCreate,i=>handle(i).catch(e=>console.error('Absence :',e.code||e.message)));
 const start=()=>{tick(client).catch(console.error);setInterval(()=>tick(client).catch(console.error),60000).unref();};if(client.isReady())start();else client.once(Events.ClientReady,start);
}
module.exports={CHANNEL,ABSENT,FROZEN,DAY,end,overlaps,records,excused,payload,publish,syncMember,declare,handle,tick,register};
