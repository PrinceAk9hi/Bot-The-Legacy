const {randomUUID}=require('node:crypto');
const {SlashCommandBuilder,ContainerBuilder,TextDisplayBuilder,ActionRowBuilder:Row,ButtonBuilder:Button,ButtonStyle:S,StringSelectMenuBuilder:Menu,ModalBuilder:Modal,TextInputBuilder:Input,TextInputStyle:T,MessageFlags:F,ChannelType:CT,PermissionFlagsBits:P,GuildScheduledEventEntityType:ET,GuildScheduledEventPrivacyLevel:EP}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg'),{parseParis}=require('../utils/convocationTime'),{embed}=require('./qgPanels'),clean=require('../utils/qgAiKnowledge').clean;
const voiceId='1562077941469552680',familyRole='1561363081018474626';
const data=new SlashCommandBuilder().setName('réunion').setDescription('Préparer les notes et décisions de réunion du QG').setDMPermission(false).addStringOption(o=>o.setName('reunion').setDescription('Identifiant de réunion facultatif'));
const configData=new SlashCommandBuilder().setName('config').setDescription('Configurer les réunions QG').setDMPermission(false).addChannelOption(o=>o.setName('rapports').setDescription('Salon privé du récap hebdomadaire').addChannelTypes(CT.GuildText));
const notesData=new SlashCommandBuilder().setName('notesmp').setDescription('Appliquer les décisions validées et envoyer les notes en MP').setDMPermission(false).addStringOption(o=>o.setName('reunion').setDescription('Identifiant de la réunion validée').setRequired(true));
const get=id=>a.state().schoolMeetings?.[id];
function save(id,fn){a.save(s=>{if(!s.schoolMeetings?.[id])throw Error('Réunion introuvable.');fn(s.schoolMeetings[id]);});return get(id);}
async function authorized(i){if(i.guildId!==config.guildId)throw Error('Commande réservée au QG.');const m=await i.guild.members.fetch({user:i.user.id,force:true});if(!a.isDirection(m))throw Error('Réservé à la direction.');return m;}
const row=(...items)=>new Row().addComponents(...items);
const text=s=>new TextDisplayBuilder().setContent(s);
const button=(id,label,style=S.Secondary,disabled=false)=>new Button().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);
const box=items=>({flags:F.IsComponentsV2,components:[new ContainerBuilder().setAccentColor(0xffffff).spliceComponents(0,0,...items)],allowedMentions:{parse:[]}});
function home(){
 const list=Object.values(a.state().schoolMeetings||{}).sort((x,y)=>y.createdAt-x.createdAt).slice(0,25);
 const items=[text('## 📅 Réunions • QG\nConfigure une réunion, prépare les notes sur 10 étoiles et les décisions de grades.\n**Aucune modification n’est appliquée avant `/notesmp`.**\nRécap hebdomadaire : lundi à 00 h, heure de Paris.'),row(button('qgm:new','Créer une réunion',S.Primary))];
 if(list.length)items.push(row(new Menu().setCustomId('qgm:open').setPlaceholder('Reprendre une réunion').addOptions(list.map(r=>({label:r.name.slice(0,100),value:r.id,description:`${r.id} • ${r.status}`})))));
 return box(items);
}
function modal(id,title,fields){return new Modal().setCustomId(id).setTitle(title).addComponents(...fields.map(([key,label,required,value,long])=>row(new Input().setCustomId(key).setLabel(label).setRequired(required).setStyle(long?T.Paragraph:T.Short).setMaxLength(long?600:100).setValue(value||''))));}
function render(r,stage='notes',page=0){
 const b=(op,label,extra='',style=S.Secondary,disabled=false)=>button(`qgm:${op}:${r.id}:${extra}`,label,style,disabled);
 const items=[text(`## 📅 ${clean(r.name)}\n<t:${Math.floor(r.start/1000)}:F> • ${r.duration} min • heure de Paris\n${clean(r.description||'')}\nIdentifiant : \`${r.id}\` • ${r.status}`)];
 if(r.status==='setup'){
  items.push(text('### 1 · Ouverture de la préparation\nChoisis quand les notes et décisions pourront être préparées.'),row(new Menu().setCustomId(`qgm:offset:${r.id}`).setPlaceholder('Choisir le délai').addOptions(['now','1','3','6'].map(v=>({label:v==='now'?'Maintenant':`${v} h avant`,value:v,default:(r.offset||'now')===v})))),row(b('configure','Créer l’événement et continuer','',S.Success)));return box(items);
 }
 if(r.status==='creating'||r.status==='event_uncertain'){items.push(text('Création de l’événement à vérifier. Réouvre cette réunion : le bot cherchera son identifiant de référence sans créer de doublon.'));return box(items);}
 if(r.status==='waiting'){items.push(text(`Préparation disponible <t:${Math.floor(r.prepareAt/1000)}:R>.\n[Événement Discord](https://discord.com/events/${config.guildId}/${r.eventId})`),row(b('refresh','Actualiser'),b('cancel','Annuler','',S.Danger)));return box(items);}
 if(['approved','sending','finished','cancelled'].includes(r.status)){
  items.push(text(r.status==='cancelled'?'Réunion annulée.':`**Décisions validées :** ${Object.keys(r.notes).length} note(s), ${Object.keys(r.actions).length} action(s).\nUtilise \`/notesmp reunion:${r.id}\` pour appliquer et envoyer.\nAucun rôle de note ne sera attribué.`));
  items.push(...summary(r,page,b));
  if(r.status==='approved')items.push(row(b('edit','Modifier les choix'),b('cancel','Annuler','',S.Danger)));
  return box(items);
 }
 if(stage==='review'){items.push(text('### Validation finale\nLes notes et décisions ci-dessous seront figées. Leur application et les MP attendront `/notesmp`.'),...summary(r,page,b),row(b('page','Retour aux notes','notes.0'),b('approve','Valider les décisions','',S.Success)));return box(items);}
 const max=Math.max(0,r.roster.length-1);page=Math.max(0,Math.min(max,page));const member=r.roster[page];
 if(!member){items.push(text('Aucun membre familial dans cette réunion.'));return box(items);}
 const n=r.notes[member.id],action=r.actions[member.id],metrics=require('./qgMemberMetrics').week(member.id),lastRankup=require('./qgMemberMetrics').lastRankup(member.id);
 items.push(text(`### ${stage==='notes'?'2 · Notes':'3 · Grades et avertissements'} — ${page+1}/${max+1}\n<@${member.id}> • ${member.grade}\n🎙️ ${Math.floor(metrics.voiceMs/3600000)} h ${Math.floor(metrics.voiceMs/60000)%60} min • 💬 ${metrics.messages} messages sur les 7 derniers jours calendaires.\nDernier rankup enregistré : ${lastRankup?`<t:${Math.floor(lastRankup/1000)}:d>`:'inconnu'}\n${n?`${'★'.repeat(n.value)}${'☆'.repeat(10-n.value)} • ${n.value}/10\n${clean(n.detail||'')}`:'Non noté'}\nDécision : ${action?.label||'aucune'}${action?.reason?'\n'+clean(action.reason):''}`));
 if(stage==='notes'){
  for(let start=1;start<=6;start+=5)items.push(row(...Array.from({length:5},(_,x)=>{const value=start+x;return b('rate',`${value} ★`,`${member.id}.${value}.${page}`,n?.value===value?S.Success:S.Secondary);})));
  items.push(row(b('detail','… Détail facultatif',`${member.id}.${page}`)));
 }else{
  const current=require('./qgUserPanel').rankNames||[];
  items.push(row(new Menu().setCustomId(`qgm:decision:${r.id}:${member.id}.${page}`).setPlaceholder('Choisir une décision').addOptions([{label:'Aucune action',value:'none'},{label:'Rankup',value:'rankup'},{label:'Derank',value:'derank'},{label:'Avertissement',value:'warn'},...['test','confirmed','expert','prestigious','senior'].map((rank,j)=>({label:'Rétrograder vers '+(['Test','Confirmé','Expert','Prestigieux','Senior'][j]),value:'demote.'+rank}))])),row(b('reason','… Motif facultatif',`${member.id}.${page}`)));
 }
 items.push(row(b('page','◀',`${stage}.${page-1}`,S.Secondary,page===0),b('page','▶',`${stage}.${page+1}`,S.Secondary,page===max),b('page',stage==='notes'?'Continuer : grades':'Récapitulatif',stage==='notes'?'grades.0':'review.0',S.Success)));
 items.push(text('-# Fondateur - QG'));return box(items);
}
function summary(r,page,b){
 const ids=r.roster.filter(m=>r.notes[m.id]||r.actions[m.id]);const max=Math.max(0,Math.ceil(ids.length/2)-1);page=Math.max(0,Math.min(max,page));
 return[text(`### Récapitulatif • ${page+1}/${max+1}\n${ids.slice(page*2,page*2+2).map(m=>{const n=r.notes[m.id],d=r.actions[m.id],result=r.results?.[m.id],dm=r.deliveries?.[m.id];return `<@${m.id}>${n?` • ${n.value}/10 ★\n${clean(n.detail||'Sans détail.')}`:''}${d?`\n${d.label}${d.reason?' — '+clean(d.reason):''}`:''}${result?`\nApplication : ${result.status} — ${result.detail}`:''}${dm?`\nMP : ${dm.status}${dm.detail?' — '+dm.detail:''}`:''}`;}).join('\n\n')||'Aucune décision.'}`),row(b('page','◀',`review.${page-1}`,S.Secondary,page===0),b('page','▶',`review.${page+1}`,S.Secondary,page===max))];
}
async function eventAndAccess(guild,r){
 const channel=await guild.channels.fetch(voiceId),role=await guild.roles.fetch(familyRole);
 if(!channel||!role)throw Error('Salon ou rôle de réunion introuvable.');
 const marker=`[QG réunion ${r.id}]`;
 if(!r.eventId){
  if(['creating','event_uncertain'].includes(r.status)){const events=await guild.scheduledEvents.fetch();const matches=events.filter(e=>e.description?.includes(marker));if(matches.size!==1)throw Error('Création incertaine : vérifier les événements Discord avant une reprise.');r=save(r.id,p=>{p.eventId=matches.first().id;p.status='waiting';});}
  else{
   save(r.id,p=>{p.status='creating';});
   try{
    const vocal=[CT.GuildVoice,CT.GuildStageVoice].includes(channel.type);
    const ev=await guild.scheduledEvents.create({name:r.name,description:`${r.description||'Réunion de la famille QG.'}\n${marker}`,scheduledStartTime:r.start,scheduledEndTime:r.start+r.duration*60000,privacyLevel:EP.GuildOnly,entityType:vocal?(channel.type===CT.GuildVoice?ET.Voice:ET.StageInstance):ET.External,...(vocal?{channel:channel.id}:{entityMetadata:{location:`https://discord.com/channels/${guild.id}/${channel.id}`}}),reason:'Réunion QG configurée'});
    r=save(r.id,p=>{p.eventId=ev.id;p.status='waiting';});
   }catch(error){save(r.id,p=>{p.status='event_uncertain';});throw error;}
  }
 }
 if(Date.now()<r.start&&!Object.values(a.state().schoolMeetings||{}).some(x=>x.openedAt&&!x.closedAt&&x.status!=='cancelled'&&Date.now()<x.start+x.duration*60000)){
  for(const id of [voiceId,a.state().schoolChannels?.meetingChat].filter(Boolean)){
   const ch=await guild.channels.fetch(id).catch(e=>{if(e.code===10003)return null;throw e;});
   if(ch)await ch.permissionOverwrites.edit(familyRole,{ViewChannel:false},{reason:'Accès réservé à l’heure programmée de réunion'});
  }
 }
 return r;
}
async function openMeeting(guild,r){
 if(Date.now()<r.start||r.status==='cancelled')return r;
 const channel=await guild.channels.fetch(voiceId);
 await channel.permissionOverwrites.edit(familyRole,{ViewChannel:true}, {reason:'Ouverture programmée de la réunion QG'});
 let discussion=a.state().schoolChannels?.meetingChat&&await guild.channels.fetch(a.state().schoolChannels.meetingChat).catch(()=>null);
 if(!discussion){await guild.channels.fetch();discussion=guild.channels.cache.find(c=>c.type===CT.GuildText&&c.parentId===channel.parentId&&c.name==='🖋️・discu-réunion');}
 if(!discussion){const roles=a.state().schoolRoles||{};discussion=await guild.channels.create({name:'🖋️・discu-réunion',type:CT.GuildText,parent:channel.parentId||undefined,permissionOverwrites:[{id:guild.id,deny:[P.ViewChannel]},{id:familyRole,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]},{id:guild.client.user.id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]},...['creator','globalManager','administrator'].map(k=>roles[k]).filter(Boolean).map(id=>({id,allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory]}))],reason:'Discussion des réunions QG'});}
 a.save(s=>{s.schoolChannels||={};s.schoolChannels.meetingChat=discussion.id;});
 await discussion.permissionOverwrites.edit(familyRole,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true},{reason:'Ouverture programmée de la discussion de réunion'});
 r=save(r.id,p=>{p.accessReady=true;p.openedAt||=Date.now();});
 if(!r.announcementId){
  const ch=await guild.channels.fetch('1561157213160996866'),marker=`Réunion ${r.id}`;
  let message;
  if(r.announcementPending){
   const recent=await ch.messages.fetch({limit:100});
   message=recent.find(m=>m.author.id===guild.client.user.id&&m.embeds.some(e=>e.footer?.text?.includes(marker)));
   if(!message)throw Error('Annonce de réunion incertaine : vérification manuelle nécessaire dans le salon d’annonces.');
  }else{
   save(r.id,p=>{p.announcementPending=true;});
   message=await ch.send({embeds:[embed('📅 La réunion du QG commence',`**${clean(r.name)}**\n${clean(r.description||'')}\nRejoignez <#${voiceId}>. Discussion : <#${discussion.id}>.\nDurée prévue : ${r.duration} minutes.`).setFooter({text:`Fondateur - QG • ${marker}`})],allowedMentions:{parse:[]}});
  }
  r=save(r.id,p=>{p.announcementId=message.id;p.announcementPending=false;});
 }
 return r;
}
async function prepare(guild,r){
 if(r.status!=='waiting'||!r.eventId||Date.now()<r.prepareAt)return r;
 const members=await require('../utils/qgMembers')(guild),panel=require('./qgUserPanel');
 const roster=[...members.values()].filter(m=>!m.user.bot&&require('./qgWeeklyReport').family(m)).map(m=>{let grade;try{grade=panel.rank(m)||'aucun grade';}catch{grade='grades multiples';}return{id:m.id,grade};});
 return save(r.id,p=>{p.roster=roster;p.status='draft';});
}
async function execute(i){
 await i.deferReply({flags:F.Ephemeral});await authorized(i);
 if(i.commandName==='config'){
  const ch=i.options.getChannel('rapports');if(ch){if(ch.guildId!==i.guildId||ch.permissionsFor(i.guild.roles.everyone)?.has(P.ViewChannel))throw Error('Choisis un salon privé.');a.save(s=>{s.schoolMeetingConfig||={};s.schoolMeetingConfig.reportChannelId=ch.id;});}
 }
 const id=i.commandName==='réunion'?i.options.getString('reunion'):null;
 if(id){let r=get(id);if(!r)throw Error('Réunion introuvable.');if(r.eventId&&!r.accessReady)r=await a.serial('meeting:'+id,()=>eventAndAccess(i.guild,get(id)));r=await prepare(i.guild,r);return i.editReply(render(r));}
 return i.editReply(home());
}
async function handle(i){
 const actor=await authorized(i);let[,op,id,extra]=i.customId.split(':');
 if(op==='new')return i.showModal(modal('qgm:create','Configurer une réunion',[['title','Titre',true],['date','JJ/MM/AAAA HH:MM — Paris',true],['duration','Durée en minutes',true,'60'],['description','Description',false,'',true]]));
 if(op==='create'){
  await i.deferReply({flags:F.Ephemeral});
  const start=parseParis(i.fields.getTextInputValue('date')),duration=Number(i.fields.getTextInputValue('duration'));
  if(!start||start<Date.now()+60000||!Number.isInteger(duration)||duration<15||duration>1440)throw Error('Date future valide et durée de 15 à 1440 minutes requises.');
  const name=clean(i.fields.getTextInputValue('title')).trim();if(!name)throw Error('Titre requis.');
  id=randomUUID().slice(0,8);a.save(s=>{s.schoolMeetings||={};s.schoolMeetings[id]={id,name,start,duration,description:clean(i.fields.getTextInputValue('description')),authorId:actor.id,createdAt:Date.now(),status:'setup',offset:'now',notes:{},actions:{},roster:[],results:{},deliveries:{}};});
  return i.editReply(render(get(id)));
 }
 if(op==='open')id=i.values[0];let r=get(id);if(!r)throw Error('Réunion introuvable.');
 if(['detail','reason'].includes(op)){
  if(r.status!=='draft')throw Error('Les choix ne sont plus modifiables.');
  const [target,page]=extra.split('.');if(!r.roster.some(m=>m.id===target))throw Error('Membre hors réunion.');
  return i.showModal(modal(`qgm:${op}save:${id}:${target}.${page}`,'Détail facultatif',[['detail','Texte transmis au membre',false,op==='detail'?r.notes[target]?.detail:r.actions[target]?.reason,true]]));
 }
 // Component messages are private; mutations are serialized across every administrator.
 await i.deferUpdate();
 return a.serial('meeting:'+id,async()=>{
  r=get(id);
  if(op==='open'||op==='refresh'){if(['creating','event_uncertain'].includes(r.status)||r.eventId&&!r.accessReady)r=await eventAndAccess(i.guild,r);r=await prepare(i.guild,r);return i.editReply(render(r));}
  if(op==='offset'){if(r.status!=='setup'||!['now','1','3','6'].includes(i.values[0]))throw Error('Choix indisponible.');r=save(id,p=>{p.offset=i.values[0];});}
  else if(op==='configure'){if(r.status!=='setup')throw Error('Configuration déjà effectuée.');r=save(id,p=>{p.prepareAt=p.offset==='now'?Date.now():p.start-Number(p.offset)*3600000;});r=await eventAndAccess(i.guild,r);r=await prepare(i.guild,r);}
  else if(op==='edit'){if(r.status!=='approved')throw Error('Réunion non modifiable.');r=save(id,p=>{p.status='draft';delete p.approvedAt;});}
  else if(op==='cancel'){if(!['waiting','approved'].includes(r.status))throw Error('Annulation indisponible.');if(r.eventId){const ev=await i.guild.scheduledEvents.fetch(r.eventId);await ev.delete('Réunion QG annulée');}r=save(id,p=>{p.status='cancelled';});}
  else if(op==='approve'){if(r.status!=='draft')throw Error('Réunion déjà validée.');r=save(id,p=>{p.status='approved';p.approvedAt=Date.now();p.approvedBy=actor.id;});}
  else if(op==='page'){const [stage,page]=extra.split('.');if(!['notes','grades','review'].includes(stage))throw Error('Page inconnue.');return i.editReply(render(r,stage,Number(page)||0));}
  else{
   if(r.status!=='draft')throw Error('Préparation fermée.');const [target,value,page]=extra.split('.');if(!r.roster.some(m=>m.id===target))throw Error('Membre hors réunion.');
   if(op==='rate'){const n=Number(value);if(!Number.isInteger(n)||n<1||n>10)throw Error('Note invalide.');r=save(id,p=>{if(p.notes[target]?.value===n)delete p.notes[target];else p.notes[target]={value:n,detail:p.notes[target]?.detail||''};});return i.editReply(render(r,'notes',Number(page)));}
   if(op==='detailsave'||op==='reasonsave'){const detail=clean(i.fields.getTextInputValue('detail'));r=save(id,p=>{if(op==='detailsave'){if(!p.notes[target])throw Error('Attribue une note avant le détail.');p.notes[target].detail=detail;}else{if(!p.actions[target])throw Error('Choisis une action avant le motif.');p.actions[target].reason=detail;}});return i.editReply(render(r,op==='detailsave'?'notes':'grades',Number(value)));}
   if(op==='decision'){
    const selected=i.values[0];if(selected==='none')r=save(id,p=>{delete p.actions[target];});
    else{const member=await i.guild.members.fetch({user:target,force:true}),panel=require('./qgUserPanel'),[action,to]=selected.split('.');
     a.hierarchy(actor,member,await i.guild.members.fetchMe());let planned=null;if(action!=='warn')planned=panel.plan(actor,member,action,to,'Décision de réunion');
     if(action!=='warn'&&!planned)throw Error('Décision inconnue.');
     r=save(id,p=>{p.actions[target]={action,choice:to||null,label:action==='warn'?'Avertissement':action==='demote'?'Rétrogradation vers '+to:action==='rankup'?'Rankup':'Derank',reason:p.actions[target]?.reason||'',expectedGrade:panel.rank(member)};});
    }return i.editReply(render(r,'grades',Number(value)));
   }
  }
  return i.editReply(render(r));
 });
}
async function tick(guild){
 for(const snapshot of Object.values(a.state().schoolMeetings||{})){
  if(!snapshot.eventId||snapshot.status==='cancelled')continue;
  await a.serial('meeting:'+snapshot.id,async()=>{
   const r=get(snapshot.id);
   if(r.start>Date.now()&&r.accessReady&&!r.openedAt){
    const active=Object.values(a.state().schoolMeetings||{}).some(x=>x.openedAt&&x.status!=='cancelled'&&x.start+x.duration*60000>Date.now());
    if(!active){
     for(const id of [voiceId,a.state().schoolChannels?.meetingChat].filter(Boolean)){
      const ch=await guild.channels.fetch(id).catch(()=>null);
      if(ch)await ch.permissionOverwrites.edit(familyRole,{ViewChannel:false},{reason:'Attente de l’heure programmée'});
     }
     save(r.id,p=>{p.accessReady=false;});
    }
   }
   if(Date.now()>=r.start&&Date.now()<r.start+r.duration*60000&&!r.announcementId)await openMeeting(guild,r);
   if(r.openedAt&&!r.closedAt&&Date.now()>=r.start+r.duration*60000){
    const otherActive=Object.values(a.state().schoolMeetings||{}).some(x=>x.id!==r.id&&x.openedAt&&!x.closedAt&&x.status!=='cancelled'&&Date.now()<x.start+x.duration*60000);
    if(!otherActive)for(const id of [voiceId,a.state().schoolChannels?.meetingChat].filter(Boolean)){
     const ch=await guild.channels.fetch(id).catch(e=>{if(e.code===10003)return null;throw e;});
     if(ch)await ch.permissionOverwrites.edit(familyRole,{ViewChannel:false},{reason:'Fin du créneau de réunion'});
    }
    save(r.id,p=>{p.closedAt=Date.now();});
   }
  });
 }
 for(const r of Object.values(a.state().schoolMeetings||{}))if(r.status==='waiting'&&Date.now()>=r.prepareAt)await a.serial('meeting:'+r.id,async()=>{
 const prepared=await prepare(guild,get(r.id));if(prepared.status==='draft'){
  const ch=await require('./qgWeeklyReport').destination(guild);
  await ch.send({embeds:[embed('Préparation de réunion ouverte',`**${prepared.name}**\nUtilise \`/réunion reunion:${prepared.id}\` pour préparer les notes et les décisions.\nRien ne sera appliqué avant \`/notesmp\`.`)],allowedMentions:{parse:[]}});
 }
});}
module.exports={data,configData,notesData,execute,handle,tick,get,save,authorized,render};
