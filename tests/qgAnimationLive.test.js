const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const data=require('../utils/recruitmentData'),a=require('../utils/qgAdmin'),config=require('../config/qg'),{Collection,PermissionFlagsBits:P,ChannelType:T}=require('discord.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qg-anim-live-'));data.setDataDirectory(dir);
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
beforeEach(()=>{for(const f of fs.readdirSync(dir))fs.rmSync(path.join(dir,f),{force:true});});
const live=require('../systems/qgAnimationLive');

test('équipes aléatoires : équilibrées, sans doublon, au plus N joueurs par équipe',()=>{
 const players=Array.from({length:7},(_,n)=>'p'+n),t=live._test.teams(players,3,()=>0.5);
 assert.equal(t.length,3);assert.deepEqual(t.map(x=>x.length).sort(),[2,2,3]);
 assert.deepEqual(t.flat().sort(),[...players].sort());
 assert.equal(live._test.teams([],3).length,1);
});

test('permissions : tout le monde voit les vocaux sans y entrer ; l’équipe entre et parle ; textes cachés',()=>{
 a.save(s=>{s.schoolRoles={outsideQG:'hors',animationLead:'resp',animationManagement:'exec',creator:'dir'};});
 const guild={id:'g',client:{user:{id:'bot'}}};
 const v=live._test.voiceOverwrites(guild,['m1']),find=id=>v.find(o=>o.id===id);
 for(const id of ['g','hors']){assert.deepEqual(find(id).allow,[P.ViewChannel]);for(const bit of [P.Connect,P.Speak,P.SendMessages,P.ReadMessageHistory])assert.ok(find(id).deny.includes(bit));}
 assert.ok(find('m1').allow.includes(P.Connect)&&find('m1').allow.includes(P.SendMessages)&&find('m1').type===1);
 assert.ok(find('resp').allow.includes(P.MuteMembers));
 const ann=live._test.textOverwrites(guild,['m1'],{write:false}),t=id=>ann.find(o=>o.id===id);
 assert.ok(t('g').deny.includes(P.ViewChannel));assert.ok(t('m1').deny.includes(P.SendMessages));assert.ok(t('exec').allow.includes(P.SendMessages));
 assert.ok(live._test.textOverwrites(guild,['m1'],{write:true}).find(o=>o.id==='m1').allow.includes(P.SendMessages));
});

// Faux serveur : salons créés, déplacements, messages.
function fakeGuild(){
 const channels=new Collection(),members=new Collection(),sent=[],created=[];let n=0;
 const mkMember=(id,voiceId,roles=[])=>{const m={id,user:{id,bot:false},roles:{cache:new Map(roles.map(r=>[r,{}]))},guild:{id:config.guildId,ownerId:'owner'},send:async p=>sent.push(['dm',id,p]),
  voice:{get channelId(){return m._voice;},serverMute:false,setChannel:async to=>{const old=channels.get(m._voice);old?.members.delete(id);m._voice=typeof to==='string'?to:to.id;channels.get(m._voice)?.members.set(id,m);},setMute:async v=>{m.voice.serverMute=v;}}};
  m._voice=voiceId;members.set(id,m);if(voiceId)channels.get(voiceId)?.members.set(id,m);return m;};
 const mkChannel=(id,o={})=>{const ch={id,...o,members:new Collection(),position:o.position||0,permissionOverwrites:{edit:async()=>{},delete:async()=>{}},isTextBased:()=>true,send:async p=>{sent.push(['ch',id,p]);return{id:'msg'+(++n),edit:async()=>{}};},messages:{fetch:async()=>null,delete:async()=>{}},setPosition:async()=>{},delete:async()=>{channels.delete(id);}};channels.set(id,ch);return ch;};
 mkChannel(live.WAIT_ROOM,{type:T.GuildVoice});mkChannel(live.CONFIRM_CHANNEL);mkChannel(live.PANEL_CHANNEL);mkChannel('comvoice',{type:T.GuildCategory,position:4});
 const guild={id:config.guildId,ownerId:'owner',client:{user:{id:'bot'}},
  channels:{cache:channels,fetch:async id=>channels.get(id)||null,create:async o=>{const ch=mkChannel('c'+(++n),o);created.push(o);return ch;}},
  members:{cache:members,fetch:async x=>members.get(typeof x==='string'?x:x.user)||null}};
 return{guild,channels,members,sent,created,mkMember};
}

