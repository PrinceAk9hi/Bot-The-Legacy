const {test}=require('node:test');
const assert=require('node:assert/strict');
const guide=require('../config/qgInterviewGuide');
const interviews=require('../systems/qgInterviews');
const {familyQuestions}=require('../systems/qgSchoolApplications');

test('guide d’entretien : 8 questions, 5 situations, fin d’entretien, sous les limites Discord',()=>{
 assert.equal(guide.part1.length,8);assert.equal(guide.situations.length,5);
 const s=guide.sections('123456789012345678');assert.deepEqual(s.map(x=>x[0]),['Partie 1 — Questions','Partie 2 — Les 5 mises en situation','Fin d’entretien']);
 assert.match(s[2][1],/tag du serveur est obligatoire/);assert.match(s[2][1],/forte activité est obligatoire pour rankup/);assert.match(s[2][1],/<#123456789012345678>/);
 let total=0;for(const [title,text] of s){assert.ok(text.length<=4096);total+=title.length+text.length+3;}assert.ok(total<=6000,'total '+total);
});
test('fiche de réception : les 10 questions et réponses apparaissent, même longues',()=>{
 const app={applicantId:'1',caseId:'abc',status:'submitted',createdAt:Date.now(),questions:familyQuestions,answers:familyQuestions.map((_,n)=>'Réponse '+(n+1)+' '+'x'.repeat(900))};
 const e=interviews.summary(app).toJSON();assert.equal(e.fields.length,10);
 familyQuestions.forEach((q,n)=>{assert.ok(e.fields[n].name.includes(q.slice(0,40)));assert.match(e.fields[n].value,new RegExp('^Réponse '+(n+1)+' '));});
 const len=(e.title||'').length+(e.description||'').length+(e.footer?.text||'').length+e.fields.reduce((n,f)=>n+f.name.length+f.value.length,0);assert.ok(len<=6000,'longueur '+len);
});
