const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const store=require('../utils/recruitmentData');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-referent-'));store.setDataDirectory(dir);after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const {Collection,PermissionFlagsBits:P}=require('discord.js');
const config=require('../config/qg'),R=require('../systems/qgReferent');
const REF='100000000000000001',MEMBER='100000000000000002',BOT='100000000000000003',VOC_A='200000000000000001',VOC_B='200000000000000002';
let guild,members,channels,sent,moves;
function overwrites(entries){const cache=new Map(entries.map(([id,allow])=>[id,{allow:{bitfield:allow},deny:{bitfield:0n}}]));return{cache,create:async(id,opts)=>{let bits=0n;for(const [k,v] of Object.entries(opts))if(v)bits|=P[k];cache.set(id,{allow:{bitfield:bits},deny:{bitfield:0n}});}};}
function member(id,roles,voice=null){return{id,user:{id,bot:id===BOT,tag:'u'+id},displayName:'m'+id,roles:{cache:new Map(roles.map(r=>[r,{}]))},voice:{channelId:voice,setChannel:async to=>{moves.push([id,to]);members.get(id).voice.channelId=to;}},send:async p=>{sent.push({dm:id,p});return{id:'dm'};}};}
function voiceChannel(id){return{id,isVoiceBased:()=>true,isTextBased:()=>false,permissionsFor:()=>({has:()=>true}),permissionOverwrites:overwrites([])};}
function textChannel(id){return{id,isTextBased:()=>true,messages:{fetch:async q=>typeof q==='object'?new Collection():null},send:async p=>{sent.push({channel:id,p});return{id:'m'+sent.length};}};}
function interaction(customId,{values=[],fields={}}={}){const i={customId,guildId:config.guildId,guild,user:{id:REF},values,fields:{getTextInputValue:k=>fields[k]??''},deferReply:async()=>{},editReply:async p=>{i.reply=p;return p;},showModal:async m=>{i.modal=m.toJSON();}};return i;}
beforeEach(()=>{fs.writeFileSync(path.join(dir,'qgServer.json'),'{}');sent=[];moves=[];
 members=new Map([[REF,member(REF,[R.ROLE_ID],VOC_A)],[MEMBER,member(MEMBER,['family'],VOC_B)],[BOT,member(BOT,[])]]);
 channels=new Map([[VOC_A,voiceChannel(VOC_A)],[VOC_B,voiceChannel(VOC_B)],[R.NOTES_CHANNEL,textChannel(R.NOTES_CHANNEL)]]);
 guild={id:config.guildId,ownerId:'owner',client:{user:{id:BOT}},members:{fetch:async q=>{const id=typeof q==='string'?q:q.user;if(!members.has(id))throw Object.assign(Error('missing'),{code:10007});return members.get(id);},fetchMe:async()=>members.get(BOT)},channels:{cache:new Collection(),fetch:async id=>id?channels.get(id):null}};
 for(const m of members.values())m.guild=guild;
});
test('accès : reprend les accès des rôles modèles, sans droits de gestion, idempotent',async()=>{
 const cat={id:R.CATEGORY_IDS.family[1],parentId:null,permissionOverwrites:overwrites([['1561363081018474626',P.ViewChannel|P.Connect|P.ManageMessages]])};
 const child={id:'300',parentId:cat.id,permissionOverwrites:overwrites([['1561157112036597880',P.ViewChannel|P.SendMessages|P.ManageChannels]])};
 guild.channels.cache=new Collection([[cat.id,cat],[child.id,child]]);guild.channels.fetch=async()=>guild.channels.cache;
 assert.equal(await R.ensureAccess(guild),2);
 const c=cat.permissionOverwrites.cache.get(R.ROLE_ID).allow.bitfield,k=child.permissionOverwrites.cache.get(R.ROLE_ID).allow.bitfield;
 assert.ok(c&P.ViewChannel&&c&P.Connect);assert.equal(c&P.ManageMessages,0n);
 assert.ok(k&P.SendMessages);assert.equal(k&P.ManageChannels,0n);
 assert.equal(await R.ensureAccess(guild),0,'deuxième passage sans changement');
});
test('panel : un menu de membre, réservé au rôle',async()=>{
 const p=R.panel();assert.equal(p.components[0].toJSON().components[0].custom_id,'qgref:pick');
 members.get(REF).roles.cache.clear();await assert.rejects(R.handle(interaction('qgref:pick',{values:[MEMBER]})),/Réservé/);
});
test('bring puis back : déplace dans le vocal de la référente puis revient',async()=>{
 const pick=interaction('qgref:pick',{values:[MEMBER]});await R.handle(pick);
 const id=pick.reply.components[0].toJSON().components[2].custom_id.split(':')[2];
 assert.equal(pick.reply.components[0].toJSON().components[3].disabled,true,'back désactivé sans bring');
 const bring=interaction('qgref:bring:'+id);await R.handle(bring);assert.deepEqual(moves.at(-1),[MEMBER,VOC_A]);
 const back=interaction('qgref:back:'+id);await R.handle(back);assert.deepEqual(moves.at(-1),[MEMBER,VOC_B]);
 await assert.rejects(R.handle(interaction('qgref:back:'+id)),/Aucun vocal précédent/);
});
test('note : enregistrée et transmise dans le salon de suivi ; convocation envoyée en MP',async()=>{
 const pick=interaction('qgref:pick',{values:[MEMBER]});await R.handle(pick);const id=pick.reply.components[0].toJSON().components[0].custom_id.split(':')[2];
 const open=interaction('qgref:note:'+id);await R.handle(open);assert.equal(open.modal.custom_id,'qgref:notesave:'+id);
 await R.handle(interaction('qgref:notesave:'+id,{fields:{category:'activité',text:'Peu présent cette semaine'}}));
 const note=Object.values(store.read('qgServer').schoolNotes)[0];assert.equal(note.category,'Activité');assert.equal(note.authorId,REF);assert.equal(note.targetId,MEMBER);
 const delivered=sent.find(x=>x.channel===R.NOTES_CHANNEL);assert.match(delivered.p.embeds[0].data.description,/Peu présent cette semaine/);
 await assert.rejects(R.handle(interaction('qgref:convokesave:'+id,{fields:{date:'01/01/2020 10:00'}})),/date future/);
 await R.handle(interaction('qgref:convokesave:'+id,{fields:{date:'01/01/2030 20:00',reason:'Point activité'}}));
 assert.ok(sent.some(x=>x.dm===MEMBER));assert.equal(store.read('qgServer').schoolConvocations[0].source,'referent');
});
