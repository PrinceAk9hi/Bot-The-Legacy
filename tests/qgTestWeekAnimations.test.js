const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const data=require('../utils/recruitmentData'),a=require('../utils/qgAdmin'),config=require('../config/qg'),{Collection}=require('discord.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-test-week-'));data.setDataDirectory(dir);
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
beforeEach(()=>{for(const f of fs.readdirSync(dir))fs.rmSync(path.join(dir,f),{recursive:true,force:true});});
const tp=require('../systems/qgTestPeriod'),week=require('../systems/qgMemberOfWeek'),anim=require('../systems/qgAnimations');
const DAY=86400000,TEST='r-test',CONF='r-conf';

function member(id,roles=[]){return{id,guild:{id:config.guildId,ownerId:'owner'},user:{id,bot:false,tag:id},displayName:id,roles:{cache:new Map(roles.map(r=>[r,{id:r}]))}};}
function guildWith(members,channels={}){
 const cache=new Collection(members.map(m=>[m.id,m]));
 return{id:config.guildId,members:{cache,fetch:async()=>cache},channels:{fetch:async id=>channels[id]||null}};
}

test('fin de PDT : échéance = PDT ouverte, sinon arrivée + 7 jours ; fiche publiée une fois',async()=>{
 const start=10*DAY;
 a.save(s=>{s.schoolRoles={test:TEST,confirmed:CONF};s.schoolFamilyMembership={a:{active:true,joinedAt:start}};
  s.schoolPdt={p1:{id:'p1',targetId:'b',referentId:'ref',startAt:start,endAt:start+14*DAY,createdAt:start,status:'En cours',observations:[{at:start+DAY,actorId:'ref',activity:'Très présent',behavior:'Bon',involvement:'Motivé'}],history:[]}};
  s.schoolDailyActivity={a:{[require('../systems/qgMemberMetrics').day(start+2*DAY)]:{messages:12,voiceMs:3*3600000}}};});
 assert.deepEqual(tp._test.period('a'),{start,end:start+7*DAY,estimated:false});
 assert.equal(tp._test.period('b').end,start+14*DAY);
 const sent=[],ch={isTextBased:()=>true,send:async p=>{sent.push(p);return{id:'msg'+sent.length};}};
 const guild=guildWith([member('a',[TEST]),member('b',[TEST]),member('c',[CONF]),member('d',[TEST])],{[tp.CHANNEL]:ch});
 assert.equal(await tp.tick(guild,{now:start+6*DAY}),0);
 assert.equal(a.state().schoolTestPeriods.d.estimated,true); // d : arrivée inconnue, période démarrée maintenant
 assert.equal(await tp.tick(guild,{now:start+7*DAY}),1);
 const text=sent[0].embeds[0].data.description;
 assert.match(text,/<@a>/);assert.match(text,/12 messages · 🎙️ 3 h 0 min/);assert.match(text,/durée par défaut/);
 assert.deepEqual(sent[0].components[0].toJSON().components.map(c=>c.custom_id),['qgte:validate:a','qgte:extend:a','qgte:remove:a']);
 assert.equal(await tp.tick(guild,{now:start+8*DAY}),0);
 assert.equal(await tp.tick(guild,{now:start+14*DAY}),2); // b (fin de PDT) et d (début estimé + 7 jours)
 assert.match(sent[1].embeds[0].data.description,/Référent : <@ref>[\s\S]*Très présent/);
});

test('fin de PDT : prolonger repousse l’échéance de 7 jours et désactive les boutons',async()=>{
 const now=Date.now();
 a.save(s=>{s.schoolRoles={test:TEST,confirmed:CONF,globalManager:'boss'};s.schoolFamilyMembership={a:{active:true,joinedAt:now-8*DAY}};});
 const target=member('a',[TEST]),actor=member('chef',['boss']);actor.guild={id:config.guildId,ownerId:'x'};
 const edits=[],replies=[];
 const old=tp._test.payload('a',tp._test.period('a'));
 const i={customId:'qgte:extend:a',user:{id:'chef'},guild:{id:config.guildId,ownerId:'x',members:{fetch:async({user})=>user==='chef'?actor:target}},
  message:{embeds:[old.embeds[0].toJSON()],edit:async p=>edits.push(p)},deferReply:async()=>{},editReply:async p=>replies.push(p)};
 await tp.handle(i);
 const end=a.state().schoolTestPeriods.a.endAt;
 assert.ok(end>=now+7*DAY-1000&&end<=Date.now()+7*DAY);
 assert.match(edits[0].embeds[0].toJSON().description,/Prolongée/);
 assert.ok(edits[0].components[0].toJSON().components.every(c=>c.disabled));
 assert.match(replies[0],/prolongée/);
 // Une personne non autorisée est refusée.
 const other=member('x2');other.guild={id:config.guildId,ownerId:'x'};const refused=[];
 await tp.handle({...i,user:{id:'x2'},guild:{...i.guild,members:{fetch:async()=>other}},reply:async p=>refused.push(p)});
 assert.match(refused[0].content,/Réservé/);
});

