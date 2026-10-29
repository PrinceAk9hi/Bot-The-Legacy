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
 assert.equal(staff.title,'Communauté');
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
