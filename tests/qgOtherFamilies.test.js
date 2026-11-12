const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const data=require('../utils/recruitmentData'),a=require('../utils/qgAdmin'),config=require('../config/qg'),{Collection}=require('discord.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-other-families-'));data.setDataDirectory(dir);
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const families=require('../systems/qgOtherFamilies');
const A='111111111111111111',B='222222222222222222',C='333333333333333333',BOT='444444444444444444';
beforeEach(()=>{for(const f of fs.readdirSync(dir))fs.rmSync(path.join(dir,f),{force:true});});

const group=(id,name,owner)=>({group:{id,name,owner:{userId:1,username:owner}}});
// Faux Roblox : communautés par joueur.
function roblox(byUser){
 const calls=[];
 return{calls,http:async url=>{const id=Number(/users\/(\d+)\//.exec(url)[1]);calls.push(id);if(byUser[id]==='error')return{ok:false,status:429};return{ok:true,json:async()=>({data:byUser[id]||[]})};}};
}
function setup(){
 const sent=[];
 const members=new Collection([A,B,C].map(id=>[id,{id,user:{id,bot:false}}]));members.set(BOT,{id:BOT,user:{id:BOT,bot:true}});
 const logs={id:'logs',guildId:config.guildId,isTextBased:()=>true,send:async p=>{sent.push(p);}};
 const guild={id:config.guildId,members:{cache:members,fetch:async()=>members},channels:{fetch:async id=>id==='logs'?logs:null}};
 a.save(s=>{s.schoolChannels={logsModeration:'logs'};s.schoolEntryVerification={[A]:{robloxId:'10',robloxName:'JoueurA'},[B]:{robloxId:'20',robloxName:'JoueurB'}};});
 return{guild,sent};
}

test('nom de famille : partie School retirée (formats réels des communautés)',()=>{
 assert.equal(families._test.familyName('KITSUNE | SCHOOLRP'),'KITSUNE');
 assert.equal(families._test.familyName('ECLIPSE | SCHOOL RP'),'ECLIPSE');
 assert.equal(families._test.familyName('DIOR | SCHOOL'),'DIOR');
 assert.equal(families._test.familyName('APOCALYPSE / SCHOOLRP'),'APOCALYPSE');
 assert.equal(families._test.familyName('admin schoolrp'),'admin');
 assert.equal(families._test.familyName('Maison Aston'),'Maison Aston');
 assert.equal(families._test.familyName('DYNASTY | SCHOOLRP'),'DYNASTY');
 assert.equal(families._test.familyName('School Staff | Les Gardiens'),'Les Gardiens');
 assert.equal(families._test.familyName('SchoolRP|Nova '),'Nova');
 assert.equal(families._test.familyName('Sans séparateur'),'Sans séparateur');
});

test('seules les communautés créées par colonelrqt2 comptent, sauf la nôtre',()=>{
 const list=[{id:1,name:'DYNASTY | SCHOOLRP',owner:'colonelrqt2'},{id:2,name:'Shadow | SCHOOLRP',owner:'quelquun'},{id:Number(config.robloxGroupId),name:'School RP | QG',owner:'colonelrqt2'},{id:3,name:'LA NIGHTMARE | SCHOOLRP',owner:'colonelrqt2'},{id:4,name:'KRATOS | SCHOOLRP',owner:'colonelrqt2'},{id:5,name:'Dynasty | SCHOOLRP',owner:'colonelrqt2'}];
 assert.deepEqual(families._test.otherFamilies(list),[{id:1,name:'Dynasty'},{id:3,name:'NIGHTMARE'}]);
});

test('vérification de tous les membres liés à Roblox, signalement des nouvelles familles une seule fois',async()=>{
 const {guild,sent}=setup();
 const r=roblox({10:[group(1,'DYNASTY | SCHOOLRP','ColonelRqt2'),group(9,'Autre groupe','x')],20:[group(Number(config.robloxGroupId),'School RP | QG','colonelrqt2')]});
 assert.equal(await families.tick(guild,{http:r.http,now:1000}),1);
 assert.deepEqual(r.calls.sort(),[10,20]); // C n'a pas de compte Roblox, le bot est ignoré
 assert.match(sent[0].embeds[0].data.description,new RegExp(`<@${A}>[\\s\\S]*JoueurA[\\s\\S]*\\*\\*Dynasty\\*\\*`));
 assert.deepEqual(a.state().schoolOtherFamilies[A].families,[{id:1,name:'Dynasty'}]);
 // Le lendemain : même famille, pas de nouveau signalement ; nouvelle famille, signalée.
 const r2=roblox({10:[group(1,'DYNASTY | SCHOOLRP','colonelrqt2'),group(5,'Shadow | SCHOOLRP','colonelrqt2')],20:[]});
 assert.equal(await families.tick(guild,{http:r2.http,now:1000+86400000}),1);
 assert.equal(sent.length,2);assert.match(sent[1].embeds[0].data.description,/\*\*Shadow\*\*/);assert.doesNotMatch(sent[1].embeds[0].data.description,/Dynasty/);
 // Avant 24 h : personne n'est revérifié.
 const r3=roblox({});await families.tick(guild,{http:r3.http,now:2000+86400000});assert.deepEqual(r3.calls,[]);
});

test('erreur Roblox : membre revérifié une heure plus tard, sans signalement',async()=>{
 const {guild,sent}=setup();
 const r=roblox({10:'error',20:[]});
 await families.tick(guild,{http:r.http,now:1000});
 assert.equal(sent.length,0);assert.equal(a.state().schoolOtherFamilies[A].next,1000+3600000);
 const r2=roblox({10:[group(1,'DYNASTY | SCHOOLRP','colonelrqt2')]});
 await families.tick(guild,{http:r2.http,now:1000+3600000});assert.equal(sent.length,1);
});

test('=familles : liste réservée, avec le nombre de comptes vérifiés',async()=>{
 const {guild}=setup();
 await families.tick(guild,{http:roblox({10:[group(1,'DYNASTY | SCHOOLRP','colonelrqt2')],20:[]}).http,now:1000});
 const replies=[];
 const msg=roles=>({guildId:config.guildId,content:'=familles',author:{id:A},reply:async p=>replies.push(p),guild:{...guild,members:{...guild.members,fetch:async q=>q?.user?{id:A,user:{id:A},guild:{id:config.guildId,ownerId:'owner'},roles:{cache:new Collection(roles.map(r=>[r,{id:r}]))}}:guild.members.cache}}});
 a.save(s=>{s.schoolRoles={recruitmentLead:'lead'};});
 assert.equal(await families.command(msg([])),true);assert.match(replies[0].content,/réservée/);
 await families.command(msg(['lead']));
 const text=replies[1].embeds[0].data.description;
 assert.match(text,new RegExp(`<@${A}> \\(JoueurA\\) — \\*\\*Dynasty\\*\\*`));assert.match(text,/2\/2 comptes Roblox vérifiés · 1 membre\(s\) sans compte/);
 assert.equal(await families.command({...msg(['lead']),content:'=famille x'}),false);
});

test('familles actives : liste des gérants, alias, familles inactives ignorées',()=>{
 assert.equal(families.activeFamily('THE_ORDER | SCHOOLRP'),'The Order');
 assert.equal(families.activeFamily('BRIGADE FANTOME | SCHOOLRP'),'Brigade fantôme');
 assert.equal(families.activeFamily('CRPS | SCHOOLRP'),'Crips');
 assert.equal(families.activeFamily('LA NIGHTMARE | SCHOOLRP'),'NIGHTMARE');
 assert.equal(families.activeFamily('NIGHT | SCHOOLRP'),null);
 assert.equal(families.activeFamily('KRATOS | SCHOOLRP'),null);
 assert.equal(families.activeFamily('QG | SCHOOLRP'),null);
});

test('profil : familles actives du membre, inactives retirées',()=>{
 a.save(s=>{s.schoolOtherFamilies={[A]:{checkedAt:1,families:[{id:1,name:'Dynasty'},{id:9,name:'KRATOS'}]},[B]:{checkedAt:1,families:[]}};});
 assert.deepEqual(families.familiesOf(A),['Dynasty']);assert.deepEqual(families.familiesOf(B),[]);assert.deepEqual(families.familiesOf(C),[]);
});
