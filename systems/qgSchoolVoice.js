const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits: P, MessageFlags, ChannelType, EmbedBuilder } = require('discord.js');
const { read, update } = require('../utils/recruitmentData');
const config = require('../config/qg');
const layout = require('../config/qgSchoolLayout');
const save = fn => update('qgServer', fn);
const state = () => read('qgServer');
const familyKeys = ['senior','prestigious','expert','confirmed','test','ticketsLead','recruitmentLead','animationLead','networksLead','ticketsManagement','recruitmentManagement','animationManagement','networksManagement'];
const accessRoles = (r,kind) => kind==='family' ? ['creator','globalManager','administrator',...familyKeys].map(k=>r[k]).filter(Boolean) : ['verified','community','creator','globalManager','administrator',...familyKeys].map(k=>r[k]).filter(Boolean);
const isFamily = member => { const r=state().schoolRoles||{};return ['creator','globalManager','administrator',...familyKeys].some(k=>r[k]&&member.roles.cache.has(r[k])); };
const allowedMentions={parse:[]};
async function voice(oldState,newState,client){
 const s=state(),channels=s.schoolChannels||{},roles=s.schoolRoles||{},member=newState.member;
 if(newState.guild.id!==config.guildId||!member||member.user.bot)return false;
 const kinds=[['createCommunityVoice','community','communityVoice'],['createFamilyVoice','family','familyVoice']];
 for(const [entry,kind,scope] of kinds){
  if(newState.channelId!==channels[entry]||oldState.channelId===newState.channelId)continue;
  if(kind==='family'&&!isFamily(member))return true;
  if(kind==='community'&&!member.roles.cache.has(roles.community)&&!member.roles.cache.has(s.roles?.member))return true;
  const current=Object.entries(s.schoolTemporaryVoices||{}).find(([,rec])=>rec.ownerId===member.id&&rec.kind===kind);
  let room=current?await newState.guild.channels.fetch(current[0]).catch(()=>null):null;
  if(!room){
   const parentId=(s.schoolCategories||{})[kind==='family'?'familyVoice':'communityVoice'];if(!parentId)throw new Error('Installe d’abord la structure SchoolRP.');
   const overwrites=layout.overwrites(newState.guild.id,client.user.id,roles,scope,{channelKey:'temporaryVoice'});
   overwrites.push({id:member.id,allow:[P.ViewChannel,P.Connect,P.Speak,P.UseVAD,P.ManageChannels,P.MoveMembers]});
   room=await newState.guild.channels.create({name:`🔊・Vocal de ${member.displayName}`.slice(0,95),type:ChannelType.GuildVoice,parent:parentId,permissionOverwrites:overwrites,reason:'Création d’un vocal temporaire SchoolRP'});
   save(x=>{x.schoolTemporaryVoices||={};x.schoolTemporaryVoices[room.id]={ownerId:member.id,kind,createdAt:Date.now(),locked:false};});
   if(room.isTextBased())await room.send({content:`<@${member.id}>`,embeds:[new EmbedBuilder().setColor(0x211a35).setTitle('Contrôles du vocal').setDescription('Gère ton salon avec les boutons ci-dessous.').setFooter({text:'Soul Society • Vocaux temporaires'})],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('qgs:temp:rename').setLabel('Renommer').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('qgs:temp:limit').setLabel('Places').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId('qgs:temp:lock').setLabel('Verrouiller / ouvrir').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('qgs:temp:allow').setLabel('Autoriser un membre').setStyle(ButtonStyle.Success))],allowedMentions});
  }
  const fresh=await newState.guild.members.fetch(member.id);await fresh.voice.setChannel(room,'Création d’un vocal temporaire');return true;
 }
 const rec=oldState.channelId&&s.schoolTemporaryVoices?.[oldState.channelId];
 if(rec){const room=oldState.guild.channels.cache.get(oldState.channelId);if(room&&room.members.size===0){await room.delete('Vocal temporaire vide');save(x=>{delete x.schoolTemporaryVoices[oldState.channelId];});}}
 return false;
}
function authorized(member,rec){const r=state().schoolRoles||{};return member.id===rec.ownerId||member.id===member.guild.ownerId||member.id===config.ownerId||['creator','globalManager','administrator'].some(k=>r[k]&&member.roles.cache.has(r[k]));}
async function handle(i){
 if(!i.customId?.startsWith('qgs:temp:'))return false;
 const rec=state().schoolTemporaryVoices?.[i.channelId],member=await i.guild.members.fetch(i.user.id);
 if(!rec||!authorized(member,rec))return i.reply({content:'Action réservée au propriétaire du vocal et à la Direction.',flags:MessageFlags.Ephemeral});
 const action=i.customId.split(':')[2];
 if(action==='rename'||action==='limit'||action==='allow'){
  const modal=new ModalBuilder().setCustomId(`qgs:temp-modal:${action}`).setTitle(action==='rename'?'Renommer le vocal':action==='limit'?'Limiter les places':'Autoriser un membre');
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('value').setLabel(action==='rename'?'Nouveau nom':action==='limit'?'Limite (0 = illimitée)':'ID Discord du membre').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(action==='rename'?90:32)));
  return i.showModal(modal);
 }
 if(action==='lock'){
  await i.deferReply({flags:MessageFlags.Ephemeral});const next=!rec.locked,room=i.channel;
  for(const id of accessRoles(state().schoolRoles||{},rec.kind))if(id!==rec.ownerId)await room.permissionOverwrites.edit(id,{Connect:!next});
  rec.locked=next;save(s=>{s.schoolTemporaryVoices[i.channelId]=rec;});return i.editReply(next?'🔒 Vocal verrouillé.':'🔓 Vocal ouvert.');
 }
 return false;
}
async function modal(i){
 if(!i.customId?.startsWith('qgs:temp-modal:'))return false;
 const action=i.customId.split(':')[2],rec=state().schoolTemporaryVoices?.[i.channelId],member=await i.guild.members.fetch(i.user.id);
 if(!rec||!authorized(member,rec))return i.reply({content:'Vocal introuvable ou action non autorisée.',flags:MessageFlags.Ephemeral});
 await i.deferReply({flags:MessageFlags.Ephemeral});const value=i.fields.getTextInputValue('value').trim();
 if(action==='rename'){
  const name=value.replace(/[\r\n]/g,' ').trim().slice(0,95);if(!name)return i.editReply('Nom invalide.');await i.channel.setName(name);return i.editReply('✅ Vocal renommé.');
 }
 if(action==='limit'){
  const limit=Number(value);if(!Number.isInteger(limit)||limit<0||limit>99)return i.editReply('Indique une limite de 0 à 99.');await i.channel.setUserLimit(limit);return i.editReply(`✅ Limite définie : ${limit||'illimitée'}.`);
 }
 if(action==='allow'){
  if(!/^\d{17,20}$/.test(value))return i.editReply('ID Discord invalide.');const target=await i.guild.members.fetch(value).catch(()=>null);if(!target)return i.editReply('Membre introuvable.');await i.channel.permissionOverwrites.edit(value,{ViewChannel:true,Connect:true});return i.editReply(`✅ ${target.user.username} peut rejoindre ce vocal.`);
 }
 return false;
}
function clean(guild){const s=state();for(const [id] of Object.entries(s.schoolTemporaryVoices||{})){const room=guild.channels.cache.get(id);if(!room||room.members.size===0){if(room)room.delete('Nettoyage des vocaux temporaires après redémarrage').catch(()=>{});save(x=>{delete x.schoolTemporaryVoices[id];});}}}
module.exports={voice,handle,modal,clean,_test:{accessRoles,isFamily}};
