const {randomUUID}=require('node:crypto');
const {PermissionFlagsBits:P,MessageFlags:F,ActionRowBuilder:Row,ButtonBuilder:Button,ButtonStyle:B}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const {embed}=require('./qgPanels');
const row=id=>new Row().addComponents(new Button().setCustomId(id).setLabel('Compléter mon profil').setStyle(B.Primary));
const get=id=>a.state().profileCatchup?.members?.[id];
const put=(id,value)=>a.save(s=>{s.profileCatchup||={};s.profileCatchup.members||={};s.profileCatchup.members[id]=value;});
const active=id=>!!get(id)&&get(id).status!=='complete';
function completeProfile(p){return p?.stage==='accepted'&&p.robloxId&&p.discordName&&p.confirmedAt;}
async function restrict(member,rec){
 const guild=member.guild,rules=a.state().schoolChannels?.rules||a.state().channels?.rules;
 if(!rules)throw Error('Salon règlement non configuré.');
 const channels=[...(await guild.channels.fetch()).values()].filter(ch=>ch&&!ch.isThread()&&ch.permissionOverwrites);
 const me=await guild.members.fetchMe();
 for(const ch of channels)if(!ch.permissionsFor(me)?.has(P.ManageRoles)||!ch.permissionOverwrites.cache.has(member.id)&&ch.permissionOverwrites.cache.size>=100)throw Error('Permissions ou capacité des dérogations insuffisantes : '+ch.id);
 for(const ch of channels){
  const target=ch.id===rules?{ViewChannel:true}:{ViewChannel:false,Connect:false};
  rec.channels||={};
  if(!rec.channels[ch.id]){
   const old=ch.permissionOverwrites.cache.get(member.id);
   rec.channels[ch.id]={allow:String(old?.allow.bitfield||0n),deny:String(old?.deny.bitfield||0n),existed:!!old,target};put(member.id,rec);
  }
  const now=ch.permissionOverwrites.cache.get(member.id);
  if(Object.entries(target).some(([key,value])=>value?!now?.allow.has(P[key]):!now?.deny.has(P[key])))await ch.permissionOverwrites.edit(member.id,target,{reason:'Profil QG à compléter : accès temporairement limité au règlement'});
 }
 if(member.voice.channelId)await member.voice.disconnect('Profil QG à compléter');
 rec.status='waiting';delete rec.error;put(member.id,rec);
}
async function restore(member,rec){
 for(const [id,old] of Object.entries(rec.channels||{})){
  const ch=await member.guild.channels.fetch(id).catch(e=>{if(e.code===10003)return null;throw e;});
  if(ch){
   const now=ch.permissionOverwrites.cache.get(member.id),patch={};
   for(const [key,value] of Object.entries(old.target)){
    const bit=P[key],prison=a.state().schoolRpStatus?.[member.id]?.prison;
    if(prison?.channels?.[id]&&(prison.restrictions||[]).includes(key)){
     // La sanction reste active ; sa libération future doit retrouver l'état antérieur au rattrapage.
     a.save(s=>{const snap=s.schoolRpStatus[member.id].prison.channels[id];snap.allow=String((BigInt(snap.allow)&~bit)|(BigInt(old.allow)&bit));snap.deny=String((BigInt(snap.deny)&~bit)|(BigInt(old.deny)&bit));});continue;
    }
    // Ne restaure que nos bits encore inchangés ; préserve les autres décisions du staff.
    if(value?now?.allow.has(bit):now?.deny.has(bit))patch[key]=(BigInt(old.allow)&bit)!==0n?true:(BigInt(old.deny)&bit)!==0n?false:null;
   }
   if(Object.keys(patch).length)await ch.permissionOverwrites.edit(member.id,patch,{reason:'Profil QG complété : restauration des accès antérieurs'});
   const fresh=ch.permissionOverwrites.cache.get(member.id);
   if(!old.existed&&fresh&&fresh.allow.bitfield===0n&&fresh.deny.bitfield===0n)await ch.permissionOverwrites.delete(member.id,'Fin de la restriction de profil');
  }
  delete rec.channels[id];put(member.id,rec);
 }
}
let running=false;
async function tick(guild){
 if(running||guild.id!==config.guildId||!a.state().schoolRoles?.community||!a.state().schoolChannels?.rules)return;running=true;
 try{
  if(!a.state().profileCatchup?.initializedAt){
   const members=await require('../utils/qgMembers')(guild),s=a.state(),roles=s.schoolRoles||{},candidates=[];
   for(const m of members.values()){
    const p=s.schoolEntryVerification?.[m.id];
    const accepted=p?.acceptedAt||[roles.community,roles.verified,s.roles?.member].filter(Boolean).some(id=>m.roles.cache.has(id));
    if(!m.user.bot&&m.id!==guild.ownerId&&!m.permissions.has(P.Administrator)&&accepted&&!completeProfile(p))candidates.push([m.id,{status:'pending',createdAt:Date.now(),previousProfile:p||null,channels:{}}]);
   }
   a.save(s=>{s.profileCatchup||={};s.profileCatchup.initializedAt=Date.now();s.profileCatchup.members||={};for(const [id,rec] of candidates)s.profileCatchup.members[id]||=rec;});
  }
  let count=0;
  for(const [id,rec] of Object.entries(a.state().profileCatchup.members||{})){
   if(rec.status==='complete'||rec.nextTry>Date.now())continue;
   if(count++>=5)break;
   await a.serial('profile-catchup:'+id,async()=>{
    const current=get(id);if(current.status==='complete')return;
    const m=await guild.members.fetch({user:id,force:true}).catch(e=>{if(e.code===10007)return null;throw e;});
    if(!m){current.nextTry=Date.now()+3600000;put(id,current);return;}
    // Administrator et le propriétaire contournent les interdictions Discord.
    if(m.id===guild.ownerId||m.permissions.has(P.Administrator)){current.error='Accès administrateur : restriction impossible avec les dérogations Discord.';current.nextTry=Date.now()+3600000;put(id,current);return;}
    if(current.status==='restoring'){await finish(m,current);return;}
    if(a.state().schoolRpStatus?.[id]?.prison){current.nextTry=Date.now()+300000;current.error='Prison active : complément différé pour préserver la sanction.';put(id,current);return;}
    await restrict(m,current);
    if(!current.dmAttemptedAt){
     current.dmAttemptedAt=Date.now();put(id,current);
     try{const msg=await m.send({embeds:[embed('Complète ton profil QG','Tu as déjà accepté le règlement : tu n’as pas à le refaire.\n\nRenseigne simplement ton **pseudo Roblox** et le **nom que tu souhaites porter sur Discord**, puis confirme le profil Roblox trouvé. Tes accès seront rétablis après cette étape.\n\nTu peux également utiliser le bouton de vérification dans le salon règlement.')],components:[row('qgp:open')],allowedMentions:{parse:[]}});current.dmId=msg.id;}
     catch{current.dmFailed=true;}
    }
    current.nextTry=Date.now()+300000;put(id,current);
   }).catch(e=>{const r=get(id);r.error=String(e.code||e.message).slice(0,300);r.nextTry=Date.now()+300000;put(id,r);console.warn('Rattrapage profil QG :',id,e.code||e.name);});
  }
 }finally{running=false;}
}
async function finish(member,rec){
 if(member.pending)throw Error('Termine les contrôles d’accueil natifs de Discord.');
 const role=await member.guild.roles.fetch(a.state().schoolRoles?.community);
 if(!role?.editable)throw Error('Le rôle communautaire ne peut pas être attribué. Préviens la direction.');
 if(member.displayName!==rec.draft.discordName){if(!member.manageable)throw Error('Le bot ne peut pas modifier ton surnom. Préviens la direction.');await member.setNickname(rec.draft.discordName,'Profil QG complété');}
 await member.roles.add(role,'Rétablissement des accès après complément du profil QG');
 await require('./qgSchoolSeparators').syncMember(await member.guild.members.fetch(member.id));
 await restore(member,rec);
 const profile={...rec.draft,stage:'accepted',acceptedAt:rec.previousProfile?.acceptedAt||rec.createdAt,acceptanceSource:rec.previousProfile?.acceptedAt?'previous-record':'legacy-role-observed',confirmedAt:rec.confirmedAt,updatedAt:Date.now(),version:rec.previousProfile?.version||2};
 a.save(s=>{s.schoolEntryVerification||={};s.schoolEntryVerification[member.id]=profile;});
 require('./qgCommunityUpgrade').recordVerification(member.id,profile);
 rec.status='complete';rec.completedAt=Date.now();delete rec.error;delete rec.draft;put(member.id,rec);
}
async function handle(i){
 const id=i.customId||'';if(!id.startsWith('qgp:')&&!(id==='qgs:verify'&&active(i.user.id)))return false;
 if(i.guildId&&i.guildId!==config.guildId)return false;
 const rec=get(i.user.id);
 if(!rec||rec.status==='complete'){await i.reply({content:'Ton profil ne nécessite pas de complément.',flags:F.Ephemeral});return true;}
 try{
  if(id==='qgp:open'||id==='qgs:verify'){
   if(rec.status==='restoring')throw Error('La restauration de tes accès est en cours.');
   await i.showModal(require('./qgEntryVerification').profileModal(rec.draft||{}).setCustomId('qgp:form'));return true;
  }
  await i.deferReply({flags:F.Ephemeral});
  await a.serial('profile-catchup:'+i.user.id,async()=>{
   const current=get(i.user.id);if(current.status==='complete')throw Error('Profil déjà complété.');
   const guild=await i.client.guilds.fetch(config.guildId),member=await guild.members.fetch({user:i.user.id,force:true});
   if(id==='qgp:form'){
    const name=i.fields.getTextInputValue('roblox').trim(),discordName=i.fields.getTextInputValue('discord').trim();
    if(!/^[A-Za-z0-9_]{3,20}$/.test(name)||!discordName||discordName.length>32||/[@\r\n\u0000-\u001f]/.test(discordName))throw Error('Indique un pseudo Roblox valide et un nom Discord sans @ ni retour à la ligne.');
    const profile=await require('./entryVerification').findRoblox(name);
    current.draft={...profile,discordName,token:randomUUID(),expires:Date.now()+1800000};put(i.user.id,current);
    await i.editReply({embeds:[embed('Confirme ton profil Roblox',`Pseudo : **${profile.robloxName}**\nhttps://www.roblox.com/users/${profile.robloxId}/profile\n\nConfirme que ce profil est le tien. Il s’agit d’une déclaration, pas d’une authentification Roblox.`)],components:[new Row().addComponents(new Button().setCustomId('qgp:confirm:'+current.draft.token).setLabel('Confirmer et retrouver mes accès').setStyle(B.Success)),row('qgp:open')],allowedMentions:{parse:[]}});
   }else if(id.startsWith('qgp:confirm:')){
    if(current.draft?.token!==id.split(':')[2]||current.draft.expires<Date.now())throw Error('Confirmation expirée. Clique sur Compléter mon profil pour reprendre.');
    current.status='restoring';current.confirmedAt=Date.now();put(i.user.id,current);
    await finish(member,current);await i.editReply({content:'Ton profil est enregistré et tes accès antérieurs sont rétablis. Tu n’as pas à accepter de nouveau le règlement.',components:[],embeds:[]});
   }
  });
 }catch(e){const payload={content:e.message||'Impossible de terminer. Réessaie ou contacte la direction.',allowedMentions:{parse:[]}};if(i.deferred||i.replied)await i.editReply(payload);else await i.reply({...payload,flags:F.Ephemeral});}
 return true;
}
async function created(ch){
 if(ch.guildId!==config.guildId||ch.isThread()||!ch.permissionOverwrites)return;
 for(const [id,r] of Object.entries(a.state().profileCatchup?.members||{}))if(r.status==='waiting')await a.serial('profile-catchup:'+id,async()=>{
  const rec=get(id);if(rec.status!=='waiting')return;
  const member=await ch.guild.members.fetch(id).catch(()=>null);if(!member)return;
  if(!ch.permissionOverwrites.cache.has(id)&&ch.permissionOverwrites.cache.size>=100)throw Error('Limite des dérogations du nouveau salon atteinte.');
  const old=ch.permissionOverwrites.cache.get(id);rec.channels[ch.id]||={allow:String(old?.allow.bitfield||0n),deny:String(old?.deny.bitfield||0n),existed:!!old,target:{ViewChannel:false,Connect:false}};put(id,rec);
  await ch.permissionOverwrites.edit(id,{ViewChannel:false,Connect:false},{reason:'Profil QG en attente : protection du nouveau salon'});
 });
}
module.exports={tick,handle,active,created};
