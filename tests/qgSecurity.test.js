const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const data=require('../utils/recruitmentData'),a=require('../utils/qgAdmin'),config=require('../config/qg'),{Collection,AuditLogEvent:E,PermissionFlagsBits:P}=require('discord.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-security-'));data.setDataDirectory(dir);
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const sec=require('../systems/qgSecurity'),JOURNAL=require('../systems/qgDirectionJournal').CHANNEL;
beforeEach(()=>{for(const f of fs.readdirSync(dir))fs.rmSync(path.join(dir,f),{force:true});sec._test.reset();});
const T=sec._test;

test('liens : vrais sites acceptés, imitations et arnaques bloquées',()=>{
 for(const ok of ['regarde https://www.youtube.com/watch?v=x','https://discord.gift/abc mon cadeau','https://www.roblox.com/games/1','https://steamcommunity.com/id/moi','salut ça va ? oui.','on se voit à 20h.30',"j'ai lancé roblox.exe",'https://www.amazon.fr free shipping','https://store.steampowered.com/app/1 nitro gratuit lol'])
  assert.equal(T.scam(ok),null,ok);
 for(const [bad,why] of [['@everyone free nitro https://dlscord-gift.com/claim',/imite/],['https://discorcl.gift/xyz',/imite/],['go https://steamcommunlty.com/tradeoffer',/imite/],['https://stearncommunity.ru/x',/imite/],['https://roblox-robux.xyz',/imite/],
  ['Nitro gratuit pour tous : https://claim-gift.ru/x',/arnaque probable/],['https://site.com/x',/interdit/]])
  assert.match(T.scam(bad,[],['site.com'])||'',why,bad);
 assert.match(T.scam('',[{name:'NitroGenerator.exe'}]),/exécutable/);
 assert.equal(T.scam('',[{name:'photo.png'}]),null);
 assert.deepEqual(T.invites('rejoins discord.gg/abc12 et discord.com/invite/XyZ'),['abc12','XyZ']);
});

function member(id,extra={}){return{id,moderatable:true,kickable:true,roles:{cache:new Collection()},user:{id,bot:false,createdTimestamp:0},guild:{id:config.guildId,ownerId:'owner'},timeout:async(ms,r)=>{(member.timeouts||=[]).push([id,ms]);},...extra};}
function setup(){
 const alerts=[],journal={isTextBased:()=>true,send:async p=>alerts.push(p)};
 const guild={id:config.guildId,ownerId:'owner',client:{user:{id:'bot'}},channels:{fetch:async id=>id===JOURNAL?journal:null},members:{fetch:async()=>null}};
 return{guild,alerts};
}
function msg(guild,author,content,channelId,extra={}){
 const m={id:Math.random().toString(),guildId:config.guildId,guild,channelId,content,author:{id:author.id,bot:false,send:async()=>{}},member:author,attachments:new Collection(),mentions:{users:new Collection(),roles:new Collection()},client:{fetchInvite:async()=>null},deleted:false,delete:async()=>{m.deleted=true;},...extra};
 return m;
}

test('message d’arnaque : supprimé, pause 6 h, alerte ; même pour la Direction, pas pour le propriétaire',async()=>{
 const {guild,alerts}=setup();member.timeouts=[];
 const u=member('u1'),m=msg(guild,u,'free nitro https://dlscord.gift/x','c1');
 assert.equal(await sec.message(m),true);assert.ok(m.deleted);
 assert.deepEqual(member.timeouts,[['u1',6*3600000]]);
 assert.match(alerts[0].embeds[0].data.description,/imite[\s\S]*hxxp/);
 const o=msg(guild,member('owner'),'https://dlscord.gift/x','c1');
 assert.equal(await sec.message(o),false);assert.ok(!o.deleted);
});

test('compte piraté : même message dans 3 salons en 30 s → tout supprimé',async()=>{
 const {guild,alerts}=setup();member.timeouts=[];
 a.save(s=>{s.schoolRoles={};});
 const u=member('u2'),ms=['c1','c2','c3'].map(c=>msg(guild,u,'Regarde ce jeu incroyable que j’ai fait','c'+c));
 assert.equal(await sec.message(ms[0]),false);assert.equal(await sec.message(ms[1]),false);
 assert.equal(await sec.message(ms[2]),true);
 assert.ok(ms.every(m=>m.deleted));assert.match(alerts[0].embeds[0].data.title,/piraté/);
 // Dans un seul salon : pas de détection.
 sec._test.reset();const same=['a','b','c'].map(()=>msg(guild,u,'Regarde ce jeu incroyable que j’ai fait','c1'));
 for(const m of same)assert.equal(await sec.message(m),false);
});

