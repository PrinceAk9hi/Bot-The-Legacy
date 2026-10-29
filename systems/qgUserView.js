const {ContainerBuilder,SectionBuilder,TextDisplayBuilder,ThumbnailBuilder,SeparatorBuilder,MediaGalleryBuilder,MediaGalleryItemBuilder,ActionRowBuilder:Row,ButtonBuilder:Button,ButtonStyle:S,ChannelSelectMenuBuilder,ChannelType,MessageFlags:F}=require('discord.js');
const a=require('../utils/qgAdmin'),rp=require('./qgRpStatus');
const {read}=require('../utils/recruitmentData');
const clean=require('../utils/qgAiKnowledge').clean;
const stamp=value=>value?`<t:${Math.floor(value/1000)}:f>`:'Non disponible';
const ago=value=>value?`<t:${Math.floor(value/1000)}:R>`:'jamais';
const text=value=>new TextDisplayBuilder().setContent(value);
const TABS=[['profile','👤 Aperçu'],['activity','📈 Activité'],['voice','🔊 Vocal'],['management','🛡️ Gestion'],['records','📋 Dossiers']];
const fr=n=>Math.round(n).toLocaleString('fr-FR');
const duration=ms=>ms>=3600000?(ms/3600000).toFixed(1).replace('.',',')+' h':Math.round(ms/60000)+' min';
// Évolution par rapport à la semaine précédente.
function trend(now,before){if(!before)return now?'🆕':'—';const p=Math.round((now-before)/before*100);return p>0?`↗️ +${p} %`:p<0?`↘️ ${p} %`:'➡️ stable';}
const held=(member,keys)=>keys.filter(k=>a.state().schoolRoles?.[k]&&member.roles.cache.has(a.state().schoolRoles[k])).map(k=>member.guild.roles.cache.get(a.state().schoolRoles[k])?.name||k);

function activity(member){
 const metrics=require('./qgMemberMetrics'),levels=require('./qgLevels'),now=Date.now();
 const week=metrics.week(member.id,now),prev=metrics.week(member.id,now,true),total=metrics.total(member.id);
 const all=read('qgXp'),xp=all[member.id]?.xp||0,level=levels.level(xp),next=levels.threshold(level+1);
 const position=xp?Object.entries(all).filter(([,v])=>typeof v?.xp==='number').sort((p,q)=>q[1].xp-p[1].xp).findIndex(([k])=>k===member.id)+1:0;
 const casino=require('./qgCasinoGames').store.peek(member.id),rankup=metrics.lastRankup(member.id);
 const bar=Math.round(Math.max(0,Math.min(1,(xp-levels.threshold(level))/Math.max(1,next-levels.threshold(level))))*12);
 return `### 📈 Niveau\n**Niveau ${level}** · ${fr(xp)} XP${position?` · **#${position}** du serveur`:''}\n\`${'▰'.repeat(bar)}${'▱'.repeat(12-bar)}\` encore ${fr(next-xp)} XP\n\n`+
  `### 🗓️ 7 derniers jours\n**Messages :** ${fr(week.messages)} · ${trend(week.messages,prev.messages)}\n**Vocal :** ${duration(week.voiceMs)} · ${trend(week.voiceMs,prev.voiceMs)}\n**Vocal total :** ${total?duration(total.milliseconds):'non mesuré'}${total?.measuredSince?` (depuis ${stamp(total.measuredSince)})`:''}\n**Dernière promotion :** ${rankup?ago(rankup):'aucune enregistrée'}\n\n`+
  `### 🎰 Casino\n${casino?`**Solde :** ${fr(casino.balance)} jetons · **Parties :** ${fr(casino.played)} · **Net :** ${casino.returned-casino.wagered>0?'+':''}${fr(casino.returned-casino.wagered)}${casino.frozen?'\n🧊 **Compte gelé**':''}${casino.game?'\n🕹️ Partie en cours':''}\nDernière partie : ${ago(casino.history?.[0]?.at)}`:'Aucune partie jouée.'}`;
}
function records(actor,member){
 const s=a.state(),apps=require('./qgUserPanel').applications(actor,member);
 const convocations=(s.schoolConvocations||[]).filter(c=>c.targetId===member.id).slice(-3).reverse();
 const warnings=held(member,['warning1','warning2','lastChance']);
 const history=(s.schoolAdminHistory||[]).filter(e=>e.targetId===member.id).slice(-6).reverse();
 return `### 📋 Candidatures\n${apps.map(x=>`**${x.type}** · ${x.status} · ${stamp(x.updatedAt||x.createdAt)}${x.updatedBy?` · <@${x.updatedBy}>`:''}`).join('\n')||'Aucun dossier auquel tu as accès.'}\n\n`+
  `### 📨 Convocations\n${convocations.map(c=>`${stamp(c.at)} · par <@${c.actorId}>${c.reason?` · ${clean(c.reason).slice(0,80)}`:''}`).join('\n')||'Aucune convocation.'}\n\n`+
  `### ⚠️ Avertissements\n${warnings.join(', ')||'Aucun avertissement actif.'}\n\n`+
  `### 🧾 Historique administratif\n${a.isDirection(actor)?history.map(e=>`${ago(e.at)} · **${e.action}** · ${e.result==='success'?'✅':'❌'} · <@${e.actorId}>`).join('\n')||'Aucune action enregistrée.':'Réservé à la direction.'}`;
}

