const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const data=require('../utils/recruitmentData'),a=require('../utils/qgAdmin'),config=require('../config/qg'),{Collection,PermissionFlagsBits:P,PermissionsBitField,ChannelType:T}=require('discord.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-perms-'));data.setDataDirectory(dir);
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
beforeEach(()=>{for(const f of fs.readdirSync(dir))fs.rmSync(path.join(dir,f),{force:true});});
const apps=require('../systems/qgSchoolApplications'),status=require('../systems/qgVoiceStatus');

test('candidature de gestion : salon des responsables, ping du responsable, sans accès du candidat',async()=>{
 a.save(s=>{s.schoolRoles={rpManagement:'exec-rp',rpLead:'resp-rp',confirmed:'conf'};});
 const sent=[],created=[];
 const ch={id:apps.MANAGEMENT_CHANNEL,isTextBased:()=>true,send:async p=>{sent.push(p);return{id:'msg1'};}};
 const applicant={id:'cand',roles:{cache:new Map([['conf',{}]])}};
 const guild={id:config.guildId,channels:{fetch:async id=>id===apps.MANAGEMENT_CHANNEL?ch:null,create:async o=>{created.push(o);return{};}},members:{fetch:async()=>applicant}};
 const replies=[];
 const i={deferred:true,user:{id:'cand',username:'cand'},client:{guilds:{fetch:async()=>guild},user:{id:'bot'}},fields:{getTextInputValue:k=>'Réponse '+k},editReply:async p=>replies.push(p)};
 await apps._test.submitManagement(i,'rpManagement');
 assert.equal(created.length,0,'plus de salon privé créé (le candidat n’a aucun accès)');
 assert.equal(sent[0].content,'<@&resp-rp>');assert.deepEqual(sent[0].allowedMentions,{parse:[],roles:['resp-rp']});
 const ids=sent[0].components[0].toJSON().components.map(c=>c.custom_id);
 assert.deepEqual(ids,['qgs:management-decision:rpManagement:cand:accept','qgs:management-decision:rpManagement:cand:refuse']);
 const app=a.state().schoolManagementApplications.cand.rpManagement;
 assert.equal(app.channelId,apps.MANAGEMENT_CHANNEL);assert.equal(app.messageId,'msg1');assert.equal(app.status,'submitted');
 // Après décision : fiche verte, boutons désactivés.
 const done=apps._test.managementPayload({...app,status:'accept',updatedBy:'resp',updatedAt:Date.now()});
 assert.equal(done.embeds[0].toJSON().color,0x2ecc71);assert.ok(done.components[0].toJSON().components.every(c=>c.disabled));
 assert.equal(done.content,null);
});

test('candidature de gestion acceptée : annonce dans 1561157222032212059 avec le responsable à contacter',async()=>{
 a.save(s=>{s.schoolRoles={rpManagement:'exec-rp',rpLead:'resp-rp',confirmed:'conf'};s.schoolManagementApplications={cand:{rpManagement:{applicantId:'cand',team:'rpManagement',status:'submitted',channelId:apps.MANAGEMENT_CHANNEL,messageId:'msg1',fields:[]}}};});
 const news=[],edits=[],added=[];
 const role=id=>({id,toString:()=>id});
 const cand={id:'cand',user:{bot:false},roles:{cache:new Map([['conf',{}]]),add:async r=>added.push(r)},guild:{ownerId:'x'}};
 const resp={id:'resp',user:{bot:false},roles:{cache:new Map([['resp-rp',{}]]),highest:{comparePositionTo:()=>1}},guild:{id:config.guildId,ownerId:'x'}};
 const members=new Collection([['cand',cand],['resp',resp]]);
 const guild={id:config.guildId,ownerId:'x',members:{cache:members,fetch:async x=>x===undefined?members:members.get(typeof x==='string'?x:x.user),fetchMe:async()=>({permissions:{has:()=>true},roles:{highest:{comparePositionTo:()=>1}}})},roles:{fetch:async id=>role(id)},
  channels:{fetch:async id=>id==='1561157222032212059'?{send:async p=>news.push(p)}:null}};
 const orig=a.hierarchy;a.hierarchy=()=>{};
 try{
  await apps._test.decisionInternal({customId:'qgs:management-decision:rpManagement:cand:accept',guild,channelId:apps.MANAGEMENT_CHANNEL,message:{id:'msg1'},user:{id:'resp'},client:{users:{fetch:async()=>({send:async()=>{}})}},editReply:async p=>edits.push(p),followUp:async p=>{throw Error(p.content);}});
 }finally{a.hierarchy=orig;}
 assert.deepEqual(added,['exec-rp']);
 assert.equal(a.state().schoolManagementApplications.cand.rpManagement.status,'accept');
 assert.match(news[0].embeds[0].data.description,/Conviens d’un horaire avec <@resp>/);
 assert.deepEqual(news[0].allowedMentions.users,['cand','resp']);
 assert.equal(edits[0].embeds[0].toJSON().color,0x2ecc71);
});