test('@everyone, mentions de masse, invitation externe : bloqués hors Direction',async()=>{
 const {guild,alerts}=setup();member.timeouts=[];
 a.save(s=>{s.schoolRoles={creator:'dir'};});
 const u=member('u3');
 assert.equal(await sec.message(msg(guild,u,'@everyone venez','c1')),true);
 const many=msg(guild,u,'salut','c1');many.mentions.users=new Collection([1,2,3,4,5].map(n=>[String(n),{}]));
 assert.equal(await sec.message(many),true);
 const inv=msg(guild,u,'rejoins discord.gg/autre','c1',{client:{fetchInvite:async()=>({guild:{id:'autre'}})}});
 assert.equal(await sec.message(inv),true);
 const ours=msg(guild,u,'rejoins discord.gg/qg','c1',{client:{fetchInvite:async()=>({guild:{id:config.guildId}})}});
 assert.equal(await sec.message(ours),false);
 assert.deepEqual(member.timeouts.map(x=>x[1]),[600000,600000,600000]);
 const boss=member('boss');boss.roles.cache.set('dir',{id:'dir'});
 assert.equal(await sec.message(msg(guild,boss,'@everyone réunion','c1')),false);
 assert.equal(alerts.length,3);
});

test('anti-raid : 10 arrivées en 1 min → mode raid, jeunes comptes expulsés, fin après 30 min',async()=>{
 const {guild,alerts}=setup(),kicked=[],now=1e12;
 const join=(id,age)=>({id,guild,user:{id,bot:false,createdTimestamp:now-age},kickable:true,send:async()=>{},kick:async()=>kicked.push(id)});
 for(let n=0;n<9;n++)assert.equal(await sec.joined(join('old'+n,30*86400000),{now:now+n}),false);
 assert.equal(await sec.joined(join('new',3600000),{now:now+9}),true);
 assert.deepEqual(kicked,['new']);assert.ok(T.raidOn(now+10));
 assert.match(alerts[0].embeds[0].data.title,/Raid détecté/);assert.equal(alerts[0].content,`<@${config.ownerId}>`);
 assert.equal(await sec.joined(join('young2',86400000),{now:now+60000}),true);assert.deepEqual(kicked,['new','young2']);
 assert.equal(await sec.joined(join('adult',30*86400000),{now:now+61000}),false);
 await sec.tick(guild,{now:now+31*60000});assert.ok(!T.raidOn(now+31*60000));
 assert.match(alerts.at(-1).embeds[0].data.title,/terminé/);
});

test('anti-nuke : 3 suppressions de salons en 1 min → rôles retirés, une seule alerte',async()=>{
 const {guild,alerts}=setup();let set=null;
 const top={id:'top',managed:false},low={id:'low',managed:false};
 const bad={id:'bad',user:{bot:false},roles:{cache:new Collection([['low',low],['top',top],[config.guildId,{id:config.guildId}]]),set:async r=>{set=r.map(x=>x.id);}}};
 guild.members.fetch=async()=>bad;
 guild.members.fetchMe=async()=>({roles:{highest:{comparePositionTo:r=>r.id==='top'?-1:1}}});
 for(let n=0;n<4;n++)await sec.audit({action:E.ChannelDelete,executorId:'bad'},guild,{now:1000+n});
 assert.deepEqual(set,['top']);assert.equal(alerts.length,1);
 assert.match(alerts[0].embeds[0].data.description,/3 suppressions de salons[\s\S]*1 rôle\(s\) retiré\(s\), 1 au-dessus du bot/);
 // Le propriétaire et le bot ne sont jamais visés.
 for(const id of ['owner','bot'])for(let n=0;n<5;n++)assert.equal(await sec.audit({action:E.ChannelDelete,executorId:id},guild),false);
});

test('anti-nuke : bot ajouté expulsé ; Administrateur donné à un rôle retiré',async()=>{
 const {guild,alerts}=setup(),kicked=[];
 guild.members.fetch=async x=>{const id=typeof x==='string'?x:x.user;return id==='newbot'?{id,kick:async()=>kicked.push(id)}:{id,user:{bot:false},roles:{cache:new Collection(),set:async()=>{}}};};
 guild.members.fetchMe=async()=>({roles:{highest:{comparePositionTo:()=>1}}});
 await sec.audit({action:E.BotAdd,executorId:'mod',targetId:'newbot'},guild);
 assert.deepEqual(kicked,['newbot']);assert.match(alerts[0].embeds[0].data.title,/Bot ajouté/);
 let perms=null;const {PermissionsBitField}=require('discord.js');
 const role={id:'r1',permissions:new PermissionsBitField(P.Administrator|P.SendMessages),setPermissions:async p=>{perms=p;}};
 guild.roles={cache:new Map([['r1',role]])};
 await sec.audit({action:E.RoleUpdate,executorId:'mod',targetId:'r1',changes:[{key:'permissions',old:String(P.SendMessages),new:String(P.Administrator|P.SendMessages)}]},guild);
 assert.ok(!perms.has(P.Administrator));assert.match(alerts[1].embeds[0].data.title,/Administrateur bloquée/);
});
