const {ActionRowBuilder,ButtonBuilder,ButtonStyle,UserSelectMenuBuilder,EmbedBuilder,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags}=require('discord.js');
const {read,update}=require('../utils/recruitmentData');
const config=require('../config/qg');
const policy=require('./qgCommunityPolicy');
const state=()=>read('qgServer');
const save=fn=>update('qgServer',fn);
const row=(...items)=>new ActionRowBuilder().addComponents(items);
const button=(id,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
function panel(){return {embeds:[new EmbedBuilder().setFooter(require('../utils/qgBrand').footer()).setColor(0xffffff).setTitle('Mon vocal temporaire').setDescription('Rejoins « Créer sa voc », puis ouvre tes contrôles ici.\nRenomme ton salon, règle les places, verrouille l’accès et choisis les membres autorisés.')],components:[row(button('qgs:voice-controls','Gérer mon vocal',ButtonStyle.Primary))],allowedMentions:{parse:[]}};}
function controls(id,rec){return {embeds:[new EmbedBuilder().setFooter(require('../utils/qgBrand').footer()).setColor(0xffffff).setTitle('Contrôles de mon vocal').setDescription(`<#${id}>\nAccès : **${rec.locked?'verrouillé':'ouvert'}**\nLes autorisations nominatives n’ouvrent pas un vocal famille aux personnes extérieures à la famille.`)],components:[
 row(button(`qgs:voice:rename:${id}`,'Renommer'),button(`qgs:voice:limit:${id}`,'Places'),button(`qgs:voice:${rec.locked?'unlock':'lock'}:${id}`,rec.locked?'Ouvrir':'Verrouiller',ButtonStyle.Primary)),
 row(new UserSelectMenuBuilder().setCustomId(`qgs:voice:allow:${id}`).setPlaceholder('Autoriser un membre').setMaxValues(1)),
 row(new UserSelectMenuBuilder().setCustomId(`qgs:voice:remove:${id}`).setPlaceholder('Retirer une autorisation').setMaxValues(1))],allowedMentions:{parse:[]}};}
function eligible(member,rec,s){const r=s.schoolRoles||{};return policy.exempt(member,s)||(rec.kind==='family'?require('../config/qgSchoolLayout').allFamily.some(k=>r[k]&&member.roles.cache.has(r[k])):!!r.community&&member.roles.cache.has(r.community));}
const busy=new Set();
async function handle(i){
 if(i.customId!=='qgs:voice-controls'&&!i.customId?.startsWith('qgs:voice:')&&!i.customId?.startsWith('qgs:voice-form:'))return false;
 if(i.guildId!==config.guildId){await i.reply({content:'Action réservée au QG.',flags:MessageFlags.Ephemeral});return true;}
 const member=await i.guild.members.fetch(i.user.id),s=state();
 const id=i.customId==='qgs:voice-controls'?member.voice.channelId:i.customId.split(':')[3];
 const rec=s.schoolTemporaryVoices?.[id];
 if(!rec||!(member.id===rec.ownerId||policy.exempt(member,s))){await i.reply({content:'Rejoins ton vocal temporaire pour le gérer. Seuls son propriétaire et la Direction peuvent le modifier.',flags:MessageFlags.Ephemeral});return true;}
 const action=i.customId.split(':')[2];
 if(['rename','limit'].includes(action)&&!i.customId.startsWith('qgs:voice-form:')){
  await i.showModal(new ModalBuilder().setCustomId(`qgs:voice-form:${action}:${id}`).setTitle(action==='rename'?'Renommer le vocal':'Nombre de places').addComponents(row(new TextInputBuilder().setCustomId('value').setLabel(action==='rename'?'Nouveau nom':'De 0 (illimité) à 99').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(action==='rename'?80:2))));return true;
 }
 await i.deferReply({flags:MessageFlags.Ephemeral});
 if(busy.has(id)){await i.editReply('Une modification est déjà en cours. Réessaie dans un instant.');return true;}
 busy.add(id);
 try {
  const room=await i.guild.channels.fetch(id);if(!room?.isVoiceBased())throw Error('Ce vocal n’existe plus.');
  if(i.customId==='qgs:voice-controls'){await i.editReply(controls(id,rec));return true;}
  if(i.customId.startsWith('qgs:voice-form:')){
   const value=i.fields.getTextInputValue('value').trim();
   if(action==='rename'){if(!value||/@(?:everyone|here)/i.test(value))throw Error('Nom invalide.');await room.setName(`🔊・${value}`.slice(0,95));}
   else if(action==='limit'){if(!/^\d{1,2}$/.test(value))throw Error('Indique un nombre entre 0 et 99.');await room.setUserLimit(Number(value));}
  }else if(['lock','unlock'].includes(action)){
   const locked=action==='lock';
   const current=state().schoolTemporaryVoices[id];
   if(locked!==current.locked){
    if(locked){
     const previous={};
     for(const o of room.permissionOverwrites.cache.values())if(o.type===0&&!['creator','globalManager','administrator'].some(k=>s.schoolRoles?.[k]===o.id)&&!i.guild.roles.cache.get(o.id)?.tags?.botId)previous[o.id]=o.allow.has('Connect')?true:o.deny.has('Connect')?false:null;
     save(x=>{x.schoolTemporaryVoices[id].previousConnect=previous;});
     for(const key of Object.keys(previous))await room.permissionOverwrites.edit(key,{Connect:false});
    }else for(const [key,value] of Object.entries(current.previousConnect||{}))await room.permissionOverwrites.edit(key,{Connect:value});
    save(x=>{x.schoolTemporaryVoices[id].locked=locked;});
   }
  }else if(['allow','remove'].includes(action)){
   const target=await i.guild.members.fetch(i.values[0]);if(target.user.bot)throw Error('Sélectionne un membre.');
   if(target.id===rec.ownerId||policy.exempt(target,s))throw Error('L’accès du propriétaire et de la Direction ne se modifie pas ici.');
   if(action==='allow'&&!eligible(target,rec,s))throw Error('Ce membre ne possède pas l’accès communautaire ou familial requis.');
   await room.permissionOverwrites.edit(target.id,{ViewChannel:action==='allow'?true:null,Connect:action==='allow',...Object.fromEntries(policy.voiceDenied.map(k=>[k,false]))});
  }
  await i.editReply(controls(id,state().schoolTemporaryVoices[id]));return true;
 }catch(e){await i.editReply({content:e.code?`Action impossible (code ${e.code}). Vérifie les permissions du bot.`:e.message,embeds:[],components:[]});return true;}finally{busy.delete(id);}
}
module.exports={panel,controls,handle,eligible};
