// Centre d'administration du casino QG : tableau de bord en direct, fiches joueurs et opérations sur les portefeuilles.
// Consultation et notes : équipe casino. Jetons, gel et réinitialisation : Responsable du casino et Direction.
const {AttachmentBuilder,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,UserSelectMenuBuilder,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags:F}=require('discord.js');
const a=require('../utils/qgAdmin'),access=require('../utils/qgCasinoAccess'),config=require('../config/qg'),brand=require('../utils/qgBrand');
const draw=require('../utils/qgCasinoAdminDraw');
const CHANNEL='1565118824519438466',GOLD=0xd4bd86;
const store=()=>require('./qgCasinoGames').store;
const casino=()=>a.state().schoolCasino||{};
const money=n=>n.toLocaleString('fr-FR')+' jetons';
const signed=n=>(n>0?'+':'')+n.toLocaleString('fr-FR');
const time=(at,style='R')=>'<t:'+Math.floor(at/1000)+':'+style+'>';
const KIND={slots:['🎰','Machines à sous'],roulette:['🎡','Roulette'],blackjack:['🃏','Blackjack'],mines:['💣','Mines']};
const TYPES={credit:'➕ Crédit',debit:'➖ Débit',set:'✏️ Solde fixé',daily:'🎁 Récompense rendue',freeze:'🧊 Compte gelé',unfreeze:'🔥 Compte dégelé',cancel:'⏹️ Partie annulée',note:'📝 Note',reset:'♻️ Compte réinitialisé',bonus:'🎁 Bonus général'};
const row=(...x)=>new ActionRowBuilder().addComponents(...x);
const btn=(id,label,emoji,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);
const embed=(title,text='')=>new EmbedBuilder().setColor(GOLD).setAuthor({name:'Casino • Le QG'}).setTitle(title).setDescription(text.slice(0,4096)||null).setFooter(brand.footer(' · Administration du casino'));
const reply=(e,components=[],files=[],content=null)=>({content,embeds:[e],components,files,attachments:[],allowedMentions:{parse:[]}});

function stats(){
 const list=store().accounts(),sum=k=>list.reduce((n,[,x])=>n+(x[k]||0),0),byKind={};
 for(const [,x] of list)for(const [k,v] of Object.entries(x.byKind||{})){const t=byKind[k]||={played:0,wagered:0,returned:0};t.played+=v.played;t.wagered+=v.wagered;t.returned+=v.returned;}
 return {list,players:list.length,circulation:sum('balance'),wagered:sum('wagered'),returned:sum('returned'),played:sum('played'),active:list.filter(([,x])=>x.game).length,frozen:list.filter(([,x])=>x.frozen).length,open:casino().enabled!==false,byKind};
}
const name=(guild,id)=>guild.members.cache.get(id)?.displayName||guild.client.users.cache.get(id)?.username||'Joueur '+id.slice(-4);
function line(e){
 const who=e.targetId?'<@'+e.targetId+'>':(e.count||0)+' joueur(s)';
 const value=['credit','debit','bonus','cancel'].includes(e.type)?' · '+money(e.amount):e.type==='set'?' · '+money(e.before)+' → '+money(e.after):'';
 return `${TYPES[e.type]||e.type} · ${who}${value} · par <@${e.actorId}> ${time(e.at)}${e.reason?'\n> '+e.reason.slice(0,120):''}`;
}
function signature(){const s=stats();return JSON.stringify([s.players,s.circulation,s.wagered,s.returned,s.played,s.active,s.frozen,s.open,s.list.map(([id,x])=>[id,x.balance]).sort((p,q)=>q[1]-p[1]).slice(0,4),store().adminLog(1)[0]?.at]);}

