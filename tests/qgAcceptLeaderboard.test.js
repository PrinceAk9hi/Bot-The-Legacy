const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const data=require('../utils/recruitmentData'),a=require('../utils/qgAdmin'),config=require('../config/qg'),{Collection}=require('discord.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-acp-'));data.setDataDirectory(dir);
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const accept=require('../systems/qgAccept'),board=require('../systems/qgLeaderboard'),metrics=require('../systems/qgMemberMetrics');
const A='111111111111111111',B='222222222222222222',C='333333333333333333',GONE='444444444444444444';
const ROLES={community:'community',confirmed:'confirmed',test:'test',expert:'expert',prestigious:'prestigious',senior:'senior',interviewWaiting:'waiting',recruitmentRefused:'refused',recruitmentLead:'lead'};
let guild;
function member(id,roles,bot=false){return{id,guild,user:{id,bot,username:'m'+id.slice(-2)},roles:{cache:new Collection(roles.map(r=>[r,{id:r}]))}};}
beforeEach(()=>{
 for(const f of fs.readdirSync(dir))fs.rmSync(path.join(dir,f),{force:true});
 guild={id:config.guildId,ownerId:'owner'};
 a.save(s=>{s.schoolRoles={...ROLES};});
});

// Faux groupe Roblox : rangs par joueur, demandes en attente, appels enregistrés.
const GROUP_ROLES=[{name:'Guest',rank:0},{name:'Membre',rank:1},{name:'Membre confirmé',rank:5},{name:'Staff',rank:200}];
function fakeRoblox({ranks={},requests=[],roles=GROUP_ROLES}={}){
 const calls=[];
 return{calls,
  rank:async(g,u)=>ranks[u]||0,
  joinRequest:async(g,u)=>requests.includes(u)?{requester:{userId:u}}:null,
  accept:async(g,u)=>{calls.push(['accept',u]);ranks[u]=1;},
  roles:async()=>roles,
  setRank:async(g,u,r)=>{calls.push(['setRank',u,r]);ranks[u]=r;},
  userByName:async name=>name==='SakuraRP'?{id:'777',username:'SakuraRP'}:null};
}

test('=acp : lecture de la commande',()=>{
 assert.deepEqual(accept._test.parse(`=acp <@${A}> très actif`),{discordId:A,robloxName:null,reason:'très actif'});
 assert.deepEqual(accept._test.parse(`=ACP ${A}`),{discordId:A,robloxName:null,reason:''});
 assert.deepEqual(accept._test.parse('=acp @SakuraRP motif'),{discordId:null,robloxName:'SakuraRP',reason:'motif'});
 assert.deepEqual(accept._test.parse('=acp'),{discordId:null,robloxName:null,reason:''});
 assert.equal(accept._test.parse('=acpx'),null);
 assert.equal(accept._test.parse('=classement'),null);
});

test('=acp : configuration du groupe et du rang Membre confirmé',()=>{
 assert.equal(accept._test.groupId({}),1031372038);
 assert.equal(accept._test.groupId({QG_ROBLOX_GROUP_ID:'123'}),123);
 assert.throws(()=>accept._test.groupId({},null),/non configuré/);
 assert.equal(accept._test.confirmedRole(GROUP_ROLES,{}).rank,5);
 assert.equal(accept._test.confirmedRole([{name:'✦ MEMBRE CONFIRME',rank:7}],{}).rank,7);
 assert.equal(accept._test.confirmedRole(GROUP_ROLES,{QG_ROBLOX_CONFIRMED_RANK:'200'}).name,'Staff');
 assert.throws(()=>accept._test.confirmedRole([{name:'Membre',rank:1}],{}),/Aucun rang/);
 assert.throws(()=>accept._test.confirmedRole(GROUP_ROLES,{QG_ROBLOX_CONFIRMED_RANK:'42'}),/aucun rang/);
});

test('=acp : accepte la demande puis donne le rang Membre confirmé',async()=>{
 const api=fakeRoblox({requests:[42]});
 const r=await accept._test.acceptInGroup(api,1,42,{delay:0});
 assert.deepEqual(api.calls,[['accept',42],['setRank',42,5]]);
 assert.equal(r.accepted,true);assert.equal(r.changed,true);
});

test('=acp : sans demande en attente, déjà au rang ou rang supérieur',async()=>{
 await assert.rejects(accept._test.acceptInGroup(fakeRoblox(),1,42,{delay:0}),/Aucune demande/);
 const same=fakeRoblox({ranks:{42:5}});assert.equal((await accept._test.acceptInGroup(same,1,42)).changed,false);assert.deepEqual(same.calls,[]);
 const staff=fakeRoblox({ranks:{42:200}});const r=await accept._test.acceptInGroup(staff,1,42);assert.equal(r.higher,true);assert.deepEqual(staff.calls,[]);
 const member1=fakeRoblox({ranks:{42:1}});await accept._test.acceptInGroup(member1,1,42);assert.deepEqual(member1.calls,[['setRank',42,5]]);
});

test('=acp : compte Roblox trouvé via la vérification QG',()=>{
 a.save(s=>{s.schoolEntryVerification={[B]:{robloxId:'987',robloxName:'Joueur'}};});
 assert.deepEqual(accept._test.robloxOf(B,a.state()),{id:987,name:'Joueur'});
});

