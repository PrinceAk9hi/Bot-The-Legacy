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

test('restauration désactivée : aucun message supprimé n’est republié, quel que soit l’auteur de la suppression',async()=>{
 assert.equal(guard.RESTORE,false);
 guard.remember(message('10',USER,'mon message'),{fetcher:async()=>null});
 assert.equal((await guard.onDelete({id:'10',guildId:config.guildId,guild,author:null})).allowed,true,'auteur');
 guard.remember(message('20',USER,'a'),{fetcher:async()=>null});audit.push(entry(AuditLogEvent.MessageDelete,MOD,{target:USER,channel:'c1',id:'g1'}));
 const byMod=await guard.onDelete({id:'20',guildId:config.guildId,guild});assert.equal(byMod.allowed,true);assert.equal(byMod.by.user.id,MOD);
 for(const id of ['30','31'])guard.remember(message(id,USER,'m'+id),{fetcher:async()=>null});
 audit.push(entry(AuditLogEvent.MessageBulkDelete,MOD,{target:'c1',count:2,id:'g2'}));
 assert.equal((await guard.onBulk(new Collection([['30',{id:'30'}],['31',{id:'31'}]]),{...channel,guild})).allowed,true,'suppression en masse');
 assert.equal(sent.length,0,'rien n’a été republié');
});

test('journal d’audit regroupé : on reconnaît l’entrée dont le compteur augmente',async()=>{
 const e=entry(AuditLogEvent.MemberDisconnect,MOD,{count:1,id:'agg'});e.createdTimestamp=Date.now()-3600000;audit.push(e);
 assert.equal(await qgLog.recent(guild,AuditLogEvent.MemberDisconnect,{}),null);
 e.extra.count=2;
 assert.equal((await qgLog.recent(guild,AuditLogEvent.MemberDisconnect,{})).user.id,MOD);
 assert.equal(await qgLog.recent(guild,AuditLogEvent.MemberDisconnect,{}),null);
});
