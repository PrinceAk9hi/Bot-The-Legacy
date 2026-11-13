const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const data=require('../utils/recruitmentData'),a=require('../utils/qgAdmin'),config=require('../config/qg'),{Collection}=require('discord.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-backup-'));data.setDataDirectory(dir);
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
beforeEach(()=>{fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir);});
const backup=require('../systems/qgBackup'),stats=require('../systems/qgRecruitmentStats');
const JOURNAL=require('../systems/qgDirectionJournal').CHANNEL;

test('sauvegarde : tous les .json (sous-dossiers compris), restauration à l’identique',()=>{
 data.update('qgServer',s=>{s.x=1;});fs.mkdirSync(path.join(dir,'qg-ai'));fs.writeFileSync(path.join(dir,'qg-ai','state.json'),'{"y":2}');
 fs.writeFileSync(path.join(dir,'son.mp3'),'binaire');fs.mkdirSync(path.join(dir,'.soul-migration-backups'));fs.writeFileSync(path.join(dir,'.soul-migration-backups','old.json'),'{}');
 const files=backup._test.collect(dir);
 assert.deepEqual(Object.keys(files).sort(),['qg-ai/state.json','qgServer.json']);
 const body=backup._test.unpack(backup._test.pack(files,123));
 assert.equal(body.createdAt,123);
 data.update('qgServer',s=>{s.x=99;});fs.writeFileSync(path.join(dir,'qg-ai','state.json'),'{"y":0}');
 assert.equal(backup._test.restoreFiles(body.files,dir),2);
 assert.equal(data.read('qgServer').x,1);assert.equal(fs.readFileSync(path.join(dir,'qg-ai','state.json'),'utf8'),'{"y":2}');
});

test('sauvegarde : fichier étranger ou chemin dangereux refusé',()=>{
 const zlib=require('node:zlib');
 assert.throws(()=>backup._test.unpack(zlib.gzipSync('{"hello":1}')),/pas une sauvegarde/);
 assert.throws(()=>backup._test.unpack(backup._test.pack({'../evil.json':'{}'})),/Chemin invalide/);
 assert.throws(()=>backup._test.unpack(backup._test.pack({'a.json':'pas du json'})));
});

function backupGuild(){
 const sent=[],deleted=[],live=new Map();let n=0;
 const ch={id:'bk',isTextBased:()=>true,send:async p=>{const m={id:'m'+(++n),url:'u',createdTimestamp:n,author:{id:'bot'},attachments:new Collection([['f',{name:p.files[0].name}]]),delete:async()=>{deleted.push(m.id);live.delete(m.id);}};sent.push(m);live.set(m.id,m);return m;},
  messages:{fetch:async()=>new Collection([...live])}};
 a.save(s=>{s.schoolBackupChannelId='bk';});
 return{guild:{id:config.guildId,client:{user:{id:'bot'}},channels:{fetch:async id=>id==='bk'?ch:null}},sent,deleted};
}

test('sauvegarde quotidienne : une seule par jour, à partir de 4 h (Paris), 14 gardées',async()=>{
 const {guild,sent,deleted}=backupGuild();
 const at=(d,h)=>Date.UTC(2026,10,d,h-1); // novembre : Paris = UTC+1
 assert.equal(await backup.tick(guild,{now:at(13,3)}),false);
 assert.equal(await backup.tick(guild,{now:at(13,4)}),true);
 assert.match(sent[0].attachments.first().name,/^qg-sauvegarde-2026-11-13-04h00\.json\.gz$/);
 assert.equal(await backup.tick(guild,{now:at(13,20)}),false);
 for(let d=14;d<=28;d++)await backup.tick(guild,{now:at(d,5)});
 assert.equal(sent.length,16);assert.deepEqual(deleted,['m1','m2']);
});

