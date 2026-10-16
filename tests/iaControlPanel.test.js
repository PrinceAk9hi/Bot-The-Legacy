const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const store=require('../utils/iaControlStore');
const panel=require('../systems/iaControlPanel');
const tickets=require('../config/tickets');
const {PermissionFlagsBits}=require('discord.js');
const data=require('../utils/recruitmentData');
const kb=require('../utils/ticketAiKnowledge');

test('centre IA : valeurs sûres, persistance atomique et déduplication des événements',()=>{
 const dir=fs.mkdtempSync(path.join(__dirname,'.ia-control-'));store.setDataDirectory(dir);
 try {
  assert.equal(store.read('config').config.autoRepliesEnabled,true);
  store.transact('config',x=>{x.config.autoRepliesEnabled=false;});
  assert.equal(store.read('config').config.autoRepliesEnabled,false);
  store.transact('config',x=>{x.config.maintenance=true;});
  store.push('metrics',{id:'same',type:'response',at:100,ticketId:'t'});
  store.push('metrics',{id:'same',type:'response',at:100,ticketId:'t'});
  assert.equal(store.read('metrics').events.length,1);
  fs.writeFileSync(path.join(dir,'iaControlConfig.json'),'{broken');
  assert.equal(store.read('config').config.autoRepliesEnabled,false);
  assert.ok(fs.existsSync(path.join(dir,'iaControlConfig.json.bak')));
 } finally {store.setDataDirectory(path.join(__dirname,'..','data'));fs.rmSync(dir,{recursive:true,force:true});}
});
test('centre IA : accès réservé au bypass, aux rôles configurés ou aux administrateurs',()=>{
 const role=tickets.accessRoles[0];
 const member={roles:{cache:new Map([[role,{}]])},permissions:{has:()=>false}};
 assert.equal(panel.allowed({guildId:require('../config/soulSociety').IDENTITY.guildId,member,memberPermissions:{has:()=>false}}),true);
 assert.equal(panel.allowed({guildId:'other',member,memberPermissions:{has:()=>true}}),false);
 assert.equal(panel.allowed({guildId:require('../config/soulSociety').IDENTITY.guildId,member:{roles:{cache:new Map()}},memberPermissions:{has:p=>p===PermissionFlagsBits.Administrator}}),true);
});
test('centre IA : statistiques déclarent la résolution non mesurée',()=>{
 const dir=fs.mkdtempSync(path.join(__dirname,'.ia-control-stats-'));store.setDataDirectory(dir);
 try {const embed=panel.makeEmbed('overview');assert.ok(embed.data.fields.some(f=>/non mesurés/i.test(f.value)));}
 finally {store.setDataDirectory(path.join(__dirname,'..','data'));fs.rmSync(dir,{recursive:true,force:true});}
});
test('centre IA : connaissance ajoutée, modifiée, désactivée puis supprimée depuis la recherche du support',()=>{
 const dir=fs.mkdtempSync(path.join(__dirname,'.ia-kb-'));data.setDataDirectory(dir);store.setDataDirectory(dir);
 try {
  const first=kb.add('Procédure test centre','Réponse initiale vérifiée',{tags:['centre-test'],createdBy:'staff-test'});
  assert.ok(kb.search('procédure centre test').some(x=>x.id===first.id));
  kb.edit(first.id,{content:'Réponse mise à jour vérifiée'},'staff-test');
  assert.match(kb.search('procédure centre test').find(x=>x.id===first.id).content,/mise à jour/);
  kb.edit(first.id,{active:false},'staff-test');
  assert.ok(!kb.search('procédure centre test').some(x=>x.id===first.id));
  assert.ok(kb.remove(first.id));
 } finally {data.setDataDirectory(path.join(__dirname,'..','data'));store.setDataDirectory(path.join(__dirname,'..','data'));fs.rmSync(dir,{recursive:true,force:true});}
});
