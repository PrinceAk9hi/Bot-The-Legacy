const u=require('../utils/qgModuleUi'),{a}=u;
const data=new u.SlashCommandBuilder().setName('maj').setDescription('Mettre à jour le QG et accéder à sa configuration').setDMPermission(false)
 .addChannelOption(o=>o.setName('rapports').setDescription('Salon privé du récap des réunions').addChannelTypes(u.ChannelType.GuildText));
async function authorized(i){const m=await a.actor(i);if(!a.isDirection(m))throw Error('La maintenance est réservée à la direction.');return m;}
const actions=[['all','Tout actualiser'],['diagnostic','Diagnostic de la structure'],['suivi-profils','Suivi des vérifications'],['reunions','Configurer les réunions'],['noms-categories','Noms des catégories'],['installer','Installer les éléments manquants'],['reparer','Réparer la structure'],['mise-a-jour','Ancienne migration communautaire (aperçu)']];
async function execute(i){await authorized(i);const id=u.session(i,'maintenance',{reportChannel:i.options.getChannel('rapports')?.id});return i.reply({...u.payload('CENTRE DE MAINTENANCE · QG','**Un espace pour maintenir les outils de la famille.**\n\n**01 · Actualiser**\nPanneaux, rôles de gestion, séparateurs, niveaux et effectifs.\n\n**02 · Entretenir les espaces**\nSupport, recrutement, calendrier et centre d’animations.\n\n**03 · Configurer**\nRéunions, suivi des profils et structure : choisis un outil dans le menu.\n\nUn bilan détaillé est présenté à la fin. Les installations et migrations particulières conservent leur confirmation.',[u.row(u.button('qgmaj:all:'+id,'Tout actualiser',u.ButtonStyle.Primary)),u.row(u.menu('qgmaj:choose:'+id,actions.map(([value,label])=>({value,label})),'Configuration et maintenance'))]),flags:u.MessageFlags.Ephemeral});}
function proxy(i,action,reportChannel){return new Proxy(i,{get(target,key){if(key==='commandName')return action==='reunions'?'config':'setup-serveur';if(key==='options')return{getSubcommand:()=>action,getChannel:()=>reportChannel?target.guild.channels.cache.get(reportChannel):null,getString:()=>null};const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}});}
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
function report(results,total,done){const ok=results.filter(r=>r.ok&&!r.notices?.length),warnings=results.filter(r=>r.ok&&r.notices?.length),failed=results.filter(r=>!r.ok);const p=u.payload(done?'Maintenance terminée • QG':'Actualisation du QG',done?'Les modules ont été traités. Consulte les points à vérifier ci-dessous.':'Actualisation des espaces et des outils en cours…');const e=p.embeds[0].setColor(0xffffff).setTimestamp();e.addFields({name:'Progression',value:results.length+'/'+total+' modules',inline:true},{name:'À vérifier',value:String(warnings.length+failed.length),inline:true});for(const [name,list]of [['✓ Modules actualisés',ok],['◈ Points à vérifier',warnings],['! Actions nécessaires',failed]])if(list.length)e.addFields({name,value:list.map(r=>'**'+r.label+'**'+(r.detail?' — '+r.detail:'')+(r.notices?.length?'\n'+r.notices.join('\n'):'')).join('\n').slice(0,1024)});return p;}
async function runAll(i){return a.serial('qg-maintenance',async()=>{
 await authorized(i);const results=[];
 const jobs=[['Rôles et gestions',()=>require('./qgCommunityUpgrade').discover(i.guild)],['Séparateurs',()=>require('./qgSchoolSeparators').syncGuild(i.guild)],['Niveaux',()=>require('./qgLevels').migrate()],['Panneaux',()=>panels(i.guild)],['Effectifs',()=>require('./qgCommunityUpgrade').roster(i.guild)],['Support',()=>require('./qgSupportWorkspace').install(i.guild)],['Entretiens',()=>require('./qgInterviews').install(i.guild)],['Centre animations',()=>require('./qgAnimations').ensureControl(i.guild)],['Calendrier',()=>require('./qgAnimations').refresh(i.guild)],['Candidatures',()=>require('./qgRecruitmentControl').refresh(i.guild)]];
 for(const [label,job]of jobs){await authorized(i);try{const result=await job();const detail=typeof result==='string'?result:result?.detail;results.push({label,ok:true,detail,notices:result?.notices});}catch(e){results.push({label,ok:false,detail:readable(e).slice(0,400)});}await i.editReply(report(results,jobs.length,false));}
 await a.audit(i.guild,{action:'maintenance',actorId:i.user.id,after:{results}});return i.editReply(report(results,jobs.length,true));
 });}
async function handle(i){const [,op,id]=i.customId.split(':'),s=u.get(i,id,'maintenance');await authorized(i);const action=op==='all'?'all':i.values?.[0];if(!actions.some(([key])=>key===action))throw Error('Action inconnue.');
 if(action==='all'){await i.deferReply({flags:u.MessageFlags.Ephemeral});return runAll(i);}
 if(action==='reunions')return require('./qgMeetings').execute(proxy(i,action,s.reportChannel));
 return require('../commandes/setup-serveur').execute(proxy(i,action));
}
module.exports={data,execute,handle,runAll,panels,proxy};
