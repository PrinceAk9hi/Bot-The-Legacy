const {test}=require('node:test');
const assert=require('node:assert/strict');
const guide=require('../config/qgInterviewGuide');
const interviews=require('../systems/qgInterviews');
const {familyQuestions}=require('../systems/qgSchoolApplications');

test('guide d’entretien : 4 questions, 6 situations puis la dernière question, fin d’entretien, sous les limites Discord',()=>{
 assert.equal(guide.part1.length,4);assert.match(guide.part1[0],/^Présente-toi brièvement : ton prénom, ton âge, une qualité et un défaut, et ton activité/);assert.match(guide.part1[2],/^Qu’est-ce que signifie/);assert.equal(guide.situations.length,6);assert.equal(guide.situations[1][0],'Manque de respect');
 const s=guide.sections('123456789012345678');assert.deepEqual(s.map(x=>x[0]),['Partie 1 — Questions','Partie 2 — Les 6 mises en situation','Fin d’entretien']);
 assert.match(s[1][1],/Dernière question\*\*\n.*prêt à respecter les règles/);assert.match(s[1][1],/Deux membres du QG/);assert.match(s[1][1],/Ton meilleur ami, membre du QG,/);assert.ok(!/comment lui expliques-tu/.test(s[1][1]));assert.match(s[2][1],/tag du serveur est obligatoire/);assert.match(s[2][1],/forte activité est obligatoire pour rankup/);assert.match(s[2][1],/<#123456789012345678>/);
 let total=0;for(const [title,text] of s){assert.ok(text.length<=4096);total+=title.length+text.length+3;}assert.ok(total<=6000,'total '+total);
});
test('fiche de réception : les 10 questions et réponses apparaissent, même longues',()=>{
 const app={applicantId:'1',caseId:'abc',status:'submitted',createdAt:Date.now(),questions:familyQuestions,answers:familyQuestions.map((_,n)=>'Réponse '+(n+1)+' '+'x'.repeat(900))};
 const e=interviews.summary(app).toJSON();assert.equal(e.fields.length,familyQuestions.length);
 familyQuestions.forEach((q,n)=>{assert.ok(e.fields[n].name.includes(q.slice(0,40)));assert.match(e.fields[n].value,new RegExp('^Réponse '+(n+1)+' '));});
 const len=(e.title||'').length+(e.description||'').length+(e.footer?.text||'').length+e.fields.reduce((n,f)=>n+f.name.length+f.value.length,0);assert.ok(len<=6000,'longueur '+len);
});
