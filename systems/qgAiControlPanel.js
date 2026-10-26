const {ActionRowBuilder:Row,ButtonBuilder:Button,ButtonStyle:Style,StringSelectMenuBuilder:Menu,ModalBuilder:Modal,TextInputBuilder:Input,TextInputStyle:Text,MessageFlags:F}=require('discord.js');
const config=require('../config/qg');
const store=require('../utils/qgAiStore');
const kb=require('../utils/qgAiKnowledge');
const context=require('../utils/qgAiContext');
const {embed}=require('./qgPanels');
const {read}=require('../utils/recruitmentData');
const topics=['general','bot-owner','direction','members','recruitment','management','rules','moderation','discord','absence','grades','voice'];
const pages={overview:'Vue d’ensemble',quality:'Qualité et tendances',knowledge:'Connaissances',corrections:'Corrections',unresolved:'Demandes non résolues',errors:'Incidents',config:'Configuration',test:'Test sans publication'};
const button=(id,label,style=Style.Secondary)=>new Button().setCustomId('qgai:'+id).setLabel(label).setStyle(style);
async function authorized(i){
  if(i.guildId!==config.guildId)return false;
  const m=await i.guild.members.fetch({user:i.user.id,force:true});
  const r=read('qgServer').schoolRoles||{};
  return i.user.id===config.ownerId||i.user.id===i.guild.ownerId||['creator','globalManager','administrator'].some(k=>r[k]&&m.roles.cache.has(r[k]));
}
function metrics(s){
  const events=s.events,answers=events.filter(e=>e.type==='answer'),outcomes=events.filter(e=>e.type==='outcome');
  const latest=new Map(outcomes.map(e=>[e.channelId,e]));
  return `Période : événements conservés (${s.config.retentionDays||30} jours maximum).\nQuestions traitées : **${answers.length}**\nEscalades : **${events.filter(e=>e.type==='escalation').length}**\nRéponses signalées : **${Object.keys(s.corrections).length}**\nDossiers marqués résolus : **${[...latest.values()].filter(e=>e.result==='resolved').length}**\nRéponses utiles : **non mesurées**\nTemps moyen : **${answers.length?Math.round(answers.reduce((n,e)=>n+(e.elapsedMs||0),0)/answers.length)+' ms':'non mesuré'}**\nTokens mesurés : **${answers.reduce((n,e)=>n+(e.usage?.input||0)+(e.usage?.output||0),0)}**\nCoût : **non estimé (tarif du modèle non configuré)**\nDernières 24 h : **${answers.filter(e=>e.at>Date.now()-86400000).length}** réponses.\nSujets : ${Object.entries(answers.reduce((a,e)=>{a[e.topic]=(a[e.topic]||0)+1;return a;},{})).map(([k,v])=>`${k} : ${v}`).join(', ')||'aucun'}`;
}
function panel(page='overview',offset=0){
  if(!pages[page])page='overview'; const s=store.read();
  let text='',items=[],actions=[];
  if(page==='quality'){
    const counts=new Map(),errors=new Map();
    for(const e of s.events.filter(e=>e.type==='answer'&&e.question)){const q=kb.normalize(e.question).replace(/\s+/g,' ').trim();counts.set(q,(counts.get(q)||0)+1);for(const fault of e.faults||[])errors.set(fault,(errors.get(fault)||0)+1);}
    for(const c of Object.values(s.corrections)){const type=c.errorType||'autre';errors.set(type,(errors.get(type)||0)+1);}
    const ranked=map=>[...map].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([q,n])=>`• ${kb.clean(q).slice(0,180)} : **${n}**`).join('\n')||'Aucune mesure.';
    text=`**Questions les plus fréquentes**\n${ranked(counts)}\n\n**Types de signalements et anomalies**\n${ranked(errors)}\n\nRegroupement par texte normalisé, sur la période conservée. Les formulations différentes ne sont pas fusionnées automatiquement.`;
  }
  if(page==='overview')text=`**QG — Assistant officiel**\nRéponses : **${s.config.enabled?'activées':'désactivées'}**\nFournisseur : API compatible configurée — ${require('../utils/qgAiProvider').configured()?'clé présente, disponibilité à confirmer par un test':'clé absente'}\n\n${metrics(s)}`;
  if(page==='knowledge'){items=Object.values(s.knowledge);actions=[button('form:knowledge','Ajouter / modifier'),button('form:archive','Archiver'),button('form:search','Rechercher'),button('migrate','Importer en brouillons')];text='Informations publiques QG uniquement. Sujets : '+topics.join(', ')+'.\n';}
  if(page==='corrections'){items=Object.values(s.corrections);actions=[button('form:correction','Signaler / proposer'),button('form:review','Examiner une correction')];text='Une proposition ne devient officielle qu’après validation.\n';}
  if(page==='unresolved'){const outcomes=new Map(s.events.filter(e=>e.type==='outcome').map(e=>[e.channelId,e.result]));items=s.events.filter(e=>e.unresolved||e.type==='escalation').map(e=>({...e,status:outcomes.get(e.channelId)||'pending'}));actions=[button('form:outcome','Marquer une issue'),button('form:correction','Proposer une solution')];}
  if(page==='errors'){items=s.events.filter(e=>e.type==='error'||e.faults?.length);text='Erreurs techniques et réponses rejetées. Aucun secret ni contenu de clé.\n';}
  if(page==='config'){text=`Réponses : ${s.config.enabled?'activées':'désactivées'}\nSalons : ${s.config.channels.length?s.config.channels.map(id=>'<#'+id+'>').join(', '):'tous les tickets QG uniquement'}\nRétention : ${s.config.retentionDays} jours\nÉtat du stockage : ${store.diagnostics().health}\nPersistance : volume Railway requis, un seul processus.\nLes mentions fonctionnent partout par défaut. Le bouton Réponses publiques permet de restreindre les salons ; une liste vide réactive les mentions partout.`;actions=[button('toggle','Activer / désactiver'),button('form:config','Salons et conservation'),button('form:public','Réponses publiques'),button('form:reset','Réinitialiser un contexte'),button('diagnostic','Diagnostic')];}
  if(page==='test'){text='La réponse sera visible uniquement par toi. Aucun ticket déplacé, aucun rôle mentionné, aucune action administrative. Un test utilise deux appels : sélection des connaissances, puis réponse.';actions=[button('form:test','Tester une question')];}
  items=items.slice().reverse();offset=Math.max(0,Math.min(Number(offset)||0,Math.max(0,Math.floor((items.length-1)/5)*5)));
  if(['knowledge','corrections','unresolved','errors'].includes(page))text+=(items.slice(offset,offset+5).map(e=>`**${kb.clean(e.title||e.question||e.topic||e.type||'Correction').slice(0,100)}**\nRéférence : \`${e.id}\`\n${e.status||e.decision||''} • ${new Date(e.updatedAt||e.at||e.createdAt).toISOString().slice(0,10)}\n${kb.clean(e.content||e.problem||e.reason||e.code||'').slice(0,240)}`).join('\n\n')||'Aucune entrée.')+`\n\n${items.length} entrée(s).`;
  const components=[new Row().addComponents(new Menu().setCustomId('qgai:page').setPlaceholder('Navigation').addOptions(Object.entries(pages).map(([value,label])=>({value,label,default:value===page}))))];
  if(actions.length)components.push(new Row().addComponents(...actions));
  if(items.length>5)components.push(new Row().addComponents(button(`page:${page}:${Math.max(0,offset-5)}`,'Précédent').setDisabled(!offset),button(`page:${page}:${offset+5}`,'Suivant').setDisabled(offset+5>=items.length)));
  return {embeds:[embed('Centre IA • '+pages[page],text.slice(0,3900))],components,allowedMentions:{parse:[]}};
}
const fields={
 knowledge:[['id','Référence existante (vide pour créer)',false],['title','Titre public QG',true],['subject','Sujet (voir liste dans le panneau)',true],['content','Information validée et partageable',true],['expires','Expiration AAAA-MM-JJ (facultatif)',false]],
 archive:[['id','Référence de la connaissance',true]],search:[['question','Question à rechercher',true]],
 correction:[['question','Question initiale',true],['answer','Réponse incorrecte',true],['problem','Type d’erreur et explication',true],['correction','Correction proposée',true],['subject','Sujet',true]],
 review:[['id','Référence de la correction',true]],outcome:[['id','Référence de la demande (ci-dessus)',true],['result','resolved / ignored / pending',true]],
 public:[['channels','Salons publics (vide = partout)',false],['mentions','Mention obligatoire : oui / non',true]],
 config:[['channels','IDs des tickets autorisés, vide = tous',false],['days','Conservation en jours (1 à 365)',true]],
 reset:[['channel','ID du ticket',true],['user','ID du demandeur',true]],test:[['question','Question de test',true]]
};
async function execute(i){
  await i.deferReply({flags:F.Ephemeral});
  if(!await authorized(i))return i.editReply('Accès réservé à la direction autorisée du QG.');
  return i.editReply(panel());
}
async function handle(i){
  try{
    // Every component and modal rechecks membership; IDs alone never authorize an action.
    if(!await authorized(i))return i.reply({content:'Accès réservé à la direction du QG.',flags:F.Ephemeral});
    const [,action,arg,extra]=i.customId.split(':');
    if(action==='form'){
      if(!fields[arg])throw Error('Action inconnue.');
      return i.showModal(new Modal().setCustomId('qgai:save:'+arg).setTitle('QG • '+arg).addComponents(...fields[arg].map(([id,label,required])=>new Row().addComponents(new Input().setCustomId(id).setLabel(label).setStyle(['content','correction','problem','answer','question'].includes(id)?Text.Paragraph:Text.Short).setRequired(required).setMaxLength(['content','correction'].includes(id)?2400:1000)))));
    }
    await i.deferReply({flags:F.Ephemeral});
    if(action==='page')return i.editReply(panel(i.values?.[0]||arg,extra));
    if(action==='migrate'){const result=kb.migrate(i.user.id);return i.editReply(`${result.count} entrée(s) QG importée(s) dans les corrections à valider ; ${result.excluded} exclue(s). Aucun fichier historique modifié, aucune connaissance importée publiée automatiquement.`);}
    if(action==='diagnostic'){
      store.transact(s=>store.audit(s,'diagnostic',i.user.id,null));
      return i.editReply({embeds:[embed('Diagnostic IA',`Module chargé. JSON lisible et écriture réussie.\n${store.diagnostics().health}\nClé du fournisseur : ${require('../utils/qgAiProvider').configured()?'présente':'absente'}.\nDisponibilité distante : non vérifiée ; utilise le test.\nLes données doivent être placées sur un volume Railway persistant.`)],allowedMentions:{parse:[]}});
    }
    if(action==='toggle'){
      const s=store.read();return i.editReply({content:`Confirmer ${s.config.enabled?'la désactivation':'l’activation'} des réponses automatiques ?`,components:[new Row().addComponents(button(`confirm-toggle:${s.config.revision||0}:${s.config.enabled?'off':'on'}`,'Confirmer',Style.Danger))]});
    }
    if(action==='confirm-toggle'){
      store.transact(s=>{if((s.config.revision||0)!==Number(arg))throw Error('Configuration déjà modifiée : rouvre le panneau.');s.config.enabled=extra==='on';s.config.revision=(s.config.revision||0)+1;store.audit(s,'config.enabled',i.user.id,extra);});return i.editReply(panel('config'));
    }
    if(action==='archive'){
      store.transact(s=>{const e=s.knowledge[arg];if(!e||e.updatedAt!==Number(extra))throw Error('Entrée absente ou modifiée.');e.status='archived';e.active=false;e.updatedAt=Date.now();store.audit(s,'knowledge.archived',i.user.id,arg);});return i.editReply(panel('knowledge'));
    }
    if(action==='review') {kb.review(arg,extra==='yes',i.user.id);return i.editReply(panel('corrections'));}
    if(action!=='save')throw Error('Action inconnue.');
    const get=k=>i.fields.getTextInputValue(k).trim();
    if(arg==='knowledge'){
      if(!topics.includes(get('subject')))throw Error('Sujet inconnu : '+topics.join(', '));
      const expires=get('expires')?Date.parse(get('expires')):null;if(expires!==null&&(!Number.isFinite(expires)||expires<=Date.now()))throw Error('Date d’expiration invalide.');
      kb.saveEntry({id:get('id'),title:get('title'),subject:get('subject'),content:get('content'),expiresAt:expires},i.user.id);return i.editReply(panel('knowledge'));
    }
    if(arg==='archive'){
      const e=store.read().knowledge[get('id')];if(!e)throw Error('Connaissance introuvable.');return i.editReply({content:'Archiver cette connaissance : '+kb.clean(e.title),components:[new Row().addComponents(button(`archive:${e.id}:${e.updatedAt}`,'Confirmer l’archivage',Style.Danger))],allowedMentions:{parse:[]}});
    }
    if(arg==='correction'){
      if(!topics.includes(get('subject')))throw Error('Sujet inconnu.');const id=kb.propose(Object.fromEntries(fields.correction.map(([k])=>[k,get(k)])),i.user.id);return i.editReply('Correction proposée, non publiée. Référence : '+id);
    }
    if(arg==='review'){
      const c=store.read().corrections[get('id')];if(!c||c.status!=='pending')throw Error('Correction absente ou déjà examinée.');return i.editReply({embeds:[embed('Examiner la correction',kb.clean(`Question : ${c.question||'expirée'}\nErreur : ${c.problem||'expirée'}\nSujet : ${c.subject}\nCorrection : ${c.correction}`).slice(0,3900))],components:[new Row().addComponents(button(`review:${c.id}:yes`,'Valider',Style.Success),button(`review:${c.id}:no`,'Refuser',Style.Danger))],allowedMentions:{parse:[]}});
    }
    if(arg==='public'){
 const ids=get('channels').split(/[\s,]+/).filter(Boolean);if(!['oui','non'].includes(get('mentions')))throw Error('Réponds oui ou non.');
 for(const id of ids){const ch=await i.guild.channels.fetch(id);if(!ch?.isTextBased()||!ch.permissionsFor(i.guild.roles.everyone)?.has('ViewChannel'))throw Error('Choisis uniquement des salons publics du QG.');}
 store.transact(s=>{s.config.publicScope=ids.length?'selected':'all';s.config.publicChannels=[...new Set(ids)];s.config.mentionsOnly=get('mentions')==='oui';store.audit(s,'config.public',i.user.id,null);});return i.editReply(panel('config'));
 }
 if(arg==='config'){

      const ids=get('channels').split(/[\s,]+/).filter(Boolean),days=Number(get('days'));if(!Number.isInteger(days)||days<1||days>365)throw Error('Durée invalide.');
      for(const id of ids){const ch=await i.guild.channels.fetch(id);if(!ch||ch.guildId!==i.guildId||!ch.isTextBased())throw Error('Salon invalide.');}
      store.transact(s=>{s.config.channels=[...new Set(ids)];s.config.retentionDays=days;s.config.revision=(s.config.revision||0)+1;store.audit(s,'config.updated',i.user.id,null);});return i.editReply(panel('config'));
    }
    if(arg==='reset'){context.reset(i.guildId,get('channel'),get('user'));return i.editReply('Mémoire IA de ce demandeur dans ce ticket réinitialisée. Les messages Discord restent présents.');}
    if(arg==='outcome'){
      const e=store.read().events.find(e=>e.id===get('id'));if(!e||!e.channelId)throw Error('Demande introuvable.');if(!['resolved','ignored','pending'].includes(get('result')))throw Error('Statut invalide.');
      store.event({id:i.id,type:'outcome',channelId:e.channelId,result:get('result'),actor:i.user.id});return i.editReply('Issue enregistrée. Aucun ticket n’a été fermé.');
    }
    if(arg==='search'||arg==='test'){
      const member=await i.guild.members.fetch(i.user.id),d=await context.discord(i.guild,member),question=get('question');
      if(arg==='search'){const entries=kb.search([...d.entries,...Object.values(store.read().knowledge)],question,i.guildId,kb.intent(question));return i.editReply({embeds:[embed('Résultats pertinents',entries.map(e=>`${e.title}\n${kb.clean(e.content).slice(0,700)}`).join('\n\n')||'Aucune connaissance suffisamment pertinente.')],allowedMentions:{parse:[]}});}
      const result=await require('./qgAiService').generate({question,discord:d});
      store.transact(s=>store.audit(s,'test.executed',i.user.id,result.decision));
      return i.editReply({embeds:[embed('Réponse de test',result.answer),embed('Diagnostic du test',`Sujet : ${result.topic}\nDécision théorique : ${result.decision}\nTemps : ${result.elapsedMs} ms\nSources : ${result.sources.map(s=>s.title).join(', ')||'aucune'}\nInformation manquante : ${kb.clean(result.missing||'non indiquée')}\nContrôles : ${(result.faults||[]).join(', ')||'aucune anomalie détectée'}`)],allowedMentions:{parse:[]}});
    }
  }catch(e){const payload={content:'Action non terminée : '+(e.status?'fournisseur indisponible':kb.clean(e.message||'erreur interne')).slice(0,1500),allowedMentions:{parse:[]}};if(i.deferred||i.replied)return i.editReply(payload).catch(()=>{});return i.reply({...payload,flags:F.Ephemeral}).catch(()=>{});}
}
const data=new (require('discord.js').SlashCommandBuilder)().setName('ia').setDescription('Centre de contrôle de QG — Assistant officiel').setDMPermission(false);
module.exports={execute,handle,authorized,panel,metrics,data};
