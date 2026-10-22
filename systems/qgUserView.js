const {ContainerBuilder,SectionBuilder,TextDisplayBuilder,ThumbnailBuilder,SeparatorBuilder,ActionRowBuilder:Row,ButtonBuilder:Button,ButtonStyle:S,ChannelSelectMenuBuilder,ChannelType,MessageFlags:F}=require('discord.js');
const a=require('../utils/qgAdmin'),rp=require('./qgRpStatus');
const clean=require('../utils/qgAiKnowledge').clean;
const stamp=value=>value?`<t:${Math.floor(value/1000)}:f>`:'Non disponible';
const text=value=>new TextDisplayBuilder().setContent(value);
function render(actor,member,id,tab='profile'){
 const button=(action,label,style=S.Secondary,disabled=false)=>{const b=new Button().setCustomId(`qgu:action:${id}:${action}`).setLabel(label).setStyle(style).setDisabled(disabled);if(['rankup','derank','demote'].includes(action))b.setEmoji({id:action==='rankup'?'1562837067782950924':'1562836899226324992',name:action==='rankup'?'statusonline':'statusoffline',animated:true});return b;};
 const row=(...buttons)=>new Row().addComponents(...buttons);
 const can=action=>a.can(actor,action);
 const state=rp.status(member.id);
 const linked=a.state().schoolEntryVerification?.[member.id];
 const roblox=linked?.robloxId&&/^\d+$/.test(String(linked.robloxId))?`[${clean(linked.robloxName||'Profil Roblox')}](https://www.roblox.com/users/${linked.robloxId}/profile)${linked.confirmedAt?' — profil déclaré et confirmé':' — vérification en cours'}`:'Aucun compte Roblox QG lié';
 const box=new ContainerBuilder().setAccentColor(0xffffff)
 .addSectionComponents(new SectionBuilder().addTextDisplayComponents(text(`## 👤 Panel membre • ${clean(member.user.username).slice(0,80)}\nPanel de gestion rapide de <@${member.id}>`)).setThumbnailAccessory(new ThumbnailBuilder().setURL(member.user.displayAvatarURL())))
 .addActionRowComponents(row(...[['profile','👤 Profil'],['voice','🔊 Vocal'],['management','🛡️ Gestion']].map(([key,label])=>new Button().setCustomId(`qgu:tab:${id}:${key}`).setLabel(label).setStyle(tab===key?S.Primary:S.Secondary))))
 .addSeparatorComponents(new SeparatorBuilder());
 const statuses=`### ⚙️ Restrictions et statuts\nPrison : **${state.prison?'🔒 Active':'Inactive'}**\nMenottes : **${state.handcuffs?'🔒 Actives':'🔓 Inactives'}**\nChien RP : **${state.dog?'Actif':'Inactif'}**`;
 if(tab==='profile'){
  const roles=[...member.roles.cache.values()].filter(r=>r.id!==member.guild.id).sort((x,y)=>y.position-x.position);
  let shown=[],size=0;for(const role of roles){const mention=`<@&${role.id}>`;if(size+mention.length>1400||shown.length>=30)break;shown.push(mention);size+=mention.length+2;}
  box.addTextDisplayComponents(text(`### 👤 Utilisateur\n**Nom Discord :** ${clean(member.user.username)}\n**Nom serveur :** ${clean(member.displayName)}\n**ID :** \`${member.id}\`\n**Bot :** ${member.user.bot?'Oui':'Non'}\n\n### 🎮 Roblox\n${roblox}\n\n### 📅 Compte\n**Créé :** ${stamp(member.user.createdTimestamp)}\n**Arrivé sur le serveur :** ${stamp(member.joinedTimestamp)}\n\n### 🎭 Rôles\n${shown.join(', ')||'Aucun rôle'}${roles.length>shown.length?`\n+ ${roles.length-shown.length} autre(s) rôle(s)`:''}`))
  .addSeparatorComponents(new SeparatorBuilder()).addActionRowComponents(row(button('applications','📋 Profil candidat'),button('stats','📊 Statistiques')));
 }else if(tab==='voice'){
  const connected=!!member.voice?.channelId,allowed=can('prison');
  box.addTextDisplayComponents(text(`### 🔊 Vocal\n**Salon :** ${connected?`<#${member.voice.channelId}>`:'❌ Aucun vocal'}\n**État :** ${connected?'Connecté':'Non connecté'}\n**Micro personnel :** ${member.voice?.selfMute?'Coupé':'Non coupé'}\n**Casque personnel :** ${member.voice?.selfDeaf?'Coupé':'Non coupé'}\n**Micro serveur :** ${member.voice?.serverMute?'Coupé':'Non coupé'}\n\n${statuses}`))
  .addActionRowComponents(row(...[['bring','📥 Bring',S.Primary],['back','↩️ Back',S.Secondary],['disconnect','☎ Déconnecter',S.Danger]].map(([key,label,style])=>new Button().setCustomId(`qgu:voice:${id}:${key}`).setLabel(label).setStyle(style).setDisabled(!allowed||!connected||(key==='bring'&&!actor.voice?.channelId)||(key==='back'&&!a.state().schoolUserSessions?.[id]?.previousVoiceId)))))
  .addActionRowComponents(row(button('handcuffs','🔒 Menotter',S.Danger,!can('handcuffs')||!!state.handcuffs),button('unhandcuffs','🔓 Déménotter',S.Success,!can('unhandcuffs')||!state.handcuffs),button('dog','🐕 CH',S.Primary,!can('dog')||!!state.dog),button('undog','🦴 UNCH',S.Secondary,!can('undog')||!state.dog)))
  .addActionRowComponents(new Row().addComponents(new ChannelSelectMenuBuilder().setCustomId(`qgu:voice:${id}:move`).setPlaceholder('🔊 Déplacer dans une voc…').setChannelTypes(ChannelType.GuildVoice).setMinValues(1).setMaxValues(1).setDisabled(!allowed||!connected)));
 }else{
  const timeout=member.communicationDisabledUntilTimestamp>Date.now()?stamp(member.communicationDisabledUntilTimestamp):'Aucun';
  box.addTextDisplayComponents(text(`### 🛡️ Modération\n**Timeout :** ${timeout}\n**Bannissable par le bot :** ${member.bannable?'✅ Oui':'❌ Non'}\n**Expulsable par le bot :** ${member.kickable?'✅ Oui':'❌ Non'}\n**Modérable par le bot :** ${member.moderatable?'✅ Oui':'❌ Non'}\n\n${statuses}`))
  .addSeparatorComponents(new SeparatorBuilder())
  .addActionRowComponents(row(button('derank','Derank',S.Danger,!can('derank')),button('rankup','Rankup',S.Secondary,!can('rankup')),button('demote','Rétrograder',S.Secondary,!can('demote')),button('prison','Prison',S.Danger,!can('prison')||!!state.prison),button('release','Libérer',S.Success,!can('release')||!state.prison)))
  .addActionRowComponents(row(button('management','🛡️ Gestions et responsables'),button('applications','📋 Candidatures'),button('stats','📊 Historique et statistiques')));
  box.addActionRowComponents(row(new Button().setCustomId(`qgu:tool:${id}:convocation`).setLabel('📨 Convoquer').setStyle(S.Secondary).setDisabled(!a.isDirection(actor)&&!a.has(actor,['recruitmentLead','recruitmentManagement'])),button('validate','✅ Valider le test',S.Success,!can('rankup')||!member.roles.cache.has(a.state().schoolRoles?.test)),button('sanctions','🛡️ Sanctions',S.Danger,!can('prison'))))
  .addActionRowComponents(row(...[['locknick','🔒 Lock pseudo'],['unlocknick','🔓 Unlock pseudo']].map(([action,label])=>new Button().setCustomId(`qgu:tool:${id}:${action}`).setLabel(label).setStyle(S.Secondary).setDisabled(!a.isDirection(actor)))));
 }
 box.addTextDisplayComponents(text('-# Fondateur - QG • Panel privé, réservé à son auteur.'));
 return{flags:F.IsComponentsV2,components:[box],allowedMentions:{parse:[]}};
}
module.exports={render};