test('=restore : bouton réservé à l’auteur, sauvegarde de l’état actuel avant, puis redémarrage',async()=>{
 const {guild,sent}=backupGuild();
 data.update('qgServer',s=>{s.valeur='ancienne';});
 const archive=backup._test.pack(backup._test.collect(dir),5000);
 data.update('qgServer',s=>{s.valeur='actuelle';});
 const ch=await guild.channels.fetch('bk');const saved={id:'old',attachments:new Collection([['f',{name:'qg-sauvegarde-x.json.gz',url:'https://x'}]])};
 ch.messages.fetch=async id=>id==='old'?saved:new Collection(sent.map(m=>[m.id,m]));
 const replies=[];let exited=0;
 const i={customId:'qgbk:restore:old:42',user:{id:'7'},guild,reply:async p=>replies.push(p)};
 await backup.handle(i,{exit:()=>exited++});
 assert.match(replies[0].content,/Seule la personne/);assert.equal(exited,0);
 i.user.id='42';i.update=async p=>replies.push(p);i.editReply=async p=>replies.push(p);
 await backup.handle(i,{exit:()=>exited++,download:async()=>archive});
 assert.equal(data.read('qgServer').valeur,'ancienne');assert.equal(exited,1);
 assert.equal(sent.length,1); // sauvegarde de l'état « actuelle » faite avant
 assert.match(replies.at(-1).content,/fichiers restaurés/);
});

test('stats de recrutement : décisions, taux, attente moyenne et décisions par recruteur',()=>{
 const H=3600000,day=86400000,to=10*day,from=3*day;
 const history=[
  {action:'recruitment.writtenaccept',actorId:'r1',targetId:'c1',at:4*day},
  {action:'recruitment.oralaccept',actorId:'r2',targetId:'c1',at:4*day+10*H},
  {action:'recruitment.writtenaccept',actorId:'r1',targetId:'c2',at:5*day},
  {action:'recruitment.oralrefuse',actorId:'r2',targetId:'c2',at:5*day+30*H},
  {action:'recruitment.writtenrefuse',actorId:'r1',targetId:'c3',at:6*day},
  {action:'recruitment.writtenaccept',actorId:'r1',targetId:'c0',at:1*day}, // hors période
  {action:'rankup',actorId:'r1',targetId:'c1',at:6*day},
 ];
 const applications={a:{caseId:'a',submittedAt:4*day,status:'accept'},b:{caseId:'b',submittedAt:2*day,status:'waiting_interview',updatedAt:2*day},c:{caseId:'c',submittedAt:6*day,status:'submitted'}};
 const reports=[{candidateId:'c1',at:4*day+10*H+60000}]; // c2 : entretien sans compte rendu
 const s=stats._test.compute({history,applications,reports,from,to});
 assert.equal(s.missing,1);
 assert.equal(s.received,2);
 assert.deepEqual(s.written,{accept:2,refuse:1});assert.deepEqual(s.oral,{accept:1,refuse:1});
 assert.equal(s.averageWait,20*H);
 assert.deepEqual(s.recruiters,[['r1',{written:3,oral:0,missing:0}],['r2',{written:0,oral:2,missing:1}]]);
 assert.equal(s.pending,1);assert.equal(s.waiting,1);
 const text=stats._test.payload(s,{days:7,to}).embeds[0].data.description;
 assert.match(text,/67 % d’acceptation/);assert.match(text,/50 % d’acceptation/);assert.match(text,/20 h/);assert.match(text,/<@r1> — 3 écrites · 0 entretien\n/);assert.match(text,/<@r2> — 0 écrite · 2 entretiens · ⚠️ 1 CR manquant/);assert.match(text,/Comptes rendus manquants : \*\*1\*\* ⚠️/);
});

test('stats de recrutement : rapport le lundi à partir de 9 h dans le journal, une fois',async()=>{
 const sent=[],ch={isTextBased:()=>true,send:async p=>sent.push(p)};
 const guild={id:config.guildId,channels:{fetch:async id=>id===JOURNAL?ch:null}};
 const monday=h=>Date.UTC(2026,10,16,h-1);
 assert.equal(await stats.tick(guild,{now:monday(8)}),false);
 assert.equal(await stats.tick(guild,{now:monday(9)}),true);
 assert.equal(await stats.tick(guild,{now:monday(15)}),false);
 assert.equal(await stats.tick(guild,{now:Date.UTC(2026,10,17,10)}),false);
 assert.equal(sent.length,1);assert.match(sent[0].embeds[0].data.title,/Statistiques de recrutement/);
});

