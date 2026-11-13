// Accueil vocal du salon d'attente entretien.
// - Un candidat attend : le bot rejoint le vocal et diffuse la musique de fond (attente-entretien.mp3, en boucle).
// - L'annonce « accueil » passe à l'arrivée puis toutes les 30 secondes : la musique baisse pendant
//   qu'elle parle, puis remonte à fond.
// - Plus personne en attente : le bot quitte le vocal.
const u=require('../utils/qgModuleUi'),{a}=u,live=require('./qgRecruitmentLive'),{Mixer}=require('../utils/qgAudioMixer'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../assets/audio/qg'),defaults={enabled:true,normal:1,duck:.20,voice:1,downMs:1500,upMs:2000,interval:30000};
const MUSIC='attente-entretien',ANNOUNCEMENTS=['accueil'];
const config=()=>({...defaults,...a.state().voiceReception});
const files=[...ANNOUNCEMENTS,MUSIC];
const labels={accueil:'Bienvenue'};
let announcementVersion=0;let connection,player,mixer=null,busy=false,current=null,nextAt=0,welcome=false,lastError=null,reconnectAt=0,guildRef,stopped=false,testing=false,decoder=null;
function persist(patch){a.save(s=>{s.voiceReception={...config(),...patch};});}
function checkFiles(){const absent=files.filter(n=>!fs.existsSync(path.join(root,n+'.mp3')));if(absent.length)throw Error('Ajoute les fichiers suivants dans assets/audio/qg : '+absent.map(x=>x+'.mp3').join(', '));const ffmpeg=process.env.FFMPEG_PATH||require('ffmpeg-static');if(!ffmpeg||!fs.existsSync(ffmpeg))throw Error('FFmpeg absent. Réinstalle les dépendances.');}
// Une seule annonce : l'accueil (plus d'annonce sur les recruteurs en bureau).
function choice(){return 'accueil';}
function stopAudio(){announcementVersion++;try{decoder?.process?.kill();}catch{}decoder=null;try{mixer?.destroy();}catch{}mixer=null;player?.stop(true);player=null;current=null;}
function disconnect(){stopAudio();if(connection&&connection.state.status!=='destroyed')connection.destroy();connection=null;reconnectAt=0;}
async function connect(guild,voice=require('@discordjs/voice')){if(Date.now()<reconnectAt)return;if(connection?.state.status===voice.VoiceConnectionStatus.Ready)return;const ch=await guild.channels.fetch(live.WAIT),bot=await guild.members.fetchMe();if(!ch?.isVoiceBased()||!ch.permissionsFor(bot)?.has([u.PermissionFlagsBits.ViewChannel,u.PermissionFlagsBits.Connect,u.PermissionFlagsBits.Speak]))throw Error('Accès au vocal d’accueil insuffisant.');const other=voice.getVoiceConnection(guild.id);if(other&&other!==connection&&other.joinConfig.channelId!==live.WAIT)throw Error('Le bot utilise déjà un autre vocal. Libère cette connexion avant activation.');reconnectAt=Date.now()+15000;if(connection&&connection.state.status!=='destroyed'){connection.rejoin({channelId:live.WAIT});}else{connection=voice.joinVoiceChannel({channelId:live.WAIT,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator,selfDeaf:true,selfMute:false});connection.on('error',e=>{lastError=e.message;});connection.on('stateChange',(_,next)=>{if(next.status==='disconnected'||next.status==='destroyed'){stopAudio();nextAt=Date.now()+15000;}});}await voice.entersState(connection,voice.VoiceConnectionStatus.Ready,20000);lastError=null;}
// Musique de fond en boucle, mixée avec les annonces (baisse pendant la voix, puis remontée).
function ensureMusic(){
 const voice=require('@discordjs/voice');
 if(!player){player=voice.createAudioPlayer({behaviors:{noSubscriber:voice.NoSubscriberBehavior.Play}});player.on('error',e=>{lastError=e.message;try{mixer?.destroy();}catch{}mixer=null;});connection.subscribe(player);}
 if(mixer&&!mixer.destroyed)return;
 mixer=new Mixer(path.join(root,MUSIC+'.mp3'),config());
 mixer.on('error',e=>{lastError='Musique : '+e.message;});
 player.play(voice.createAudioResource(mixer,{inputType:voice.StreamType.Raw}));
}
async function announce(name,{replace=false}={}){if(!ANNOUNCEMENTS.includes(name)||current&&!replace)return;ensureMusic();const version=++announcementVersion;current=name;
 try{if(replace)mixer.cancelAnnouncement();await mixer.announce(path.join(root,name+'.mp3'));}
 catch(e){if(e.code!=='ANNOUNCEMENT_REPLACED')lastError=e.message;}finally{if(version===announcementVersion){current=null;nextAt=Date.now()+config().interval;}}}
async function playNow(guild,name='context'){return a.serial('voice-manual',async()=>{
 if(!config().enabled)throw Error('L’accueil vocal est désactivé.');
 if(!listeners(guild).some(live.candidate))throw Error('Aucun candidat n’attend dans le vocal.');
 if(name==='context')name=choice(guild);
 if(!ANNOUNCEMENTS.includes(name))throw Error('Annonce inconnue.');
 checkFiles();await connect(guild);if(connection?.state.status!=='ready')throw Error('Connexion en cours. Réessaie dans quelques secondes.');
 welcome=false;nextAt=Infinity;
 void announce(name,{replace:true});
 return 'Annonce lancée : '+labels[name]+'.';
});}
function listeners(guild){return [...(guild.channels.cache.get(live.WAIT)?.members?.values()||[])].filter(m=>!m.user.bot);}
function migrateAutoJoin(){if(a.state().voiceReception?.musicVersion!==1)persist({normal:1,duck:.2,interval:30000,musicVersion:1});const old=a.state().voiceReception;if(old?.autoJoinVersion===1)return;const disabled=old?.enabled===false&&(a.state().schoolAdminHistory||[]).some(x=>x.action==='voice-reception.desactiver');persist({enabled:!disabled,autoJoinVersion:1});}
async function tick(guild,{force=false}={}){if(busy||stopped||held)return;busy=true;guildRef=guild;try{
 migrateAutoJoin();if(!config().enabled){disconnect();lastError='Accueil désactivé. Utilise /accueil-vocal activer.';return;}
 let arrivals=[];try{arrivals=await live.sync(guild);}catch(e){lastError='Suivi des candidats : '+e.message;}
 if(arrivals.length)welcome=true;
 const waiting=live.state().queue.length||listeners(guild).some(live.candidate);
 // Plus personne en attente d'entretien : le bot quitte le vocal.
 if(!waiting&&!testing){welcome=false;if(connection)disconnect();return;}
 await connect(guild);
 if(connection?.state.status!=='ready')return;
 checkFiles();
 ensureMusic();
 if(!current){if(welcome||Date.now()>=nextAt){welcome=false;announce('accueil').catch(e=>{lastError=e.message;});}}
 }catch(e){lastError=e.message;reconnectAt=Date.now()+15000;}finally{busy=false;}}
async function voice(old,next){if(old.channelId===next.channelId)return;if(next.channelId===live.WAIT&&!next.member?.user.bot){reconnectAt=0;return tick(next.guild,{force:true});}if(old.channelId===live.WAIT)return tick(next.guild);}
function status(guild){const c=config(),snap=live.snapshot(guild),next=choice(guild);
 const p=u.payload('🎧 ACCUEIL VOCAL · QG','Le bot rejoint le vocal d’attente quand un candidat attend, diffuse la musique de fond et l’annonce d’accueil (la musique baisse pendant la voix), puis quitte le vocal quand plus personne n’attend.',[
 u.row(u.button('qgv:play:context','Annoncer maintenant',u.ButtonStyle.Primary),u.button('qgv:play:accueil','Dire bienvenue'),u.button('qgv:status','Actualiser'))]);
 p.embeds[0].addFields(
 {name:'Connexion',value:`${c.enabled?'🟢 Activé':'🔴 Désactivé'} · ${connection?.state.status==='ready'?'Connecté':'Non connecté'}\nSalon : <#${live.WAIT}>`},
 {name:'Annonce en cours',value:labels[current]||'Aucune',inline:true},
 {name:'Prochaine annonce',value:!c.enabled||!live.state().queue.length?'En attente d’un candidat':`${labels[next]} (toutes les ${Math.round(c.interval/1000)} s)`,inline:true},
 {name:'Recruteurs en bureau',value:String(snap.staff.length)});
 if(lastError)p.embeds[0].addFields({name:'À résoudre',value:lastError.slice(0,1024)});return p;}
async function monitor(guild){return require('./qgRecruitmentHub').install(guild);}
async function auth(i){const m=await a.actor(i);if(!a.isDirection(m)&&!a.has(m,['recruitmentLead']))throw Error('Réservé à la direction et au responsable recrutement.');return m;}
const data=new u.SlashCommandBuilder().setName('accueil-vocal').setDescription('Configurer l’accueil vocal QG').setDMPermission(false);
for(const name of ['activer','desactiver','statut','volume','intervalle','tester','reconnecter'])data.addSubcommand(s=>{s.setName(name).setDescription('Accueil vocal : '+name);if(name==='volume'){for(const [key,label,min,max]of [['musique','Musique normale (%)',1,100],['jessica-fond','Musique pendant Jessica (%)',1,100],['voix','Jessica (%)',1,100],['baisse','Baisse en millisecondes',100,10000],['remontee','Remontée en millisecondes',100,10000]])s.addIntegerOption(o=>o.setName(key).setDescription(label).setMinValue(min).setMaxValue(max));}if(name==='intervalle')s.addIntegerOption(o=>o.setName('secondes').setDescription('Délai après la fin d’une annonce').setRequired(true).setMinValue(5).setMaxValue(300));if(name==='tester')s.addStringOption(o=>o.setName('annonce').setDescription('Fichier à jouer').setRequired(true).addChoices(...ANNOUNCEMENTS.map(value=>({name:value,value}))));return s;});
async function execute(i){await auth(i);await i.deferReply({flags:u.MessageFlags.Ephemeral});const op=i.options.getSubcommand();if(op==='activer'){require('../utils/qgDurability').assertDurable();persist({enabled:true,autoJoinVersion:1});reconnectAt=0;welcome=live.state().queue.length>0;await tick(i.guild,{force:true});}if(op==='desactiver'){persist({enabled:false,autoJoinVersion:1});disconnect();}if(op==='volume'){const before=config(),patch={};for(const [field,key,factor]of [['musique','normal',100],['jessica-fond','duck',100],['voix','voice',100],['baisse','downMs',1],['remontee','upMs',1]]){const value=i.options.getInteger(field);if(value!=null){if(!Number.isInteger(value)||value<1||value>(factor===100?100:10000))throw Error('Réglage de volume ou durée invalide.');patch[key]=value/factor;}}if((patch.duck??before.duck)>(patch.normal??before.normal))throw Error('Le volume réduit doit être inférieur ou égal au volume normal.');persist(patch);if(mixer){mixer.options=config();if(!current)mixer.fade(config().normal,config().upMs);}}
 if(op==='intervalle'){const seconds=i.options.getInteger('secondes');if(!Number.isInteger(seconds)||seconds<5||seconds>300)throw Error('Intervalle entre 5 et 300 secondes.');persist({interval:seconds*1000});}if(op==='reconnecter'){disconnect();reconnectAt=0;await tick(i.guild,{force:true});}if(op==='tester'){if(!config().enabled)throw Error('Active d’abord l’accueil.');checkFiles();await connect(i.guild);if(!connection||connection.state.status!=='ready')throw Error('Connexion en cours. Réessaie.');if(current)throw Error('Une annonce est déjà en cours.');ensureMusic();testing=true;try{await announce(i.options.getString('annonce'));}finally{testing=false;}}
 if(op!=='statut')await a.audit(i.guild,{action:'voice-reception.'+op,actorId:i.user.id,after:config()});return i.editReply(status(i.guild));}
async function handle(i){await i.deferReply({flags:u.MessageFlags.Ephemeral});const member=await a.actor(i);if(!a.isDirection(member)&&!a.has(member,['recruitmentLead','recruitmentManagement']))throw Error('Réservé au recrutement.');let content=null;if(i.customId.startsWith('qgv:play:')){content=await playNow(i.guild,i.customId.split(':')[2]);await a.audit(i.guild,{action:'voice-reception.manual',actorId:i.user.id,after:{announcement:i.customId.split(':')[2]}});}return i.editReply({...status(i.guild),content});}
function shutdown(){stopped=true;disconnect();}
// Pause pendant une alerte d’urgence : le bot ne peut occuper qu’un seul vocal par serveur.
let held=false;
async function pause(){held=true;for(let n=0;n<50&&busy;n++)await new Promise(r=>setTimeout(r,100));disconnect();}
function resume(){held=false;reconnectAt=0;}
module.exports={MUSIC,ANNOUNCEMENTS,choice,labels,pause,resume,playNow,disconnect,listeners,migrateAutoJoin,voice,data,execute,handle,tick,monitor,status,config,persist,checkFiles,files,root,shutdown,connect};
