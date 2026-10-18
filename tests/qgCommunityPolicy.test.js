const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Collection,PermissionFlagsBits:P}=require('discord.js');
const store=require('../utils/recruitmentData');
const policy=require('../systems/qgCommunityPolicy');
const voice=require('../systems/qgVoiceControls');
const layout=require('../config/qgSchoolLayout');
const config=require('../config/qg');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-community-'));
store.setDataDirectory(dir);
test.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
function reset(){fs.writeFileSync(path.join(dir,'qgServer.json'),JSON.stringify({schoolRoles:{community:'community',creator:'creator',globalManager:'global',administrator:'admin',ticketsManagement:'support'},schoolChannels:{communityMedia:'media',communitySuggestions:'suggestions',communityCommands:'commands'},schoolCommunityPolicy:{enabled:true}}));policy._test.bursts.clear();}
function fixture(id='member',roles=['community']) {
 const calls=[]; const guild={id:config.guildId,ownerId:'owner',members:{},channels:{fetch:async()=>null}};
 const member={id,guild,user:{bot:false},roles:{cache:new Map(roles.map(k=>[k,true]))},timeout:async(...args)=>calls.push(['timeout',...args])};
 guild.members.fetch=async()=>member;guild.members.ban=async(...args)=>calls.push(['ban',...args]);guild.members.unban=async(...args)=>calls.push(['unban',...args]);
 const m={id:'message',guildId:guild.id,guild,member,author:{id,username:'Membre'},content:'Bonjour',channelId:'chat',attachments:new Map(),embeds:[],delete:async()=>calls.push(['delete']),startThread:async()=>{calls.push(['thread']);return {send:async p=>calls.push(['ping',p])};},react:async x=>calls.push(['reaction',x]),url:'https://discord.com/channels/test'};
 return {m,member,guild,calls};
}
test('direction and foundation exempt; management is not',()=>{
 reset();for(const role of ['creator','global','admin'])assert.equal(policy.exempt(fixture('x',[role]).member),true);
 assert.equal(policy.exempt(fixture('x',['support']).member),false);
});
test('spam uses cross-channel bursts and repeated text, without treating one message as spam',()=>{
 reset();for(let n=0;n<5;n++)assert.equal(policy._test.spam('a',`message ${n}`,n*500),false);
 assert.equal(policy._test.spam('a','sixième',3000),true);
 assert.equal(policy._test.spam('a','après délai',30000),false);
 for(let n=0;n<3;n++)assert.equal(policy._test.spam('b','identique',n*5000),false);
 assert.equal(policy._test.spam('b','identique',15000),true);
});
test('invite and everyone filters delete ordinary messages, exempt direction, do not count edits as spam',async()=>{
 reset();let f=fixture();f.m.content='https://discord.gg/example';assert.equal(await policy.message(f.m),true);assert.equal(f.calls[0][0],'delete');
 f=fixture('admin-user',['admin']);f.m.content='@everyone https://discord.gg/example';assert.equal(await policy.message(f.m),false);assert.equal(f.calls.length,0);
 f=fixture();f.m.content='correction';await policy.message(f.m,true);assert.equal(policy._test.bursts.has('member'),true); // prior original message only
 assert.equal(policy._test.bursts.get('member').length,1);
});
test('media-only channels delete plain text and create one discussion thread for media',async()=>{
 reset();const f=fixture();f.m.channelId='media';await policy.message(f.m);assert.deepEqual(f.calls,[['delete']]);
 f.calls.length=0;f.m.attachments.set('a',{contentType:'image/png'});await policy.message(f.m);assert.deepEqual(f.calls,[['thread']]);
 f.calls.length=0;await policy.message(f.m,true);assert.equal(f.calls.length,0);
});
test('suggestion opens thread, votes and a single support-role mention',async()=>{
 reset();const f=fixture();f.m.channelId='suggestions';await policy.message(f.m);
 assert.deepEqual(f.calls.map(x=>x[0]),['thread','reaction','reaction','ping']);assert.deepEqual(f.calls.at(-1)[1].allowedMentions,{parse:[],roles:['support']});
});
test('sanctions persist, serialize one incident, expire 24h bans and retain strikes',async()=>{
 reset();const f=fixture();await Promise.all([policy._test.sanction(f.m),policy._test.sanction(f.m)]);
 assert.equal(f.calls.filter(x=>x[0]==='timeout').length,1);assert.equal(store.read('qgServer').schoolModeration.member.strikes,1);
 store.update('qgServer',s=>{s.schoolModeration.member.blockedUntil=0;});f.m.id='second';await policy._test.sanction(f.m);
 let rec=store.read('qgServer').schoolModeration.member;assert.equal(rec.strikes,2);assert.ok(rec.unbanAt>Date.now());
 f.guild.bans={fetch:async()=>({reason:rec.reason})};store.update('qgServer',s=>{s.schoolModeration.member.unbanAt=1;});
 await policy.expireBans(f.guild);assert.equal(f.calls.filter(x=>x[0]==='unban').length,1);assert.equal(store.read('qgServer').schoolModeration.member.strikes,2);
 store.update('qgServer',s=>{s.schoolModeration.member.blockedUntil=0;});f.m.id='third';await policy._test.sanction(f.m);
 rec=store.read('qgServer').schoolModeration.member;assert.equal(rec.strikes,3);assert.equal(rec.unbanAt,undefined);
});
test('expiry never removes a different staff ban and errors do not advance strikes',async()=>{
 reset();const f=fixture();store.update('qgServer',s=>{s.schoolModeration={member:{strikes:2,status:'applied',unbanAt:1,reason:'automatic'}};});
 f.guild.bans={fetch:async()=>({reason:'staff decision'})};await policy.expireBans(f.guild);assert.equal(f.calls.length,0);assert.equal(store.read('qgServer').schoolModeration.member.status,'review');
 reset();f.member.timeout=async()=>{throw {code:50013};};await policy._test.sanction(f.m);assert.equal(store.read('qgServer').schoolModeration.member.strikes,0);
});
test('default layout hides welcome except rules, disables voice text and removes community giveaway',()=>{
 const r={community:'community',creator:'creator',globalManager:'global',administrator:'admin'};
 assert.ok(layout.overwrites('guild','bot',r,'welcome',{channelKey:'arrivals'}).find(x=>x.id==='guild').deny.includes(P.ViewChannel));
 assert.ok(layout.overwrites('guild','bot',r,'welcome',{channelKey:'rules'}).find(x=>x.id==='guild').allow.includes(P.ViewChannel));
 const grants=layout.overwrites('guild','bot',r,'communityVoice',{channelKey:'communityVoice1'});
 assert.ok(grants.find(x=>x.id==='community').deny.includes(P.UseSoundboard));
 assert.ok(grants.find(x=>x.id==='community').deny.includes(P.ReadMessageHistory));
 assert.ok(!layout.channels.some(x=>x[0]==='communityGiveaways'));
});
test('voice panel uses native member selectors and family access remains mandatory',()=>{
 const p=voice.controls('123',{locked:false});assert.equal(p.components[1].toJSON().components[0].type,5);
 assert.equal(voice.eligible(fixture().member,{kind:'family'},store.read('qgServer')),false);
});
test('voice controls reject another member before any mutation',async()=>{
 reset();store.update('qgServer',s=>{s.schoolTemporaryVoices={room:{ownerId:'someone',kind:'community'}};});
 const f=fixture();let response;await voice.handle({customId:'qgs:voice:lock:room',guildId:f.guild.id,guild:f.guild,user:{id:'member'},reply:async p=>{response=p;}});
 assert.match(response.content,/propriétaire/);assert.equal(f.calls.length,0);
});
test('read-only reaction removal also prevents clicking existing reactions',async()=>{
 reset();store.update('qgServer',s=>{s.schoolCategories={information:'info'};});const f=fixture();let removed;
 const reaction={message:{guildId:f.guild.id,guild:f.guild,channel:{parentId:'info'}},users:{remove:async id=>{removed=id;}}};
 assert.equal(await policy.reaction(reaction,{id:'member'}),true);assert.equal(removed,'member');
 removed=null;f.member.roles.cache.set('admin',true);await policy.reaction(reaction,{id:'member'});assert.equal(removed,null);
});
test('vocal lock/unlock restores manual connect permissions instead of granting every role',async()=>{
 reset();const f=fixture();store.update('qgServer',s=>{s.schoolTemporaryVoices={room:{ownerId:'member',kind:'community',locked:false}};});
 const edits=[];const cache=new Collection([['community',{id:'community',type:0,allow:{has:()=>true},deny:{has:()=>false}}],['blocked',{id:'blocked',type:0,allow:{has:()=>false},deny:{has:()=>true}}]]);
 const room={isVoiceBased:()=>true,permissionOverwrites:{cache,edit:async(id,v)=>{edits.push([id,v.Connect]);}}};
 f.guild.channels.fetch=async()=>room;f.guild.roles={cache:new Collection()};
 const i=action=>({customId:`qgs:voice:${action}:room`,guildId:f.guild.id,guild:f.guild,user:{id:'member'},deferReply:async()=>{},editReply:async()=>{}});
 await voice.handle(i('lock'));await voice.handle(i('unlock'));
 assert.deepEqual(edits,[['community',false],['blocked',false],['community',true],['blocked',false]]);
});
test('migration is repeatable, keeps separators and deletes only configured community giveaway',async()=>{
 reset();store.update('qgServer',s=>{s.schoolChannels.rules='rules';s.schoolChannels.communityGiveaways='giveaway';s.schoolChannels.giveawaysInfo='info-giveaway';s.schoolCategories={welcome:'welcome',information:'info',community:'community-cat',support:'support-cat'};});
 const all=new Collection();let deleted=0,renamed=0;
 function ch(id,parentId){let cache=new Collection();const c={id,parentId,isThread:()=>false,isVoiceBased:()=>false,permissionOverwrites:{get cache(){return cache;},set:async entries=>{cache=new Collection(entries.map(e=>[e.id,{...e,allow:{bitfield:e.allow},deny:{bitfield:e.deny}}]));}},delete:async()=>{deleted++;all.delete(id);}};all.set(id,c);return c;}
 ch('rules','welcome');const info=ch('info-giveaway','info');ch('giveaway','community-cat');ch('private','private-cat');const ticket=ch('private-ticket','support-cat');
 const support={name:'Gestion Tickets',editable:true,setName:async n=>{support.name=n;renamed++;}};
 const guild={id:config.guildId,channels:{fetch:async()=>all},members:{fetchMe:async()=>({permissions:{has:()=>true}})},roles:{fetch:async()=>support,cache:new Collection()}};
 await policy.apply(guild,{user:{id:'bot'}});await policy.apply(guild,{user:{id:'bot'}});
 assert.equal(deleted,1);assert.equal(renamed,1);assert.ok(all.has('info-giveaway'));assert.ok(store.read('qgServer').schoolCommunityPolicy.enabled);
 assert.ok(info.permissionOverwrites.cache.get(config.guildId).deny.bitfield&P.SendMessages);
 assert.ok(info.permissionOverwrites.cache.get('community').allow.bitfield&P.ViewChannel);
 assert.equal(ticket.permissionOverwrites.cache.has('community'),false,'A ticket under Support must never be opened to Community');
});
