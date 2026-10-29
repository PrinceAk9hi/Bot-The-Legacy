const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const data=require('../utils/recruitmentData'),a=require('../utils/qgAdmin'),config=require('../config/qg'),{Collection}=require('discord.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-profile-'));data.setDataDirectory(dir);
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const profile=require('../systems/qgProfile'),store=require('../systems/qgCasinoGames').store;
const ME='111111111111111111',OTHER='222222222222222222';
const DAY=86400000;
let guild;
function member(id,roles,joinedDays){return{id,guild,joinedTimestamp:Date.now()-joinedDays*DAY,displayName:'Membre '+id.slice(-2),user:{id,bot:false,username:'membre'+id.slice(-2)},roles:{cache:new Collection(roles.map(r=>[r,{id:r}]))},displayAvatarURL:()=>'https://example.invalid/a.png'};}
beforeEach(()=>{
 for(const f of fs.readdirSync(dir))fs.rmSync(path.join(dir,f),{force:true});
 guild={id:config.guildId,ownerId:'owner'};
 a.save(s=>{s.schoolRoles={expert:'expert',recruitmentManagement:'recrut',community:'community'};s.schoolEntryVerification={[ME]:{robloxName:'SakuraRP'}};});
 data.update('qgXp',x=>{x[ME]={xp:5100};x[OTHER]={xp:9000};});
});

test('collecte : grade, niveau, position, Roblox et casino',()=>{
 store.credit(ME,500,{actorId:OTHER,reason:'test'});
 const p=profile.collect(member(ME,['expert','community'],200));
 assert.equal(p.title,'Membre Expert');
 assert.equal(p.level,14);
 assert.ok(p.current<=p.xp&&p.xp<p.next);
 assert.equal(p.position,2);
 assert.equal(p.roblox,'SakuraRP');
 assert.equal(p.casino.balance,1500);
 assert.equal(p.days,200);
 assert.ok(p.badges.includes('Vétéran'));
 assert.ok(p.badges.includes('Roblox vérifié'));
});

test('badges : équipe, ancien, vocal, bavard, flambeur',()=>{
 assert.deepEqual(profile.badges({team:true,days:400,voiceTotal:60*3600000,weekMessages:250,casino:{wagered:200000,returned:0},verified:false}),['Équipe du QG','Ancien','Pilier du vocal','Bavard','Flambeur']);
 assert.deepEqual(profile.badges({team:false,days:3,voiceTotal:0,weekMessages:0,casino:null,verified:false}),[]);
 const staff=profile.collect(member(OTHER,['recrut','community'],1));
 assert.ok(staff.badges.includes('Équipe du QG'));
 assert.equal(staff.title,'Membre du QG');
});

test('carte : image PNG jointe à l’embed, sans avatar disponible',async()=>{
 const p=await profile.payload(member(ME,['expert','community'],30));
 assert.equal(p.files[0].name,'profil-qg.png');
 assert.equal(p.embeds[0].toJSON().image.url,'attachment://profil-qg.png');
 assert.deepEqual([...p.files[0].attachment.subarray(0,4)],[137,80,78,71]);
});

test('commande /profil : schéma valide',()=>{
 const json=profile.data.toJSON();
 assert.equal(json.name,'profil');
 assert.equal(json.options[0].name,'membre');
});

// ---- Dossier privé de l'équipe (/profil sur un autre membre) ----
function rich(id,roles){const m=member(id,roles,90);m.user.displayAvatarURL=()=>'https://cdn.discordapp.com/embed/avatars/0.png';m.voice={};m.guild={...guild,roles:{cache:new Collection(roles.map(r=>[r,{id:r,name:'Rôle '+r,position:1}]))}};return m;}
const view=require('../systems/qgUserView'),panel=require('../systems/qgUserPanel');
function json(p){return p.components.map(c=>c.toJSON());}
test('dossier : chaque onglet se construit, carte en tête, total de texte sous la limite',()=>{
 const actor=rich('owner',[]),target=rich(ME,['expert','recrut','community']);
 actor.guild.ownerId='owner';target.guild.ownerId='owner';
 const id=panel.open({guildId:config.guildId},actor,target,{card:true});
 for(const [tab] of view.TABS){
  const p=view.render(actor,target,id,tab),out=json(p),flat=JSON.stringify(out);
  assert.ok(flat.includes('attachment://profil-qg.png'),'carte absente : '+tab);
  assert.ok(flat.includes('qgu:publish:'+id));
  const count=node=>Array.isArray(node)?node.reduce((n,x)=>n+count(x),0):node&&typeof node==='object'?Object.entries(node).reduce((n,[k,v])=>n+(k==='content'&&typeof v==='string'?v.length:count(v)),0):0;
  const texts=count(out);
  assert.equal(new Set([...flat.matchAll(/"custom_id":"([^"]+)"/g)].map(m=>m[1])).size,[...flat.matchAll(/"custom_id":"([^"]+)"/g)].length,'custom_id dupliqué : '+tab);
  assert.ok(texts<4000,tab+' : '+texts+' caractères');
 }
 const activity=view.activity(target);
 assert.match(activity,/Niveau 14/);
 assert.match(view.records(actor,target),/Historique administratif/);
});
test('dossier sans carte (/user) : pas de galerie ni de bouton publier',()=>{
 const actor=rich('owner',[]),target=rich(ME,['expert']);
 const id=panel.open({guildId:config.guildId},actor,target);
 const flat=JSON.stringify(json(view.render(actor,target,id,'activity')));
 assert.ok(!flat.includes('attachment://'));
 assert.ok(!flat.includes('qgu:publish'));
});
test('/profil sur un autre : dossier privé pour l’équipe, carte publique sinon',async()=>{
 const calls=[];
 const make=(who,target)=>({guildId:config.guildId,user:{id:who},guild:{members:{fetch:async q=>rich(typeof q==='string'?q:q.user,typeof q==='string'?['expert','community']:(who===OTHER?['recrut','community']:['community']))}},options:{getUser:()=>({id:target,bot:false})},deferReply:async o=>calls.push(['defer',o?.flags]),editReply:async p=>calls.push(['edit',p]),reply:async p=>calls.push(['reply',p])});
 await profile.execute(make(OTHER,ME));
 assert.ok(calls[0][1],'réponse privée attendue');
 assert.ok(JSON.stringify(calls[1][1].components.map(c=>c.toJSON())).includes('Dossier de membre'));
 assert.equal(calls[1][1].files[0].name,'profil-qg.png');
 calls.length=0;
 await profile.execute(make(ME,OTHER));
 assert.equal(calls[0][1],undefined);
 assert.equal(calls[1][1].embeds[0].toJSON().image.url,'attachment://profil-qg.png');
});
