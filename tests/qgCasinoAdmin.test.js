const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const data=require('../utils/recruitmentData'),a=require('../utils/qgAdmin'),config=require('../config/qg'),{Collection}=require('discord.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-casino-admin-'));data.setDataDirectory(dir);
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const admin=require('../systems/qgCasinoAdmin'),store=require('../systems/qgCasinoGames').store;
const LEAD='111111111111111111',OP='222222222222222222',PLAYER='333333333333333333',STRANGER='444444444444444444',BOT='555555555555555555';
const meta={actorId:LEAD,reason:'test'};
let guild,members,replies;
function member(id,roles){return{id,guild,user:{id,bot:id===BOT,username:'u'+id.slice(-2)},displayName:'Membre '+id.slice(-2),pending:false,roles:{cache:new Collection(roles.map(r=>[r,{id:r}]))}};}
function interaction(customId,who,{values=[],fields={},ephemeral=false,modal=false}={}){
 return{customId,guildId:config.guildId,guild,user:{id:who},values,message:{flags:{has:()=>ephemeral}},
  fields:{getTextInputValue:k=>{if(!(k in fields))throw Error('absent');return fields[k];}},
  isButton:()=>!modal&&!values.length,isModalSubmit:()=>modal,
  showModal:async m=>replies.push({modal:m.toJSON()}),deferReply:async()=>replies.push('deferReply'),deferUpdate:async()=>replies.push('deferUpdate'),
  editReply:async p=>replies.push(p),followUp:async p=>replies.push(p)};
}
beforeEach(()=>{
 for(const f of fs.readdirSync(dir))fs.rmSync(path.join(dir,f),{force:true});
 replies=[];members=new Collection();
 guild={id:config.guildId,client:{user:{id:BOT},users:{cache:new Collection(),fetch:async id=>members.get(id)?.user||{id,username:'inconnu',send:async()=>{}}}},channels:{fetch:async()=>null}};
 guild.members={cache:members,fetch:async q=>{const id=typeof q==='string'?q:q.user;if(!members.has(id))throw{code:10007};return members.get(id);}};
 members.set(LEAD,member(LEAD,['lead']));members.set(OP,member(OP,['op']));members.set(PLAYER,member(PLAYER,['community']));members.set(STRANGER,member(STRANGER,[]));
 a.save(s=>{s.schoolRoles={casinoLead:'lead',casinoOperator:'op',community:'community'};});
});

test('opérations admin : crédit, débit, solde fixé, journal avant/après',()=>{
 assert.equal(store.credit(PLAYER,5000,meta).balance,6000);
 assert.throws(()=>store.debit(PLAYER,7000,meta),/n’a que 6\s000/);
 assert.equal(store.debit(PLAYER,1000,meta).balance,5000);
 assert.equal(store.setBalance(PLAYER,250,meta).balance,250);
 assert.throws(()=>store.credit(PLAYER,0,meta),/Montant invalide/);
 const log=store.adminLog();
 assert.deepEqual(log.map(e=>e.type),['set','debit','credit']);
 assert.deepEqual([log[0].before,log[0].after,log[0].actorId,log[0].reason],[5000,250,LEAD,'test']);
});

test('gel : plus de mise ni de récompense, dégel rétablit le jeu',()=>{
 store.freeze(PLAYER,true,meta);
 assert.throws(()=>store.start(PLAYER,'slots',10,'','t1'),/gelé/);
 assert.throws(()=>store.daily(PLAYER),/gelé/);
 store.freeze(PLAYER,false,meta);
 const acc=store.start(PLAYER,'slots',10,'','t2');
 assert.equal(acc.played,1);
 assert.equal(acc.byKind.slots.played,1);
 assert.match(acc.history[0].detail,/^Rouleaux \d-\d-\d$/);
});

test('annulation de partie : mise remboursée ; réinitialisation conserve les notes',()=>{
 store.credit(PLAYER,1000,meta);
 const started=store.start(PLAYER,'mines',500,'','t3');
 assert.equal(started.balance,1500);
 assert.equal(store.cancelGame(PLAYER,meta).balance,2000);
 assert.throws(()=>store.cancelGame(PLAYER,meta),/Aucune partie/);
 store.note(PLAYER,'Joueur averti pour multi-compte',meta);
 const reset=store.resetAccount(PLAYER,meta);
 assert.deepEqual([reset.balance,reset.played,reset.history.length,reset.notes.length],[1000,0,0,1]);
});

test('bonus général : chaque compte existant reçoit le montant',()=>{
 store.credit(PLAYER,1,meta);store.credit(OP,1,meta);
 assert.equal(store.creditAll(250,meta),2);
 assert.equal(store.peek(PLAYER).balance,1251);
 assert.throws(()=>store.creditAll(500000,meta),/Montant invalide/);
});

test('montants saisis : 5k, 10 000, 1,5k ; texte refusé',()=>{
 assert.equal(admin.parseAmount('5k'),5000);
 assert.equal(admin.parseAmount('10 000'),10000);
 assert.equal(admin.parseAmount('1,5k'),1500);
 assert.throws(()=>admin.parseAmount('beaucoup'),/Montant invalide/);
});

test('tableau de bord : menu joueur, boutons uniques et image jointe',()=>{
 store.credit(PLAYER,2000,meta);store.start(PLAYER,'roulette',100,'rouge','t4');
 const p=admin.panel(guild),ids=p.components.flatMap(r=>r.toJSON().components.map(c=>c.custom_id));
 assert.equal(ids[0],'qgcadm:player');
 assert.equal(new Set(ids).size,ids.length);
 assert.equal(p.files[0].name,'casino-admin.png');
 assert.equal(admin.stats().byKind.roulette.played,1);
 assert.match(admin.csv(),new RegExp(PLAYER));
});

test('fiche joueur : solde, image et actions ; refus hors équipe',async()=>{
 store.credit(PLAYER,2000,meta);
 const p=await admin.card(guild,PLAYER);
 assert.equal(p.files[0].name,'joueur.png');
 assert.ok(p.embeds[0].toJSON().fields.some(f=>/^3\s000 jetons$/.test(f.value)));
 await assert.rejects(admin.handle(interaction('qgcadm:player',STRANGER,{values:[PLAYER]})),/réservé à l’équipe casino/);
});

test('permissions : un exécutant consulte et note, seul le responsable crédite',async()=>{
 await assert.rejects(admin.handle(interaction('qgcadm:give:'+PLAYER,OP)),/Responsable du casino/);
 await admin.handle(interaction('qgcadm:note:'+PLAYER,OP));
 assert.equal(replies.at(-1).modal.custom_id,'qgcadm:notef:'+PLAYER);
 await admin.handle(interaction('qgcadm:givef:'+PLAYER,LEAD,{modal:true,ephemeral:true,fields:{amount:'2k',reason:'Gagnant de l’événement',notify:'non'}}));
 assert.equal(store.peek(PLAYER).balance,3000);
 assert.match(replies.at(-1).content,/1\s000 jetons|nouveau compte/);
 assert.equal(replies[replies.length-2],'deferUpdate');
});
