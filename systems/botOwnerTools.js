const {randomUUID}=require('node:crypto');
const {SlashCommandBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags,AttachmentBuilder,escapeMarkdown,Events}=require('discord.js');
const {read,update}=require('../utils/recruitmentData');
const config=require('../config/qg');
const guilds=new Set([config.guildId,require('../config/soulSociety').IDENTITY.guildId]);
const pending=new Map();let running=false;
const allowedMentions={parse:[],repliedUser:false};
const store=fn=>update('ownerTools',fn);
function authorized(id,guildId){return id===config.ownerId&&guilds.has(guildId);}
function data(name){
 const d=new SlashCommandBuilder().setName(name).setDescription(name==='mpall'?'Envoyer un MP aux membres de ce serveur — propriétaire uniquement':'Envoyer un MP aux utilisateurs sélectionnés — propriétaire uniquement').setDMPermission(false);
 if(name==='mp')d.addStringOption(o=>o.setName('ids').setDescription('IDs séparés par des espaces ou virgules (25 maximum)').setRequired(true).setMaxLength(600));
 return d.addStringOption(o=>o.setName('texte').setDescription('Message envoyé en privé').setRequired(true).setMaxLength(1600));
}
async function execute(i){
 if(!authorized(i.user.id,i.guildId))return i.reply({content:'Commande réservée au propriétaire du bot.',flags:MessageFlags.Ephemeral});
 await i.deferReply({flags:MessageFlags.Ephemeral});
 if(running)return i.editReply('Un envoi est déjà en cours. Attends son bilan.');
 const text=i.options.getString('texte',true).trim();if(!text)return i.editReply('Le texte ne peut pas être vide.');
 let ids;
 if(i.commandName==='mpall')ids=[...(await i.guild.members.fetch()).values()].filter(m=>!m.user.bot).map(m=>m.id);
 else{
  ids=[...new Set(i.options.getString('ids',true).trim().split(/[\s,;]+/))];
  if(!ids.length||ids.length>25||ids.some(id=>!/^\d{17,20}$/.test(id)))return i.editReply('Fournis de 1 à 25 IDs Discord valides, séparés par des espaces ou virgules.');
  // Résolution individuelle pendant l’envoi : un utilisateur inaccessible ne bloque pas le lot.
 }
 if(!ids.length)return i.editReply('Aucun destinataire humain dans ce serveur.');
 for(const [key,p] of pending)if(p.expires<Date.now()||p.owner===i.user.id)pending.delete(key);
 const key=randomUUID();pending.set(key,{owner:i.user.id,guildId:i.guildId,mode:i.commandName==='mp'?'ids':'guild',text,ids,expires:Date.now()+300000});
 return i.editReply({content:`**Serveur : ${i.guild.name} (${i.guildId})**\n**${ids.length} destinataire(s)**, ${i.commandName==='mp'?'sélectionnés par ID, même hors de ce serveur':'uniquement sur ce serveur'}. Confirmation valable 5 minutes.\n\nMessage :\n${text}`,allowedMentions,components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ownerDM:send:'+key).setLabel('Confirmer l’envoi').setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId('ownerDM:cancel:'+key).setLabel('Annuler').setStyle(ButtonStyle.Secondary))]});
}
async function handle(i){
 if(!authorized(i.user.id,i.guildId))return i.reply({content:'Ce bouton est réservé au propriétaire du bot.',flags:MessageFlags.Ephemeral});
 const [,action,key]=i.customId.split(':'),p=pending.get(key);
 if(!p||p.expires<Date.now()||p.owner!==i.user.id||p.guildId!==i.guildId)return i.reply({content:'Confirmation expirée. Relance la commande.',flags:MessageFlags.Ephemeral});
 if(action==='cancel'){pending.delete(key);return i.update({content:'Envoi annulé. Aucun MP envoyé.',components:[]});}
 if(action!=='send'||running)return i.reply({content:'Un envoi est déjà en cours.',flags:MessageFlags.Ephemeral});
 pending.delete(key);running=true;
 try{
  await i.update({content:`Envoi confirmé sur **${i.guild.name}** : ${p.ids.length} destinataires. Le bilan sera envoyé ici et en MP à ton compte.`,components:[],allowedMentions});
  store(s=>{s.jobs||={};for(const [id,j] of Object.entries(s.jobs))if(j.at<Date.now()-30*86400000)delete s.jobs[id];s.jobs[key]={guildId:p.guildId,mode:p.mode||'guild',owner:p.owner,at:Date.now(),total:p.ids.length,sent:0,failed:0,skipped:0,status:'running'};});
  const failures=[];
  for(const id of p.ids){
   let result='failed',user,reason='';
   try{
    user=p.mode==='ids'?await i.client.users.fetch(id,{force:true}):(await i.guild.members.fetch({user:id,force:true})).user;
    if(user.bot){result='skipped';reason='Compte bot : envoi ignoré.';}
    else{await user.send({content:p.text,allowedMentions});result='sent';}
   }catch(e){
    if(e.code===10007){result='skipped';reason='Ne fait plus partie du serveur : envoi ignoré.';}
    else if(e.code===10013)reason='Utilisateur introuvable.';
    else if(e.code===50007)reason='MP refusé par Discord ; cause exacte non précisée (confidentialité, blocage, etc.).';
    else if(e.code===50001||e.code===50013)reason='Accès refusé par Discord.';
    else reason='Envoi non confirmé : erreur technique ou réseau'+(Number.isInteger(e.code)?' (code '+e.code+')':'')+'.';
   }
   if(result!=='sent')failures.push({id,name:user?.username||'Nom indisponible',reason});
   store(s=>{s.jobs[key][result]++;});
   await new Promise(resolve=>setTimeout(resolve,1250));
  }
  store(s=>{s.jobs[key].status='finished';s.jobs[key].finishedAt=Date.now();});
  const j=read('ownerTools').jobs[key],content=`Bilan MP — ${i.guild.name} (${i.guildId})\nEnvoyés : ${j.sent} · Échecs : ${j.failed} · Ignorés : ${j.skipped}\nDiscord peut refuser les MP (confidentialité, blocage ou absence de serveur partagé). ${p.mode==='ids'?'Seuls les IDs confirmés ont été ciblés.':'Seuls les membres du serveur de lancement ont été ciblés.'}`;
  const lines=failures.map(x=>escapeMarkdown(x.name)+' — '+x.id+' : '+x.reason);
  const details=lines.length?'\n\n**Destinataires non livrés**\n'+lines.join('\n'):'\n\nTous les destinataires ont reçu le message.';
  const payload=content.length+details.length<=1900?{content:content+details,allowedMentions}:{content:content+'\n\nListe complète des destinataires non livrés dans le fichier joint.',allowedMentions,files:[new AttachmentBuilder(Buffer.from(failures.map(x=>x.name+' — '+x.id+' : '+x.reason).join('\n'),'utf8'),{name:'bilan-mp-non-livres.txt'})]};
  await i.editReply(payload).catch(()=>{});await i.user.send(payload).catch(()=>{});
 }catch(e){store(s=>{if(s.jobs?.[key])s.jobs[key].status='interrupted';});await i.editReply({content:'Envoi interrompu. Les messages déjà envoyés ne sont pas réexpédiés automatiquement.',components:[]}).catch(()=>{});}
 finally{running=false;}
}
async function message(m){
 if(!/^=bot(?:\s|$)/i.test(m.content||''))return false;
 if(!authorized(m.author.id,m.guildId)||m.author.bot)return true;
 const parts=m.content.trim().split(/\s+/),cmd=(parts[1]||'').toLowerCase();
 if(!cmd){await m.reply(require('./botPanel').payload(m.client,'',m.guildId));return true;}
 let action=cmd,text=parts.slice(2).join(' ');
 if(cmd==='statut'){action=text;text='';}
 action=({'écoute':'ecoute',competition:'participe','compétition':'participe',stop:'effacer'})[action]||action;
 try{require('../utils/botPresence').configure(action,text);require('../commandes/maintenance').maintenanceSystem.updateBotPresence(m.client);await m.reply({content:'Réglages de présence sauvegardés. Communs aux deux serveurs ; pause et maintenance restent prioritaires.',allowedMentions});}
 catch(e){await m.reply({content:e.message,allowedMentions});}
 return true;
}
function register(client){client.once(Events.ClientReady,()=>{try{store(s=>{for(const j of Object.values(s.jobs||{}))if(j.status==='running')j.status='interrupted';});}catch{console.error('Journal MP propriétaire : restauration impossible.');}});}
module.exports={data,execute,handle,message,register};