function voiceChannel(name,overwrites){
 const cache=new Collection(overwrites.map(([id,type,allow,deny])=>[id,{id,type,allow:new PermissionsBitField(allow),deny:new PermissionsBitField(deny)}]));
 return{name,type:T.GuildVoice,guild:{id:'g'},client:{user:{id:'bot'}},permissionOverwrites:{cache}};
}
test('statut vocal : retiré partout sauf Direction et Responsables ; autorisé dans les bureaux',()=>{
 const allowed=new Set(['dir','resp']);
 const normal=voiceChannel('🔊・Général',[['g',0,P.SetVoiceChannelStatus,0n],['membre',0,P.SetVoiceChannelStatus|P.Connect,0n],['resp',0,0n,P.SetVoiceChannelStatus],['dir',0,P.SetVoiceChannelStatus,0n],['bot',1,P.SetVoiceChannelStatus,0n]]);
 assert.deepEqual(status._test.channelPlan(normal,allowed),[['g',null],['membre',null],['resp',null]]);
 const office=voiceChannel('🔊・Bureau Entretien 01',[['g',0,0n,P.ViewChannel],['membre',0,0n,P.SetVoiceChannelStatus]]);
 assert.ok(status._test.bureau(office));
 assert.deepEqual(status._test.channelPlan(office,allowed),[['g',true],['membre',null]]);
 const ok=voiceChannel('🔊・Bureau Aven',[['g',0,P.SetVoiceChannelStatus,0n]]);
 assert.deepEqual(status._test.channelPlan(ok,allowed),[]);
});

test('réglages manuels conservés : maintenance par séparateurs coupée une seule fois',()=>{
 a.save(s=>{s.schoolSeparatorPermissions={enabled:true};});
 assert.equal(status.preserve(),true);assert.equal(a.state().schoolSeparatorPermissions.enabled,false);
 a.save(s=>{s.schoolSeparatorPermissions.enabled=true;});
 assert.equal(status.preserve(),false);assert.equal(a.state().schoolSeparatorPermissions.enabled,true,'réactivable ensuite volontairement');
});

test('casino ouvert / fermé : seules les permissions qui changent sont modifiées, le reste réglé à la main reste',async()=>{
 const {toggle}=require('../systems/qgCasino')._test,edits=[];
 const ch={permissionOverwrites:{edit:async(id,p)=>edits.push([id,p])}};
 const open=[{id:'g',deny:[P.ViewChannel]},{id:'joueurs',allow:[P.ViewChannel,P.ReadMessageHistory],deny:[P.MentionEveryone]}];
 const closed=[{id:'g',deny:[P.ViewChannel]},{id:'joueurs',deny:[P.ViewChannel,P.Connect,P.MentionEveryone]}];
 await toggle(ch,open,closed,true,'Casino fermé');
 assert.deepEqual(edits,[['joueurs',{ViewChannel:false,ReadMessageHistory:null,Connect:false}]]);
 edits.length=0;await toggle(ch,open,closed,false,'Casino ouvert');
 assert.deepEqual(edits,[['joueurs',{ViewChannel:true,ReadMessageHistory:true,Connect:null}]]);
});