// ---- Panneau permanent ----
function panel(guild){
 const s=stats(),top=[...s.list].sort((p,q)=>q[1].balance-p[1].balance).slice(0,4).map(([id,x])=>[name(guild,id),x.balance]);
 const image=new AttachmentBuilder(draw.renderDashboard({...s,top,updatedAt:Date.now()}),{name:'casino-admin.png'});
 const log=store().adminLog(4).map(line).join('\n')||'Aucune opération pour le moment.';
 const e=embed('🛡️  Centre d’administration du casino',`Choisis un joueur dans le menu pour ouvrir sa **fiche** : solde, courbe de résultats, parties, notes et actions.\n\n**Accès** · Équipe casino : consultation et notes · Responsable et Direction : jetons, gel et réinitialisation. Chaque opération est journalisée.\n\n**Dernières opérations**\n${log}`).setImage('attachment://casino-admin.png').setTimestamp();
 const open=s.open;
 return reply(e,[
  row(new UserSelectMenuBuilder().setCustomId('qgcadm:player').setPlaceholder('🔎 Ouvrir la fiche d’un joueur…').setMinValues(1).setMaxValues(1)),
  row(btn('qgcadm:live','Parties en cours','🕹️'),btn('qgcadm:games','Dernières parties','📜'),btn('qgcadm:ranks','Classements','🏆'),btn('qgcadm:log','Journal','🧾')),
  row(btn('qgcadm:bonus','Bonus général','🎁',ButtonStyle.Success),open?btn('qgcadm:toggle','Suspendre les mises','🔴',ButtonStyle.Danger):btn('qgcadm:toggle','Ouvrir les mises','🟢',ButtonStyle.Success),btn('qgcadm:export','Exporter','📤'),btn('qgcadm:refresh','Actualiser','🔄',ButtonStyle.Primary))
 ],[image]);
}
async function publish(guild){return a.serial('casino-admin-panel',async()=>{
 if(guild.id!==config.guildId)throw Error('Serveur QG incorrect.');
 const ch=await guild.channels.fetch(CHANNEL).catch(e=>{if(e.code===10003)return null;throw e;});
 if(!ch?.isTextBased?.()||ch.guildId!==guild.id)throw Error('Salon d’administration du casino introuvable.');
 const saved=casino().panels?.admin;
 let message=saved?.channelId===ch.id?await ch.messages.fetch(saved.messageId).catch(e=>{if(e.code===10008)return null;throw e;}):null;
 if(!message){const recent=await ch.messages.fetch({limit:50});message=recent.find(m=>m.author.id===guild.client.user.id&&m.components.some(r=>r.components.some(c=>c.customId==='qgcadm:player')));}
 const next=panel(guild),sig=signature();
 if(message)await message.edit(next);else message=await ch.send(next);
 a.save(s=>{s.schoolCasino||={};s.schoolCasino.panels||={};s.schoolCasino.panels.admin={channelId:ch.id,messageId:message.id};s.schoolCasino.adminSignature=sig;});
 return {detail:'Centre d’administration publié'};
});}
// Rafraîchit le tableau de bord seulement quand les chiffres changent.
async function tick(guild){if(signature()!==casino().adminSignature)await publish(guild);}

