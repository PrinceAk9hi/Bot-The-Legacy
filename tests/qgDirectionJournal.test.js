const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const data=require('../utils/recruitmentData'),a=require('../utils/qgAdmin'),config=require('../config/qg');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-journal-'));data.setDataDirectory(dir);
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const journal=require('../systems/qgDirectionJournal');
beforeEach(()=>{for(const f of fs.readdirSync(dir))fs.rmSync(path.join(dir,f),{force:true});});
const desc=p=>p.embeds[0].data.description;

function guild(){
 const sent=[];
 const ch={guildId:config.guildId,isTextBased:()=>true,send:async p=>{sent.push(p);return{id:String(sent.length)};}};
 return{sent,guild:{id:config.guildId,client:{user:{id:'bot'}},channels:{fetch:async id=>id===journal.CHANNEL?ch:null}}};
}

test('journal : seulement les actions importantes faites par une personne',()=>{
 const ok=action=>journal._test.important({action,actorId:'dir',result:'success'},'bot');
 for(const x of ['rankup','derank','demote','discipline','sanction.warn','note.add','pdt.start','foundation.decision','foundation.watch','cd.on','recruitment.oralaccept','referent.convocation'])assert.ok(ok(x),x);
 for(const x of ['messages.clear','voice.moveall','recruiter.status','interview.start','maintenance.auto','meeting.rankup','tag.review','casino.bet'])assert.ok(!ok(x),x);
 assert.ok(!journal._test.important({action:'rankup',actorId:'bot',result:'success'},'bot'),'action automatique du bot');
 assert.ok(!journal._test.important({action:'rankup',result:'success'},'bot'),'sans auteur');
 assert.ok(!journal._test.important({action:'rankup',actorId:'dir',result:'failed'},'bot'),'échec');
});

test('journal : avertissement avec niveau et motif, rankup avec le grade',async()=>{
 const {guild:g,sent}=guild();
 await journal.fromAudit(g,{action:'discipline',actorId:'dir',targetId:'m1',before:0,after:1,reason:'Insultes en vocal',result:'success',at:1});
 const text=desc(sent[0]);
 assert.match(text,/Par <@dir> · Membre : <@m1>/);assert.match(text,/\*\*Avertissement 1\*\*/);assert.match(text,/\*\*Motif :\*\* Insultes en vocal/);
 await journal.fromAudit(g,{action:'rankup',actorId:'dir',targetId:'m2',before:'expert',after:{grade:'senior'},reason:'Très actif',result:'success'});
 assert.match(desc(sent[1]),/expert → \*\*senior\*\*/);
 // Les listes de rôles techniques ne sont pas affichées.
 await journal.fromAudit(g,{action:'management',actorId:'dir',targetId:'m3',after:{roles:['1','2']},result:'success'});
 assert.doesNotMatch(desc(sent[2]),/roles|\['1'/);
 // Action non importante : rien.
 assert.equal(await journal.fromAudit(g,{action:'messages.clear',actorId:'dir',result:'success'}),false);assert.equal(sent.length,3);
});

test('journal : détail complet de chaque réunion, une seule fois',async()=>{
 const {guild:g,sent}=guild();
 a.save(s=>{s.schoolMeetings={r1:{id:'r1',name:'Réunion mensuelle',description:'Bilan',start:Date.UTC(2026,10,20,19),duration:60,authorId:'dir',approvedBy:'fond',
  roster:[{id:'m1'},{id:'m2'},{id:'m3'},{id:'m4'}],
  notes:{m1:{value:8,detail:'Très bonne présence'},m3:{value:4,detail:''}},
  actions:{m1:{action:'rankup',label:'Rankup',reason:'Investi'},m2:{action:'warn',label:'Avertissement 1',reason:'Absent sans prévenir'}},
  results:{m1:{status:'done'},m2:{status:'blocked',detail:'Grade modifié depuis la préparation.'},m3:{status:'done'}}}};});
 const r=require('../systems/qgMeetings').get('r1');
 assert.equal(await journal.meeting(g,r),true);
 const text=sent.map(desc).join('\n');
 assert.match(text,/Réunion mensuelle/);assert.match(text,/Validée par <@fond>/);assert.match(text,/3 notes|2 notes/);
 assert.match(text,/<@m1>\nNote : \*\*8\/10\*\* — Très bonne présence\nDécision : \*\*Rankup\*\* — Investi/);
 assert.match(text,/<@m2>\nDécision : \*\*Avertissement 1\*\* — Absent sans prévenir\n-# ⛔ Bloquée : Grade modifié/);
 assert.match(text,/<@m3>\nNote : \*\*4\/10\*\*/);assert.doesNotMatch(text,/<@m4>/);
 assert.equal(await journal.meeting(g,require('../systems/qgMeetings').get('r1')),false);assert.equal(sent.length,1);
});

test('journal : réunion très longue découpée en plusieurs messages',()=>{
 const roster=Array.from({length:120},(_,n)=>({id:'m'+n})),notes=Object.fromEntries(roster.map(m=>[m.id,{value:7,detail:'Bonne implication dans la famille cette semaine, à continuer.'}]));
 const pages=journal._test.meetingPayloads({id:'r2',name:'Grande réunion',start:0,duration:90,roster,notes,actions:{},results:{}});
 assert.ok(pages.length>=2);for(const p of pages)assert.ok(desc(p).length<=4000);
 assert.equal(pages.map(desc).join('\n').match(/Note :/g).length,120);
});

test('journal : fiche de réunion dès la programmation, modifiée ensuite au lieu d’être republiée',async()=>{
 const sent=[],edits=[],messages=new Map();
 const ch={guildId:config.guildId,isTextBased:()=>true,send:async p=>{const m={id:'f'+(sent.length+1),edit:async q=>{edits.push(q);}};sent.push(p);messages.set(m.id,m);return m;},messages:{fetch:async id=>messages.get(id),delete:async()=>{}}};
 const g={id:config.guildId,channels:{fetch:async id=>id===journal.CHANNEL?ch:null}};
 const meetings=require('../systems/qgMeetings');
 a.save(s=>{s.schoolMeetings={r3:{id:'r3',name:'Réunion de rentrée',start:Date.now()+86400000,duration:45,authorId:'dir',status:'waiting',roster:[],notes:{},actions:{},results:{}}};});
 assert.equal(await journal.meetingSync(g,meetings.get('r3')),true);
 assert.equal(sent.length,1);assert.match(desc(sent[0]),/Réunion de rentrée[\s\S]*Statut :\*\* 🗓️ Programmée/);
 // Rien n'a changé : pas de modification.
 assert.equal(await journal.meetingSync(g,meetings.get('r3')),false);
 // Préparation : notes et décision ajoutées → la même fiche est modifiée.
 meetings.save('r3',p=>{p.status='draft';p.roster=[{id:'m1'}];p.notes={m1:{value:9,detail:'Super'}};p.actions={m1:{action:'rankup',label:'Rankup',reason:'Très actif'}};});
 await journal.meetingSync(g,meetings.get('r3'));
 assert.equal(sent.length,1);assert.equal(edits.length,1);
 assert.match(desc(edits[0]),/Préparation des notes[\s\S]*<@m1>\nNote : \*\*9\/10\*\* — Super\nDécision : \*\*Rankup\*\* — Très actif/);
 meetings.save('r3',p=>{p.status='cancelled';});
 await journal.meetingSync(g,meetings.get('r3'));assert.match(desc(edits.at(-1)),/Annulée/);assert.equal(sent.length,1);
});
