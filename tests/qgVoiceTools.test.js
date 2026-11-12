const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const data=require('../utils/recruitmentData'),a=require('../utils/qgAdmin'),config=require('../config/qg'),{Collection,MessageFlags}=require('discord.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-voice-tools-'));data.setDataDirectory(dir);
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const tools=require('../systems/qgVoiceTools'),upgrade=require('../systems/qgCommunityUpgrade');
const AUTHOR='111111111111111111',SRC='222222222222222222',DEST='333333333333333333';
beforeEach(()=>{for(const f of fs.readdirSync(dir))fs.rmSync(path.join(dir,f),{force:true});tools._test.pending.clear();});
const allow={has:()=>true},deny={has:()=>false};

function setup({canManage=true}={}){
 const replies=[],deleted=[],bulk=[];
 const guild={id:config.guildId,ownerId:'owner',members:{fetchMe:async()=>({id:'bot'})},channels:{}};
 const channel={name:'general',permissionsFor:m=>m.id==='bot'||canManage?allow:deny,bulkDelete:async(n,old)=>{bulk.push([n,old]);return new Collection(Array.from({length:n},(_,k)=>[String(k),{}]));}};
 const msg=content=>({guildId:config.guildId,guild,channel,content,author:{id:AUTHOR,bot:false},member:{id:AUTHOR},delete:async()=>{deleted.push(content);},reply:async p=>{replies.push(p.content);return{edit:async q=>replies.push(q.content)};}});
 return{guild,channel,msg,replies,deleted,bulk};
}

test('=clear : supprime la commande et N messages, sans aucune réponse',async()=>{
 const s=setup();
 assert.equal(await tools.message(s.msg('=clear 15')),true);
 assert.deepEqual(s.deleted,['=clear 15']);assert.deepEqual(s.bulk,[[15,true]]);assert.deepEqual(s.replies,[]);
 await tools.message(s.msg('=clear 500'));assert.deepEqual(s.bulk.at(-1),[100,true]);
 await tools.message(s.msg('=clear'));assert.equal(s.bulk.length,2);assert.deepEqual(s.replies,[]);
});

test('=clear : sans permission, rien n’est supprimé à part la commande',async()=>{
 const s=setup({canManage:false});
 await tools.message(s.msg('=clear 5'));
 assert.deepEqual(s.bulk,[]);assert.deepEqual(s.replies,[]);assert.deepEqual(s.deleted,['=clear 5']);
});

test('=mvvoc : déplace tout le vocal dans le prochain vocal rejoint',async()=>{
 const s=setup(),moved=[];
 const member=id=>({id,voice:{setChannel:async ch=>moved.push([id,ch.id])}});
 const source={id:SRC,name:'source',isVoiceBased:()=>true,permissionsFor:()=>allow,members:new Collection([[AUTHOR,member(AUTHOR)],['a',member('a')],['b',member('b')]])};
 const dest={id:DEST,name:'dest',isVoiceBased:()=>true,permissionsFor:()=>allow};
 s.guild.channels.fetch=async id=>id===SRC?source:null;
 s.guild.members.fetch=async()=>({id:AUTHOR,voice:{channelId:SRC},user:{username:'x'}});
 await tools.message(s.msg('=mvvoc'));
 assert.match(s.replies[0],/Rejoins maintenant le vocal de destination/);
 const author={id:AUTHOR,user:{username:'x'}};
 // Un autre membre qui bouge ne déclenche rien.
 await tools.voice({channelId:SRC},{id:'a',channelId:DEST,channel:dest,guild:s.guild,member:author});assert.deepEqual(moved,[]);
 await tools.voice({channelId:SRC},{id:AUTHOR,channelId:DEST,channel:dest,guild:s.guild,member:author});
 assert.deepEqual(moved,[['a',DEST],['b',DEST]]);
 assert.match(s.replies.at(-1),/2 membres déplacés/);
 // Commande consommée : un nouveau changement de vocal ne redéplace personne.
 await tools.voice({channelId:DEST},{id:AUTHOR,channelId:SRC,channel:source,guild:s.guild,member:author});assert.equal(moved.length,2);
});

test('=mvvoc : vocal source indiqué, et refus sans vocal',async()=>{
 const s=setup();
 s.guild.channels.fetch=async id=>id===SRC?{id:SRC,isVoiceBased:()=>true,permissionsFor:()=>allow}:null;
 s.guild.members.fetch=async()=>({id:AUTHOR,voice:{channelId:null}});
 await tools.message(s.msg('=mvvoc'));assert.match(s.replies.at(-1),/Indique le vocal/);
 await tools.message(s.msg(`=mvvoc <#${SRC}>`));assert.equal(tools._test.pending.get(AUTHOR).sourceId,SRC);
});

test('nouvelle recrue : annonce envoyée tout de suite, une seule fois',async()=>{
 const sent=[];
 const ch={isTextBased:()=>true,guildId:config.guildId,send:async p=>{sent.push(p);return{id:'m'+sent.length};},messages:{fetch:async()=>new Collection()}};
 const guild={id:config.guildId,channels:{fetch:async()=>ch}};
 a.save(s=>{s.schoolFamilyMembership={[AUTHOR]:{active:true,joinedAt:123}};});
 await Promise.all([upgrade.announce(guild,AUTHOR),upgrade.announce(guild,AUTHOR)]);
 assert.equal(sent.length,1);assert.match(sent[0].embeds[0].data.description,new RegExp(AUTHOR));
});