// ---- Fiche joueur ----
async function card(guild,id,notice=''){
 const acc=store().peek(id),user=await guild.client.users.fetch(id).catch(()=>null),nm=(await guild.members.fetch(id).catch(()=>null))?.displayName||user?.username||id;
 if(user?.bot)throw Error('Les bots n’ont pas de compte casino.');
 if(!acc)return reply(embed('👤  '+nm,`<@${id}> n’a encore jamais joué.\n\nUn crédit crée son compte : **1 000 jetons** de départ, plus le montant crédité.`),[row(btn('qgcadm:give:'+id,'Créditer','➕',ButtonStyle.Success),btn('qgcadm:note:'+id,'Note','📝'),btn('qgcadm:view:'+id,'Actualiser','🔄'))],[],notice||null);
 const fav=Object.entries(acc.byKind||{}).sort((p,q)=>q[1].played-p[1].played)[0];
 const daily=!acc.dailyAt||Date.now()-acc.dailyAt>=store().DAY?'Disponible':'Prochaine '+time(acc.dailyAt+store().DAY);
 const g=acc.game,games=(acc.history||[]).slice(0,8).map(h=>`${KIND[h.kind]?.[0]||'🎲'} ${time(h.at)} · mise ${h.stake.toLocaleString('fr-FR')} → **${signed(h.payout-h.stake)}**${h.detail?' · '+h.detail:''}`).join('\n');
 const notes=(acc.notes||[]).slice(0,3).map(n=>`${time(n.at,'d')} <@${n.actorId}> : ${n.text}`).join('\n');
 const ops=store().adminLog(300).filter(e=>e.targetId===id).slice(0,3).map(line).join('\n');
 const e=embed('👤  '+nm,`<@${id}>${acc.frozen?' · 🧊 **Compte gelé** : il ne peut plus miser ni récupérer sa récompense.':''}`).setImage('attachment://joueur.png').addFields(
  {name:'💰 Solde',value:money(acc.balance),inline:true},{name:'🎁 Récompense du jour',value:daily,inline:true},{name:'⭐ Jeu préféré',value:fav?KIND[fav[0]].join(' ')+' ('+fav[1].played+')':'—',inline:true},
  {name:'🕹️ Partie en cours',value:g?`${KIND[g.kind][0]} ${KIND[g.kind][1]} · mise ${money(g.stake)} · se résout ${time(g.expiresAt)}`:'Aucune'},
  {name:'📜 Dernières parties',value:(games||'Aucune partie.').slice(0,1024)},
  {name:'📝 Notes de l’équipe',value:(notes||'Aucune note.').slice(0,1024)},
  {name:'🧾 Dernières opérations',value:(ops||'Aucune opération.').slice(0,1024)});
 const file=new AttachmentBuilder(draw.renderPlayer({name:nm,id,account:acc}),{name:'joueur.png'});
 return reply(e,[
  row(btn('qgcadm:give:'+id,'Créditer','➕',ButtonStyle.Success),btn('qgcadm:take:'+id,'Débiter','➖',ButtonStyle.Danger),btn('qgcadm:set:'+id,'Fixer le solde','✏️'),btn('qgcadm:daily:'+id,'Rendre la récompense','🎁').setDisabled(daily==='Disponible')),
  row(btn('qgcadm:cancel:'+id,'Annuler la partie','⏹️').setDisabled(!g),acc.frozen?btn('qgcadm:freeze:'+id,'Dégeler','🔥',ButtonStyle.Success):btn('qgcadm:freeze:'+id,'Geler','🧊'),btn('qgcadm:note:'+id,'Note','📝'),btn('qgcadm:history:'+id,'Historique complet','📜')),
  row(btn('qgcadm:reset:'+id,'Réinitialiser','♻️',ButtonStyle.Danger),btn('qgcadm:view:'+id,'Actualiser','🔄',ButtonStyle.Primary))
 ],[file],notice||null);
}

