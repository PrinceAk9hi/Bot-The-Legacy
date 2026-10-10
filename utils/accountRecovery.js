const { read, update } = require('./recruitmentData');
const { MAIN_RANKS } = require('../config/ranks');
const { ROLES } = require('../config/soulSociety');
const locks = new Set();
const ACCESS = ['1502983003616575519','1468701262102134891'];
const membership = [...Object.values(MAIN_RANKS).map(r=>r.roleId),ROLES.member,ROLES.interviewWaiting];
function mark(key, changes) { update('accountRecoveries', s=>Object.assign(s[key],changes)); }
async function fetchMember(guild,id,optional=false) {
 try { return await guild.members.fetch({user:id,force:true}); }
 catch(e) { if(optional && e.code===10007) return null; throw e; }
}
async function recover(guild,oldId,newId,authorId) {
 if(oldId===newId) throw Error('Les deux comptes doivent être différents.');
 if(locks.has(oldId)||locks.has(newId)) throw Error('Un transfert est déjà en cours pour un de ces comptes.');
 locks.add(oldId); locks.add(newId);
 const key=oldId+':'+newId;
 try {
  const all=read('accountRecoveries'); let job=all[key];
  if(job?.status==='done') { mark(key,{guildId:guild.id,ageExceptionUntil:Date.now()+7*86400000}); return {already:true}; }
  if(Object.entries(all).some(([k,r])=>k!==key && [r.oldId,r.newId].some(id=>[oldId,newId].includes(id)))) throw Error('Un de ces comptes est déjà associé à un autre transfert. Contacte Aven.');
  const target=await fetchMember(guild,newId,true), old=await fetchMember(guild,oldId,true);
  const newUser=target?.user||await guild.client.users.fetch(newId);
  if(newUser.bot) throw Error('Le nouveau compte doit être humain.');
  if(!job) {
   const snapshot={};
   for(const name of ['welcomeProfiles','robloxLinks','entryVerification','candidatures']) snapshot[name]=read(name)[oldId]||null;
   if(!snapshot.welcomeProfiles&&!snapshot.robloxLinks&&!snapshot.candidatures&&!old?.roles.cache.some(r=>membership.includes(r.id))) throw Error('Aucun ancien profil membre trouvé.');
   if(['welcomeProfiles','robloxLinks','entryVerification','candidatures'].some(n=>read(n)[newId])) throw Error('Le nouveau compte possède déjà un profil. Aucun écrasement automatique autorisé.');
   job={guildId:guild.id,oldId,newId,authorId,createdAt:Date.now(),status:'pending',snapshot};
   update('accountRecoveries',s=>{s[key]=job;});
  }
  mark(key,{guildId:guild.id,ageExceptionUntil:Date.now()+7*86400000});
  if(!target) return {pending:true};
  // Preflight before changing data or permissions. Do not transfer staff roles.
  const removeOld=[...membership,...ACCESS];
  const removeNew=[...membership,...ACCESS];
  const required=new Set([ROLES.member,ROLES.test,...(old?[...old.roles.cache.keys()].filter(id=>removeOld.includes(id)):[]),...[...target.roles.cache.keys()].filter(id=>removeNew.includes(id))]);
  for(const id of required) { const role=await guild.roles.fetch(id); if(!role?.editable) throw Error('Rôle non modifiable : '+(role?.name||id)); }
  if(!job.prepared) {
   update('welcomeNotifications',s=>{s[newId]={...s[newId],recruitDmSent:true,recovery:true};});
   // Archive first, invalidate previous associations, and force a fresh Roblox declaration.
   for(const name of ['robloxLinks','entryVerification']) update(name,s=>{delete s[oldId]; delete s[newId];});
   update('welcomeProfiles',s=>{
    if(s[oldId]) Object.assign(s[oldId],{transferredTo:newId,robloxId:null,robloxUsername:null,membershipVerifiedAt:null,membershipRobloxId:null});
    const source=job.snapshot.welcomeProfiles||{};
    s[newId]={discordId:newId,discordName:target.user.username,birthDate:source.birthDate||null,step:source.birthDate?'roblox':'profile',recoveredFrom:oldId,updatedAt:Date.now()};
   });
   if(job.snapshot.candidatures) update('candidatures',s=>{s[newId]={...job.snapshot.candidatures,recoveredFrom:oldId};});
   mark(key,{prepared:true});
  }
  if(old) {
   const ids=[...old.roles.cache.keys()].filter(id=>removeOld.includes(id));
   if(ids.length) await old.roles.remove(ids,'Transfert du compte vers '+newId);
  }
  // Only remove known member/verification roles; unrelated roles stay untouched.
  const unwanted=[...target.roles.cache.keys()].filter(id=>removeNew.includes(id)&&![ROLES.test,ROLES.member].includes(id));
  if(unwanted.length) await target.roles.remove(unwanted,'Nouvelle vérification après transfert');
  await target.roles.add([ROLES.member,ROLES.test],'Récupération du compte '+oldId+' par '+authorId);
  mark(key,{status:'done',completedAt:Date.now()});
  return {already:false};
 } finally { locks.delete(oldId); locks.delete(newId); }
}
function hasAgeException(member) {
 return Object.values(read('accountRecoveries')).some(r=>r.guildId===member.guild.id && r.newId===member.id && ['pending','done'].includes(r.status) && Number.isFinite(r.ageExceptionUntil) && r.ageExceptionUntil>Date.now());
}
module.exports={recover,hasAgeException};
