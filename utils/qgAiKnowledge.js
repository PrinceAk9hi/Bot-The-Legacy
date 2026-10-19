const { randomUUID } = require('node:crypto');
const config = require('../config/qg');
const store = require('./qgAiStore');
const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const stop = new Set('qui que quoi comment pourquoi est sont les des une dans pour avec fait faire plus pas moi mon ton nous vous notre votre quel quelle combien peut peux veux voudrais avoir etre sur du de le la un et a au en il elle on ce ca c est'.split(' '));
const words = text => [...new Set(normalize(text).match(/[a-z0-9]+/g) || [])].filter(w => w.length > 2 && !stop.has(w));
function intent(text, previous = 'general') {
  const q = normalize(text);
  if (/(?:\+?18|\+?13)\s*(?:ans)?|\bage\b|majeur|mineur|\btag\b|activite|c.est quoi.*qg/.test(q)) return 'rules';
  if (/(bot|developpeur|maintenance)/.test(q) && /(qui|gere|occupe|responsable|prenom|cree|createur)/.test(q)) return 'bot-owner';
  if (/(combien|effectif|nombre)/.test(q) && /(membre|sommes|famille|serveur)/.test(q)) return 'members';
  if (/(dirige|direction|fondateur|gerant)/.test(q)) return 'direction';
  if (/(gestionnaire|gestion|equipe)/.test(q) && /(rejoindre|devenir|candidat|postul)/.test(q)) return 'management';
  if (/(recrut|candidat|postul|rejoindre.*famille|rentrer.*famille)/.test(q)) return 'recruitment';
  if (/(absence|absent|indisponib)/.test(q)) return 'absence';
  if (/(grade|promotion|rank.?up)/.test(q)) return 'grades';
  if (/(vocal|micro|casque|soundboard)/.test(q)) return 'voice';
  if (/(reglement|regles|verifi)/.test(q)) return 'rules';
  if (/(sanction|bann|timeout|permission|harcel|menace)/.test(q)) return 'moderation';
  if (/(commande|slash|bouton|interaction|erreur)/.test(q)) return 'discord';
  if (/^(et |ca |cela |oui|non|toujours|deja|j.ai essaye)|combien de temps|marche pas/.test(q)) return previous;
  return 'general';
}
function search(entries, question, guildId, topic, now = Date.now()) {
  const tokens = words(question);
  const ranked = entries.filter(e => e && e.status === 'validated' && e.active !== false && (e.guildId === guildId || (e.guildId === 'general' && e.scope === 'general')) && (!e.expiresAt || e.expiresAt > now) && !/soul\s*society/i.test(e.title + ' ' + e.content))
    .map(e => {
      if (['bot-owner','members','direction'].includes(topic) && e.subject !== topic) return { ...e, score: 0 };
      if (topic !== 'general' && e.subject !== topic && e.subject !== 'general') return { ...e, score: 0 };
      const title = words(e.title + ' ' + (e.keywords || '')); const body = words(e.content);
      const matches = tokens.filter(t => title.includes(t) || body.includes(t));
      const score = matches.reduce((s,t) => s + (title.includes(t) ? 3 : 1), 0) + (e.subject === topic && topic !== 'general' ? 5 : 0);
      return { ...e, score: (matches.length >= 2 || e.subject === topic && topic !== 'general') ? score : 0 };
    }).filter(e => e.score >= 5).sort((a,b) => b.score-a.score || (b.priority||0)-(a.priority||0) || b.updatedAt-a.updatedAt);
  return ranked.slice(0,4);
}
function clean(text) {
  let value = String(text || '');
  for (const [key, secret] of Object.entries(process.env)) if (/(TOKEN|SECRET|PASSWORD|API_KEY|COOKIE)/i.test(key) && secret?.length >= 8) value = value.split(secret).join('[secret masqué]');
  return value.replace(/\bsk-[\w-]{12,}\b|\b[\w-]{24,}\.[\w-]{6}\.[\w-]{20,}\b/g, '[secret masqué]').replace(/((?:password|mot de passe|token|api[_ -]?key|cookie)\s*[:=]\s*)\S+/gi, '$1[secret masqué]');
}
function saveEntry(input, actor, db = store) {
  if (!input.title?.trim() || !input.content?.trim()) throw Error('Titre et contenu requis.');
  if (/soul\s*society/i.test(input.content + input.title)) throw Error('Cette base est réservée aux informations QG.');
  let entry;
  db.transact(s => {
    const old = input.id ? s.knowledge[input.id] : null;
    if (input.id && !old) throw Error('Connaissance introuvable.');
    entry = { ...old, id: old?.id || randomUUID(), guildId: config.guildId, subject: input.subject || 'general', category: input.subject || 'general', title: clean(input.title).slice(0,100), content: clean(input.content).slice(0,2400), source: 'staff-reviewed', status: 'validated', active: true, priority: 10, createdAt: old?.createdAt || Date.now(), updatedAt: Date.now(), updatedBy: actor, expiresAt: input.expiresAt || null };
    s.knowledge[entry.id] = entry; db.audit(s, 'knowledge.save', actor, entry.id);
  }); return entry;
}
function propose(input, actor, db = store) {
  const id = randomUUID();
  db.transact(s => { s.corrections[id] = { id, guildId: config.guildId, question: clean(input.question).slice(0,1000), answer: clean(input.answer).slice(0,1800), problem: clean(input.problem).slice(0,1000), errorType: normalize(input.problem).match(/hors sujet|mauvais serveur|inventee|obsolete|interpretation|incomplete|identifiant|procedure/)?.[0] || 'autre', correction: clean(input.correction).slice(0,2400), subject: input.subject || 'general', status: 'pending', createdAt: Date.now(), updatedAt: Date.now(), proposedBy: actor }; db.audit(s,'correction.proposed',actor,id); }); return id;
}
function review(id, approve, actor, db = store) {
  db.transact(s => {
    const c=s.corrections[id]; if (!c || c.status !== 'pending') throw Error('Correction absente ou déjà traitée.');
    if (approve && (!c.correction?.trim() || /soul\s*society/i.test(c.correction))) throw Error('Correction QG valide requise.');
    c.status=approve?'validated':'rejected'; c.updatedAt=Date.now(); c.validatedBy=actor;
    if(approve) {
      for(const old of Object.values(s.knowledge))if(old.subject===c.subject && normalize(old.title)===normalize((c.question||'').slice(0,100))){old.status='superseded';old.active=false;old.updatedAt=Date.now();}
      const key=randomUUID(); s.knowledge[key]={id:key,guildId:config.guildId,subject:c.subject,category:c.subject,title:(c.question||'Correction validée').slice(0,100),content:c.correction,source:'correction:'+id,status:'validated',active:true,priority:20,createdAt:Date.now(),updatedAt:Date.now(),updatedBy:actor}; c.knowledgeId=key;
    }
    db.audit(s,'correction.'+c.status,actor,id);
  });
}
function migrate(actor, db=store, load=require('./recruitmentData').read){
  let count=0,excluded=0;
  const drafts=[];
  for(const name of ['ticketKnowledgeEntries','iaControlKnowledge']){
    const raw=load(name),items=raw.items||raw;
    for(const [legacyId,e] of Object.entries(items)){
      if(!e||typeof e!=='object'||e.guildId!==config.guildId||e.status!=='validated'||e.active===false||!e.content||e.expiresAt&&e.expiresAt<Date.now()||/soul\s*society/i.test(e.content+' '+e.title)){excluded++;continue;}
      drafts.push({legacyKey:name+':'+legacyId,entry:e});
    }
  }
  db.transact(s=>{
    s.migrations||={};
    for(const {legacyKey,entry:e} of drafts){
      if(s.migrations[legacyKey])continue;
      const id=randomUUID();s.corrections[id]={id,guildId:config.guildId,question:clean(e.title||'Import historique').slice(0,1000),answer:'',problem:'Import historique QG : vérifier la validité et le caractère public.',correction:clean(e.content).slice(0,2400),subject:intent(e.title||''),status:'pending',createdAt:Date.now(),updatedAt:Date.now(),proposedBy:actor,legacyKey};
      s.migrations[legacyKey]=id;count++;
    }
    db.audit(s,'migration.drafts',actor,String(count));
  });return {count,excluded};
}
module.exports={normalize,words,intent,search,clean,saveEntry,propose,review,migrate};