// ---- Formulaires ----
function modal(id,title,fields){return new ModalBuilder().setCustomId(id).setTitle(title).addComponents(...fields.map(([key,label,style=TextInputStyle.Short,required=true,value])=>{const input=new TextInputBuilder().setCustomId(key).setLabel(label).setStyle(style).setRequired(required).setMaxLength(style===TextInputStyle.Paragraph?500:20);if(value)input.setValue(value);return row(input);}));}
const FORMS={
 give:['Créditer des jetons',[['amount','Montant (ex. 5000 ou 5k)'],['reason','Motif (visible dans le journal)',TextInputStyle.Paragraph],['notify','Prévenir le joueur en MP ? (oui / non)',TextInputStyle.Short,false,'oui']]],
 take:['Débiter des jetons',[['amount','Montant (ex. 5000 ou 5k)'],['reason','Motif (visible dans le journal)',TextInputStyle.Paragraph],['notify','Prévenir le joueur en MP ? (oui / non)',TextInputStyle.Short,false,'oui']]],
 set:['Fixer le solde',[['amount','Nouveau solde (ex. 25000 ou 25k)'],['reason','Motif (visible dans le journal)',TextInputStyle.Paragraph],['notify','Prévenir le joueur en MP ? (oui / non)',TextInputStyle.Short,false,'non']]],
 note:['Note de l’équipe',[['text','Note (visible par l’équipe casino)',TextInputStyle.Paragraph]]],
 bonus:['Bonus pour tous les joueurs',[['amount','Jetons par joueur (1 à 100 000)'],['reason','Motif (ex. événement du week-end)',TextInputStyle.Paragraph]]]
};
function parseAmount(text){const t=String(text||'').trim().toLowerCase().replace(/[\s.  _]/g,'').replace(',','.');const m=/^(\d+(?:\.\d+)?)(k|m)?$/.exec(t);if(!m)throw Error('Montant invalide : écris un nombre, par exemple 5000 ou 5k.');return Math.round(Number(m[1])*(m[2]==='m'?1e6:m[2]==='k'?1e3:1));}
async function notify(guild,id,text){const user=await guild.client.users.fetch(id).catch(()=>null);if(!user)return false;return user.send({embeds:[embed('💰  Ton portefeuille casino',text)]}).then(()=>true).catch(()=>false);}

// ---- Listes ----
function live(){const rows=store().accounts().filter(([,x])=>x.game).map(([id,x])=>`${KIND[x.game.kind][0]} <@${id}> · ${KIND[x.game.kind][1]} · mise **${money(x.game.stake)}** · se résout ${time(x.game.expiresAt)}`);return embed('🕹️  Parties en cours',(rows.join('\n')||'Aucune partie en cours.')+'\n\nUne partie inactive se résout seule après 30 minutes. Depuis la fiche du joueur, **Annuler la partie** rembourse sa mise.');}
function recent(){const all=store().accounts().flatMap(([id,x])=>(x.history||[]).map(h=>[id,h])).sort((p,q)=>q[1].at-p[1].at).slice(0,25);return embed('📜  Dernières parties',all.map(([id,h])=>`${KIND[h.kind]?.[0]||'🎲'} ${time(h.at)} · <@${id}> · mise ${h.stake.toLocaleString('fr-FR')} → **${signed(h.payout-h.stake)}**${h.detail?' · '+h.detail:''}`).join('\n')||'Aucune partie enregistrée.');}
function ranks(){
 const list=store().accounts(),top=(score,fmt)=>[...list].sort((p,q)=>score(q[1])-score(p[1])).slice(0,5).map(([id,x],i)=>`${['🥇','🥈','🥉','4.','5.'][i]} <@${id}> · ${fmt(x)}`).join('\n')||'—';
 const best=list.flatMap(([id,x])=>(x.history||[]).map(h=>[id,h])).sort((p,q)=>(q[1].payout-q[1].stake)-(p[1].payout-p[1].stake))[0];
 return embed('🏆  Classements',best?`**Plus gros gain récent** : <@${best[0]}> · **${signed(best[1].payout-best[1].stake)}** au ${KIND[best[1].kind]?.[1]} ${time(best[1].at)}`:'').addFields(
  {name:'💰 Soldes',value:top(x=>x.balance,x=>money(x.balance)),inline:true},{name:'📈 Résultat net',value:top(x=>x.returned-x.wagered,x=>signed(x.returned-x.wagered)),inline:true},
  {name:'🎲 Plus gros miseurs',value:top(x=>x.wagered,x=>money(x.wagered)),inline:true},{name:'🔥 Plus actifs',value:top(x=>x.played,x=>x.played+' parties'),inline:true});
}
function csv(){const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return 'id;solde;parties;mise;rendu;net;gele;partie_en_cours;derniere_partie\n'+store().accounts().map(([id,x])=>[id,x.balance,x.played,x.wagered,x.returned,x.returned-x.wagered,x.frozen?'oui':'non',x.game?x.game.kind:'',x.history?.[0]?new Date(x.history[0].at).toISOString():''].map(cell).join(';')).join('\n');}

