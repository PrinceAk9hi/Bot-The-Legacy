const {PermissionFlagsBits:P,EmbedBuilder}=require('discord.js');
const {MAIN_RANKS}=require('../config/ranks');
const {hasBypass,isProtectedUser}=require('./security');
const {eligible}=require('./soulActivityHelpers');
const plan=require('./conferencePlan');
const NOTE_CHANNEL='1506322302286037025';
function rankIds(member){return Object.values(MAIN_RANKS).filter(r=>member.roles.cache.has(r.roleId)).map(r=>r.roleId).sort();}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
async function runCommand(guild,actor,member,name,strings){
 let response='';
 const capture=async p=>{response=typeof p==='string'?p:p?.content||'';};
 const i={guild,guildId:guild.id,client:guild.client,user:actor.user,member:actor,commandName:name,deferred:false,replied:false,
  options:{data:[{type:6,name:'membre',value:member.id}],getUser:()=>member.user,getMember:()=>member,getString:k=>strings[k]||null},
  async deferReply(){this.deferred=true;},reply:capture,editReply:capture,followUp:capture};
 await require('../commandes/'+name).execute(i);
 if(!response.startsWith('✅')||response.includes('⚠️'))throw Error(response.slice(0,900)||'Résultat non confirmé : vérifier manuellement.');
 return response.slice(0,900);
}
async function apply(guild,r,id,kind){
 const actor=await guild.members.fetch({user:r.authorId,force:true});
 if(!hasBypass(actor))throw Error('L’auteur ne dispose plus des permissions nécessaires.');
 const member=await guild.members.fetch({user:id,force:true});
 if(!eligible(member))throw Error('Le membre ne fait plus partie des effectifs.');
 const a=kind==='note'?r.notes[id]:r.actions[id];
 if(actor.id!=='547192186547077130'&&isProtectedUser(id,a.type==='derank'?'derank':a.type||'note'))throw Error('Compte protégé.');
 const reason=(a.reason||'Aucune raison précisée.').slice(0,500);
 if(kind==='note'){
  const target=plan.NOTES[a.value-1];if(!target)throw Error('Note inconnue.');
  const me=guild.members.me||await guild.members.fetchMe();
  if(!me.permissions.has(P.ManageRoles)||!member.manageable)throw Error('Permissions ou hiérarchie insuffisantes pour la note.');
  for(const rid of plan.NOTES.filter(x=>x===target||member.roles.cache.has(x))){const role=await guild.roles.fetch(rid);if(!role||role.managed||role.position>=me.roles.highest.position)throw Error('Un rôle de note ne peut pas être modifié.');}
  const keep=[...member.roles.cache.keys()].filter(x=>x!==guild.id&&!plan.NOTES.includes(x));
  await member.roles.set([...keep,target],`Conférence ${r.name} : note par ${actor.id}`);
  const checked=await guild.members.fetch({user:id,force:true});
  if(!checked.roles.cache.has(target)||plan.NOTES.some(x=>x!==target&&checked.roles.cache.has(x)))throw Error('Les rôles de note ne correspondent pas au résultat attendu.');
  const c=await guild.channels.fetch(NOTE_CHANNEL);
  await c.send({embeds:[new EmbedBuilder().setColor(0xe8a6c8).setTitle('⭐ Note d’activité — La Soul Society').setDescription(`<@${id}>\n${'★'.repeat(a.value)}${'☆'.repeat(5-a.value)} — **${plan.LABELS[a.value-1]}**`).addFields({name:'Conférence',value:r.name},{name:'Raison',value:reason},{name:'Attribuée par',value:`<@${actor.id}>`}).setTimestamp()],allowedMentions:{parse:[]}});
  return 'Note et annonce appliquées.';
 }
 if(!same(rankIds(member),a.expectedRoles))throw Error('Le grade a changé depuis la préparation : aucune action exécutée.');
 if(a.type==='up'||a.type==='down')return runCommand(guild,actor,member,'rank',{categorie:'grade',action:'add',role:a.next,note:reason});
 if(a.type==='derank')return runCommand(guild,actor,member,'derank',{raison:reason,note:`Conférence : ${r.name}`});
 if(a.type==='warn'){
  const levels=['1468698882002387044','1468698901077823653','1468698902428516524'];
  const held=levels.filter(x=>member.roles.cache.has(x));
  if(!same(held,a.expectedWarnings||[]))throw Error('Les avertissements ont changé depuis la préparation.');
  return runCommand(guild,actor,member,'avert',{choixavert:a.warning,raison:reason});
 }
 throw Error('Action inconnue.');
}
// Persist before each side effect. After a crash a pending entry becomes uncertain;
// it is never blindly repeated (especially a derank/Roblox expulsion).
async function execute(guild,r){
 for(const kind of ['note','action'])for(const id of Object.keys(kind==='note'?r.notes:r.actions)){
  if(require('./lineState').isOff()||plan.get(r.id)?.cancelledAt)return;
  const key=kind+':'+id,old=plan.get(r.id).results?.[key];
  if(old){if(old.status==='pending')plan.save(r.id,p=>{p.results[key]={...old,status:'uncertain',detail:'Interruption pendant l’action : contrôle manuel requis.'};});continue;}
  plan.save(r.id,p=>{p.results||={};p.results[key]={status:'pending',at:Date.now()};});
  try{const detail=await apply(guild,r,id,kind);plan.save(r.id,p=>{p.results[key]={status:'done',detail,at:Date.now()};});}
  catch(e){plan.save(r.id,p=>{p.results[key]={status:'review',detail:String(e.message||e.code).slice(0,900),at:Date.now()};});}
 }
 if(!require('./lineState').isOff()&&!plan.get(r.id).cancelledAt)plan.save(r.id,p=>{p.status='finished';p.finishedAt=Date.now();});
}
module.exports={apply,execute,rankIds,NOTE_CHANNEL};
