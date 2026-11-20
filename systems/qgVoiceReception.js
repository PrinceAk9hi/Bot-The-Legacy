// Accueil vocal du salon d'attente entretien.
// - Un candidat attend : le bot rejoint le vocal et diffuse la musique de fond (attente-entretien.mp3, en boucle).
// - L'annonce « accueil » passe à l'arrivée puis toutes les 30 secondes : la musique baisse pendant
//   qu'elle parle, puis remonte à fond.
// - Plus personne en attente : le bot quitte le vocal.
// Second salon (1561466341989425273) : même musique, annonce « vous allez bientôt être déplacés », dès qu'un
// membre s'y trouve. Le bot ne peut occuper qu'un vocal par serveur : l'attente entretien est prioritaire.
const u=require('../utils/qgModuleUi'),{a}=u,live=require('./qgRecruitmentLive'),{Mixer}=require('../utils/qgAudioMixer'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../assets/audio/qg'),defaults={enabled:true,normal:.6,duck:.12,voice:1,downMs:1500,upMs:2000,interval:30000};
const MUSIC='attente-entretien',ANNOUNCEMENTS=['accueil','deplacement'],MOVE_ROOM='1561466341989425273';
// Salons servis, par priorité : l'attente entretien, puis le salon de déplacement. Aucun rôle requis :
// n'importe quel membre (hors bots) présent dans le salon suffit.
const ROOM_LABELS={reunion:'Réunion',entretien:'Attente entretien',aide:'Attente aide'};
const ROOMS=[
 {key:'reunion',get id(){return require('./qgMeetings').voiceId();},announcement:null,need:g=>{const id=require('./qgMeetings').openVoice();if(!id)return false;const l=listeners(g,id);return l.length>0&&!l.some(m=>a.isDirection(m));}},
 {key:'entretien',id:live.WAIT,announcement:'accueil',need:g=>live.state().queue.length>0||listeners(g,live.WAIT).length>0},
 {key:'aide',id:MOVE_ROOM,announcement:'deplacement',need:g=>listeners(g,MOVE_ROOM).length>0}];
const target=g=>ROOMS.find(r=>r.need(g))||null;
let room=null;
const config=()=>({...defaults,...a.state().voiceReception});
// Musique de fond : celle envoyée avec /accueil-vocal musique si elle existe, sinon celle du projet.
const customMusic=(key='entretien')=>path.join(require('../utils/recruitmentData').getDataDirectory(),'audio',key==='entretien'?'attente-entretien.mp3':`attente-${key}.mp3`);
const musicPath=(key='entretien')=>fs.existsSync(customMusic(key))?customMusic(key):path.join(root,MUSIC+'.mp3');
const MAX_MUSIC=25*1024*1024;
// Vérifie que le fichier se lit (FFmpeg) avant de remplacer la musique.
// Le résultat n'est rendu qu'une fois FFmpeg fermé (sous Windows, le fichier reste verrouillé tant qu'il tourne).
function playable(file,ms=15000){return new Promise((resolve,reject)=>{let src;try{src=require('../utils/qgAudioMixer').decode(file);}catch(e){return reject(e);}let bytes=0,result=null,closed=false;
 const finish=()=>{if(!result||!closed)return;clearTimeout(t);result.err?reject(result.err):resolve(bytes);};
 const done=err=>{if(result)return;result={err};try{src.stream.destroy();src.process.kill();}catch{}finish();};
 const t=setTimeout(()=>{bytes>0?done():done(Error('Lecture du fichier trop lente.'));closed=true;finish();},ms);
 src.stream.on('data',b=>{bytes+=b.length;if(bytes>192000)done();});src.process.on('error',e=>{done(e);closed=true;finish();});
 src.process.on('close',code=>{if(!result)done(code&&!bytes?Error('Fichier audio illisible.'):bytes?null:Error('Fichier audio vide.'));closed=true;finish();});});}
// Remplace la musique : téléchargement, vérification, puis la boucle repart avec le nouveau fichier.
async function setMusic(attachment,{key='entretien',download=url=>fetch(url).then(r=>{if(!r.ok)throw Error('Téléchargement impossible ('+r.status+').');return r.arrayBuffer();})}={}){
 if(!attachment)throw Error('Joins un fichier audio.');
 if(!/\.(mp3|ogg|wav|m4a|flac)$/i.test(attachment.name||''))throw Error('Format accepté : mp3, ogg, wav, m4a ou flac.');
 if(attachment.size>MAX_MUSIC)throw Error('Fichier trop lourd (25 Mo maximum).');
 if(!ROOM_LABELS[key])throw Error('Salon inconnu.');
 const target=customMusic(key),tmp=target+'.tmp';
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(tmp,Buffer.from(await download(attachment.url)));
 try{await playable(tmp);}catch(e){fs.rmSync(tmp,{force:true});throw Error('Musique refusée : '+e.message);}
 fs.renameSync(tmp,target);
 persist({musics:{...(config().musics||{}),[key]:{name:attachment.name,size:attachment.size,at:Date.now()}}});
 restartMusic(key);
 return attachment.name;
}
function resetMusic(key='entretien'){fs.rmSync(customMusic(key),{force:true});const musics={...(config().musics||{})};delete musics[key];persist({musics,customMusic:null});restartMusic(key);}
// La boucle repart avec le nouveau fichier si le bot joue en ce moment.
function restartMusic(key){if(key&&(room?.key||'entretien')!==key)return;try{mixer?.destroy();}catch{}mixer=null;if(player&&connection)try{ensureMusic();}catch(e){lastError=e.message;}}
const files=[...ANNOUNCEMENTS,MUSIC];
const labels={accueil:'Bienvenue',deplacement:'Déplacement imminent'};
let announcementVersion=0;let connection,player,mixer=null,busy=false,current=null,nextAt=0,welcome=false,lastError=null,reconnectAt=0,guildRef,stopped=false,testing=false,decoder=null;
function persist(patch){a.save(s=>{s.voiceReception={...config(),...patch};});}
function checkFiles(){const absent=files.filter(n=>!fs.existsSync(path.join(root,n+'.mp3')));if(absent.length)throw Error('Ajoute les fichiers suivants dans assets/audio/qg : '+absent.map(x=>x+'.mp3').join(', '));const ffmpeg=process.env.FFMPEG_PATH||require('ffmpeg-static');if(!ffmpeg||!fs.existsSync(ffmpeg))throw Error('FFmpeg absent. Réinstalle les dépendances.');}
// Une seule annonce : l'accueil (plus d'annonce sur les recruteurs en bureau).
function choice(guild){return(guild&&target(guild)?.announcement)||'accueil';}
function stopAudio(){announcementVersion++;try{decoder?.process?.kill();}catch{}decoder=null;try{mixer?.destroy();}catch{}mixer=null;player?.stop(true);player=null;current=null;}
function disconnect(){stopAudio();if(connection&&connection.state.status!=='destroyed')connection.destroy();connection=null;reconnectAt=0;}
async function connect(guild,voice=require('@discordjs/voice'),id=room?.id||live.WAIT){if(Date.now()<reconnectAt)return;if(connection?.state.status===voice.VoiceConnectionStatus.Ready&&connection.joinConfig?.channelId===id)return;const ch=await guild.channels.fetch(id),bot=await guild.members.fetchMe();if(!ch?.isVoiceBased()||!ch.permissionsFor(bot)?.has([u.PermissionFlagsBits.ViewChannel,u.PermissionFlagsBits.Connect,u.PermissionFlagsBits.Speak]))throw Error('Accès au vocal d’accueil insuffisant.');const other=voice.getVoiceConnection(guild.id);if(other&&other!==connection&&!ROOMS.some(r=>r.id===other.joinConfig.channelId))throw Error('Le bot utilise déjà un autre vocal. Libère cette connexion avant activation.');reconnectAt=Date.now()+15000;if(connection&&connection.state.status!=='destroyed'){connection.rejoin({channelId:id});}else{connection=voice.joinVoiceChannel({channelId:id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator,selfDeaf:true,selfMute:false});connection.on('error',e=>{lastError=e.message;});connection.on('stateChange',(_,next)=>{if(next.status==='disconnected'||next.status==='destroyed'){stopAudio();nextAt=Date.now()+15000;}});}await voice.entersState(connection,voice.VoiceConnectionStatus.Ready,20000);lastError=null;if(ch.type===13)await(await guild.members.fetchMe()).voice.setSuppressed(false).catch(()=>{});}
// Musique de fond en boucle, mixée avec les annonces (baisse pendant la voix, puis remontée).
function ensureMusic(){
 const voice=require('@discordjs/voice');
 if(!player){player=voice.createAudioPlayer({behaviors:{noSubscriber:voice.NoSubscriberBehavior.Play}});player.on('error',e=>{lastError=e.message;try{mixer?.destroy();}catch{}mixer=null;});connection.subscribe(player);}
 if(mixer&&!mixer.destroyed)return;
 mixer=new Mixer(musicPath(room?.key||'entretien'),config());
 mixer.on('error',e=>{lastError='Musique : '+e.message;});
 player.play(voice.createAudioResource(mixer,{inputType:voice.StreamType.Raw}));
}
async function announce(name,{replace=false}={}){if(!ANNOUNCEMENTS.includes(name)||current&&!replace)return;ensureMusic();const version=++announcementVersion;current=name;
 try{if(replace)mixer.cancelAnnouncement();await mixer.announce(path.join(root,name+'.mp3'));}
 catch(e){if(e.code!=='ANNOUNCEMENT_REPLACED')lastError=e.message;}finally{if(version===announcementVersion){current=null;nextAt=Date.now()+config().interval;}}}
async function playNow(guild,name='context'){return a.serial('voice-manual',async()=>{
 if(!config().enabled)throw Error('L’accueil vocal est désactivé.');
 const r=target(guild);if(!r)throw Error('Personne n’attend dans les vocaux d’attente.');
 if(room?.id!==r.id){disconnect();room=r;}
 if(name==='context')name=r.announcement;
 if(!ANNOUNCEMENTS.includes(name))throw Error('Annonce inconnue.');
 checkFiles();await connect(guild);if(connection?.state.status!=='ready')throw Error('Connexion en cours. Réessaie dans quelques secondes.');
 welcome=false;nextAt=Infinity;
 void announce(name,{replace:true});
 return 'Annonce lancée : '+labels[name]+'.';
});}
function listeners(guild,id=live.WAIT){return [...(guild.channels.cache.get(id)?.members?.values()||[])].filter(m=>!m.user.bot);}
function migrateAutoJoin(){if((a.state().voiceReception?.musicVersion||0)<2)persist({normal:.6,duck:.12,interval:30000,musicVersion:2});const old=a.state().voiceReception;if(old?.autoJoinVersion===1)return;const disabled=old?.enabled===false&&(a.state().schoolAdminHistory||[]).some(x=>x.action==='voice-reception.desactiver');persist({enabled:!disabled,autoJoinVersion:1});}
async function tick(guild,{force=false}={}){if(busy||stopped||held)return;busy=true;guildRef=guild;try{
 migrateAutoJoin();if(!config().enabled){disconnect();lastError='Accueil désactivé. Utilise /accueil-vocal activer.';return;}
 let arrivals=[];try{arrivals=await live.sync(guild);}catch(e){lastError='Suivi des candidats : '+e.message;}
 if(arrivals.length)welcome=true;
 const next=target(guild);
 // Plus personne en attente : le bot quitte le vocal.
 if(!next&&!testing){welcome=false;room=null;if(connection)disconnect();return;}
 // Changement de salon (l'attente entretien passe devant) : on quitte puis on rejoint l'autre.
 if(next&&room?.id!==next.id){if(connection)disconnect();room=next;welcome=true;}
 await connect(guild);
 if(connection?.state.status!=='ready')return;
 checkFiles();
 ensureMusic();
 if(!current&&room?.announcement){if(welcome||Date.now()>=nextAt){welcome=false;announce(room.announcement).catch(e=>{lastError=e.message;});}}
 }catch(e){lastError=e.message;reconnectAt=Date.now()+15000;}finally{busy=false;}}
async function voice(old,next){if(old.channelId===next.channelId)return;const ids=ROOMS.map(r=>r.id);if(ids.includes(next.channelId)&&!next.member?.user.bot){reconnectAt=0;return tick(next.guild,{force:true});}if(ids.includes(old.channelId))return tick(next.guild);}
function status(guild){const c=config(),snap=live.snapshot(guild),next=choice(guild);
 const p=u.payload('🎧 ACCUEIL VOCAL · QG','Le bot rejoint le vocal d’attente quand un candidat attend, diffuse la musique de fond et l’annonce d’accueil (la musique baisse pendant la voix), puis quitte le vocal quand plus personne n’attend.',[
 u.row(u.button('qgv:play:context','Annoncer maintenant',u.ButtonStyle.Primary),u.button('qgv:play:accueil','Dire bienvenue'),u.button('qgv:status','Actualiser'))]);
 p.embeds[0].addFields(
 {name:'Connexion',value:`${c.enabled?'🟢 Activé':'🔴 Désactivé'} · ${connection?.state.status==='ready'?'Connecté':'Non connecté'}\nSalons : <#${live.WAIT}> (prioritaire) · <#${MOVE_ROOM}>${room?`\nEn cours : <#${room.id}>`:''}`},
 {name:'Annonce en cours',value:labels[current]||'Aucune',inline:true},
 {name:'Prochaine annonce',value:!c.enabled||!target(guild)?'En attente d’un membre':`${labels[next]} (toutes les ${Math.round(c.interval/1000)} s)`,inline:true},
 {name:'Recruteurs en bureau',value:String(snap.staff.length)},{name:'Musiques d’attente',value:Object.entries(ROOM_LABELS).map(([k,l])=>`🎵 **${l}** : ${(c.musics||{})[k]?.name||(k==='entretien'&&c.customMusic?.name)||'musique d’origine'}`).join('\n')});
 if(lastError)p.embeds[0].addFields({name:'À résoudre',value:lastError.slice(0,1024)});return p;}
async function monitor(guild){return require('./qgRecruitmentHub').install(guild);}
async function auth(i){const m=await a.actor(i);if(!a.isDirection(m)&&!a.has(m,['recruitmentLead']))throw Error('Réservé à la direction et au responsable recrutement.');return m;}
const data=new u.SlashCommandBuilder().setName('musique').setDescription('Musique d’attente des vocaux : entretien, attente aide, réunion').setDMPermission(false);
data.addSubcommand(s=>s.setName('changer').setDescription('Changer la musique d’un salon (fichier audio) ou revenir à celle d’origine').addStringOption(o=>o.setName('salon').setDescription('Salon concerné').setRequired(true).addChoices({name:'Attente entretien',value:'entretien'},{name:'Attente aide',value:'aide'},{name:'Réunion',value:'reunion'})).addAttachmentOption(o=>o.setName('fichier').setDescription('Nouvelle musique : mp3, ogg, wav, m4a ou flac (25 Mo max)')).addBooleanOption(o=>o.setName('origine').setDescription('Revenir à la musique d’origine')));
for(const name of ['activer','desactiver','statut','volume','intervalle','tester','reconnecter'])data.addSubcommand(s=>{s.setName(name).setDescription('Accueil vocal : '+name);if(name==='volume'){for(const [key,label,min,max]of [['musique','Musique normale (%)',1,100],['jessica-fond','Musique pendant Jessica (%)',1,100],['voix','Jessica (%)',1,100],['baisse','Baisse en millisecondes',100,10000],['remontee','Remontée en millisecondes',100,10000]])s.addIntegerOption(o=>o.setName(key).setDescription(label).setMinValue(min).setMaxValue(max));}if(name==='intervalle')s.addIntegerOption(o=>o.setName('secondes').setDescription('Délai après la fin d’une annonce').setRequired(true).setMinValue(5).setMaxValue(300));if(name==='tester')s.addStringOption(o=>o.setName('annonce').setDescription('Fichier à jouer').setRequired(true).addChoices(...ANNOUNCEMENTS.map(value=>({name:value,value}))));return s;});
async function execute(i){await auth(i);await i.deferReply({flags:u.MessageFlags.Ephemeral});const op=i.options.getSubcommand();if(op==='changer'){const key=i.options.getString('salon'),label=ROOM_LABELS[key];let text;if(i.options.getBoolean('origine')){resetMusic(key);text=`🎵 ${label} : musique d’origine rétablie.`;}else{const name=await setMusic(i.options.getAttachment('fichier'),{key});text=`🎵 ${label} : nouvelle musique **${name}**. Elle est déjà en place (et le reste après les mises à jour du bot).`;}await a.audit(i.guild,{action:'voice-reception.musique',actorId:i.user.id,after:`${label} : ${config().musics?.[key]?.name||'origine'}`});return i.editReply({...status(i.guild),content:text});}if(op==='activer'){require('../utils/qgDurability').assertDurable();persist({enabled:true,autoJoinVersion:1});reconnectAt=0;welcome=live.state().queue.length>0;await tick(i.guild,{force:true});}if(op==='desactiver'){persist({enabled:false,autoJoinVersion:1});disconnect();}if(op==='volume'){const before=config(),patch={};for(const [field,key,factor]of [['musique','normal',100],['jessica-fond','duck',100],['voix','voice',100],['baisse','downMs',1],['remontee','upMs',1]]){const value=i.options.getInteger(field);if(value!=null){if(!Number.isInteger(value)||value<1||value>(factor===100?100:10000))throw Error('Réglage de volume ou durée invalide.');patch[key]=value/factor;}}if((patch.duck??before.duck)>(patch.normal??before.normal))throw Error('Le volume réduit doit être inférieur ou égal au volume normal.');persist(patch);if(mixer){mixer.options=config();if(!current)mixer.fade(config().normal,config().upMs);}}
 if(op==='intervalle'){const seconds=i.options.getInteger('secondes');if(!Number.isInteger(seconds)||seconds<5||seconds>300)throw Error('Intervalle entre 5 et 300 secondes.');persist({interval:seconds*1000});}if(op==='reconnecter'){disconnect();reconnectAt=0;await tick(i.guild,{force:true});}if(op==='tester'){if(!config().enabled)throw Error('Active d’abord l’accueil.');checkFiles();await connect(i.guild);if(!connection||connection.state.status!=='ready')throw Error('Connexion en cours. Réessaie.');if(current)throw Error('Une annonce est déjà en cours.');ensureMusic();testing=true;try{await announce(i.options.getString('annonce'));}finally{testing=false;}}
 if(op!=='statut')await a.audit(i.guild,{action:'voice-reception.'+op,actorId:i.user.id,after:config()});return i.editReply(status(i.guild));}
async function handle(i){await i.deferReply({flags:u.MessageFlags.Ephemeral});const member=await a.actor(i);if(!a.isDirection(member)&&!a.has(member,['recruitmentLead','recruitmentManagement']))throw Error('Réservé au recrutement.');let content=null;if(i.customId.startsWith('qgv:play:')){content=await playNow(i.guild,i.customId.split(':')[2]);await a.audit(i.guild,{action:'voice-reception.manual',actorId:i.user.id,after:{announcement:i.customId.split(':')[2]}});}return i.editReply({...status(i.guild),content});}
function shutdown(){stopped=true;disconnect();}
// Pause pendant une alerte d’urgence : le bot ne peut occuper qu’un seul vocal par serveur.
let held=false;
async function pause(){held=true;for(let n=0;n<50&&busy;n++)await new Promise(r=>setTimeout(r,100));disconnect();}
function resume(){held=false;reconnectAt=0;}
module.exports={ROOM_LABELS,setMusic,resetMusic,musicPath,customMusic,playable,MUSIC,ANNOUNCEMENTS,ROOMS,MOVE_ROOM,target,choice,labels,pause,resume,playNow,disconnect,listeners,migrateAutoJoin,voice,data,execute,handle,tick,monitor,status,config,persist,checkFiles,files,root,shutdown,connect};