// ---- Interactions ----
async function handle(i){
 if(i.guildId!==config.guildId)throw Error('Serveur QG incorrect.');
 const member=await i.guild.members.fetch({user:i.user.id,force:true});
 if(!access.staff(member))throw Error('Centre réservé à l’équipe casino.');
 const [,op,target]=i.customId.split(':'),manager=access.manager(member);
 const need=()=>{if(!manager)throw Error('Action réservée au Responsable du casino et à la Direction.');};
 const onCard=Boolean(i.message?.flags?.has(F.Ephemeral));
 const refreshPanel=()=>publish(i.guild).catch(e=>console.error('Admin casino :',e.code||e.message));
 const audit=(type,before,after,reason)=>a.audit(i.guild,{action:'casino.admin.'+type,actorId:i.user.id,targetId:target,before,after,reason}).catch(()=>{});

 // Formulaires : ouverts avant toute réponse différée.
 if(i.isButton()&&FORMS[op]){if(op!=='note')need();const [title,fields]=FORMS[op];return i.showModal(modal(`qgcadm:${op}f${target?':'+target:''}`,title,fields));}

 // Réponses en privé ; sur une fiche déjà ouverte, on la met à jour sur place.
 if(['history','live','games','ranks','log','export'].includes(op)||(!onCard&&op!=='refresh'))await i.deferReply({flags:F.Ephemeral});else await i.deferUpdate();
 const show=async(id,notice)=>i.editReply(await card(i.guild,id,notice));

 if(op==='player')return show(i.values[0]);
 if(op==='view')return show(target);
 if(op==='live')return i.editReply(reply(live()));
 if(op==='games')return i.editReply(reply(recent()));
 if(op==='ranks')return i.editReply(reply(ranks()));
 if(op==='log')return i.editReply(reply(embed('🧾  Journal des opérations',store().adminLog(15).map(line).join('\n\n')||'Aucune opération pour le moment.')));
 if(op==='export')return i.editReply({content:'📤 Export des comptes casino (CSV, séparateur « ; »).',files:[new AttachmentBuilder(Buffer.from('﻿'+csv(),'utf8'),{name:'casino-comptes.csv'})]});
 if(op==='refresh'){await publish(i.guild);return i.followUp({content:'🔄 Tableau de bord actualisé.',flags:F.Ephemeral});}
 if(op==='history'){
  const acc=store().peek(target);if(!acc)throw Error('Ce joueur n’a pas encore de compte.');
  const lines=(acc.history||[]).map(h=>`${new Date(h.at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})} · ${KIND[h.kind]?.[1]||h.kind} · mise ${h.stake} → ${h.payout} (${signed(h.payout-h.stake)})${h.detail?' · '+h.detail:''}${h.note?' · '+h.note:''}`);
  return i.editReply({...reply(embed('📜  Historique de '+name(i.guild,target),(acc.history||[]).slice(0,20).map(h=>`${KIND[h.kind]?.[0]||'🎲'} ${time(h.at,'f')} · mise ${h.stake.toLocaleString('fr-FR')} → **${signed(h.payout-h.stake)}**${h.detail?' · '+h.detail:''}`).join('\n')||'Aucune partie.')),files:lines.length?[new AttachmentBuilder(Buffer.from(lines.join('\n'),'utf8'),{name:'historique-'+target+'.txt'})]:[]});
 }

 if(i.isModalSubmit()){
  const field=k=>{try{return i.fields.getTextInputValue(k);}catch{return '';}};
  const reason=field('reason').trim();
  if(op==='notef'){store().note(target,field('text'),{actorId:i.user.id});return show(target,'📝 Note ajoutée.');}
  need();if(!reason)throw Error('Indique un motif.');
  if(op==='bonusf'){const n=parseAmount(field('amount')),count=store().creditAll(n,{actorId:i.user.id,reason});await audit('bonus',null,{amount:n,count},reason);refreshPanel();return i.editReply(reply(embed('🎁  Bonus distribué',`**${money(n)}** crédités à **${count} joueur(s)**.\nMotif : ${reason}`)));}
  const n=parseAmount(field('amount')),before=store().peek(target)?.balance??null;
  const acc=op==='givef'?store().credit(target,n,{actorId:i.user.id,reason}):op==='takef'?store().debit(target,n,{actorId:i.user.id,reason}):op==='setf'?store().setBalance(target,n,{actorId:i.user.id,reason}):null;
  if(!acc)throw Error('Formulaire inconnu.');
  await audit(op.slice(0,-1),before,acc.balance,reason);refreshPanel();
  const verb=op==='givef'?`a crédité **${money(n)}** sur`:op==='takef'?`a retiré **${money(n)}** de`:'a ajusté';
  const sent=/^o/i.test(field('notify').trim())?await notify(i.guild,target,`L’équipe du casino ${verb} ton portefeuille.\n\nMotif : ${reason}\nNouveau solde : **${money(acc.balance)}**`):null;
  return show(target,`✅ Solde : ${before===null?'nouveau compte':money(before)} → **${money(acc.balance)}**.${sent===true?' Le joueur a été prévenu en MP.':sent===false?' ⚠️ MP du joueur fermés : il n’a pas été prévenu.':''}`);
 }

 need();
 if(op==='toggle')return a.serial('casino-status',async()=>{
  const before=casino().enabled!==false;a.save(s=>{s.schoolCasino||={};s.schoolCasino.enabled=!before;});
  await a.audit(i.guild,{action:'casino.'+(before?'disable':'enable'),actorId:i.user.id,before,after:!before}).catch(()=>{});
  for(const [key,kind]of [['casinoHome','home'],['casinoControl','control']])await require('./qgCasino').publish(i.guild,key,kind).catch(e=>console.error('Panel casino :',e.code||e.message));
  await publish(i.guild);
  return i.editReply({content:before?'🔴 Nouvelles mises suspendues. Les parties en cours restent jouables.':'🟢 Nouvelles mises ouvertes.'});
 });
 const meta={actorId:i.user.id,reason:''};
 if(op==='daily'){store().resetDaily(target,meta);await audit('daily');refreshPanel();return show(target,'🎁 Le joueur peut de nouveau récupérer sa récompense du jour.');}
 if(op==='freeze'){const frozen=!store().peek(target)?.frozen;store().freeze(target,frozen,meta);await audit(frozen?'freeze':'unfreeze');refreshPanel();return show(target,frozen?'🧊 Compte gelé : plus de mises ni de récompense.':'🔥 Compte dégelé.');}
 if(op==='cancel'){const acc=store().cancelGame(target,meta);await audit('cancel');refreshPanel();return show(target,'⏹️ Partie annulée et mise remboursée. Solde : **'+money(acc.balance)+'**.');}
 if(op==='reset')return i.editReply({content:`⚠️ **Réinitialiser le compte de <@${target}> ?**\nSolde remis à 1 000 jetons, statistiques et historique effacés. Les notes de l’équipe sont conservées.`,embeds:[],files:[],attachments:[],components:[row(btn('qgcadm:resetok:'+target,'Confirmer la réinitialisation','♻️',ButtonStyle.Danger),btn('qgcadm:view:'+target,'Annuler','↩️'))],allowedMentions:{parse:[]}});
 if(op==='resetok'){const before=store().peek(target)?.balance??null;store().resetAccount(target,meta);await audit('reset',before,1000);refreshPanel();return show(target,'♻️ Compte réinitialisé.');}
 throw Error('Action inconnue.');
}
module.exports={CHANNEL,panel,publish,tick,card,handle,stats,parseAmount,csv};