test('démarrage en équipes aléatoires : catégorie, vocaux d’équipe, déplacements, mention, confirmation, panneau',async()=>{
 a.save(s=>{s.schoolRoles={animationLead:'resp'};s.schoolCategories={communityVoice:'comvoice'};});
 const {guild,channels,sent,created,mkMember}=fakeGuild();
 for(const id of ['a','b','c'])mkMember(id,live.WAIT_ROOM);
 mkMember('intrus',live.WAIT_ROOM);mkMember('absent',null);
 const spec={id:'event:e1',eventId:'e1',title:'Course',organizerId:'org',format:'teams',teamSize:2,randomTeams:true,invitees:['a','b','c','absent'],startAt:0,endAt:3600000};
 const rec=await live.start(guild,spec);
 assert.match(created[0].name,/^🎉〃COURSE$/);
 assert.deepEqual(created.slice(1).map(o=>o.name),['📢・annonces-animation','💬・discussion-animation','🔊・Équipe 1','🔊・Équipe 2']);
 assert.deepEqual(rec.moved.sort(),['a','b','c']);assert.deepEqual(rec.missing,['absent']);
 assert.equal(channels.get(live.WAIT_ROOM).members.has('intrus'),true,'non invité : pas déplacé');
 const teamPings=sent.filter(([k,id,p])=>k==='ch'&&rec.voices.some(v=>v.id===id)&&/Vous êtes l’\*\*Équipe/.test(p.content));
 assert.equal(teamPings.length,2);
 const conf=sent.find(([k,id])=>k==='ch'&&id===live.CONFIRM_CHANNEL)[2];
 assert.equal(conf.content,'<@org>');assert.match(conf.embeds[0].data.description,/3\*\* déplacés[\s\S]*Absents du vocal d’attente : <@absent>/);
 assert.ok(sent.some(([k,id,p])=>k==='ch'&&id===live.PANEL_CHANNEL&&p.components[0].toJSON().components.length===3));
 // Retardataire invité : placé dans l’équipe la moins remplie.
 mkMember('absent',live.WAIT_ROOM);
 assert.equal(await live._test.lateArrivals(guild,'event:e1'),1);
 assert.ok(live._test.teams&&a.state().schoolAnimationLive['event:e1'].voices.some(v=>v.members.includes('absent')));
});

test('mute all : tout le monde sauf l’équipe animation ; unmute ; fin : voix rétablies et salons supprimés',async()=>{
 a.save(s=>{s.schoolRoles={animationManagement:'exec'};s.schoolCategories={};});
 const {guild,channels,mkMember}=fakeGuild();
 const p1=mkMember('p1',live.WAIT_ROOM),staff=mkMember('st',live.WAIT_ROOM,['exec']);
 await live.start(guild,{id:'test:1',test:true,title:'Test',organizerId:'st',format:'group',invitees:[],startAt:0,endAt:0});
 const rec=a.state().schoolAnimationLive['test:1'];
 assert.equal(rec.voices.length,1);assert.equal(p1.voice.channelId,rec.voices[0].id);
 assert.equal(await live.setMute(guild,'test:1',true),1);assert.equal(p1.voice.serverMute,true);assert.equal(staff.voice.serverMute,false);
 assert.equal(await live.setMute(guild,'test:1',false),1);assert.equal(p1.voice.serverMute,false);
 await live.setMute(guild,'test:1',true);
 assert.equal(await live.end(guild,'test:1'),true);
 assert.equal(p1.voice.serverMute,false,'voix rétablie à la fin');
 assert.ok(!channels.has(rec.categoryId)&&!channels.has(rec.voices[0].id));
 assert.equal(await live.end(guild,'test:1'),false);
});

test('MP : 15 minutes avant, lien du vocal d’attente et déplacement à l’heure prévue',()=>{
 const t=live.soonText('Course',Date.UTC(2026,10,20,20));
 assert.match(t,new RegExp(`<#${live.WAIT_ROOM}>`));assert.match(t,/discord\.com\/channels\/\d+\/1561466341989425273/);assert.match(t,/déplacé automatiquement à l’heure prévue/);
});

test('chat d’équipe : pseudo Roblox à copier et lien du profil de chaque joueur',()=>{
 a.save(s=>{s.schoolEntryVerification={a:{robloxId:'123',robloxName:'JoueurA'}};});
 assert.equal(live._test.playerLine('a'),'<@a> · Roblox : `JoueurA` · [profil](https://www.roblox.com/users/123/profile)');
 assert.equal(live._test.playerLine('b'),'<@b> · Roblox non relié');
 const t=live._test.teamMessage('Équipe 1',['a','b']);
 assert.match(t,/^<@a> <@b>\nVous êtes l’\*\*Équipe 1\*\*/);assert.match(t,/pseudo Roblox à copier[\s\S]*`JoueurA`[\s\S]*Roblox non relié/);
});

