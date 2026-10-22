const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Collection,PermissionFlagsBits:P}=require('discord.js');
const storage=require('../utils/recruitmentData'),config=require('../config/qg');
const panels=require('../systems/qgPanels'),routing=require('../systems/qgTicketRouting');
const help=require('../systems/qgVerificationHelp');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'qg-panels-'));storage.setDataDirectory(folder);test.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
function reset(){fs.writeFileSync(path.join(folder,'qgServer.json'),JSON.stringify({schoolRoles:{creator:'creator',globalManager:'global',administrator:'admin',ticketsManagement:'support',animationManagement:'animation',animationLead:'animation-lead',absent:'absent'},schoolCategories:{foundation:'foundation',supportManagement:'support-category',animationManagement:'animation-category'},tickets:{}}));}
function guild(){return {id:config.guildId,ownerId:'owner',client:{user:{id:'bot'}},roles:{cache:new Collection(['creator','global','admin','support','animation','everyone'].map(id=>[id,{id}]))}};}
test('ticket panel order, supplied emojis, white branding and verification help button',()=>{
 reset();const p=panels.tickets(),data=p.embeds[0].toJSON(),options=p.components[0].toJSON().components[0].options;
 assert.deepEqual(options.map(x=>x.value),['questions','event','report','foundation']);assert.deepEqual(options.map(x=>x.emoji.id),['1561415725485260840',undefined,'1561417105218215996','1561417429999952033']);
 assert.equal(data.color,0xffffff);assert.equal(data.footer.text,'Fondateur - QG');assert.ok(data.description.startsWith('Besoin'));assert.doesNotMatch(JSON.stringify(data),/soul|héritage|héritier/i);
 const buttons=require('../systems/qgEntryVerification').panel().components[0].toJSON().components;assert.ok(buttons.some(x=>x.custom_id==='qgs:help-open'));
});
test('management capacity uses real members and excludes the responsible',async()=>{
 reset();const members=new Collection([['a',{user:{bot:false},roles:{cache:new Map([['animation',true]])}}],['lead',{user:{bot:false},roles:{cache:new Map([['animation',true],['animation-lead',true]])}}]]);
 const p=await panels.management({members:{cache:members,fetch:async()=>members}});assert.match(p.embeds[0].data.description,/Gestion Animation[\s\S]*?1\/2/);
 const unknown=await panels.management();assert.match(unknown.embeds[0].data.description,/non mesuré/);
});
test('reports and Foundation are private from Support and Administrator roles',()=>{
 reset();for(const type of ['report','foundation']){const out=routing.overwrites(guild(),'applicant',type);assert.ok(out.find(x=>x.id==='support').deny.includes(P.ViewChannel));assert.ok(out.find(x=>x.id==='admin').deny.includes(P.ViewChannel));assert.ok(out.find(x=>x.id==='applicant').allow.includes(P.ViewChannel));assert.ok(out.find(x=>x.id==='global').allow.includes(P.ViewChannel));}
});
test('each ticket moves once to its team and never synchronizes category permissions',async()=>{
 for(const [type,dest] of [['questions','support-category'],['event','animation-category'],['report','foundation'],['foundation','foundation']]){
  reset();storage.update('qgServer',s=>{s.tickets.ticket={ownerId:'applicant',type};});const actions=[];
  const channel={id:'ticket',guild:guild(),permissionOverwrites:{set:async o=>actions.push(['permissions',o])},setParent:async(...a)=>actions.push(['move',...a]),send:async p=>actions.push(['send',p])};
  await routing.escalate(channel,'Décision humaine nécessaire');await routing.escalate(channel,'Doublon');
  assert.equal(actions.filter(x=>x[0]==='move').length,1);assert.equal(actions[1][1],dest);assert.equal(actions[1][2].lockPermissions,false);assert.equal(actions.filter(x=>x[0]==='send').length,1);
 }
});
test('warning is delivered in DM before kick, failed DM cannot authorize a kick',async()=>{
 reset();const events=[];const member={id:'person',guild:guild(),roles:{cache:new Map()},kickable:true,send:async()=>events.push('dm'),kick:async()=>events.push('kick')};
 await help.abuse(member,'test');await help.abuse(member,'repeat');assert.deepEqual(events,['dm','kick']);
 reset();events.length=0;member.send=async()=>{throw Error('closed');};await help.abuse(member,'test');await help.abuse(member,'test');assert.deepEqual(events,[]);assert.equal(storage.read('qgServer').verificationHelp,undefined);
});
test('ordinary members cannot confirm another user help request as abusive',async()=>{
 reset();let response;const g=guild();g.members={fetch:async()=>({id:'ordinary',guild:g,roles:{cache:new Map()}})};
 await help.handle({customId:'qgs:help-abuse:person',guildId:g.id,guild:g,user:{id:'ordinary'},deferReply:async()=>{},editReply:async v=>{response=v;}});assert.match(response,/réservée/);
});
test('absence role follows overlapping dates and cancellation',async()=>{
 reset();const now=Date.now();storage.update('qgServer',s=>{s.schoolAbsences={a:{memberId:'person',status:'active',start:now-1000,end:now+86400000},b:{memberId:'person',status:'active',start:now+86400000,end:now+172800000}};});
 const g=guild(),assigned=new Map(),events=[];const member={roles:{cache:assigned,add:async id=>{assigned.set(id,true);events.push('add');},remove:async id=>{assigned.delete(id);events.push('remove');}}};
 g.roles.fetch=async()=>({editable:true,members:new Map()});g.members={fetch:async()=>member};
 const sync=require('../systems/qgSchoolFamily').syncAbsenceRoles;await sync(g);await sync(g);assert.deepEqual(events,['add']);storage.update('qgServer',s=>{s.schoolAbsences.a.status='cancelled';});await sync(g);assert.deepEqual(events,['add','remove']);
});
test('AI decision parsing rejects invalid output and a transfer without reason',()=>{
 const parse=require('../systems/qgTicketAssistant').parse;
 assert.throws(()=>parse('hello'));assert.throws(()=>parse('{"answer":"oui","decision":"escalate","reason":""}'));
 assert.equal(parse('{"answer":"Clique sur le bouton","decision":"answer","reason":""}').decision,'answer');
});
test('arrival card generates a PNG locally without network',async()=>{
 const png=await require('../utils/qgArrivalCard').render({displayName:'Aven',user:{username:'Aven'}},{avatar:false});assert.equal(png.subarray(1,4).toString(),'PNG');assert.ok(png.length>10000);
});
test('ticket categories and absent role are reused on a second update',async()=>{
 reset();storage.update('qgServer',s=>{delete s.schoolRoles.absent;});const g=guild(),all=new Collection();let categories=0,roles=0;
 g.members={fetchMe:async()=>({permissions:{has:()=>true}})};
 g.channels={cache:all,fetch:async()=>all,create:async options=>{const ch={...options,id:`category-${++categories}`,setPosition:async()=>{}};all.set(ch.id,ch);return ch;}};
 g.roles.create=async options=>{const role={...options,id:'new-absent',permissions:{bitfield:0n}};g.roles.cache.set(role.id,role);roles++;return role;};
 await routing.ensure(g);await routing.ensure(g);assert.equal(categories,3);assert.equal(roles,1);assert.equal(storage.read('qgServer').schoolRoles.absent,'new-absent');
});
