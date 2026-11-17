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