test('salon rank-up : rankup, derank de réunion et avertissements annoncés, sans motif',async()=>{
 const ann=require('../systems/qgRankAnnounce'),sent=[];
 a.save(s=>{s.schoolChannels={rankUp:'rk'};s.schoolRoles={expert:'r-exp'};});
 const member={id:'m1',roles:{cache:new Map([['r-exp',{}]])}};
 const guild={id:config.guildId,members:{fetch:async()=>member},channels:{fetch:async id=>id==='rk'?{isTextBased:()=>true,send:async p=>sent.push(p)}:null}};
 const base={result:'success',targetId:'m1',actorId:'chef',at:1,reason:'Motif privé'};
 assert.equal(await ann.fromAudit(guild,{...base,action:'rankup',before:'test',after:{grade:'confirmed'}}),true);
 assert.match(sent[0].embeds[0].data.description,/<@m1> passe \*\*Membre Confirmé\*\*\.$/);assert.equal(sent[0].content,'<@m1>');
 assert.equal(await ann.fromAudit(guild,{...base,action:'meeting.derank',after:{meetingId:'x'}}),true);
 assert.match(sent[1].embeds[0].data.title,/Derank/);assert.match(sent[1].embeds[0].data.description,/Membre Expert\*\* · décidé en réunion/);
 assert.equal(await ann.fromAudit(guild,{...base,action:'discipline',before:0,after:1}),true);
 assert.match(sent[2].embeds[0].data.description,/reçoit \*\*Avertissement 1\*\*/);
 assert.equal(await ann.fromAudit(guild,{...base,action:'discipline',before:2,after:0}),true);
 assert.match(sent[3].embeds[0].data.title,/levé/);
 // Ignorés : avertissement de réunion (déjà annoncé par la sanction), échec, autre action.
 for(const e of [{...base,action:'meeting.warn'},{...base,action:'rankup',result:'failed'},{...base,action:'note.add'}])assert.equal(await ann.fromAudit(guild,e),false);
 assert.ok(sent.every(p=>!JSON.stringify(p).includes('Motif privé')));
});

test('rattrapage rank-up : décisions de la dernière réunion, avec sa date, une seule fois',async()=>{
 const ann=require('../systems/qgRankAnnounce'),sent=[],start=Date.UTC(2026,10,10,19);
 a.save(s=>{s.schoolChannels={rankUp:'rk'};s.schoolRoles={};
  s.schoolMeetings={old:{id:'old',status:'finished',start:start-30*86400000,actions:{z:{action:'rankup'}},results:{z:{status:'done'}}},
   m1:{id:'m1',name:'Réunion',status:'finished',start,actions:{a1:{action:'rankup'},a2:{action:'warn'},a3:{action:'derank',choice:'test'},a4:{action:'rankup'}},results:{a1:{status:'done'},a2:{status:'done'},a3:{status:'done'},a4:{status:'blocked'}}}};
  s.schoolAdminHistory=[{action:'meeting.rankup',targetId:'a1',result:'success',after:{meetingId:'m1',grade:'expert'}}];
  s.discipline={cases:{c:{sourceKey:'meeting:m1:a2',level:1,before:0}}};});
 const guild={id:config.guildId,members:{fetch:async()=>null},channels:{fetch:async id=>id==='rk'?{isTextBased:()=>true,send:async p=>sent.push(p)}:null}};
 assert.match((await ann.backfill(guild)).detail,/3 annonce/);
 const texts=sent.map(p=>p.embeds[0].data.description),date=`<t:${start/1000}:D>`;
 assert.deepEqual(texts,[`<@a1> passe **Membre Expert** · décidé en réunion du ${date}.`,`<@a2> reçoit **Avertissement 1** · décidé en réunion du ${date}.`,`<@a3> passe **Membre Test** · décidé en réunion du ${date}.`]);
 assert.equal(sent[0].embeds[0].data.timestamp,new Date(start).toISOString());
 assert.match((await ann.backfill(guild)).detail,/déjà fait/);assert.equal(sent.length,3);
});

