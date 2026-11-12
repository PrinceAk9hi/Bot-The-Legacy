const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const data=require('../utils/recruitmentData'),a=require('../utils/qgAdmin'),config=require('../config/qg'),{Collection,MessageFlags}=require('discord.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-help-'));data.setDataDirectory(dir);
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const help=require('../systems/qgHelp');
beforeEach(()=>{for(const f of fs.readdirSync(dir))fs.rmSync(path.join(dir,f),{force:true});});
const texts=p=>p.components[0].toJSON().components.filter(c=>c.type===10).map(c=>c.content).join('\n');

function setup(){
 const messages=new Map(),deleted=[];let n=0;
 const make=(id,v2)=>({id,flags:{has:f=>v2&&f===MessageFlags.IsComponentsV2},edit:async p=>{messages.get(id).payload=p;},delete:async()=>{deleted.push(id);messages.delete(id);}});
 const ch={id:help.CHANNEL,guildId:config.guildId,isTextBased:()=>true,send:async p=>{const m=make('new'+(++n),true);m.payload=p;messages.set(m.id,m);return m;},
  messages:{fetch:async id=>{const m=messages.get(id);if(!m){const e=Error('Unknown Message');e.code=10008;throw e;}return m;},delete:async id=>{deleted.push(id);messages.delete(id);}}};
 const commands=new Collection([['1',{name:'entretien',description:'Espace recruteur du QG',options:[{type:1,name:'panel'}]}],['2',{name:'classement',description:'Voir le classement du serveur QG',options:[{type:3,name:'type'}]}]]);
 const guild={id:config.guildId,channels:{fetch:async id=>id===help.CHANNEL?ch:null},commands:{fetch:async()=>commands}};
 return{guild,messages,deleted,make};
}