test('=acp : parcours complet et droits d’accès',async()=>{
 const old=process.env.QG_ROBLOX_GROUP_ID;process.env.QG_ROBLOX_GROUP_ID='555';
 try{
  a.save(s=>{s.schoolEntryVerification={[B]:{robloxId:'987',robloxName:'Joueur'}};});
  const replies=[];
  const make=(content,actorRoles)=>({guildId:config.guildId,content,author:{id:A},reply:async p=>replies.push(p.content),guild:{...guild,members:{fetch:async()=>member(A,actorRoles)},client:{users:{fetch:async()=>null}}}});
  assert.equal(await accept.command(make(`=acp <@${B}>`,['community']),fakeRoblox()),true);
  assert.match(replies.at(-1),/réservée/);
  const api=fakeRoblox({requests:[987]});
  await accept.command(make(`=acp <@${B}> actif`,['lead']),api);
  assert.match(replies.at(-1),/Joueur.*demande d’adhésion acceptée.*Membre confirmé/);
  assert.deepEqual(api.calls,[['accept',987],['setRank',987,5]]);
  const byName=fakeRoblox({requests:[777]});
  await accept.command(make('=acp SakuraRP',['lead']),byName);
  assert.deepEqual(byName.calls,[['accept',777],['setRank',777,5]]);
  assert.equal(await accept.command({...make('=acp x',['lead']),guildId:'autre'}),false);
 }finally{if(old===undefined)delete process.env.QG_ROBLOX_GROUP_ID;else process.env.QG_ROBLOX_GROUP_ID=old;}
});

test('/classement niveaux : tri par XP, membres partis et non éligibles exclus',()=>{
 data.update('qgXp',x=>{x[A]={xp:900};x[B]={xp:5000};x[C]={xp:300};x[GONE]={xp:99999};});
 const members=new Collection([[A,member(A,['community'])],[B,member(B,['confirmed'])],[C,member(C,[])]]);
 const rows=board._test.ranking('niveaux',7,members,a.state());
 assert.deepEqual(rows.map(([id])=>id),[B,A]);
});

test('/classement vocal et messages : somme sur la période choisie',()=>{
 const now=Date.UTC(2026,10,11,12),day=metrics.day;
 a.save(s=>{s.schoolDailyActivity={
  [A]:{[day(now)]:{voiceMs:3600000,messages:4},[day(now-20*86400000)]:{voiceMs:7200000,messages:50}},
  [B]:{[day(now)]:{voiceMs:60000,messages:10}},
  [GONE]:{[day(now)]:{voiceMs:9e9,messages:999}}};});
 const members=new Collection([[A,member(A,['community'])],[B,member(B,['community'])]]);
 assert.deepEqual(board._test.ranking('vocal',7,members,a.state(),now),[[A,3600000],[B,60000]]);
 assert.deepEqual(board._test.ranking('messages',7,members,a.state(),now),[[B,10],[A,4]]);
 assert.deepEqual(board._test.ranking('messages',30,members,a.state(),now),[[A,54],[B,10]]);
});

test('/classement : pages, position personnelle et boutons à IDs uniques',()=>{
 const rows=Array.from({length:23},(_,n)=>[String(100000000000000000+n),1000-n]);
 const payload=board._test.view('vocal',30,5,rows[21][0],rows);
 const text=payload.embeds[0].data.description;
 assert.match(text,/Ta position : \*\*#22\*\*/);
 assert.match(text,/Page|23 membres/);
 const ids=payload.components.flatMap(r=>r.components.map(c=>c.data.custom_id));
 assert.equal(new Set(ids).size,ids.length);
 assert.ok(ids.every(id=>id.startsWith('qgclass:')&&id.length<=100));
 assert.equal(board._test.duration(3_720_000),'1 h 02');
 // Données de la carte image : page 3, positions 21 à 23, valeurs sans markdown.
 const members=new Collection(rows.map(([id])=>[id,{...member(id,['community']),displayName:'Nom '+id.slice(-2),displayAvatarURL:()=>'https://example.invalid/a.png'}]));
 const c=board._test.card('vocal',30,5,rows[21][0],rows,members);
 assert.equal(c.page,3);assert.equal(c.pages,3);assert.equal(c.total,23);
 assert.deepEqual(c.rows.map(r=>r.position),[21,22,23]);
 assert.equal(c.rows[0].name,'Nom 20');assert.ok(!/\*/.test(c.rows[0].value));
 assert.deepEqual(c.mine,{position:22,value:'0 min · en vocal'});
 assert.deepEqual(board._test.plain('niveaux',650),['Niveau 5','650 XP']);
 assert.equal(board.data.toJSON().name,'classement');
});

test('entretien accepté : rappel tag, communauté Roblox et activité',()=>{
 const p=require('../systems/qgInterviews').welcomeReminderPayload(A);
 const text=p.embeds[0].data.description;
 assert.equal(p.content,`<@${A}>`);assert.deepEqual(p.allowedMentions,{parse:[],users:[A]});
 assert.match(text,/tag du serveur est obligatoire/);assert.match(text,/communauté Roblox/);assert.match(text,/actif dans la famille/);
 assert.ok(text.includes(config.robloxGroupUrl));
 assert.equal(p.components[0].components[0].data.url,config.robloxGroupUrl);
});