test('effectif : date à laquelle le rôle a été mis (événement, journal d’audit), sinon arrivée',async()=>{
 const since=require('../systems/qgRoleSince'),upgrade=require('../systems/qgCommunityUpgrade');
 a.save(s=>{s.schoolRoles={test:'t',rpLead:'l'};s.schoolRoleSince={};delete s.schoolRoleSinceBackfill;});
 // Journal d'audit : du plus récent au plus ancien ; le plus récent ajout est gardé.
 const entry=(id,target,role,at)=>[id,{id,targetId:target,createdTimestamp:at,changes:[{key:'$add',new:[{id:role}]}]}];
 const pages=[new Collection([entry('3','B1','t',3000),entry('2','B1','t',2000),entry('1','B2','l',1000)])];
 const guild={id:config.guildId,fetchAuditLogs:async()=>({entries:pages.shift()||new Collection()})};
 assert.match((await since.backfill(guild)).detail,/2 reprise/);
 assert.equal(since.since('B1','t'),3000);assert.equal(since.since('B2','l'),1000);
 assert.match((await since.backfill(guild)).detail,/déjà/);
 // Nouvel ajout : date de l'événement.
 const old={roles:{cache:new Map()}},neu={id:'B3',guild:{id:config.guildId},roles:{cache:new Map([['t',{}]])}};
 assert.equal(since.record(old,neu,5000),1);assert.equal(since.since('B3','t'),5000);
 const m=(id,joined,...ids)=>({id,joinedTimestamp:joined,roles:{cache:new Collection(ids.map(x=>[x,{}]))}});
 const g={roles:{cache:new Collection([['t',{id:'t',name:'Membre Test'}],['l',{id:'l',name:'Responsable RP'}]])},emojis:{cache:new Collection()}};
 const parts=upgrade._test.fullRoster(g,[m('B1',9e12,'t'),m('B3',9e12,'t'),m('B4',7000,'t')],new Map(),{details:true});
 const lines=parts.find(p=>p.title.includes('Grades')).lines[0].split('\n').slice(1);
 assert.deepEqual(lines,['-# <@B1> - <t:3:d>','-# <@B3> - <t:5:d>','-# <@B4> - <t:7:d>']);
});

test('tranche d’âge : reprise de la dernière vérification quand la fiche actuelle l’a perdue',()=>{
 const {bracket}=require('../systems/qgAgeProfiles');
 a.save(s=>{s.schoolEntryVerification={x:{stage:'profile',resetAt:1},y:{ageBracket:'13'},z:{stage:'accepted'}};
  s.schoolVerificationHistory={'x:1':{userId:'x',acceptedAt:1,ageBracket:'13'},'x:2':{userId:'x',acceptedAt:2,ageBracket:'18'},'y:1':{userId:'y',acceptedAt:1,ageBracket:'18'}};
  s.schoolAgeProfiles={z:{ageBracket:'18'}};});
 assert.equal(bracket('x'),'18','la vérification la plus récente');
 assert.equal(bracket('y'),'13','la fiche actuelle passe en premier');
 assert.equal(bracket('z'),'18','ancien rôle de vérification');
 assert.equal(bracket('inconnu'),null);
});

test('panneaux : supprimé à la main → jamais republié ; panneau des notifications retiré → message supprimé',async()=>{
 const {panels}=require('../systems/qgMaintenance'),sent=[],deleted=[];
 a.save(s=>{s.schoolChannels={rules:'c1',notifications:'c2'};s.schoolPanels={rules:{channelId:'c1',messageId:'gone'},notifications:{channelId:'c2',messageId:'n1'}};});
 const notif={id:'n1',author:{id:'bot'},delete:async()=>deleted.push('n1')};
 const ch=id=>({id,guildId:config.guildId,isTextBased:()=>true,send:async p=>{sent.push(p);return{id:'new'};},messages:{fetch:async x=>{if(typeof x==='object')return new Collection();if(x==='n1')return notif;const e=Error('Unknown Message');e.code=10008;throw e;}}});
 const guild={id:config.guildId,client:{user:{id:'bot'}},channels:{fetch:async id=>ch(id)}};
 const r=await panels(guild);
 assert.equal(sent.length,0,'aucun panneau republié');
 assert.deepEqual(deleted,['n1']);
 assert.deepEqual(Object.keys(a.state().schoolPanels),[]);
 assert.equal(a.state().schoolPanelArchives.rules.reason,'Supprimé à la main');
 assert.ok(r.notices.some(n=>/supprimé à la main/.test(n)));
});

