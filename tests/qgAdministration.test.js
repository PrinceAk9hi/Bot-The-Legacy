const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Collection,PermissionFlagsBits:P}=require('discord.js');
const storage=require('../utils/recruitmentData'),config=require('../config/qg');
const a=require('../utils/qgAdmin'),panel=require('../systems/qgUserPanel'),rp=require('../systems/qgRpStatus'),cd=require('../systems/qgRecruitmentControl');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-admin-'));storage.setDataDirectory(dir);test.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
function role(id,position){return{id,name:id,position,managed:false,editable:true,permissions:{bitfield:0n},comparePositionTo(other){return this.position-other.position;}};}
function mock(){
 storage.update('qgServer',s=>{for(const k of Object.keys(s))delete s[k];s.schoolRoles={creator:'creator',administrator:'admin',test:'test',confirmed:'confirmed',expert:'expert',prestigious:'prestigious',senior:'senior',ticketsLead:'support-lead',ticketsManagement:'support',recruitmentLead:'recruit-lead',recruitmentManagement:'recruit',animationLead:'animation-lead',animationManagement:'animation',networksLead:'networks-lead',networksManagement:'networks',dividerFamily:'divider-family',dividerManagement:'divider-management',dividerResponsibles:'divider-leads'};s.schoolChannels={logsBot:'logs',logsMembers:'logs',logsModeration:'logs',familyApplications:'applications'};});
 const roles=new Collection();for(const [id,n]of [['bot',100],['actor',80],['admin',75],['creator',90],['recruit-lead',65],['support-lead',64],['animation-lead',63],['networks-lead',62],['support',30],['recruit',29],['animation',28],['networks',27],['test',10],['confirmed',11],['expert',12],['prestigious',13],['senior',14],['divider-family',5],['divider-management',6],['divider-leads',7]])roles.set(id,role(id,n));
 const guild={id:config.guildId,ownerId:'owner',client:{user:{id:'bot'}},roles:{cache:roles,fetch:async id=>id?roles.get(id):roles,create:async data=>{const r=role('rp-'+data.name,15);r.name=data.name;roles.set(r.id,r);return r;}}};
 const members=new Collection();
 function member(id,ids){const cache=new Collection(ids.map(k=>[k,roles.get(k)]));const m={id,guild,displayName:id,joinedTimestamp:100000,user:{id,username:id,bot:id==='bot',createdTimestamp:1000,displayAvatarURL:()=> 'https://cdn.discordapp.com/embed/avatars/0.png'},permissions:{has:p=>id==='bot'||p===P.Administrator&&m.admin===true},voice:{channelId:null},roles:{cache,get highest(){return [...cache.values()].sort((x,y)=>y.position-x.position)[0]||role('everyone',0);},add:async value=>{for(const id of Array.isArray(value)?value:[value])cache.set(id,roles.get(id));},remove:async value=>{for(const id of Array.isArray(value)?value:[value])cache.delete(id);}}};members.set(id,m);return m;}
 const bot=member('bot',['bot']),actor=member('staff',['actor','admin']),target=member('target',['confirmed']);
 guild.members={me:bot,cache:members,fetchMe:async()=>bot,fetch:async value=>{if(!value)return members;const id=typeof value==='object'?value.user:value;const m=members.get(id);if(!m)throw Object.assign(Error('missing'),{code:10007});return m;}};
 const channels=new Collection();let sends=[];
 function channel(id,parentId=null){const cache=new Collection();const ch={id,name:id,guild,guildId:guild.id,parentId,isThread:()=>false,isTextBased:()=>true,permissionsFor:()=>({has:()=>!ch.fail}),messages:{fetch:async value=>typeof value==='object'?new Collection():Promise.reject(Object.assign(Error('missing'),{code:10008}))},send:async payload=>{sends.push(payload);return{id:'sent',author:{id:'bot'},edit:async()=>{}};},permissionOverwrites:{cache,edit:async(id,patch)=>{if(ch.fail)throw Error('permission');let allow=cache.get(id)?.allow.bitfield||0n,deny=cache.get(id)?.deny.bitfield||0n;for(const [k,v]of Object.entries(patch)){const bit=P[k];allow&=~bit;deny&=~bit;if(v===true)allow|=bit;if(v===false)deny|=bit;}cache.set(id,{id,allow:{bitfield:allow},deny:{bitfield:deny}});},delete:async id=>cache.delete(id)}};channels.set(id,ch);return ch;}
 channel('logs');channel('applications');channel('chat');channel('voice');guild.channels={cache:channels,fetch:async id=>id?channels.get(id):channels};
 return{guild,actor,target,bot,member,channel,channels,sends};
}
function interaction(m,id='session'){return{guild:m.guild,guildId:m.guild.id,user:{id:m.actor.id},customId:'qgu:confirm:'+id,editReply:async p=>p};}
function session(m,p,id='session'){const nonce='nonce';a.save(s=>{s.schoolUserSessions||={};s.schoolUserSessions[id]={actorId:m.actor.id,targetId:m.target.id,guildId:m.guild.id,expiresAt:Date.now()+600000,pending:{...p,nonce,fingerprint:panel.fingerprint(m.target)}};});return nonce;}
test('new prison channel failures are retried without losing original permissions',async()=>{
 const m=mock();await rp.apply(m.target,'prison',m.actor,'test');
 const ch=m.channel('new-retry');ch.fail=true;await rp.reconcile(m.guild);
 assert.ok(rp.status(m.target.id).prison.pendingChannels.includes(ch.id));
 ch.fail=false;await rp.reconcile(m.guild);
 assert.equal(ch.permissionOverwrites.cache.get(m.target.id).deny.bitfield & P.SendMessages,P.SendMessages);
 assert.deepEqual(rp.status(m.target.id).prison.pendingChannels,[]);
 await rp.release(m.target,'prison');assert.equal(ch.permissionOverwrites.cache.has(m.target.id),false);
});
test('/cd off/on persists and updates the actual GIF panel without deleting existing applications',async()=>{
 const m=mock();a.save(s=>{s.schoolFamilyRecruitment={a:{status:'in_progress'},b:{status:'submitted'}};});
 await cd.change(m.guild,m.actor.id,false);assert.equal(cd.status().open,false);assert.equal(a.state().schoolFamilyRecruitment.a.status,'in_progress');let payload=require('../systems/qgSchoolSetup').panelPayload('familyApplications',m.guild);assert.equal(payload.components[0].components[0].data.disabled,true);assert.match(payload.embeds[0].data.description,/Candidatures fermées/);
 delete require.cache[require.resolve('../systems/qgRecruitmentControl')];assert.equal(require('../systems/qgRecruitmentControl').status().open,false);
 await cd.change(m.guild,m.actor.id,true);assert.equal(cd.status().open,true);assert.equal(a.state().schoolAdminHistory.length,2);assert.ok(m.sends.length>=2);
});
test('/cd status reports actual pending/in-progress counts and rejects ordinary members',async()=>{
 const m=mock();a.save(s=>{s.schoolFamilyRecruitment={a:{status:'in_progress'},b:{status:'submitted'},c:{status:'accept'}};});let out;
 await cd.execute({...interaction(m),options:{getSubcommand:()=> 'statut'},deferReply:async()=>{},editReply:async p=>{out=p;}});assert.match(out.embeds[0].data.description,/Questionnaires en cours : \*\*1\*\*/);assert.match(out.embeds[0].data.description,/Dossiers à traiter : \*\*1\*\*/);assert.equal(a.can(m.target,'cd'),false);
});
test('closed recruitment blocks a fresh applicant, ongoing MP questionnaire remains usable',async()=>{
 const m=mock();a.save(s=>{s.schoolRecruitmentControl={open:false};s.schoolRoles.community='community';s.schoolEntryVerification={new:{stage:'accepted',acceptedAt:Date.now(),confirmedAt:Date.now(),robloxId:'123456'}};});m.guild.roles.cache.set('community',role('community',1));const candidate=m.member('new',['community']);const responses=[];
 await require('../systems/qgSchoolApplications').beginFamilyRecruitment({guildId:m.guild.id,user:{id:'new'},client:{guilds:{fetch:async()=>m.guild}},deferReply:async()=>{},editReply:async p=>responses.push(p)});assert.equal(responses[0],cd.CLOSED);
 a.save(s=>{s.schoolFamilyRecruitment={new:{status:'in_progress',step:0,answers:[],guildId:m.guild.id}};});
 await require('../systems/qgSchoolApplications').directMessage({guildId:null,author:{id:'new',bot:false},content:'PseudoRoblox',reply:async()=>{},client:{guilds:{fetch:async()=>m.guild}}});assert.equal(a.state().schoolFamilyRecruitment.new.step,1);
});
test('/user opens a bound private profile and does not mutate roles',async()=>{
 const m=mock();let out;await panel.execute({...interaction(m),options:{getUser:()=>m.target.user},deferReply:async()=>{},editReply:async p=>{out=p;}});assert.ok(m.target.roles.cache.has('confirmed'));const rendered=JSON.stringify(out.components[0].toJSON());assert.match(rendered,/Panel membre/);assert.match(rendered,/qgu:tab:/);assert.match(rendered,/Profil candidat/);
});
test('rankup and derank select adjacent grade; targeted demotion cannot promote',async()=>{
 const m=mock();let p=panel.plan(m.actor,m.target,'rankup');await panel.confirm(interaction(m),'session',session(m,p));assert.ok(m.target.roles.cache.has('expert'));assert.equal(m.target.roles.cache.has('confirmed'),false);assert.ok(m.target.roles.cache.has('divider-family'));
 p=panel.plan(m.actor,m.target,'derank');await panel.confirm(interaction(m),'session',session(m,p));assert.ok(m.target.roles.cache.has('confirmed'));
 p=panel.plan(m.actor,m.target,'demote','test','Motif validé');await panel.confirm(interaction(m),'session',session(m,p));assert.ok(m.target.roles.cache.has('test'));assert.throws(()=>panel.plan(m.actor,m.target,'derank'));assert.throws(()=>panel.plan(m.actor,m.target,'demote','senior','motif'));
});
test('maximum grade, actor hierarchy, bot hierarchy and owner protection are enforced',()=>{
 const m=mock(),senior=m.member('senior-person',['senior']),owner=m.member('owner',['creator']);assert.throws(()=>panel.plan(m.actor,senior,'rankup'));assert.throws(()=>a.hierarchy(m.actor,owner,m.bot));assert.throws(()=>a.hierarchy(m.target,m.actor,m.bot));assert.throws(()=>a.hierarchy(m.actor,m.target,m.target));assert.throws(()=>a.hierarchy(m.actor,m.actor,m.bot));
});
test('confirmation is one-shot and rejects changed roles or another clicking user',async()=>{
 const m=mock(),p=panel.plan(m.actor,m.target,'rankup'),nonce=session(m,p);await panel.confirm(interaction(m),'session',nonce);await assert.rejects(()=>panel.confirm(interaction(m),'session',nonce));assert.throws(()=>panel.session({...interaction(m),user:{id:'target'}},'session'));
 session(m,p);await m.target.roles.add('support');await assert.rejects(()=>panel.confirm(interaction(m),'session','nonce'),/changé/);
});
test('prison blocks writing and voice then restores only owned permission changes',async()=>{
 const m=mock(),chat=m.channels.get('chat');await chat.permissionOverwrites.edit('target',{AddReactions:false,ViewChannel:true});
 await rp.apply(m.target,'prison',m.actor,'Test RP',1);assert.ok(rp.status('target').prison.expiresAt);assert.ok(chat.permissionOverwrites.cache.get('target').deny.bitfield&P.SendMessages);assert.ok(chat.permissionOverwrites.cache.get('target').deny.bitfield&P.Connect);
 // Independent staff edit is not reverted by liberation.
 await chat.permissionOverwrites.edit('target',{Speak:true,AttachFiles:false});
 await rp.release(m.target,'prison');const after=chat.permissionOverwrites.cache.get('target');assert.equal(after.deny.bitfield&P.SendMessages,0n);assert.ok(after.deny.bitfield&P.AddReactions);assert.ok(after.deny.bitfield&P.AttachFiles);assert.ok(after.allow.bitfield&P.Speak);assert.ok(after.allow.bitfield&P.ViewChannel);assert.equal(rp.status('target').prison,undefined);
});
test('RP handcuffs and dog are independent, persistent and do not change channel permissions',async()=>{
 const m=mock();await rp.apply(m.target,'handcuffs',m.actor,'Jeu RP');await rp.apply(m.target,'dog',m.actor,'Jeu RP');assert.ok(rp.status('target').handcuffs);assert.ok(rp.status('target').dog);assert.equal(m.channels.get('chat').permissionOverwrites.cache.size,0);await rp.release(m.target,'handcuffs');assert.ok(rp.status('target').dog);await rp.release(m.target,'dog');assert.deepEqual(rp.status('target'),{});
});
test('timed prison expires after restart and new channels inherit the active restriction',async()=>{
 const m=mock();await rp.apply(m.target,'prison',m.actor,'Jeu RP',1);const added=m.channel('new');await rp.reconcile(m.guild);assert.ok(added.permissionOverwrites.cache.get('target').deny.bitfield&P.SendMessages);a.save(s=>{s.schoolRpStatus.target.prison.expiresAt=1;});await rp.reconcile(m.guild);assert.equal(rp.status('target').prison,undefined);assert.equal(a.state().schoolAdminHistory.at(-1).action,'rp.expire.prison');
});
test('prison preflight refuses missing permission and administrators without partial action',async()=>{
 const m=mock();m.channels.get('chat').fail=true;await assert.rejects(()=>rp.apply(m.target,'prison',m.actor,'test'));assert.equal(rp.status('target').prison,undefined);m.channels.get('chat').fail=false;m.target.admin=true;await assert.rejects(()=>rp.apply(m.target,'prison',m.actor,'test'),/administrateur/);
});
test('management additions synchronize separators; only direction can appoint leads',async()=>{
 const m=mock(),lead=m.member('lead',['support-lead']);assert.equal(a.can(lead,'management','ticketsManagement'),true);assert.equal(a.can(lead,'management','animationManagement'),false);assert.equal(a.can(lead,'responsibility'),false);
 let p=panel.plan(m.actor,m.target,'management','add.ticketsManagement');await panel.confirm(interaction(m),'session',session(m,p));assert.ok(m.target.roles.cache.has('support'));assert.ok(m.target.roles.cache.has('divider-management'));
 p=panel.plan(m.actor,m.target,'responsibility','add.ticketsManagement');await panel.confirm(interaction(m),'session',session(m,p));assert.ok(m.target.roles.cache.has('support-lead'));assert.ok(m.target.roles.cache.has('divider-leads'));
});
test('private applications are filtered by team; statistics do not invent vocal time',async()=>{
 const m=mock(),support=m.member('support-staff',['support']);a.save(s=>{s.schoolFamilyRecruitment={target:{status:'submitted',createdAt:1}};s.schoolManagementApplications={target:{animationManagement:{status:'submitted'},ticketsManagement:{status:'submitted'}}};});assert.equal(panel.applications(support,m.target).length,1);assert.equal(panel.applications(m.actor,m.target).length,3);
 session(m,panel.plan(m.actor,m.target,'rankup'));const out=await panel.stats(interaction(m),'session');assert.match(out.embeds[0].data.description,/non mesuré/);
});
test('Discord role failures are logged and do not claim success',async()=>{
 const m=mock();m.target.roles.add=async()=>{throw Object.assign(Error('denied'),{code:50013});};const p=panel.plan(m.actor,m.target,'rankup');await assert.rejects(()=>panel.confirm(interaction(m),'session',session(m,p)));assert.equal(a.state().schoolAdminHistory.at(-1).result,'failed');assert.ok(m.target.roles.cache.has('confirmed'));
});
test('AI sends plain text and retains current QG recruitment conditions',async()=>{
 const messages=[];await require('../systems/qgTicketAssistant').sendText({send:async p=>{messages.push(p);return{id:'answer'};}},'Bonjour, bienvenue au QG.');assert.equal(messages[0].embeds,undefined);assert.equal(messages[0].content,'Bonjour, bienvenue au QG.');const family=require('../config/qgFamily');assert.match(family.conditions,/16 ans minimum/);assert.match(family.conditions,/Tag QG obligatoire/);
});