function voiceRoom(ids){
 const edits=[],sent=[];
 const members=new Collection(ids.map(id=>[id,{id,user:{bot:id==='bot'}}]));
 return{edits,sent,room:{id:'v1',members,permissionOverwrites:{edit:async(id,p)=>edits.push([id,p])},send:async p=>sent.push(p)}};
}

test('vocal temporaire : le propriétaire part, la voc passe au membre suivant avec son panel',async()=>{
 const voice=require('../systems/qgSchoolVoice');
 a.save(s=>{s.schoolTemporaryVoices={v1:{ownerId:'o',kind:'community',locked:false}};});
 const {room,edits,sent}=voiceRoom(['bot','m2','m3']);
 const guild={id:config.guildId,channels:{cache:new Map([['v1',room]])}};
 const member={id:'o',user:{bot:false}};
 await voice.voice({channelId:'v1',guild},{channelId:null,guild,member},{user:{id:'bot'}});
 assert.equal(a.state().schoolTemporaryVoices.v1.ownerId,'m2');
 assert.equal(edits[0][0],'m2');assert.equal(edits[0][1].ReadMessageHistory,true);
 assert.deepEqual(edits[1],['o',{ReadMessageHistory:false}]);
 assert.match(sent[0].content,/<@m2> tu es maintenant propriétaire/);assert.deepEqual(sent[0].allowedMentions.users,['m2']);
 const ids=sent[0].components.flatMap(r=>r.toJSON().components.map(c=>c.custom_id));
 assert.ok(ids.includes('qgs:voice:transfer:v1'));
 // Un autre membre part : pas de transfert.
 await voice.voice({channelId:'v1',guild},{channelId:null,guild,member:{id:'m3',user:{bot:false}}},{user:{id:'bot'}});
 assert.equal(sent.length,1);
});

test('autres familles : alerte Direction pour un membre déjà vérifié ou nouvel arrivant, pas au premier passage',async()=>{
 const families=require('../systems/qgOtherFamilies');
 const OLD='111111111111111111',NEW='222222222222222222',now=100*86400000;
 const members=new Collection([[OLD,{id:OLD,user:{id:OLD,bot:false},joinedTimestamp:1}],[NEW,{id:NEW,user:{id:NEW,bot:false},joinedTimestamp:now-86400000}]]);
 const journal=[],ch={isTextBased:()=>true,guildId:config.guildId,send:async p=>journal.push(p)};
 const guild={id:config.guildId,members:{cache:members,fetch:async()=>members},channels:{fetch:async id=>id===JOURNAL?ch:null}};
 a.save(s=>{s.schoolEntryVerification={[OLD]:{robloxId:'10',robloxName:'Ancien'},[NEW]:{robloxId:'20',robloxName:'Nouveau'}};});
 const fam=(id,name)=>({group:{id,name,owner:{userId:1,username:'colonelrqt2'}}});
 const http=groups=>async url=>({ok:true,json:async()=>({data:groups[/users\/(\d+)\//.exec(url)[1]]||[]})});
 await families.tick(guild,{now,http:http({10:[fam(1,'DYNASTY | SCHOOLRP')],20:[fam(1,'DYNASTY | SCHOOLRP')]})});
 assert.equal(journal.length,1);
 assert.match(journal[0].embeds[0].data.description,new RegExp(`Vient d’arriver[\\s\\S]*<@${NEW}>`));
 await families.tick(guild,{now:now+86400001,http:http({10:[fam(1,'DYNASTY | SCHOOLRP'),fam(5,'Shadow | SCHOOLRP')],20:[fam(1,'DYNASTY | SCHOOLRP')]})});
 assert.equal(journal.length,2);
 assert.match(journal[1].embeds[0].data.description,new RegExp(`A rejoint la famille \\*\\*Shadow\\*\\*[\\s\\S]*<@${OLD}>`));
});