test('salons de l’animation : fils, messages vocaux et soundboard interdits aux joueurs',()=>{
 a.save(s=>{s.schoolRoles={outsideQG:'hors',animationLead:'resp'};});
 const guild={id:'g',client:{user:{id:'bot'}}},blocked=[P.CreatePublicThreads,P.CreatePrivateThreads,P.SendVoiceMessages,P.UseSoundboard,P.UseExternalSounds];
 const v=live._test.voiceOverwrites(guild,['m1']),t=live._test.textOverwrites(guild,['m1'],{write:true});
 for(const o of [v.find(x=>x.id==='g'),v.find(x=>x.id==='hors'),v.find(x=>x.id==='m1'),t.find(x=>x.id==='g'),t.find(x=>x.id==='m1')])for(const bit of blocked)assert.ok(o.deny.includes(bit),o.id+' '+bit);
 assert.ok(!(v.find(x=>x.id==='resp').deny||[]).length,'l’équipe animation garde ses droits');
});

test('panel animations : « Créer » depuis le panel public, le formulaire répond en privé sans toucher au panel',async()=>{
 const anim=require('../systems/qgAnimations'),{MessageFlags,MessageFlagsBitField}=require('discord.js');
 a.save(s=>{s.schoolRoles={animationLead:'resp'};});
 const member={id:'u1',roles:{cache:new Map([['resp',{}]])},guild:{id:config.guildId,ownerId:'x'}};
 const base={user:{id:'u1'},guildId:config.guildId,guild:{id:config.guildId,ownerId:'x',members:{fetch:async()=>member}}};
 let modal;await anim.handle({...base,customId:'qga:p:new',showModal:async m=>{modal=m.toJSON();}});
 const calls=[];
 const submit={...base,customId:modal.custom_id,isModalSubmit:()=>true,message:{flags:new MessageFlagsBitField(MessageFlags.IsComponentsV2)},
  fields:{getTextInputValue:k=>({title:'Course',summary:'Résumé',start:'20/11/2030 21:00',minutes:'60',type:'Jeu'})[k]},
  deferReply:async o=>calls.push(['deferReply',o.flags]),deferUpdate:async()=>calls.push(['deferUpdate']),editReply:async p=>calls.push(['editReply',!!p.embeds])};
 await anim.handle(submit);
 assert.deepEqual(calls[0],['deferReply',MessageFlags.Ephemeral]);
 assert.deepEqual(calls.at(-1),['editReply',true]);
 assert.ok(!calls.some(c=>c[0]==='deferUpdate'));
});

