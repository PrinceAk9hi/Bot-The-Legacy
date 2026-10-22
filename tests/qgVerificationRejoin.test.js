const {test}=require('node:test');
const assert=require('node:assert/strict');
const {current,invalidate}=require('../utils/qgVerificationMembership');
const {createHandler}=require('../systems/qgEntryVerification');
const config=require('../config/qg');
function fixture(){
 const joined=Date.now()-1000;
 const state={schoolRoles:{community:'community'},schoolEntryVerification:{user:{stage:'accepted',robloxId:'42',robloxName:'Example',discordName:'Example',confirmedAt:joined+10,acceptedAt:joined+20,joinedAt:joined}}};
 const member={id:'user',joinedTimestamp:joined,pending:false,displayName:'Example',roles:{cache:new Map(),add:async id=>member.roles.cache.set(id,true)}};
 const deps={read:()=>state,update:(_,fn)=>fn(state),recordVerification:()=>{},syncMember:async()=>{},welcome:async()=>{state.welcomes=(state.welcomes||0)+1;}};
 const i=id=>({customId:id,guildId:config.guildId,user:{id:'user',username:'Example'},guild:{members:{fetch:async()=>member},roles:{fetch:async()=>({editable:true})}},reply:async p=>{state.reply=p;},showModal:async p=>{state.modal=p;},deferReply:async()=>{},deferUpdate:async()=>{},editReply:async p=>{state.reply=p;}});
 return{state,member,deps,i};
}
test('même arrivée après redémarrage : vérification déjà acquise',async()=>{
 const f=fixture();await createHandler(f.deps)(f.i('qgs:verify'));assert.match(f.state.reply.content,/déjà terminée/);assert.equal(f.state.modal,undefined);
});
test('retour hors ligne : ancien profil archivé et formulaire complet rouvert',async()=>{
 const f=fixture(),old={...f.state.schoolEntryVerification.user};f.member.joinedTimestamp=Date.now();
 await createHandler(f.deps)(f.i('qgs:verify'));
 assert.ok(f.state.modal);assert.equal(f.state.schoolEntryVerification.user.stage,'profile');assert.equal(f.state.schoolEntryVerification.user.confirmedAt,undefined);
 assert.equal(f.state.schoolVerificationHistory['user:'+old.acceptedAt].robloxId,'42');assert.equal(f.state.schoolEntryVerification.user.joinedAt,f.member.joinedTimestamp);
});
test('départ invalide les anciens boutons, sans perdre le profil Roblox ni l’historique',async()=>{
 const f=fixture();Object.assign(f.state.schoolEntryVerification.user,{token:'old',expires:Date.now()+60000});invalidate(f.member,f.deps,true);
 assert.equal(current(f.state.schoolEntryVerification.user,f.member),false);assert.equal(f.state.schoolEntryVerification.user.robloxId,'42');
 f.member.joinedTimestamp=Date.now();await assert.rejects(createHandler(f.deps)(f.i('qgs:entry-accept:old')));assert.equal(f.member.roles.cache.size,0);
});
test('nouveau séjour : profil confirmé puis règlement accepté et une seule bienvenue',async()=>{
 const f=fixture();f.member.joinedTimestamp=Date.now();await createHandler(f.deps)(f.i('qgs:verify'));
 Object.assign(f.state.schoolEntryVerification.user,{stage:'profile',token:'new',expires:Date.now()+60000});
 await createHandler(f.deps)(f.i('qgs:entry-confirm:new'));
 assert.equal(f.member.roles.cache.size,0);await createHandler(f.deps)(f.i('qgs:entry-accept:new'));
 assert.equal(f.member.roles.cache.has('community'),true);assert.equal(f.state.welcomes,1);assert.equal(f.state.schoolEntryVerification.user.joinedAt,f.member.joinedTimestamp);
 await assert.rejects(createHandler(f.deps)(f.i('qgs:entry-accept:new')));assert.equal(f.state.welcomes,1);
});
test('anciens enregistrements : date d’acceptation comparée à l’arrivée',()=>{
 const member={joinedTimestamp:200};assert.equal(current({stage:'accepted',acceptedAt:100},member),false);assert.equal(current({stage:'accepted',acceptedAt:300},member),true);
});