test('effectif complet : emoji du serveur, rôle et nombre pour chaque grade',()=>{
 const roles=new Collection([['r-test',{id:'r-test',name:'Membre Test'}],['r-conf',{id:'r-conf',name:'✦ Membre Confirmé'}],['r-sen',{id:'r-sen',name:'Membre Senior',unicodeEmoji:'⭐'}],['r-ref',{id:'r-ref',name:'Référent du QG'}],['r-crea',{id:'r-crea',name:'Créateur'}],['r-rp',{id:'r-rp',name:'Exécutant RP'}]]);
 const emojis=new Collection([['1',{id:'1',name:'membre_test'}],['2',{id:'2',name:'confirme',animated:true}],['3',{id:'3',name:'referent'}],['4',{id:'4',name:'membre'}]]);
 const guild={roles:{cache:roles},emojis:{cache:emojis}};
 a.save(s=>{s.schoolRoles={test:'r-test',confirmed:'r-conf',senior:'r-sen',creator:'r-crea',referent:'r-ref',rpManagement:'r-rp'};});
 const m=(...ids)=>({roles:{cache:new Collection(ids.map(id=>[id,{}]))}});
 const parts=upgrade._test.fullRoster(guild,[m('r-test'),m('r-test'),m('r-conf'),m('r-crea'),m('r-ref'),m('r-rp')]);
 assert.deepEqual(parts.map(p=>p.title),['👑 Direction','🎖️ Grades de la famille','🛠️ Exécutants']);
 assert.deepEqual(parts[0].lines,['▫️ <@&r-crea> - **1**','<:referent:3> <@&r-ref> - **1**']);
 assert.deepEqual(parts[1].lines,['⭐ <@&r-sen> - **0**','<a:confirme:2> <@&r-conf> - **1**','<:membre_test:1> <@&r-test> - **2**']);
 assert.deepEqual(parts[2].lines,['▫️ <@&r-rp> - **1**']);
 const p=upgrade._test.rosterPage({total:3,page:0,pages:1,lines:['x'],summary:parts});
 assert.equal(p.flags,MessageFlags.IsComponentsV2);
 const json=JSON.stringify(p.components[0].toJSON());
 assert.match(json,/Grades de la famille/);assert.ok(json.includes('<:membre_test:1> <@&r-test> - **2**'));
 assert.doesNotMatch(JSON.stringify(upgrade._test.rosterPage({total:3,page:1,pages:2,lines:['x']}).components[0].toJSON()),/Direction/);
});

test('badges : chaque badge de rôle retrouve l’emoji du serveur qui a la même image',async()=>{
 const badges=require('../utils/qgRoleBadges');badges._test.prints.clear();
 const img=v=>new Uint8Array(768).fill(v);
 // Images : badge Senior ≈ emoji 20 (léger écart d'encodage), badge Test = emoji 10, badge sans emoji ressemblant.
 const images={'emoji/10':img(10),'emoji/20':img(200),'emoji/30':img(120),'role/senior':img(195),'role/test':img(10),'role/autre':img(60)};
 let calls=0;const print=async url=>{calls++;const key=Object.keys(images).find(k=>url.includes(k.replace('emoji/','emojis/').replace('role/','role-icons/')));return images[key];};
 const emojis=new Collection([['10',{id:'10',name:'badge_test'}],['20',{id:'20',name:'etoile',animated:true}],['30',{id:'30',name:'autre'}]]);
 const role=(id,icon)=>({id,icon,iconURL:()=>'https://cdn.discordapp.com/role-icons/'+icon+'.png'});
 const guild={emojis:{cache:emojis}};
 const map=await badges.badgeEmojis(guild,[role('rs','senior'),role('rt','test'),role('ra','autre'),{id:'sans-badge',icon:null}],{print});
 assert.equal(map.get('rs'),'<a:etoile:20>');assert.equal(map.get('rt'),'<:badge_test:10>');assert.equal(map.has('ra'),false);assert.equal(map.has('sans-badge'),false);
 // Résultat mémorisé : pas de nouveau téléchargement tant que le badge ne change pas.
 const before=calls;const again=await badges.badgeEmojis(guild,[role('rs','senior'),role('rt','test')],{print});
 assert.equal(again.get('rs'),'<a:etoile:20>');assert.equal(calls,before);
 // Le badge prime sur la correspondance par nom dans l'effectif.
 const roles=new Collection([['rs',{id:'rs',name:'Membre Senior'}]]);
 a.save(s=>{s.schoolRoles={senior:'rs'};});
 const parts=upgrade._test.fullRoster({roles:{cache:roles},emojis:{cache:emojis}},[{roles:{cache:new Collection([['rs',{}]])}}],again);
 assert.deepEqual(parts[0].lines,['<a:etoile:20> <@&rs> - **1**']);
});

test('badges : empreinte d’une vraie image PNG',async()=>{
 const {createCanvas}=require('@napi-rs/canvas'),c=createCanvas(64,64),ctx=c.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,64,64);
 const png=c.toBuffer('image/png'),old=global.fetch;
 global.fetch=async()=>({ok:true,arrayBuffer:async()=>png.buffer.slice(png.byteOffset,png.byteOffset+png.length)});
 try{
  const badges=require('../utils/qgRoleBadges');badges._test.prints.clear();
  const emojis=new Collection([['1',{id:'1',name:'rouge'}]]);
  const map=await badges.badgeEmojis({emojis:{cache:emojis}},[{id:'r',icon:'h2',iconURL:()=>'https://x/role.png'}]);
  assert.equal(map.get('r'),'<:rouge:1>');
 }finally{global.fetch=old;}
});
