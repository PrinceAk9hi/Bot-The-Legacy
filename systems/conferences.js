const {Events,MessageFlags,ModalBuilder,ActionRowBuilder,TextInputBuilder,TextInputStyle,GuildScheduledEventStatus}=require('discord.js');
const {IDENTITY}=require('../config/soulSociety');
const {MAIN_RANKS}=require('../config/ranks');
const {hasBypass}=require('../utils/security');
const {read}=require('../utils/recruitmentData');
const {eligible,duration}=require('../utils/soulActivityHelpers');
const {Ledger}=require('../utils/soulActivityLedger');
const plan=require('../utils/conferencePlan');
const jobs=require('../utils/conferenceActions');
const meetings=require('../utils/familyMeetings');
const PAGE_SIZE=2,locks=new Set();
const text=content=>({type:10,content});
const row=(...components)=>({type:1,components});
const button=(custom_id,label,style=2,disabled=false)=>({type:2,custom_id,label,style,disabled});
const menu=(custom_id,placeholder,options)=>row({type:3,custom_id,placeholder,options});
const box=components=>({flags:MessageFlags.IsComponentsV2,components:[{type:17,accent_color:0xe8a6c8,components}],allowedMentions:{parse:[]}});
const cid=(r,action,extra='')=>`conf:${r.id}:${r.revision||0}:${action}${extra?':'+extra:''}`;
const stamp=t=>`<t:${Math.floor(t/1000)}:F>`;
const esc=s=>String(s).replace(/[\\*_~`|]/g,'\\$&').replace(/@/g,'＠');
function home(i){
 const list=Object.values(read(plan.STORE)).filter(r=>r.guildId===i.guildId&&r.authorId===i.user.id&&!r.cancelledAt).sort((a,b)=>b.createdAt-a.createdAt).slice(0,25);
 const p=plan.parts();const components=[text(`## 📅 Conférences — La Soul Society\nDate actuelle : **${p.day}/${p.month}/${p.year}**, heure de Paris.\nConfigure la date et l’heure, le titre et une description facultative. Prépare ensuite les notes et les grades maintenant ou avant la conférence. Les modifications ne sont exécutées qu’après validation finale.\nLes événements, annonces et rappels en MP 30 minutes avant sont conservés.`),row(button(`confhome:${i.user.id}:new`,'Créer une conférence',3))];
 if(list.length)components.push(menu(`confhome:${i.user.id}:open`,'Reprendre une conférence',list.map(r=>({label:r.name.slice(0,100),value:r.id,description:`${new Date(r.start).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})} • ${r.status}`.slice(0,100)}))));
 return box(components);
}
function payload(r){
 const b=(a,label,style=2,disabled=false,extra='')=>button(cid(r,a,extra),label,style,disabled);
 const out=[text(`## 📅 ${esc(r.name)}\n${stamp(r.start)} • ${r.duration} min • heure de Paris\n${esc(r.description||'Aucune description.')}\nAuteur : <@${r.authorId}>`)];
 if(r.notice)out.push(text('ℹ️ '+esc(r.notice)));
 if(r.cancelledAt){out.push(text('❌ Conférence annulée. Les actions restantes et les rappels sont arrêtés.'));return box(out);}
 if(r.status==='finished'){
  const results=Object.entries(r.results||{}),page=Math.min(r.resultPage||0,Math.max(0,Math.ceil(results.length/5)-1));
  out.push(text('### Exécution terminée\n'+(results.length?results.slice(page*5,page*5+5).map(([key,v])=>`${v.status==='done'?'✅':'⚠️'} <@${key.split(':')[1]}> — ${key.startsWith('note:')?'Note':'Grade / sanction'}\n${esc((v.detail||v.status).slice(0,300))}`).join('\n\n'):'Aucune modification programmée.')));
  if(results.length>5)out.push(row(b('results','Précédent',2,page===0,String(page-1)),b('results','Suivant',2,(page+1)*5>=results.length,String(page+1))));
  return box(out);
 }
 if(r.status==='event_review'){out.push(text('⚠️ Création d’événement interrompue : vérification requise pour éviter un doublon. Utilise « Retrouver l’événement » avant toute nouvelle création.'),row(b('recover','Retrouver l’événement',1)));return box(out);}
 if(r.status==='paused'){
  out.push(text('⚠️ La date de l’événement Discord a changé. Les actions automatiques sont suspendues.'),row(b('resync','Reprendre la nouvelle date',1),b('cancel','Annuler',4)));return box(out);
 }
 if(r.status==='scheduled'||r.status==='waiting'){
  out.push(text(`### Conférence enregistrée\n${r.eventId?`[Événement Discord](https://discord.com/events/${r.guildId}/${r.eventId})`:'Événement en préparation.'}\nPréparation : **${plan.PREP[r.offset]}**\nApplication : **${stamp(plan.executionAt(r))}**\n${r.status==='waiting'?'Les actions ne sont pas encore validées. Le panel demandera la préparation au moment prévu.':'✅ Choix validés. Seuls les membres explicitement notés ou sélectionnés sont concernés.'}`));
  out.push(row(b('edit','Préparer / modifier',1,Date.now()>=plan.executionAt(r)),b('cancel','Annuler la conférence',4)));
  return box(out);
 }
 if(r.page==='setup'){
  out.push(text('### 1 · Préparation des notes et grades\nChoisis quand préparer les décisions. Aucun grade n’est changé pendant la préparation.'));
  out.push(menu(cid(r,'offset'),'Quand préparer ?',Object.entries(plan.PREP).map(([value,label])=>({value,label,default:r.offset===value}))));
  out.push(row(b('details','Retour : date et titre',2,Boolean(r.eventId)),b('next','Continuer',3)));
 }else if(r.page==='notes'||r.page==='grades'){
  const max=Math.max(0,Math.ceil(r.roster.length/PAGE_SIZE)-1),page=Math.min(r.memberPage||0,max),slice=r.roster.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE);
  out.push(text(`### ${r.page==='notes'?'2 · Notes d’activité':'3 · Gestion des grades'} — page ${page+1}/${max+1}\n${r.page==='notes'?'Clique une étoile ; recliquer la note sélectionnée la retire. « … » ajoute une raison facultative.':'Choisis une action ; recliquer la même action l’annule. « … » ajoute une raison facultative. Les avertissements sont progressifs.'}\nActivité moyenne par semaine sur les 28 derniers jours observés ; les périodes non enregistrées ne sont pas reconstituées.`));
  for(const m of slice){
   const n=r.notes[m.id],a=r.actions[m.id],notePage=r.page==='notes';
   const summary=notePage?(n?`${'★'.repeat(n.value)} — ${plan.LABELS[n.value-1]}`:'Non noté'):(a?`${plan.ACTIONS[a.type]}${a.next?' → '+MAIN_RANKS[a.next].name:a.warningLabel?' → '+a.warningLabel:''}`:'Aucune action');
   out.push({type:9,components:[text(`<@${m.id}> • **${esc(m.grade)}**\n🎙️ ${duration(m.voiceMs)} / semaine • 💬 ${m.messages} messages / semaine${m.partial?' • historique partiel':''}\n**${summary}**${(notePage?n:a)?.reason?'\nRaison : '+esc((notePage?n:a).reason):''}`)],accessory:b(notePage?'noteReason':'actionReason','…',2,false,m.id)});
   out.push(notePage?row(...[1,2,3,4,5].map(v=>b('rate',`${v} ★`,n?.value===v?3:2,false,m.id+':'+v))):row(...['up','derank','down','warn'].map(v=>b('action',plan.ACTIONS[v],a?.type===v?3:2,false,m.id+':'+v))));
  }
  if(!slice.length)out.push(text('Aucun membre éligible trouvé.'));
  out.push(row(b('back','Retour'),b('page','◀',2,page===0,String(page-1)),b('page','▶',2,page===max,String(page+1)),b('next','Terminer cette étape',3)));
 }else if(r.page==='delay'){
  out.push(text('### 4 · Application des modifications\nLes notes, grades et sanctions validés seront appliqués au délai choisi après le début de la conférence.'));
  out.push(menu(cid(r,'delay'),'Délai après le début',[1,2,3].map(n=>({label:`${n} heure${n>1?'s':''} après le début`,value:String(n),default:r.delay===n}))));
  out.push(row(b('back','Retour'),b('next','Voir le récapitulatif',3)));
 }else{
  const entries=[...Object.entries(r.notes).map(([id,n])=>`⭐ <@${id}> : ${n.value}/5 — ${esc(n.reason||'Aucune raison précisée.')}`),...Object.entries(r.actions).map(([id,a])=>`• <@${id}> : ${plan.ACTIONS[a.type]}${a.next?' → '+MAIN_RANKS[a.next].name:a.warningLabel?' → '+a.warningLabel:''} — ${esc(a.reason||'Aucune raison précisée.')}`)];
  const page=Math.min(r.reviewPage||0,Math.max(0,Math.ceil(entries.length/4)-1));
  out.push(text(`### 5 · Validation finale\nPréparation : **${plan.PREP[r.offset]}**\nApplication : **${stamp(plan.executionAt(r))}**\n**${Object.keys(r.notes).length} note(s), ${Object.keys(r.actions).length} action(s)**\n${r.offset!=='now'&&r.offset!=='none'&&!r.preparing?'Les notes et grades seront demandés plus tard : aucune sanction n’est encore autorisée.':'Valider autorise l’application automatique des choix ci-dessous.'}\n\n${entries.slice(page*4,page*4+4).join('\n')||'Aucune modification sélectionnée.'}`));
  if(entries.length>4)out.push(row(b('reviewpage','◀',2,page===0,String(page-1)),b('reviewpage','▶',2,(page+1)*4>=entries.length,String(page+1))));
  out.push(row(b('back','Retour'),b('finish','Valider la conférence',3)));
 }
 return box(out);
}
function modal(customId,title,fields){return new ModalBuilder().setCustomId(customId).setTitle(title).addComponents(fields.map(f=>new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(f.id).setLabel(f.label).setStyle(f.long?TextInputStyle.Paragraph:TextInputStyle.Short).setRequired(f.required!==false).setMaxLength(f.max||100).setValue(f.value||''))));}
function detailsModal(id,r){
 const p=r?plan.parts(r.start):null,h=r?new Date(r.start).toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'}):'';
 return modal(id,'Configurer la conférence',[{id:'date',label:'Jour ou JJ/MM ou JJ/MM/AAAA',value:p?`${p.day}/${p.month}/${p.year}`:''},{id:'time',label:'Heure de Paris — HH:MM',value:h},{id:'title',label:'Titre',value:r?.name||''},{id:'description',label:'Description (facultative)',value:r?.description||'',required:false,long:true,max:1000},{id:'duration',label:'Durée en minutes (60 par défaut)',value:r?String(r.duration):'',required:false,max:4}]);
}
async function snapshot(guild){
 const roster=await require('../utils/familyMembers').members(guild,true),now=Date.now(),ledger=guild.client.soulActivity?.ledger||new Ledger(read('soulActivityTimeline'));
 const from=Math.max(now-28*86400000,ledger.data.since||now),weeks=Math.max(1,(now-from)/(7*86400000));
 return [...roster.values()].filter(eligible).sort((a,b)=>a.displayName.localeCompare(b.displayName,'fr')).map(m=>{
  const held=Object.entries(MAIN_RANKS).filter(([,v])=>m.roles.cache.has(v.roleId)),g=held.at(-1),stats=ledger.totals(m.id,from,now);
  return {id:m.id,key:g?.[0]||null,grade:g?.[1].name||'Sans grade principal',expectedRoles:jobs.rankIds(m),messages:Math.round(stats.messages/weeks),voiceMs:Math.round(stats.voiceMs/weeks),partial:from>now-28*86400000};
 });
}
async function render(guild,r){if(!r.messageId)return;const c=await guild.channels.fetch(r.channelId);const m=await c.messages.fetch(r.messageId);await m.edit(payload(r));}
async function notify(guild,r,content){const c=await guild.channels.fetch(r.channelId);await c.send({content:`<@${r.authorId}> ${content}`,allowedMentions:{parse:[],users:[r.authorId]}});}
function mutate(id,fn){return plan.save(id,r=>{fn(r);r.revision=(r.revision||0)+1;});}
async function prepare(guild,r){const roster=await snapshot(guild);return mutate(r.id,p=>{p.roster=roster;p.preparing=true;p.status='draft';p.approvedAt=null;p.page='notes';p.memberPage=0;});}
async function finalize(guild,r){
 plan.validate(r);
 if(!r.eventId){
  if(r.start<=Date.now()+1800000)throw Error('La conférence doit encore être à plus de 30 minutes. Modifie la date avant de valider.');
  plan.save(r.id,p=>{p.status='event_review';});
  // The reference is persisted in the existing event record for crash recovery.
  const result=await meetings.create(guild,{start:r.start,name:r.name,description:r.description,duration:r.duration,authorId:r.authorId,conferenceId:r.id});
  r=plan.save(r.id,p=>{p.eventId=result.id;p.notice=result.announcement?'': 'Événement créé, mais annonce non envoyée : vérifie le salon d’annonces.';});
 }
 r=mutate(r.id,p=>{const later=p.offset!=='now'&&p.offset!=='none'&&!p.preparing;p.status=later?'waiting':'scheduled';p.approvedAt=later?null:Date.now();});
 if(r.status==='waiting'&&plan.due(r)<=Date.now()){
  r=await prepare(guild,r);
  r=plan.save(r.id,p=>{p.notice='Le délai de préparation choisi est déjà passé : prépare les décisions maintenant, puis valide-les.';});
 }
 return r;
}
async function handle(i){
 if(!i.customId?.startsWith('conf:')&&!i.customId?.startsWith('confhome:'))return;
 const fail=msg=>i.followUp({content:'❌ '+msg,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
 if(i.guildId!==IDENTITY.guildId||require('../utils/lineState').isOff())return i.reply({content:'❌ Panel indisponible.',flags:MessageFlags.Ephemeral});
 if(i.message?.author?.id!==i.client.user.id)return;
 // These permissions are checked again with a fresh member before every mutation.
 if(!hasBypass(i.member))return i.reply({content:'❌ Accès réservé à la fondation et aux bypass.',flags:MessageFlags.Ephemeral});
 const homeAction=i.customId.startsWith('confhome:'),chunks=i.customId.split(':'),id=chunks[1],action=homeAction?chunks[2]:chunks[3],extra=chunks.slice(4);
 if(homeAction&&id!==i.user.id)return i.reply({content:'Ce panneau appartient à son auteur.',flags:MessageFlags.Ephemeral});
 let r=homeAction?null:plan.get(id);
 if(!homeAction&&(!r||r.guildId!==i.guildId||r.authorId!==i.user.id))return i.reply({content:'Conférence introuvable ou réservée à son auteur.',flags:MessageFlags.Ephemeral});
 const lock=homeAction?'new:'+i.user.id:id;
 if(locks.has(lock))return i.reply({content:'Une opération est déjà en cours.',flags:MessageFlags.Ephemeral});
 locks.add(lock);
 try{
  if(!homeAction&&(r.revision||0)!==Number(chunks[2]))return i.reply({content:'Cette page a changé. Utilise le panneau actualisé ou relance =conf.',flags:MessageFlags.Ephemeral});
  if(homeAction&&action==='new')return i.showModal(detailsModal(`confhome:${i.user.id}:create`));
  if(!homeAction&&action==='details'&&!r.eventId)return i.showModal(detailsModal(cid(r,'detailsSave'),r));
  if(!homeAction&&['noteReason','actionReason'].includes(action)){
   if(r.status!=='draft'||!['notes','grades'].includes(r.page)||!r.roster.some(m=>m.id===extra[0]))throw Error('Page incorrecte.');
   const item=(action==='noteReason'?r.notes:r.actions)[extra[0]];if(!item)throw Error('Choisis d’abord une note ou une action.');
   return i.showModal(modal(cid(r,action+'Save',extra[0]),'Raison facultative',[{id:'reason',label:'Raison (laisser vide pour retirer)',value:item.reason||'',required:false,long:true,max:300}]));
  }
  if(!homeAction&&action==='cancel')return i.showModal(modal(cid(r,'cancelSave'),'Annuler cette conférence',[{id:'confirm',label:'Écris ANNULER pour confirmer',max:7}]));
  await i.deferUpdate();
  const actor=await i.guild.members.fetch({user:i.user.id,force:true});if(!hasBypass(actor))throw Error('Tu ne disposes plus des permissions.');
  if(homeAction){
   if(action==='open'){
    r=plan.get(i.values[0]);if(!r||r.authorId!==i.user.id||r.guildId!==i.guildId)throw Error('Conférence inaccessible.');
    r=mutate(r.id,p=>{p.channelId=i.channelId;p.messageId=i.message.id;});
   }else if(action==='create'){
    const start=plan.parseDate(i.fields.getTextInputValue('date'),i.fields.getTextInputValue('time')),name=i.fields.getTextInputValue('title').trim(),description=i.fields.getTextInputValue('description').trim(),d=i.fields.getTextInputValue('duration').trim(),duration=d?Number(d):60;
    if(!name||!Number.isInteger(duration)||duration<15||duration>1440)throw Error('Titre obligatoire ; durée entre 15 et 1440 minutes.');
    r=plan.create({guildId:i.guildId,authorId:i.user.id,channelId:i.channelId,start,name,description,duration});r=mutate(r.id,p=>{p.messageId=i.message.id;});
   }else throw Error('Action inconnue.');
  }else{
   if(r.cancelledAt)throw Error('Cette conférence est annulée.');
   if(action==='results')r=mutate(id,p=>{p.resultPage=Math.max(0,Number(extra[0])||0);});
   else if(action==='cancelSave'){
    if(i.fields.getTextInputValue('confirm')!=='ANNULER')throw Error('Annulation non confirmée.');
    // Block scheduled work before Discord calls; do not restore it on API failure.
    r=mutate(id,p=>{p.cancelledAt=Date.now();p.status='cancelled';});
    if(r.eventId)await meetings.cancel(i.guild,r.eventId);
   }else if(action==='recover'){
    const found=Object.values(read('familyMeetings')).find(m=>m.conferenceId===id&&m.guildId===i.guildId);
    if(!found)throw Error('Aucun événement lié enregistré : vérifie les événements Discord avant de recréer une conférence. Ce brouillon reste suspendu.');
    r=mutate(id,p=>{p.eventId=found.eventId;p.status='draft';p.page='review';});
   }else if(action==='resync'){
    const event=await i.guild.scheduledEvents.fetch(r.eventId);if(!event||event.status===GuildScheduledEventStatus.Canceled||event.channelId!==meetings.CONFERENCE)throw Error('Événement annulé, introuvable ou déplacé hors du salon conférence.');
    r=mutate(id,p=>{p.start=event.scheduledStartTimestamp;p.status='draft';p.approvedAt=null;p.page='review';p.notice='Nouvelle date : vérifie puis valide à nouveau.';});
   }else if(action==='edit'){
    if(Date.now()>=plan.executionAt(r))throw Error('Le délai d’application est dépassé.');
    r=await prepare(i.guild,r);
   }else{
    if(r.status!=='draft')throw Error('Cette conférence n’est plus en préparation.');
    if(action==='detailsSave'&&!r.eventId){
     const start=plan.parseDate(i.fields.getTextInputValue('date'),i.fields.getTextInputValue('time')),name=i.fields.getTextInputValue('title').trim(),description=i.fields.getTextInputValue('description').trim(),d=i.fields.getTextInputValue('duration').trim(),duration=d?Number(d):60;
     if(!name||!Number.isInteger(duration)||duration<15||duration>1440)throw Error('Titre ou durée invalide.');
     r=mutate(id,p=>{Object.assign(p,{start,name,description,duration});});
    }else if(action==='offset'&&r.page==='setup'){
     if(!Object.hasOwn(plan.PREP,i.values[0]))throw Error('Choix invalide.');r=mutate(id,p=>{p.offset=i.values[0];p.preparing=false;});
    }else if(action==='next'){
     if(r.page==='setup'&&r.offset==='now'){r=await prepare(i.guild,r);}
     else r=mutate(id,p=>{p.page={setup:'delay',notes:'grades',grades:'delay',delay:'review'}[p.page]||'review';p.memberPage=0;p.reviewPage=0;if(p.offset==='none'){p.notes={};p.actions={};}});
    }else if(action==='back')r=mutate(id,p=>{p.page={notes:'setup',grades:'notes',delay:(p.preparing?'grades':'setup'),review:'delay'}[p.page]||'setup';p.memberPage=0;});
    else if(action==='page'&&['notes','grades'].includes(r.page))r=mutate(id,p=>{p.memberPage=Math.max(0,Math.min(Math.ceil(p.roster.length/PAGE_SIZE)-1,Number(extra[0])||0));});
    else if(action==='reviewpage'&&r.page==='review')r=mutate(id,p=>{p.reviewPage=Math.max(0,Number(extra[0])||0);});
    else if(action==='delay'&&r.page==='delay'){
     const d=Number(i.values[0]);if(![1,2,3].includes(d))throw Error('Délai invalide.');r=mutate(id,p=>{p.delay=d;});
    }else if(action==='rate'&&r.page==='notes'){
     const [target,v]=extra,value=Number(v);if(!r.roster.some(m=>m.id===target)||![1,2,3,4,5].includes(value))throw Error('Note invalide.');
     r=mutate(id,p=>{if(p.notes[target]?.value===value)delete p.notes[target];else p.notes[target]={...p.notes[target],value};});
    }else if(action==='action'&&r.page==='grades'){
     const [target,type]=extra,m=r.roster.find(m=>m.id===target);if(!m||!['up','down','derank','warn'].includes(type))throw Error('Action invalide.');
     if(r.actions[target]?.type===type)r=mutate(id,p=>{delete p.actions[target];});
     else{
      const member=await i.guild.members.fetch({user:target,force:true});if(!eligible(member))throw Error('Ce membre n’est plus éligible.');
      const a={type,expectedRoles:jobs.rankIds(member),reason:r.actions[target]?.reason||''};
      if(type==='up'||type==='down')a.next=require('./userActions').adjacent(member,type).next;
      if(type==='warn'){
       const levels=['1468698882002387044','1468698901077823653','1468698902428516524'],keys=['rappel','avertissement','derniere_chance'],names=['Avertissement 1','Avertissement 2','Dernière chance'];
       const held=levels.filter(x=>member.roles.cache.has(x)),index=Math.max(-1,...held.map(x=>levels.indexOf(x)))+1;
       if(index>=3)throw Error('Ce membre est déjà en Dernière chance. Choisis explicitement une autre action.');
       a.warning=keys[index];a.warningLabel=names[index];a.expectedWarnings=held;
      }
      r=mutate(id,p=>{p.actions[target]=a;});
     }
    }else if(['noteReasonSave','actionReasonSave'].includes(action)){
     const collection=action==='noteReasonSave'?'notes':'actions',target=extra[0];if(!r[collection][target])throw Error('La sélection a été retirée.');
     r=mutate(id,p=>{p[collection][target].reason=i.fields.getTextInputValue('reason').trim();});
    }else if(action==='finish'&&r.page==='review')r=await finalize(i.guild,r);
    else throw Error('Action indisponible sur cette page.');
   }
  }
  await i.editReply(payload(r));
 }catch(e){if(!i.deferred&&!i.replied)await i.reply({content:'❌ '+e.message,flags:MessageFlags.Ephemeral}).catch(()=>{});else{await fail(e.message||'Opération impossible.').catch(()=>{});if(r)await i.editReply(payload(plan.get(r.id)||r)).catch(()=>{});}}
 finally{locks.delete(lock);}
}
async function tick(guild){
 if(require('../utils/lineState').isOff())return;
 for(const raw of Object.values(read(plan.STORE))){
  if(raw.guildId!==guild.id||raw.cancelledAt||!['waiting','scheduled'].includes(raw.status)||locks.has(raw.id))continue;
  locks.add(raw.id);
  try{
   let r=plan.get(raw.id);if(!r.eventId)continue;
   const event=await guild.scheduledEvents.fetch(r.eventId).catch(e=>{if(e.code===10070)return null;throw e;});
   if(!event||event.status===GuildScheduledEventStatus.Canceled){r=mutate(r.id,p=>{p.cancelledAt=Date.now();p.status='cancelled';});await render(guild,r);continue;}
   if(event.channelId!==meetings.CONFERENCE||event.scheduledStartTimestamp!==r.start){r=mutate(r.id,p=>{p.status='paused';p.approvedAt=null;});await render(guild,r);continue;}
   if(r.status==='waiting'&&Date.now()>=plan.due(r)){
    r=await prepare(guild,r);r=plan.save(r.id,p=>{p.notice='La préparation est ouverte. Les décisions ne seront exécutées qu’après validation finale.';});
    await render(guild,r).catch(e=>console.error('Panel conférence :',e.code||e.message));
    await notify(guild,r,'la préparation de ta conférence est ouverte. Utilise le panel ou `=conf`.');
   }else if(plan.scheduled(r)&&Date.now()>=plan.executionAt(r)){
    // An outage lasting a whole day must not silently apply obsolete sanctions.
    if(Date.now()>plan.executionAt(r)+86400000){r=mutate(r.id,p=>{p.status='paused';p.notice='Application dépassée de plus de 24 h : aucune sanction tardive automatique.';});await render(guild,r);continue;}
    await jobs.execute(guild,r);await render(guild,plan.get(r.id));
   }
  }catch(e){console.error('Conférence :',e.code||e.message);}
  finally{locks.delete(raw.id);}
 }
}
function register(client){if(client.conferencesRegistered)return;client.conferencesRegistered=true;
 let running=false;const run=async()=>{if(running)return;running=true;try{const guild=client.guilds.cache.get(IDENTITY.guildId);if(guild)await tick(guild);}catch(e){console.error('Conférences :',e.code||e.message);}finally{running=false;}};
 const start=()=>{run();const t=setInterval(run,60000);t.unref();};if(client.isReady())start();else client.once(Events.ClientReady,start);
}
module.exports={register,handle,tick,home,payload,snapshot,finalize,prepare,detailsModal};
