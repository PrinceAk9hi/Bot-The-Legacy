const {test,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {Collection,AuditLogEvent}=require('discord.js');
const config=require('../config/qg'),qgLog=require('../utils/qgLog');
qgLog.timing.wait=0;qgLog.timing.retry=0;
const guard=require('../systems/qgMessageGuard');
const BOT='900000000000000000',MOD='800000000000000000',USER='700000000000000000',OWNER=config.ownerId;
let guild,channel,audit,sent,nextEntry;
function entry(type,executorId,{target,channel:ch,count=1,id}={}){return{id:id||String(++nextEntry),action:type,executor:{id:executorId},target:target?{id:target}:null,targetId:target,extra:{channel:ch?{id:ch}:undefined,count},createdTimestamp:Date.now(),reason:null};}
function message(id,authorId,content,{bot=false}={}){return{id,guildId:config.guildId,guild,channelId:channel.id,content,createdTimestamp:Date.now(),author:{id:authorId,bot,username:'u'+authorId.slice(0,2),displayAvatarURL:()=>'https://cdn.discordapp.com/a.png'},member:{displayName:'Membre '+authorId.slice(0,2),displayAvatarURL:()=>'https://cdn.discordapp.com/a.png'},attachments:new Collection()};}
beforeEach(()=>{
 nextEntry=1000;guard.cache.clear();sent=[];audit=[];
 const hook={id:'hook',owner:{id:BOT},name:guard.HOOK,send:async p=>{sent.push(p);return{id:'r'+sent.length,url:'https://discord.com/channels/x/'+sent.length,author:{id:'hookuser'}};}};
 channel={id:'c1',isThread:()=>false,permissionsFor:()=>({has:()=>true}),fetchWebhooks:async()=>new Collection([['hook',hook]]),createWebhook:async()=>hook};
 guild={id:config.guildId,client:{user:{id:BOT}},members:{me:{permissions:{has:()=>true}}},channels:{fetch:async()=>channel},fetchAuditLogs:async({type})=>({entries:new Collection(audit.filter(e=>e.action===type).map(e=>[e.id,e]))})};
});

test('mémorisation : seulement les messages humains du QG',()=>{
 assert.ok(guard.remember(message('1',USER,'salut'),{fetcher:async()=>null}));
 assert.equal(guard.remember(message('2',BOT,'panel',{bot:true})),null);
 assert.equal(guard.remember({...message('3',USER,'x'),guildId:'autre'}),null);
 assert.equal(guard.cache.get('1').content,'salut');
});

test('l’auteur supprime son propre message : il réapparaît avec son nom',async()=>{
 guard.remember(message('10',USER,'mon message'),{fetcher:async()=>null});
 const r=await guard.onDelete({id:'10',guildId:config.guildId,guild,author:null});
 assert.equal(r.allowed,false);assert.ok(r.restored);
 assert.match(sent[0].content,/mon message/);assert.match(sent[0].content,/Message restauré/);
 assert.equal(sent[0].username,'Membre 70');assert.deepEqual(sent[0].allowedMentions,{parse:[]});
 // Le message restauré reste protégé et garde l'auteur d'origine.
 assert.equal(guard.cache.get('r1').authorId,USER);
});

test('un modérateur supprime : restauré ; le propriétaire ou le bot : suppression conservée',async()=>{
 guard.remember(message('20',USER,'a'),{fetcher:async()=>null});audit.push(entry(AuditLogEvent.MessageDelete,MOD,{target:USER,channel:'c1'}));
 assert.equal((await guard.onDelete({id:'20',guildId:config.guildId,guild})).restored!==undefined,true);
 assert.equal(sent.length,1);
 guard.remember(message('21',USER,'b'),{fetcher:async()=>null});audit.push(entry(AuditLogEvent.MessageDelete,OWNER,{target:USER,channel:'c1'}));
 const byOwner=await guard.onDelete({id:'21',guildId:config.guildId,guild});
 assert.equal(byOwner.allowed,true);assert.equal(byOwner.by.user.id,OWNER);
 guard.remember(message('22',USER,'c'),{fetcher:async()=>null});audit.push(entry(AuditLogEvent.MessageDelete,BOT,{target:USER,channel:'c1'}));
 assert.equal((await guard.onDelete({id:'22',guildId:config.guildId,guild})).allowed,true);
 guard.remember(message('23',OWNER,'d'),{fetcher:async()=>null});
 assert.equal((await guard.onDelete({id:'23',guildId:config.guildId,guild})).allowed,true);
 assert.equal(sent.length,1);
});

test('journal d’audit regroupé : on reconnaît l’entrée dont le compteur augmente',async()=>{
 const e=entry(AuditLogEvent.MemberDisconnect,MOD,{count:1,id:'agg'});e.createdTimestamp=Date.now()-3600000;audit.push(e);
 assert.equal(await qgLog.recent(guild,AuditLogEvent.MemberDisconnect,{}),null);
 e.extra.count=2;
 assert.equal((await qgLog.recent(guild,AuditLogEvent.MemberDisconnect,{})).user.id,MOD);
 assert.equal(await qgLog.recent(guild,AuditLogEvent.MemberDisconnect,{}),null);
});

test('suppression en masse : restaurée sauf si elle vient du propriétaire',async()=>{
 for(const id of ['30','31'])guard.remember(message(id,USER,'m'+id),{fetcher:async()=>null});
 const batch=new Collection([['30',{id:'30'}],['31',{id:'31'}]]);
 audit.push(entry(AuditLogEvent.MessageBulkDelete,MOD,{target:'c1',count:2}));
 const r=await guard.onBulk(batch,{...channel,guild});
 assert.deepEqual([r.allowed,r.restored],[false,2]);
 assert.deepEqual(sent.map(p=>p.content.split('\n')[0]),['m30','m31']);
 for(const id of ['32'])guard.remember(message(id,USER,'x'),{fetcher:async()=>null});
 audit.push(entry(AuditLogEvent.MessageBulkDelete,OWNER,{target:'c1',count:1}));
 assert.equal((await guard.onBulk(new Collection([['32',{id:'32'}]]),{...channel,guild})).allowed,true);
});
