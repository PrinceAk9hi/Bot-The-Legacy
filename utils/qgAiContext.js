const { guildId } = require('../config/qg');
const { read } = require('./recruitmentData');
const { clean } = require('./qgAiKnowledge');
const store = require('./qgAiStore');
const key = (guild, channel, user) => `${guild}:${channel}:${user}`;
function memory(guild, channel, user, db = store) {
  const s=db.read(), c=s.conversations[key(guild,channel,user)];
  return c && c.updatedAt > Date.now()-(s.config.retentionDays||30)*86400000 ? c : { topic:'general', recent:[], excerpts:[] };
}
function remember(guild, channel, user, question, answer, topic, db = store) {
  db.transact(s => {
    const k=key(guild,channel,user), old=memory(guild,channel,user,db);
    const recent=[...old.recent,{role:'user',content:clean(question).slice(0,1600)},{role:'assistant',content:clean(answer).slice(0,2400)}];
    const removed=recent.splice(0,Math.max(0,recent.length-12));
    // Extractive memory, never a claimed complete summary or a source of official facts.
    const excerpts=[...old.excerpts,...removed.filter(m=>m.role==='user').map(m=>m.content.slice(0,350))].slice(-6);
    s.conversations[k]={topic,recent,excerpts,updatedAt:Date.now(),resetAt:old.resetAt};
  });
}
function reset(guild,channel,user,db=store){db.transact(s=>{s.conversations[key(guild,channel,user)]={topic:'general',recent:[],excerpts:[],updatedAt:Date.now(),resetAt:Date.now()};});}
async function discord(guild, member) {
  if(guild.id!==guildId)throw Error('Serveur QG requis.');
  await guild.channels.fetch(); await guild.roles.fetch();
  const s=read('qgServer'), channels={}, roles={};
  // Only configured navigation destinations, not private ticket names or messages from other rooms.
  for(const [k,id] of Object.entries(s.schoolChannels||{})) {
    const ch=guild.channels.cache.get(id);
    if(ch?.guildId===guild.id && ch.permissionsFor(member)?.has(['ViewChannel','ReadMessageHistory']) && ch.permissionsFor(guild.members.me)?.has('ViewChannel')) channels[id]={name:clean(ch.name),key:k};
  }
  for(const [k,id] of Object.entries(s.schoolRoles||{})) {
    const r=guild.roles.cache.get(id); if(r)roles[id]={name:clean(r.name),key:k};
  }
  const link=k=>{const match=Object.entries(channels).find(([,c])=>c.key===k);return match?`<#${match[0]}>`:'le panel correspondant (salon non confirmé accessible)';};
  const seed=(id,subject,title,content)=>({id:'qg-code:'+id,guildId,status:'validated',subject,title,content,source:'code QG vérifié',createdAt:0,updatedAt:0});
  const entries=[
    seed('recruitment','recruitment','Rejoindre la famille, candidature et délai',`Terminer la vérification Roblox puis confirmer le règlement. Déposer sa candidature depuis ${link('familyApplications')}. Le questionnaire se déroule en MP, une question à la fois. Une équipe humaine examine le dossier ; aucun délai garanti n’est configuré. Si les MP sont fermés, autoriser les messages privés du serveur et réessayer.`),
    seed('management','management','Devenir gestionnaire, candidater aux gestions',`Être déjà membre familial. Utiliser le panel rejoindre une gestion ${link('joinManagement')}. Formulaire motivation, expérience, disponibilités, compétences et contribution. Quatre gestions : Support, Recrutement, Animation, Réseaux. Validation humaine par l’équipe concernée.`),
    seed('rules','rules','Lire le règlement et se vérifier',`Le règlement se trouve dans ${link('rules')}. Vérification Roblox suivie de la confirmation de lecture du règlement. Le rôle communautaire est accordé à la fin, puis la candidature famille est possible.`),
    seed('discord','discord','Utiliser une commande slash, erreur de permission ou interaction',`Une commande slash se choisit après avoir tapé / dans la zone de message. Remplir ses options puis envoyer. Si elle manque : vérifier le serveur, les autorisations et l’intégration avec un administrateur. Missing Permissions : autorisation manquante ou rôle trop bas. Unknown Interaction ou Interaction Failed : délai expiré ou erreur du bot ; réessayer une fois et donner le nom de la commande, l’heure et le message exact. Ne jamais communiquer de token ou mot de passe. Les commandes QG enregistrées sont /setup-serveur, /delc, /sync, /ia, /cd et /user ; certaines sont réservées à l’administration.`),
    seed('members','members','Nombre de membres du serveur',`Le serveur QG compte actuellement ${guild.memberCount} comptes Discord, bots inclus. Ce nombre n’est pas l’effectif familial. Ne pas déduire l’effectif familial du cache partiel des membres.`),
    seed('direction','direction','Direction du QG',`La structure vérifiée comprend Créateur, Gérant Global et Administrateur. Les noms des titulaires ne sont pas confirmés dans ce contexte. Ne pas confondre la direction avec le développeur ou le responsable technique du bot.`)
  ];
  const articles=require('../systems/qgSchoolSetup').ruleText.split(/\n\n/).filter(t=>t.startsWith('**Article'));
  entries.push(seed('family-identity','rules','QG : famille SchoolRP, âge minimum, tag et activité',require('../config/qgFamily').description+' '+require('../config/qgFamily').conditions));
  entries.push(seed('absence','absence','Déclarer et modifier une absence',`Les membres familiaux utilisent ${link('absences')} : dates de début et fin, motif et commentaire facultatifs. Mes absences permet de modifier ou annuler. Le rôle Absent suit les dates ; le motif reste privé.`));
  entries.push(seed('grades','grades','Grades et demande de promotion',`Progression : Membre Test, Confirmé, Expert, Prestigieux, Senior. Le panel ${link('rankUp')} permet de demander le grade suivant avec justification. Validation humaine, aucune promotion automatique par XP.`));
  entries.push(seed('voice','voice','Créer et contrôler son vocal temporaire',`Rejoindre le vocal Créer sa voc pour créer son salon temporaire. Le panel de contrôle permet au propriétaire de renommer, limiter les places, verrouiller, déverrouiller et sélectionner les membres autorisés. Le salon vide est nettoyé automatiquement. Les vocaux famille restent réservés à la famille.`));
  for(const [i,text] of articles.entries())entries.push(seed('rule-'+i,'general',text.split('**')[1]||'Règlement QG',text));
  return {channels,roles,entries};
}
module.exports={key,memory,remember,reset,discord};
