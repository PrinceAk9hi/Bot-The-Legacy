const u=require('../utils/qgModuleUi'),{a}=u;
function readable(error){return ({10003:'Salon supprimé ou introuvable',10008:'Message supprimé',50001:'Salon inaccessible au bot',50013:'Permissions du bot insuffisantes',50035:'Contenu refusé par Discord'})[error.code]||String(error.message||'Erreur inconnue');}
async function panels(guild){return a.serial('maintenance-panels',async()=>{
 const saved=a.state().schoolPanels||{},notices=[];let count=0;
 for(const [key,record] of Object.entries(saved)){
  try{
   const payload=key==='managementFollowup'?await require('./qgSchoolManagementBoard').buildPanel(guild):await require('./qgSchoolSetup').panelPayload(key,guild);
   if(!payload){notices.push(key+' : ancien panneau ignoré');continue;}
   const current=a.state().schoolChannels?.[key]||record.channelId;
   const ch=await guild.channels.fetch(current).catch(e=>{if(e.code===10003)return null;throw e;});
   if(!ch){a.save(s=>{s.schoolPanelArchives||={};s.schoolPanelArchives[key]={...record,archivedAt:Date.now(),reason:'Salon supprimé'};delete s.schoolPanels[key];});notices.push(key+' : référence au salon supprimé archivée');continue;}
   if(!ch.isTextBased()||ch.guildId!==guild.id||!ch.send)throw Error('Ce salon ne permet pas de publier le panneau');
   let msg=current===record.channelId?await ch.messages.fetch(record.messageId).catch(e=>{if(e.code===10008)return null;throw e;}):null;
   if(!msg){const recent=await ch.messages.fetch({limit:100});const ids=(payload.components||[]).flatMap(r=>(r.toJSON?.()||r).components||[]).map(c=>c.custom_id).filter(Boolean);const title=payload.embeds?.[0]?.toJSON?.().title;msg=recent.find(m=>m.author.id===guild.client.user.id&&(ids.length?m.components?.some(r=>r.components?.some(c=>ids.includes(c.customId))):title&&m.embeds?.[0]?.title===title));}
   if(msg&&msg.author.id!==guild.client.user.id)throw Error('Le message appartient à un autre compte');
   if(msg)await msg.edit({...payload,attachments:[]});else msg=await ch.send(payload);
   a.save(s=>{s.schoolPanels[key]={channelId:ch.id,messageId:msg.id};});count++;
  }catch(e){notices.push(key+' : '+readable(e));}
 }
 return {detail:count+' panneaux actualisés',notices};
 });}
// Actualisation complète du QG, lancée automatiquement au démarrage du bot (remplace l’ancienne commande /maj).
const jobs=guild=>[['Tranches Roblox',()=>require('./qgAgeProfiles').migrate(guild)],['Casino',()=>require('./qgCasino').install(guild)],['Fils publics',()=>require('./qgPublicThreads').inspect(guild)],['Rôles disciplinaires',()=>require('./qgDiscipline').ensure(guild)],['Espace recrutement unifié',()=>require('./qgRecruitmentHub').install(guild)],['Rôles et gestions',()=>require('./qgCommunityUpgrade').discover(guild)],['Séparateurs',()=>require('./qgSchoolSeparators').syncGuild(guild)],['Niveaux',()=>require('./qgLevels').migrate()],['Panneaux',()=>panels(guild)],['Effectifs',()=>require('./qgCommunityUpgrade').roster(guild)],['Support',()=>require('./qgSupportWorkspace').install(guild)],['Entretiens',()=>require('./qgInterviews').install(guild)],['Centre animations',()=>require('./qgAnimations').ensureControl(guild)],['Calendrier',()=>require('./qgAnimations').refresh(guild)],['Candidatures',()=>require('./qgRecruitmentControl').refresh(guild)]];
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