test('annonce : aperçu en MP à l’animateur, publication avec mention seulement après confirmation',async()=>{
 const anim=require('../systems/qgAnimations');
 a.save(s=>{s.schoolRoles={separatorGrade:'sg',animationLead:'resp'};s.schoolAnimations={events:{},posts:{},suggestions:{},calendar:[],deliveries:{}};});
 // Animation déjà créée avant la mise à jour : elle reçoit aussi son aperçu.
 const e={...anim.newEvent({title:'Course de karts',summary:'Une course folle',description:'Rendez-vous sur la piste',startAt:Date.now()+86400000,minutes:90,type:'Jeu',organizerId:'org',coorganizers:[],capacity:8,signups:true,format:'teams',teamSize:4,randomTeams:true,families:['Dynasty']},'org'),createdAt:1};
 anim.save(s=>{s.events[e.id]=e;});
 const dms=[],news=[],emojis=new Collection([['1',{id:'1',name:'calendar_qg',available:true}]]);
 const dm={id:'dm',send:async p=>{dms.push(p);return{id:'p1',channelId:'dm'};},messages:{fetch:async()=>({id:'p1',edit:async p=>dms.push(p)})}};
 const ch={id:anim.NEWS,guildId:config.guildId,isTextBased:()=>true,send:async p=>{news.push(p);return{id:'n1'};},messages:{fetch:async()=>null}};
 const member={id:'org',roles:{cache:new Map()},guild:{id:config.guildId,ownerId:'x'}};
 const guild={id:config.guildId,emojis:{cache:emojis},roles:{cache:new Map([['1561363081018474626',{name:'A / Sanctions / Grade'}]])},channels:{fetch:async id=>id===anim.NEWS?ch:null},
  members:{fetch:async()=>member},client:{users:{fetch:async()=>({createDM:async()=>dm})}}};
 assert.equal(await anim.announceEvent(guild,e.id),true);
 assert.equal(news.length,0,'rien de publié sans confirmation');
 const text=JSON.stringify(dms[0].components.map(c=>c.toJSON()));
 for(const x of ['Aperçu de l’annonce','Course de karts','Une course folle','Rendez-vous sur la piste','<:calendar_qg:1>','équipes de 4 joueurs, tirées au sort','Dynasty','@A / Sanctions / Grade','qgan:publish:','qgan:edit:','qgan:skip:'])assert.ok(text.includes(x),x);
 assert.ok(!text.includes('<@&1561363081018474626>'),'pas de mention dans l’aperçu');
 assert.equal(await anim.announceEvent(guild,e.id),false,'aperçu envoyé une seule fois');
 // Modifier la description puis publier, depuis le MP.
 const replies=[];const click=(customId,extra={})=>anim.newsHandle({customId,user:{id:'org'},client:{guilds:{cache:new Map([[config.guildId,guild]])}},deferUpdate:async()=>{},editReply:async p=>replies.push(p),reply:async p=>replies.push(p),...extra});
 await click('qgan:save:'+e.id,{fields:{getTextInputValue:k=>k==='summary'?'Nouvelle description':'Détails'}});
 assert.equal(anim.event(e.id).summary,'Nouvelle description');assert.ok(JSON.stringify(replies[0].components.map(c=>c.toJSON())).includes('Nouvelle description'));
 await click('qgan:publish:'+e.id);
 assert.equal(news.length,1);assert.ok(JSON.stringify(news[0].components[0].toJSON()).includes('<@&1561363081018474626>'));assert.deepEqual(news[0].allowedMentions.roles,['1561363081018474626']);
 assert.match(JSON.stringify(replies.at(-1).components[0].toJSON()),/publiée/);
 await click('qgan:publish:'+e.id);assert.equal(news.length,1,'pas de doublon');
 // Quelqu’un d’autre ne peut pas valider.
 member.id='autre';const before=replies.length;await click('qgan:skip:'+e.id);assert.match(replies[before].content,/Seul l’animateur/);
});

test('bouton S’inscrire : emoji :statusonline: du serveur, sinon ✋',()=>{
 const anim=require('../systems/qgAnimations');
 const e={...anim.newEvent({title:'X',startAt:Date.now()+86400000,minutes:30,organizerId:'o',coorganizers:[],capacity:null,signups:true},'o')};
 const guild={id:config.guildId,emojis:{cache:new Collection([['9',{id:'9',name:'statusonline',available:true}]])},roles:{cache:new Map()}};
 const btn=JSON.stringify(anim.newsPayload(guild,e).components[0].toJSON());
 assert.match(btn,/"emoji":\{"id":"9","name":"statusonline","animated":false\}/);
 assert.match(JSON.stringify(anim.newsPayload({emojis:{cache:new Collection()},roles:{cache:new Map()}},e).components[0].toJSON()),/✋/);
});

test('/accueil-vocal musique : fichier vérifié puis utilisé, fichier illisible refusé, retour à l’origine',async()=>{
 const audio=require('../systems/qgVoiceReception');
 const good=fs.readFileSync(path.join(audio.root,'deplacement.mp3'));
 assert.ok(audio.musicPath().endsWith('attente-entretien.mp3')&&!audio.musicPath().startsWith(dir));
 assert.equal(await audio.setMusic({name:'ma-musique.mp3',size:good.length,url:'x'},{download:async()=>good}),'ma-musique.mp3');
 assert.equal(audio.musicPath(),audio.customMusic());assert.ok(audio.musicPath().startsWith(dir));
 assert.equal(audio.config().customMusic.name,'ma-musique.mp3');
 await assert.rejects(audio.setMusic({name:'faux.mp3',size:10,url:'x'},{download:async()=>Buffer.from('pas du son')}),/Musique refusée/);
 assert.equal(audio.musicPath(),audio.customMusic(),'l’ancienne musique reste en place');
 await assert.rejects(audio.setMusic({name:'image.png',size:10,url:'x'}),/Format accepté/);
 await assert.rejects(audio.setMusic({name:'gros.mp3',size:30*1024*1024,url:'x'}),/25 Mo/);
 audio.resetMusic();assert.ok(!audio.musicPath().startsWith(dir));
});
