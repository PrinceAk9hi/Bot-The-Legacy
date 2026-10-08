const {randomUUID}=require('node:crypto');
const {SlashCommandBuilder,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,StringSelectMenuBuilder,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags,AttachmentBuilder}=require('discord.js');
const {IDENTITY,COLORS}=require('../config/soulSociety');
const {read,update}=require('../utils/recruitmentData');
const data=require('../utils/radioData');
const audio=require('../utils/radioAudio');
const busy=new Set();
const labels={done:'✅ Diffusée',duplicate:'⏭️ Auditeur déjà touché',empty:'⏭️ Vocal vide',permissions:'❌ Permissions insuffisantes',connection:'❌ Connexion impossible',audio:'❌ Erreur audio',timeout:'❌ Lecture expirée',missing:'⏭️ Salon supprimé',stopped:'⏹️ Arrêtée', 'duplicate-arrival':'⏹️ Arrivée d’un auditeur déjà touché'};
function payload(r,s){
 const running=Boolean(s),phase=s?.phase||r.status;
 const title=running?(phase==='preparing'?'Préparation de la voix…':phase==='restoring'?'Reprise de la musique…':`Diffusion ${s.index}/${s.rooms.length}`):['finished','stopped','error'].includes(phase)?'Tournée terminée':'Interphone de la fondation';
 const results=s?.results||r.results||[];
 const embed=new EmbedBuilder().setColor(COLORS.primary).setTitle('📻 '+title).setDescription(`**${r.title}**\n${audio.INTRO}.\n\n${r.text}`)
 .addFields({name:'Volume',value:'100 %',inline:true},{name:'Destination',value:'Tous les vocaux occupés au lancement, successivement.',inline:true})
 .setFooter({text:'Voix de synthèse • Carillon, annonce, puis musique détendue de 5 secondes'});
 if(s?.current)embed.addFields({name:'Salon actuel',value:`<#${s.current}>`});
 if(results.length)embed.addFields({name:'Suivi',value:results.slice(-8).map(x=>`${labels[x.status]||x.status} — <#${x.channelId}>`).join('\n').slice(0,1000)});
 if(s?.error||r.error)embed.addFields({name:'Information',value:(s?.error||r.error).slice(0,1000)});
 if(s?.restoreError||r.restoreError)embed.addFields({name:'Musique',value:(s?.restoreError||r.restoreError).slice(0,1000)});
 if(!running)embed.addFields({name:'Éviter les répétitions',value:'Un vocal contenant un auditeur déjà touché sera ignoré. Si cet auditeur arrive pendant la lecture dans un autre vocal, celle-ci sera coupée. Certains membres pourront donc n’entendre qu’une partie ou aucune annonce.'});
 const b=(action,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId(`radio:${r.id}:${action}`).setLabel(label).setStyle(style);
 let components;
 if(running)components=[new ActionRowBuilder().addComponents(b('stop','Arrêter',ButtonStyle.Danger))];
 else components=[new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`radio:${r.id}:template`).setPlaceholder('Annonces enregistrées').addOptions(Object.entries(data.templates()).slice(0,25).map(([value,v])=>({label:v.title.slice(0,100),value})))),new ActionRowBuilder().addComponents(b('edit','Écrire / modifier'),b('preview','Préécouter'),b('save','Enregistrer'),b('start','Diffuser dans les vocaux',ButtonStyle.Success))];
 return {embeds:[embed],components,allowedMentions:{parse:[]}};
}
async function show(i){
 if(i.guildId!==IDENTITY.guildId||!data.allowed(i))return i.reply({content:'❌ Radio réservée à Aven, aux fondateurs et au Bras droit.',flags:MessageFlags.Ephemeral});
 const radio=require('./radio')(i.client),s=radio.state(i.guildId);
 if(s)return i.reply(payload(data.get(s.id),s));
 const id=randomUUID().slice(0,8),r={id,guildId:i.guildId,authorId:i.user.id,title:'Rassemblement',text:data.defaults.gather.text,status:'ready',createdAt:Date.now()};
 update('radioDrafts',all=>{all[id]=r;const old=Object.keys(all).filter(k=>all[k].status!=='running').sort((a,b)=>(all[b].createdAt||0)-(all[a].createdAt||0));for(const key of old.slice(100))delete all[key];});return i.reply(payload(r));
}
async function handle(i){
 if(!i.customId?.startsWith('radio:'))return;
 const [,id,action]=i.customId.split(':'),r=data.get(id),radio=require('./radio')(i.client);
 const fail=content=>i.reply({content:'❌ '+content,flags:MessageFlags.Ephemeral});
 if(i.guildId!==IDENTITY.guildId||!data.allowed(i)||!r||r.guildId!==i.guildId)return fail('Panneau inaccessible.');
 if(i.message?.author.id!==i.client.user.id)return;
 if(action!=='stop'&&r.authorId!==i.user.id)return fail('Ce panneau appartient à son auteur. Lance =radio pour créer le tien.');
 if(action==='stop'){
  await i.deferUpdate();const actor=await i.guild.members.fetch({user:i.user.id,force:true});if(!data.allowed(actor))return i.followUp({content:'❌ Accès refusé.',flags:MessageFlags.Ephemeral});
  const state=radio.state(i.guildId);if(state?.id===id)radio.stop(i.guildId);
  return i.followUp({content:'⏹️ Arrêt demandé. La musique précédente sera reprise si possible.',flags:MessageFlags.Ephemeral});
 }
 if(require('../utils/lineState').isOff())return fail('Le bot est en pause.');
 if(radio.active(i.guildId)||busy.has(id))return fail('Une préparation ou diffusion est déjà en cours.');
 if(action==='edit')return i.showModal(new ModalBuilder().setCustomId(`radio:${id}:edited`).setTitle('Annonce de la fondation').addComponents(
  new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Titre du modèle').setStyle(TextInputStyle.Short).setMaxLength(80).setValue(r.title)),
  new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text').setLabel('Annonce — introduction ajoutée automatiquement').setStyle(TextInputStyle.Paragraph).setMaxLength(600).setValue(r.text))));
 busy.add(id);
 try{
  await i.deferUpdate();const actor=await i.guild.members.fetch({user:i.user.id,force:true});if(!data.allowed(actor))throw Error('Accès refusé.');
  if(action==='edited'){
   const title=i.fields.getTextInputValue('title').trim(),text=i.fields.getTextInputValue('text').trim();if(!title||!text)throw Error('Le titre et le texte sont obligatoires.');
   data.save(id,v=>{v.title=title;v.text=text;v.status='ready';v.results=[];v.error='';v.restoreError='';});
  }else if(action==='template'){
   const t=data.templates()[i.values[0]];if(!t)throw Error('Annonce introuvable.');data.save(id,v=>{v.title=t.title;v.text=t.text;v.status='ready';v.results=[];v.error='';v.restoreError='';});
  }else if(action==='save'){
   update('radioTemplates',all=>{const existing=Object.keys(all).find(k=>all[k].title===r.title);if(!existing&&Object.keys(all).length>=22)throw Error('22 annonces personnalisées maximum. Réutilise un titre existant pour la remplacer.');all[existing||randomUUID().slice(0,8)]={title:r.title,text:r.text,authorId:i.user.id};});
   await i.followUp({content:'✅ Annonce enregistrée. Un titre identique remplace le modèle personnalisé existant.',flags:MessageFlags.Ephemeral});
  }else if(action==='preview'){
   const pcm=await audio.generate(r.text);const mp3=await audio.preview(pcm);await i.followUp({content:'🔊 Préécoute — voix de synthèse, carillon et musique de fin.',files:[new AttachmentBuilder(mp3,{name:'annonce-radio.mp3'})],flags:MessageFlags.Ephemeral});
  }else if(action==='start'){
   // Store the actual message rather than an expiring interaction webhook.
   const message=i.message;await radio.start(i.guild,r,async state=>message.edit(payload(data.get(id),['finished','error','stopped'].includes(state.phase)?null:state)));return;
  }
  await i.editReply(payload(data.get(id)));
 }catch(e){await i.followUp({content:'❌ '+(e.status?'Synthèse vocale indisponible ('+e.status+').':String(e.message||'Erreur radio.').slice(0,300)),flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}}).catch(()=>{});}
 finally{busy.delete(id);}
}
module.exports={show,handle,payload};