test('membre de la semaine : score vocal + messages + animations, Direction exclue',()=>{
 assert.equal(week._test.score({voiceMs:90*60000,messages:10,animations:1}),90+20+30);
 a.save(s=>{s.schoolAnimations={events:{e1:{startAt:5*DAY,attendance:{a:true,b:false}},e2:{startAt:20*DAY,attendance:{a:true}}}};});
 assert.equal(week._test.animationsOf('a',0,10*DAY),1);assert.equal(week._test.animationsOf('b',0,10*DAY),0);
 const p=week._test.payload([{id:'a',score:140,voiceMs:90*60000,messages:10,animations:1},{id:'b',score:50,voiceMs:0,messages:25,animations:0}]);
 assert.equal(p.content,'<@a>');assert.deepEqual(p.allowedMentions,{parse:[],users:['a']});
 assert.match(p.embeds[0].data.description,/🥇 <@a> — 140 pts[\s\S]*🥈 <@b> — 50 pts/);
});

test('membre de la semaine : le lundi à partir de 10 h, une fois, rôle passé au nouveau gagnant',async()=>{
 const day=require('../systems/qgMemberMetrics').day,monday=Date.UTC(2026,10,16,9); // 10 h à Paris
 a.save(s=>{s.schoolRoles={test:TEST,memberOfWeek:'star'};s.schoolDailyActivity={a:{[day(monday-2*DAY)]:{messages:5,voiceMs:0}},b:{[day(monday-3*DAY)]:{messages:1,voiceMs:60*60000}}};});
 const ma=member('a',[TEST]),mb=member('b',[TEST]),old=member('old',['star']),log=[];
 for(const m of [ma,mb,old])m.roles.add=async()=>log.push('+'+m.id),m.roles.remove=async()=>log.push('-'+m.id);
 const sent=[],ch={isTextBased:()=>true,send:async p=>sent.push(p)};
 const guild=guildWith([ma,mb,old],{'1561157222032212059':ch});
 guild.roles={cache:new Map([['star',{id:'star',members:new Map([['old',old]])}]])};
 assert.equal(await week.tick(guild,{now:monday-3600000}),false);
 assert.equal(await week.tick(guild,{now:monday}),true);
 assert.equal(sent[0].content,'<@b>'); // 60 min + 2 = 62 pts contre 10 pts
 assert.deepEqual(log,['-old','+b']);
 assert.equal(await week.tick(guild,{now:monday+3600000}),false);
});

test('animations : familles invitées reconnues, membres de ces familles ajoutés aux rappels',()=>{
 assert.deepEqual(anim.parseFamilies('dynasty, LA NIGHTMARE ,Dynasty'),['Dynasty','NIGHTMARE']);
 assert.throws(()=>anim.parseFamilies('Dynasty, Inventée'),/Inventée/);
 assert.deepEqual(anim.parseFamilies(''),[]);
 a.save(s=>{s.schoolOtherFamilies={g1:{families:[{id:1,name:'DYNASTY | SCHOOLRP'}]},g2:{families:[{id:2,name:'Shadow | SCHOOLRP'}]},p1:{families:[{id:1,name:'DYNASTY'}]}};});
 const guild={members:{cache:new Map([['g1',{}],['g2',{}],['p1',{}],['x',{}]])}};
 const e={title:'Course',families:['Dynasty'],participants:['p1']};
 assert.deepEqual(anim.guestIds(guild,e),['g1']); // p1 déjà inscrit, g2 d'une autre famille
 assert.deepEqual(anim.guestIds(guild,{participants:[]}),[]);
 const t=anim.rosterText(e,['g1']);
 assert.match(t,/Inscrits \(1\) :\n<@p1>/);assert.match(t,/Familles invitées \(Dynasty\) : 1 membre\n<@g1>/);
});
