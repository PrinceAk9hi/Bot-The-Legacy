const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const data=require('../utils/recruitmentData'),a=require('../utils/qgAdmin'),config=require('../config/qg'),{Collection}=require('discord.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-foundation-'));data.setDataDirectory(dir);
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const foundation=require('../systems/qgFoundation');
const OWNER='100000000000000000',ADMIN='200000000000000000',ADMIN2='300000000000000000',MEMBER='400000000000000000';
let guild,members,edits;
function member(id,roles){return {id,guild,displayName:'M'+id[0],joinedTimestamp:Date.now()-30*86400000,user:{id,bot:false,username:'m'+id[0],displayAvatarURL:()=>null},roles:{cache:new Collection(roles.map(r=>[r,{id:r}]))}};}
beforeEach(()=>{
 for(const f of fs.readdirSync(dir))fs.rmSync(path.join(dir,f),{force:true});
 members=new Collection();edits=[];
 const message={edit:async p=>{edits.push(p);}};
 guild={id:config.guildId,ownerId:OWNER,client:{user:{id:'bot'},users:{fetch:async id=>members.get(id)?.user}},members:{cache:members,fetch:async q=>q?members.get(typeof q==='string'?q:q.user):members,me:{permissions:{has:()=>false}}},voiceStates:{cache:new Collection()},channels:{cache:new Collection(),fetch:async()=>({messages:{fetch:async()=>message},isTextBased:()=>true,send:async()=>({})})}};
 a.save(s=>{s.schoolRoles={creator:'creator',administrator:'admin',senior:'senior',warning1:'w1'};});
 members.set(OWNER,member(OWNER,['creator']));members.set(ADMIN,member(ADMIN,['admin']));members.set(ADMIN2,member(ADMIN2,['admin']));members.set(MEMBER,member(MEMBER,['senior','w1']));
});
function decision(votes,extra={}){const d={id:'d1',type:'rules',title:'Nouveau règlement',description:'Texte',authorId:OWNER,createdAt:Date.now(),closesAt:Date.now()-1,status:'open',votes,electorate:3,channelId:'c',messageId:'m',url:'https://discord.com/x',...extra};a.save(s=>{s.schoolFoundation={decisions:{d1:d},watch:{},objectives:{}};});return d;}

test('vote : adopté seulement si plus de la moitié de la direction vote Pour',async()=>{
 decision({[OWNER]:'yes',[ADMIN]:'yes'});
 let d=await foundation.closeDecision(guild,'d1',null);
 assert.equal(d.status,'adopted');assert.equal(d.electorate,3);assert.equal(edits.length,1);
 decision({[OWNER]:'yes',[ADMIN]:'abstain',[ADMIN2]:'no'});
 d=await foundation.closeDecision(guild,'d1',OWNER);
 assert.equal(d.status,'rejected');assert.equal(d.closedBy,OWNER);
 assert.match(JSON.stringify(foundation.decisionMessage(d).embeds[0].toJSON()),/Décision rejetée/);
 assert.deepEqual(foundation.decisionMessage(d).components,[]);
});

test('tick : clôture uniquement les votes arrivés à échéance',async()=>{
 decision({[OWNER]:'yes'},{closesAt:Date.now()+3600000});
 await foundation.tick(guild);assert.equal(a.state().schoolFoundation.decisions.d1.status,'open');
 a.save(s=>{s.schoolFoundation.decisions.d1.closesAt=Date.now()-1;});
 await foundation.tick(guild);assert.equal(a.state().schoolFoundation.decisions.d1.status,'rejected');
});

test('journal : filtres par type et par membre, du plus récent au plus ancien',()=>{
 a.save(s=>{s.schoolAdminHistory=[{id:'1',at:1,action:'rankup',actorId:OWNER,targetId:MEMBER},{id:'2',at:2,action:'discipline',actorId:ADMIN,targetId:MEMBER,reason:'Spam'},{id:'3',at:3,action:'casino.enable',actorId:ADMIN}];});
 const text=v=>v.embeds[0].toJSON().description;
 assert.match(text(foundation.journalView()),/\*\*3\*\* entrées/);
 assert.match(text(foundation.journalView('promotions')),/\*\*1\*\* entrée ·|\*\*1\*\* entrée/);
 assert.match(text(foundation.journalView('sanctions')),/Spam/);
 const byMember=text(foundation.journalView('all',MEMBER));assert.match(byMember,/\*\*2\*\* entrées/);assert.ok(byMember.indexOf('Discipline')<byMember.indexOf('Rank up'));
});

test('vues : discipline et décisions se construisent avec un sélecteur de navigation',()=>{
 require('../systems/qgDiscipline').save(s=>{s.cases.c1={id:'c1',memberId:MEMBER,actorId:ADMIN,reason:'Insultes',level:2,status:'pending',at:Date.now(),history:[]};});
 const d=foundation.disciplineView();
 assert.match(JSON.stringify(d.embeds[0].toJSON()),/Insultes/);
 assert.equal(d.components[0].toJSON().components[0].custom_id,'qgfd:nav');
 assert.ok(d.components.length<=5);
 decision({},{status:'adopted',closedAt:Date.now()});
 assert.match(JSON.stringify(foundation.decisionsView().embeds[0].toJSON()),/Archives \(1\)/);
 assert.equal(foundation.panelRows().length,2);
});

test('vues : tableau de bord, fiche membre, gestions et activité se construisent',async()=>{
 for(const section of ['dash','members','teams','activity','journal'])assert.ok((await foundation.render(guild,section)).embeds[0].toJSON().title,section);
 const card=await foundation.memberCard(guild,MEMBER),json=JSON.stringify(card.embeds[0].toJSON());
 assert.match(json,/Avertissement 1/);assert.match(json,/Fiche Fondation/);
 assert.ok(card.components.length<=5);
});