test('panel des gestions : rôle d’exécutant puis ses membres et les places libres',async()=>{
 const panels=require('../systems/qgPanels');
 a.save(s=>{s.schoolRoles={rpManagement:'exec-rp',rpLead:'resp-rp'};s.schoolRoleBadgeEmojis={};});
 const m=(id,...r)=>({id,user:{bot:false},roles:{cache:new Map(r.map(x=>[x,{}]))}});
 const members=new Collection([['m1',m('m1','exec-rp')],['chef',m('chef','exec-rp','resp-rp')]]);
 const guild={id:config.guildId,roles:{cache:new Collection([['exec-rp',{id:'exec-rp',icon:null}]])},emojis:{cache:new Collection()},members:{cache:members,fetch:async()=>members}};
 const p=await panels.management(guild);
 const rp=p.embeds[0].toJSON().fields.find(f=>f.name.includes('Exécutant du RP'));
 assert.match(rp.value,/<@&exec-rp>\n> -# <@m1>\n> -# Place libre$/);
 assert.ok(!rp.value.includes('<@chef>'),'le responsable n’occupe pas de place');
 assert.deepEqual(p.allowedMentions,{parse:[]});
});

test('maintenance : la présentation du QG (publiée par son module) n’est ni supprimée ni republiée',async()=>{
 const {panels}=require('../systems/qgMaintenance'),deleted=[],sent=[];
 a.save(s=>{s.schoolChannels={};s.schoolPanels={communityHelp:{channelId:'pres',messageId:'p1'}};});
 const msg={id:'p1',author:{id:'bot'},delete:async()=>deleted.push('p1'),edit:async()=>{}};
 const guild={id:config.guildId,client:{user:{id:'bot'}},channels:{fetch:async()=>({id:'pres',guildId:config.guildId,isTextBased:()=>true,send:async p=>sent.push(p),messages:{fetch:async()=>msg}})}};
 await panels(guild);
 assert.deepEqual(deleted,[]);assert.equal(sent.length,0);assert.ok(a.state().schoolPanels.communityHelp);
});

test('salons de réunion : déplacés dans la catégorie, Direction et rôle famille seulement, une fois',async()=>{
 const meetings=require('../systems/qgMeetings'),{PermissionFlagsBits:P2}=require('discord.js'),edits=[];
 a.save(s=>{s.schoolRoles={creator:'dir'};s.schoolChannels={meetingChat:'chat'};s.schoolMeetings={};delete s.schoolMeetingChannels;});
 const ch=id=>({id,edit:async o=>edits.push([id,o])});
 const guild={id:config.guildId,client:{user:{id:'bot'}},channels:{fetch:async id=>id===meetings.MEETING_CATEGORY?{id}:id==='1562077941469552680'?ch(id):id==='chat'?ch('chat'):null}};
 assert.match((await meetings.setupChannels(guild)).detail,/refaits/);
 assert.deepEqual(edits.map(e=>[e[0],e[1].parent]),[['1562077941469552680',meetings.MEETING_CATEGORY],['chat',meetings.MEETING_CATEGORY]]);
 const o=edits[0][1].permissionOverwrites,find=id=>o.find(x=>x.id===id);
 assert.deepEqual(find(config.guildId).deny,[P2.ViewChannel]);
 assert.ok(find('dir').allow.includes(P2.ViewChannel));assert.ok(find('1561363081018474626').deny.includes(P2.ViewChannel),'fermé hors réunion');
 assert.match((await meetings.setupChannels(guild)).detail,/déjà/);assert.equal(edits.length,2);
});

test('vocal temporaire : réglages appliqués sur le panel, menu unique des autorisations, nom en 🌲・',async()=>{
 const vc=require('../systems/qgVoiceControls');
 assert.equal(vc.voiceName('Salon de Sakura'),'🌲・Salon de Sakura');assert.equal(vc.voiceName('🌲・ Chill'),'🌲・Chill');assert.equal(vc.voiceName('🌲 Chill'),'🌲・Chill');
 a.save(s=>{s.schoolRoles={community:'comm'};s.schoolTemporaryVoices={v1:{ownerId:'own',kind:'community',locked:false,allowed:['old']}};});
 const overw=[],deleted=[];
 const room={id:'v1',userLimit:0,isVoiceBased:()=>true,permissionOverwrites:{cache:new Collection(),edit:async(id,p)=>overw.push(id),delete:async id=>deleted.push(id)},setName:async n=>{room.name=n;}};
 const mem=(id,roles=['comm'])=>({id,user:{bot:false,tag:id},guild:{id:config.guildId,ownerId:'x'},roles:{cache:new Map(roles.map(r=>[r,{}]))},voice:{channelId:'v1'}});
 const members={own:mem('own'),new1:mem('new1'),stranger:mem('stranger',[])};
 const guild={id:config.guildId,ownerId:'x',emojis:{cache:new Collection([['5',{id:'5',name:'padlock_crown',available:true}]])},roles:{cache:new Map()},channels:{fetch:async()=>room},members:{fetch:async x=>members[typeof x==='string'?x:x.user]}};
 const calls=[];
 const i=(customId,extra={})=>({customId,guildId:config.guildId,guild,user:{id:'own'},message:{id:'panel1'},deferUpdate:async()=>calls.push('deferUpdate'),deferReply:async()=>calls.push('deferReply'),editReply:async p=>calls.push(['edit',p]),followUp:async p=>calls.push(['followUp',p.content]),...extra});
 await vc.handle(i('qgs:voice:members:v1',{values:['new1','stranger']}));
 assert.ok(calls.includes('deferUpdate')&&!calls.includes('deferReply'),'pas de copie privée du panel');
 assert.deepEqual(overw,['new1']);assert.deepEqual(deleted,['old']);
 assert.deepEqual(a.state().schoolTemporaryVoices.v1.allowed,['new1']);assert.equal(a.state().schoolTemporaryVoices.v1.panelId,'panel1');
 assert.ok(calls.some(c=>c[0]==='followUp'&&/stranger/.test(c[1])));
 const panel=calls.find(c=>c[0]==='edit')[1],json=JSON.stringify(panel.components[0].toJSON());
 assert.ok(json.includes('<:padlock_crown:5>'));assert.match(json,/"default_values":\[\{"id":"new1","type":"user"\}\]/);
 await vc.handle(i('qgs:voice-form:rename:v1',{fields:{getTextInputValue:()=>'Chill'}}));assert.equal(room.name,'🌲・Chill');
});

test('appeler un gérant : notification dans gestion requête, réponses, abus = exclusion 6 h',async()=>{
 const vc=require('../systems/qgVoiceControls');
 a.save(s=>{s.schoolRoles={};s.schoolTemporaryVoices={v1:{ownerId:'own',kind:'community',locked:false,panelId:'p1'}};});
 const sent=[],panelEdits=[];let timeout=null;
 const req={id:vc.REQUEST_CHANNEL,isTextBased:()=>true,send:async p=>{sent.push(p);return{id:'n1'};}};
 const room={id:'v1',userLimit:0,isVoiceBased:()=>true,permissionOverwrites:{cache:new Collection()},messages:{fetch:async()=>({edit:async p=>panelEdits.push(p)})}};
 const member={id:'own',user:{bot:false,tag:'own'},guild:{id:config.guildId,ownerId:'x'},roles:{cache:new Map()},voice:{channelId:'v1'},moderatable:true,timeout:async ms=>{timeout=ms;}};
 const guild={id:config.guildId,ownerId:'x',client:{user:{id:'bot'}},emojis:{cache:new Collection()},roles:{cache:new Map()},channels:{fetch:async id=>id===vc.REQUEST_CHANNEL?req:room},members:{fetch:async()=>member}};
 const base={guildId:config.guildId,guild,user:{id:'own',tag:'own'},message:{id:'p1'},deferUpdate:async()=>{},editReply:async()=>{},followUp:async()=>{},reply:async()=>{}};
 await vc.handle({...base,customId:'qgs:voice-form:call:v1',fields:{getTextInputValue:()=>'Un membre crie'}});
 assert.match(sent[0].embeds[0].data.description,/<#v1>[\s\S]*<@own>[\s\S]*Un membre crie[\s\S]*En attente/);
 const edits=[];const ans=(op,uid)=>vc.handle({...base,user:{id:uid,tag:uid},customId:`qgs:vcall:${op}:v1`,editReply:async p=>edits.push(p)});
 await ans('busy','g1');await ans('eta10','g2');
 const call=a.state().schoolTemporaryVoices.v1.call;assert.equal(call.claimedBy,'g2');assert.equal(call.eta,10);assert.deepEqual(call.unavailable,['g1']);
 assert.match(edits.at(-1).embeds[0].data.description,/<@g2> arrive dans \*\*10 min\*\*[\s\S]*Pas disponible : <@g1>/);
 assert.match(JSON.stringify(panelEdits.at(-1).components[0].toJSON()),/<@g2> arrive dans \*\*10 min\*\*.*pas disponible : <@g1>/);
 // Deuxième appel trop tôt : refusé.
 const errors=[];await vc.handle({...base,customId:'qgs:voice-form:call:v1',fields:{getTextInputValue:()=>'Encore'},followUp:async p=>errors.push(p.content)});
 assert.match(errors[0],/moins de 10 minutes/);
 await ans('abuse','g2');assert.equal(timeout,6*3600000);assert.equal(a.state().schoolTemporaryVoices.v1.call.closed,'abuse');
 assert.ok(edits.at(-1).components[0].toJSON().components.every(c=>c.disabled));
});