test('aide : commandes slash lues sur Discord et commandes = avec leur fonction',async()=>{
 const {guild}=setup();
 const slash=await help._test.slashCommands(guild);
 assert.deepEqual(slash,[['classement','Voir le classement du serveur QG',[]],['entretien','Espace recruteur du QG',['panel']]]);
 const all=help._test.pages(help._test.sections(slash)).map(texts).join('\n');
 assert.match(all,/\*\*\/classement\*\* — Voir le classement du serveur QG/);
 assert.match(all,/-# `panel`/);
 for(const cmd of ['=niveau','=classement','=suggestion','=mv @membre','=mvvoc','=clear','=giveaway','=actualite','=acp','=derank','=familles'])assert.ok(all.includes(cmd),cmd);
 // Plus rien de l'ancien centre de commandement.
 assert.doesNotMatch(all,/Effectif détaillé|Annonce publique|Journal|Décisions/);
});

test('aide : remplace l’ancien centre de commandement, puis ne republie que si le contenu change',async()=>{
 const {guild,messages,deleted,make}=setup();
 const old=make('ancien',true);messages.set('ancien',old);
 a.save(s=>{s.schoolCommandPanel={channelId:help.CHANNEL,messageId:'ancien'};});
 await help.publish(guild);
 assert.ok(texts(messages.get('ancien').payload).includes('Aide · Commandes du QG'));
 assert.deepEqual(a.state().schoolHelpPanel.messageIds,['ancien']);
 messages.get('ancien').edit=async()=>{throw Error('ne doit pas être republié');};
 assert.equal((await help.publish(guild)).detail,'Panel d’aide à jour');
 assert.deepEqual(deleted,[]);
});

test('aide : très longue liste découpée sous la limite Discord',()=>{
 const slash=Array.from({length:80},(_,n)=>[`commande${n}`,'Une description assez longue pour remplir le panel d’aide du QG.',['a','b','c']]);
 const pages=help._test.pages(help._test.sections(slash));
 assert.ok(pages.length>=2);
 for(const p of pages){const t=p.components[0].toJSON().components.filter(c=>c.type===10).map(c=>c.content);assert.ok(t.join('').length<=4000);for(const c of t)assert.ok(c.length<=2000);}
});

test('rejoindre une gestion : emoji du badge de chaque rôle d’exécutant, dans le texte et le menu',async()=>{
 const panels=require('../systems/qgPanels');
 const roles=new Collection([['rp',{id:'rp',icon:'h1',iconURL:()=>'x'}],['casino',{id:'casino',icon:null}]]);
 const emojis=new Collection([['77',{id:'77',name:'rp_badge'}]]);
 const members=new Collection();
 const guild={id:config.guildId,roles:{cache:roles},emojis:{cache:emojis},members:{cache:members,fetch:async()=>members}};
 a.save(s=>{s.schoolRoles={rpManagement:'rp',casinoOperator:'casino'};s.schoolRoleBadgeEmojis={rp:{icon:'h1',emojiId:'77',set:'77'}};});
 const p=await panels.management(guild);
 const fields=p.embeds[0].toJSON().fields.map(f=>f.name);
 assert.ok(fields.includes('<:rp_badge:77> Exécutant du RP'));assert.ok(fields.includes('🎰 Exécutant du Casino'));
 const options=p.components[0].toJSON().components[0].options;
 assert.deepEqual(options.find(o=>o.value==='rpManagement').emoji,{id:'77',name:'rp_badge',animated:false});
 assert.equal(options.length,6);assert.ok(options.some(o=>o.value==='casinoOperator'));
});

test('/réunion : annonce à la fin de la programmation, une seule fois, barrée si annulée',async()=>{
 const meetings=require('../systems/qgMeetings'),sent=[];
 const ch={isTextBased:()=>true,send:async p=>{sent.push(p);return{id:'annonce1'};}};
 const guild={channels:{fetch:async id=>id==='1561157213160996866'?ch:null}};
 a.save(s=>{s.schoolMeetings={m1:{id:'m1',name:'Réunion mensuelle',description:'Bilan',start:Date.now()+86400000,duration:60,status:'waiting',eventId:'ev1'}};});
 let r=await meetings._test.announceScheduled(guild,meetings.get('m1'));
 assert.equal(sent.length,1);assert.equal(sent[0].content,'<@&1561363081018474626>');assert.deepEqual(sent[0].allowedMentions,{parse:[],roles:['1561363081018474626']});
 const text=sent[0].embeds[0].data.description;
 assert.match(text,/Réunion mensuelle/);assert.match(text,/<t:\d+:F> \(<t:\d+:R>\)/);assert.match(text,/60 minutes/);assert.match(text,/discord\.com\/events\/.+\/ev1/);
 assert.equal(r.scheduledAnnouncementId,'annonce1');
 await meetings._test.announceScheduled(guild,meetings.get('m1'));assert.equal(sent.length,1);
 const cancelled=meetings._test.scheduledPayload(meetings.get('m1'),true);
 assert.equal(cancelled.content,null);assert.match(cancelled.embeds[0].data.description,/annulée/);assert.deepEqual(cancelled.allowedMentions,{parse:[]});
});

test('aide communautaire : histoire, fondateurs, inspiration, valeurs, et rejoindre la famille en dernier',async()=>{
 const p=require('../systems/qgCommunityHelp').payload(null,{schoolChannels:{familyApplications:'777',tickets:'888'}});
 const titles=p.embeds.map(e=>e.toJSON().title),all=p.embeds.map(e=>e.toJSON().description).join('\n');
 assert.ok(titles[0].includes('Aide et FAQ'),'titre retrouvé par la mise à jour automatique');
 assert.match(titles.at(-1),/Rejoindre la famille/);
 for(const x of ['Qualité & Grandeur','7 novembre 2026','Aven et EMS','Key et Meg','esthétique ancienne','Respect','<#888>','<#777>','Tag QG obligatoire',config.robloxGroupUrl])assert.ok(all.includes(x),x);
 assert.ok(all.length+titles.join('').length<6000);
 const setup=require('../systems/qgSchoolSetup');
 assert.ok((await setup.panelPayload('help',null)).embeds[0].toJSON().title.includes('Aide et FAQ'));
});

test('fiche candidature : verte et boutons désactivés une fois acceptée, rouge si refusée',()=>{
 const interviews=require('../systems/qgInterviews');
 const app=status=>({applicantId:'111',caseId:'c1',status,submittedAt:1,answers:['Réponse'],questions:['Question ?']});
 const disabled=a=>interviews.controls(a)[0].toJSON().components.map(c=>!!c.disabled);
 assert.deepEqual(disabled(app('submitted')),[false,false,false,false]);
 assert.equal(interviews.summary(app('submitted')).toJSON().color,0xffffff);
 for(const s of ['waiting_interview','accept']){assert.equal(interviews.summary(app(s)).toJSON().color,0x2ecc71);assert.deepEqual(disabled(app(s)),[true,true,true,true]);}
 assert.match(interviews.summary(app('waiting_interview')).toJSON().description,/Acceptée — en attente d’entretien/);
 assert.equal(interviews.summary(app('refuse')).toJSON().color,0xd62f2f);assert.deepEqual(disabled(app('refuse')),[true,true,true,true]);
});
