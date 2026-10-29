const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const data=require('../utils/recruitmentData'),a=require('../utils/qgAdmin'),config=require('../config/qg'),{Collection}=require('discord.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-command-'));data.setDataDirectory(dir);
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const command=require('../systems/qgCommand'),emergency=require('../systems/qgEmergency'),alertAudio=require('../utils/qgAlertAudio');
const OWNER='100000000000000000',LEAD='200000000000000000',SENIOR='300000000000000000',TEST='400000000000000000',WARNED='500000000000000000';
let guild,members,moves;
function member(id,roles,channelId=null){const m={id,guild,displayName:'M'+id.slice(0,1),user:{id,bot:false},roles:{cache:new Collection(roles.map(r=>[r,{id:r}]))},voice:{channelId,setChannel:async t=>{moves.push([id,t.id]);m.voice.channelId=t.id;}}};return m;}
function voiceChannel(id,ids){return{id,guildId:config.guildId,rawPosition:Number(id.slice(-1)),isVoiceBased:()=>true,members:new Collection(ids.map(x=>[x,members.get(x)]))};}
beforeEach(()=>{
 for(const f of fs.readdirSync(dir))fs.rmSync(path.join(dir,f),{force:true});
 moves=[];members=new Collection();
 guild={id:config.guildId,ownerId:OWNER,members:{cache:members,fetch:async q=>q?members.get(typeof q==='string'?q:q.user):members,me:{permissions:{has:()=>true}}},voiceStates:{cache:new Collection()},channels:{cache:new Collection(),fetch:async()=>null}};
 a.save(s=>{s.schoolRoles={creator:'creator',recruitmentLead:'rlead',recruitmentManagement:'recrut',senior:'senior',test:'test',warning1:'w1',lastChance:'lc'};});
 members.set(OWNER,member(OWNER,['creator'],'v1'));members.set(LEAD,member(LEAD,['rlead','senior'],'v1'));members.set(SENIOR,member(SENIOR,['senior'],'v2'));members.set(TEST,member(TEST,['test','w1']));members.set(WARNED,member(WARNED,['test','lc'],'v2'));
 for(const m of members.values())if(m.voice.channelId)guild.voiceStates.cache.set(m.id,{channelId:m.voice.channelId,member:m});
 guild.channels.cache.set('v1',voiceChannel('v1',[OWNER,LEAD]));guild.channels.cache.set('v2',voiceChannel('v2',[SENIOR,WARNED]));guild.channels.cache.set('v3',voiceChannel('v3',[]));
});

test('audio d’alerte : sirène seule sans synthèse, sirène + voix avec synthèse',async()=>{
 const silent=await alertAudio.build('',{tts:async()=>null});
 assert.equal(silent.spoken,false);assert.equal(silent.pcm.length%4,0);assert.ok(silent.pcm.length>alertAudio.RATE*4*5);
 const voice=Buffer.alloc(alertAudio.RATE*4*3,1);
 const spoken=await alertAudio.build('Test',{tts:async()=>voice});
 assert.equal(spoken.spoken,true);assert.ok(spoken.pcm.length>silent.pcm.length);
 assert.equal(alertAudio.upsample(Buffer.alloc(4)).length,16);
});

test('effectif : direction, grades et sanctions suivent les rôles',async()=>{
 const r=await command.roster(guild);
 assert.deepEqual(r.direction.find(([l])=>l==='Créateur')[1].map(m=>m.id),[OWNER]);
 assert.deepEqual(r.grades.find(([l])=>l==='Membre Senior')[1].map(m=>m.id).sort(),[LEAD,SENIOR].sort());
 assert.deepEqual(r.sanctions.find(([l])=>l==='Avertissement 1')[1].map(m=>m.id),[TEST]);
 assert.deepEqual(r.sanctions.find(([l])=>l==='Dernière Chance')[1].map(m=>m.id),[WARNED]);
 assert.match(command.csv(r),/"Sanction";"Dernière Chance"/);
});

test('panneau : composants valides, identifiants uniques, texte sous la limite',async()=>{
 const p=await command.panel(guild),json=p.components.map(c=>c.toJSON()),flat=JSON.stringify(json);
 const ids=[...flat.matchAll(/"custom_id":"([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const id of ['qgcmd:recruit','qgcmd:casino','qgm:new','qgcmd:alert','qgcmd:gather','qgcmd:roster','qgcmd:report'])assert.ok(ids.includes(id),id);
 const count=n=>Array.isArray(n)?n.reduce((s,x)=>s+count(x),0):n&&typeof n==='object'?Object.entries(n).reduce((s,[k,v])=>s+(k==='content'?v.length:count(v)),0):0;
 assert.ok(count(json)<4000);
 assert.match(flat,/4\*\* en vocal \(2 salons\)/);
 assert.match(flat,/Recrutement ouvert/);
});

test('salons à alerter : seulement les vocaux occupés ; rassemblement vers un salon',async()=>{
 assert.deepEqual(emergency.rooms(guild).map(c=>c.id),['v1','v2']);
 const r=await emergency.gather(guild,'v1',OWNER);
 assert.deepEqual([r.moved,r.failed],[2,0]);
 assert.deepEqual(moves.map(([id])=>id).sort(),[SENIOR,WARNED].sort());
});

test('permissions : hors équipe refusé, alerte réservée à la direction',async()=>{
 const i=(who,customId)=>({customId,guildId:config.guildId,guild,user:{id:who},isButton:()=>true,showModal:async()=>{},deferReply:async()=>{},editReply:async()=>{}});
 await assert.rejects(command.handle(i(TEST,'qgcmd:roster')),/réservé à l’équipe/);
 await assert.rejects(command.handle(i(LEAD,'qgcmd:alert')),/réservée à la direction/);
 await command.handle(i(OWNER,'qgcmd:alert'));
});
