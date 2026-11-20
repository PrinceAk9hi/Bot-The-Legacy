const u=require('../utils/qgModuleUi'),{a}=u;
function readable(error){return ({10003:'Salon supprimé ou introuvable',10008:'Message supprimé',50001:'Salon inaccessible au bot',50013:'Permissions du bot insuffisantes',50035:'Contenu refusé par Discord'})[error.code]||String(error.message||'Erreur inconnue');}
// Panneaux retirés pour de bon : leur ancien message est supprimé. Les autres panneaux sans contenu ici sont
// publiés par leur propre module et ne sont pas touchés.
const RETIRED=new Set(['notifications']);
async function panels(guild){return a.serial('maintenance-panels',async()=>{
 const saved=a.state().schoolPanels||{},notices=[];let count=0;
 for(const [key,record] of Object.entries(saved)){
  try{
   const payload=key==='managementFollowup'?await require('./qgSchoolManagementBoard').buildPanel(guild):await require('./qgSchoolSetup').panelPayload(key,guild);
   // Panneau publié par son propre module (ex. présentation du QG) : on n'y touche pas ici.
   if(!payload&&!RETIRED.has(key))continue;
   // Panneau retiré du bot (ex. notifications) : son message est supprimé et il n'est plus suivi.
   if(!payload){const old=await guild.channels.fetch(record.channelId).catch(()=>null);const m=old?.isTextBased?.()?await old.messages.fetch(record.messageId).catch(()=>null):null;if(m&&m.author.id===guild.client.user.id)await m.delete().catch(()=>{});a.save(s=>{delete s.schoolPanels[key];});notices.push(key+' : ancien panneau retiré');continue;}
   const current=a.state().schoolChannels?.[key]||record.channelId;
   const ch=await guild.channels.fetch(current).catch(e=>{if(e.code===10003)return null;throw e;});
   if(!ch){a.save(s=>{s.schoolPanelArchives||={};s.schoolPanelArchives[key]={...record,archivedAt:Date.now(),reason:'Salon supprimé'};delete s.schoolPanels[key];});notices.push(key+' : référence au salon supprimé archivée');continue;}
   if(!ch.isTextBased()||ch.guildId!==guild.id||!ch.send)throw Error('Ce salon ne permet pas de publier le panneau');
   let msg=current===record.channelId?await ch.messages.fetch(record.messageId).catch(e=>{if(e.code===10008)return null;throw e;}):null;
   if(!msg){const recent=await ch.messages.fetch({limit:100});const ids=(payload.components||[]).flatMap(r=>(r.toJSON?.()||r).components||[]).map(c=>c.custom_id).filter(Boolean);const title=payload.embeds?.[0]?.toJSON?.().title;msg=recent.find(m=>m.author.id===guild.client.user.id&&(ids.length?m.components?.some(r=>r.components?.some(c=>ids.includes(c.customId))):title&&m.embeds?.[0]?.title===title));}
   if(msg&&msg.author.id!==guild.client.user.id)throw Error('Le message appartient à un autre compte');
   // Supprimé à la main : on respecte ce choix, le panneau n'est plus republié ni suivi.
   if(!msg){a.save(s=>{s.schoolPanelArchives||={};s.schoolPanelArchives[key]={...record,archivedAt:Date.now(),reason:'Supprimé à la main'};delete s.schoolPanels[key];});notices.push(key+' : supprimé à la main, non republié');continue;}
   await msg.edit({...payload,attachments:[]});
   a.save(s=>{s.schoolPanels[key]={channelId:ch.id,messageId:msg.id};});count++;
  }catch(e){notices.push(key+' : '+readable(e));}
 }
 return {detail:count+' panneaux actualisés',notices};
 });}
// Actualisation complète du QG, lancée automatiquement au démarrage du bot (remplace l’ancienne commande /maj).
const jobs=guild=>[['Tranches Roblox',()=>require('./qgAgeProfiles').migrate(guild)],['Casino',()=>require('./qgCasino').install(guild)],['Administration casino',()=>require('./qgCasinoAdmin').publish(guild)],['Fils publics',()=>require('./qgPublicThreads').inspect(guild)],['Rôles disciplinaires',()=>require('./qgDiscipline').ensure(guild)],['Espace recrutement unifié',()=>require('./qgRecruitmentHub').install(guild)],['Rôles et gestions',()=>require('./qgCommunityUpgrade').discover(guild)],['Séparateurs',()=>require('./qgSchoolSeparators').syncGuild(guild)],['Niveaux',()=>require('./qgLevels').migrate()],['Panneaux',()=>panels(guild)],['Dates des rôles',()=>require('./qgRoleSince').backfill(guild)],['Effectifs',()=>require('./qgCommunityUpgrade').roster(guild)],['Support',()=>require('./qgSupportWorkspace').install(guild)],['Entretiens',()=>require('./qgInterviews').install(guild)],['Centre animations',()=>require('./qgAnimations').ensureControl(guild)],['Calendrier',()=>require('./qgAnimations').refresh(guild)],['Candidatures',()=>require('./qgRecruitmentControl').refresh(guild)],['Panel d’aide',()=>require('./qgHelp').publish(guild)],['Présentation du QG',()=>require('./qgCommunityHelp').publish(guild)],['Panneaux vocaux des salons commandes',()=>require('./qgSchoolVoice').retireCommandPanels(guild)],['Salons de réunion',()=>require('./qgMeetings').setupChannels(guild)],['Permissions manuelles et statut vocal',()=>require('./qgVoiceStatus').apply(guild)],['Rattrapage rank-up',()=>require('./qgRankAnnounce').backfill(guild)]];
async function refreshAll(guild){return a.serial('qg-maintenance',async()=>{
 const results=[];
 for(const [label,job]of jobs(guild)){try{const result=await job();results.push({label,ok:true,detail:typeof result==='string'?result:result?.detail,notices:result?.notices});}catch(e){results.push({label,ok:false,detail:readable(e).slice(0,400)});}}
 const issues=results.filter(r=>!r.ok||r.notices?.length);
 console.log(`🔄 Actualisation automatique du QG : `+(results.length-issues.length)+'/'+results.length+' modules sans alerte');
 for(const r of issues)console.warn('   ⚠️ '+r.label+' : '+(r.ok?r.notices.join(' · '):r.detail));
 await a.audit(guild,{action:'maintenance.auto',actorId:guild.client.user.id,after:{results}}).catch(()=>{});
 return results;
 });}
module.exports={refreshAll,panels};