function render(actor,member,id,tab='profile'){
 const button=(action,label,style=S.Secondary,disabled=false)=>{const b=new Button().setCustomId(`qgu:action:${id}:${action}`).setLabel(label).setStyle(style).setDisabled(disabled);if(['rankup','derank','demote'].includes(action))b.setEmoji({id:action==='rankup'?'1562837067782950924':'1562836899226324992',name:action==='rankup'?'statusonline':'statusoffline',animated:true});return b;};
 const row=(...buttons)=>new Row().addComponents(...buttons);
 const can=action=>a.can(actor,action);
 const state=rp.status(member.id);
 const linked=a.state().schoolEntryVerification?.[member.id];
 const age=require('./qgAgeProfiles').bracket(member.id),ageLabel=age?'+'+age+' (déclarée, non vérifiée par Roblox)':'Non renseignée';
 const roblox=linked?.robloxId&&/^\d+$/.test(String(linked.robloxId))?`[${clean(linked.robloxName||'Profil Roblox')}](https://www.roblox.com/users/${linked.robloxId}/profile)${linked.confirmedAt?' — profil déclaré et confirmé':' — vérification en cours'}`:'Aucun compte Roblox QG lié';
 const session=a.state().schoolUserSessions?.[id]||{},card=Boolean(session.card);
 // Résumé en une ligne : grade, gestions et statuts actifs.
 let grade=null;try{grade=require('./qgUserPanel').rank(member);}catch{}
 const teams=held(member,Object.keys(a.teams)),leads=held(member,Object.values(a.teams));
 const chips=[a.isDirection(member)?'👑 Direction':grade?'🎖️ '+require('./qgGrades').names[require('./qgGrades').ranks.indexOf(grade)]:'🎖️ Sans grade',...leads.map(n=>'⭐ '+n),...teams.map(n=>'🛡️ '+n),state.prison&&'🔒 Prison',state.handcuffs&&'⛓️ Menotté',state.dog&&'🐕 Chien RP',member.voice?.channelId&&'🔊 En vocal'].filter(Boolean);
 const box=new ContainerBuilder().setAccentColor(card?0xa3262a:0xffffff);
 if(card)box.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://profil-qg.png').setDescription('Carte de membre de '+clean(member.displayName).slice(0,80))));
 box.addSectionComponents(new SectionBuilder().addTextDisplayComponents(text(`## 🗂️ Dossier de membre • ${clean(member.displayName).slice(0,80)}\n<@${member.id}> · ${chips.join(' · ')}`)).setThumbnailAccessory(new ThumbnailBuilder().setURL(member.user.displayAvatarURL())))
 .addActionRowComponents(row(...TABS.map(([key,label])=>new Button().setCustomId(`qgu:tab:${id}:${key}`).setLabel(label).setStyle(tab===key?S.Primary:S.Secondary))))
 .addSeparatorComponents(new SeparatorBuilder());
 const statuses=`### ⚙️ Restrictions et statuts\nPrison : **${state.prison?'🔒 Active':'Inactive'}**\nMenottes : **${state.handcuffs?'🔒 Actives':'🔓 Inactives'}**\nChien RP : **${state.dog?'Actif':'Inactif'}**`;
 if(tab==='profile'){
  const roles=[...member.roles.cache.values()].filter(r=>r.id!==member.guild.id).sort((x,y)=>y.position-x.position);
  let shown=[],size=0;for(const role of roles){const mention=`<@&${role.id}>`;if(size+mention.length>1400||shown.length>=30)break;shown.push(mention);size+=mention.length+2;}
  box.addTextDisplayComponents(text(`### 👤 Utilisateur\n**Nom Discord :** ${clean(member.user.username)}\n**Nom serveur :** ${clean(member.displayName)}\n**ID :** \`${member.id}\`\n**Bot :** ${member.user.bot?'Oui':'Non'}\n\n### 🎮 Roblox\n${roblox}\n**Tranche d’âge Roblox :** ${ageLabel}\n\n### 📅 Compte\n**Créé :** ${stamp(member.user.createdTimestamp)}\n**Arrivé sur le serveur :** ${stamp(member.joinedTimestamp)}\n\n### 🎭 Rôles\n${shown.join(', ')||'Aucun rôle'}${roles.length>shown.length?`\n+ ${roles.length-shown.length} autre(s) rôle(s)`:''}`))
  .addSeparatorComponents(new SeparatorBuilder()).addActionRowComponents(row(button('applications','📋 Profil candidat'),button('stats','📊 Statistiques')));
 }else if(tab==='activity'){
  box.addTextDisplayComponents(text(activity(member)));
 }else if(tab==='records'){
  box.addTextDisplayComponents(text(records(actor,member)))
  .addSeparatorComponents(new SeparatorBuilder()).addActionRowComponents(row(button('applications','📋 Ouvrir les dossiers'),new Button().setCustomId(`qgu:tool:${id}:convocation`).setLabel('📨 Convoquer').setStyle(S.Secondary).setDisabled(!a.isDirection(actor)&&!a.has(actor,['recruitmentLead','recruitmentManagement'])),button('sanctions','🛡️ Sanctions',S.Danger,!can('prison')),button('stats','📊 Statistiques')));
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
 box.addSeparatorComponents(new SeparatorBuilder()).addActionRowComponents(row(...[card&&new Button().setCustomId(`qgu:publish:${id}`).setLabel('📰 Publier la carte').setStyle(S.Secondary),new Button().setCustomId(`qgu:refresh:${id}:${tab}`).setLabel('🔄 Actualiser').setStyle(S.Secondary)].filter(Boolean)));
 box.addTextDisplayComponents(text('-# '+require('../utils/qgBrand').signature+' • Dossier privé, réservé à son auteur · expire 10 min après ouverture.'));
 return{flags:F.IsComponentsV2,components:[box],allowedMentions:{parse:[]}};
}
module.exports={render,activity,records,TABS};
