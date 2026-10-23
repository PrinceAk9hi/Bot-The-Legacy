const u=require('../utils/qgModuleUi'),{a}=u,live=require('./qgRecruitmentLive'),{Mixer}=require('../utils/qgAudioMixer'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../assets/audio/qg'),defaults={enabled:true,normal:.65,duck:.20,voice:1,downMs:1500,upMs:2000,interval:15000};
const config=()=>({...defaults,...a.state().voiceReception});
const files=['accueil','concertation','recruteurs-occupes','recruteurs-absents'];
let announcementVersion=0;let connection,player,mixer,busy=false,current=null,nextAt=0,welcome=false,lastError=null,reconnectAt=0,guildRef,stopped=false,testing=false;
function persist(patch){a.save(s=>{s.voiceReception={...config(),...patch};});}
function checkFiles(){const absent=[...files,'ambiance'].filter(n=>!fs.existsSync(path.join(root,n+'.mp3')));if(absent.length)throw Error('Ajoute les fichiers suivants dans assets/audio/qg : '+absent.map(x=>x+'.mp3').join(', '));const ffmpeg=process.env.FFMPEG_PATH||require('ffmpeg-static');if(!ffmpeg||!fs.existsSync(ffmpeg))throw Error('FFmpeg absent. Réinstalle les dépendances.');}
function stopAudio(){announcementVersion++;mixer?.destroy();mixer=null;player?.stop();player=null;current=null;}
function disconnect(){stopAudio();if(connection&&connection.state.status!=='destroyed')connection.destroy();connection=null;}
async function connect(guild,voice=require('@discordjs/voice')){if(Date.now()<reconnectAt)return;if(connection?.state.status===voice.VoiceConnectionStatus.Ready)return;const ch=await guild.channels.fetch(live.WAIT),bot=await guild.members.fetchMe();if(!ch?.isVoiceBased()||!ch.permissionsFor(bot)?.has([u.PermissionFlagsBits.ViewChannel,u.PermissionFlagsBits.Connect,u.PermissionFlagsBits.Speak]))throw Error('Accès au vocal d’accueil insuffisant.');const other=voice.getVoiceConnection(guild.id);if(other&&other!==connection&&other.joinConfig.channelId!==live.WAIT)throw Error('Le bot utilise déjà un autre vocal. Libère cette connexion avant activation.');reconnectAt=Date.now()+15000;if(connection&&connection.state.status!=='destroyed'){connection.rejoin({channelId:live.WAIT});}else{connection=voice.joinVoiceChannel({channelId:live.WAIT,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator,selfDeaf:true,selfMute:false});connection.on('error',e=>{lastError=e.message;});connection.on('stateChange',(_,next)=>{if(next.status==='disconnected'||next.status==='destroyed'){stopAudio();nextAt=Date.now()+15000;}});}await voice.entersState(connection,voice.VoiceConnectionStatus.Ready,20000);lastError=null;}
function ensureMusic(){if(mixer&&!mixer.destroyed)return;const voice=require('@discordjs/voice');mixer=new Mixer(path.join(root,'ambiance.mp3'),config());mixer.on('error',e=>{lastError=e.message;nextAt=Date.now()+15000;});player=voice.createAudioPlayer({behaviors:{noSubscriber:voice.NoSubscriberBehavior.Pause}});player.on('error',e=>{lastError=e.message;stopAudio();});player.play(voice.createAudioResource(mixer,{inputType:voice.StreamType.Raw}));connection.subscribe(player);}
async function announce(name,{replace=false}={}){if(!files.includes(name)||current&&!replace)return;const version=++announcementVersion,activeMixer=mixer;if(replace)activeMixer.cancelAnnouncement();current=name;try{await activeMixer.announce(path.join(root,name+'.mp3'));}catch(e){if(e.code!=='ANNOUNCEMENT_REPLACED')lastError=e.message;}finally{if(version===announcementVersion){current=null;nextAt=(activeMixer.voiceEndedAt||Date.now())+config().interval;}}}
async function playNow(guild,name='context'){return a.serial('voice-manual',async()=>{
 if(!config().enabled)throw Error('L’accueil vocal est désactivé.');
 if(!listeners(guild).some(live.candidate))throw Error('Aucun candidat n’attend dans le vocal.');
 const choice=live.snapshot(guild).announcement;
 if(name==='context')name=choice;
 if(!name)return 'Un recruteur est disponible, ou les statuts sont mixtes : musique seule.';
 if(!files.includes(name))throw Error('Annonce inconnue.');
 if(name!=='accueil'&&name!==choice)throw Error('Cette annonce ne correspond pas à la situation actuelle des recruteurs.');
 checkFiles();await connect(guild);if(connection?.state.status!=='ready')throw Error('Connexion en cours. Réessaie dans quelques secondes.');
 ensureMusic();welcome=false;nextAt=Infinity;
 void announce(name,{replace:true});
 return 'Annonce lancée maintenant. Prochaine annonce automatique '+config().interval/1000+' s après sa fin.';
});}
function listeners(guild){return [...(guild.channels.cache.get(live.WAIT)?.members?.values()||[])].filter(m=>!m.user.bot);}
function migrateAutoJoin(){const old=a.state().voiceReception;if(old?.autoJoinVersion===1)return;const disabled=old?.enabled===false&&(a.state().schoolAdminHistory||[]).some(x=>x.action==='voice-reception.desactiver');persist({enabled:!disabled,autoJoinVersion:1});}
async function tick(guild,{force=false}={}){if(busy||stopped)return;busy=true;guildRef=guild;try{
 migrateAutoJoin();if(!config().enabled){disconnect();lastError='Accueil désactivé. Utilise /accueil-vocal activer.';return;}
 // Joining Discord must not depend on music files or recruitment storage.
 if(force||listeners(guild).length||connection)await connect(guild);
 let arrivals=[];try{arrivals=await live.sync(guild);}catch(e){lastError='Suivi des candidats : '+e.message;}
 if(arrivals.length)welcome=true;
 const waiting=live.state().queue.length;
 if(!waiting&&!testing){welcome=false;stopAudio();return;}
 if(connection?.state.status!=='ready')return;
 checkFiles();ensureMusic();
 if(!current){if(welcome){welcome=false;announce('accueil').catch(e=>{lastError=e.message;});}else if(Date.now()>=nextAt){const choice=live.snapshot(guild).announcement;if(choice)announce(choice).catch(e=>{lastError=e.message;});else nextAt=Date.now()+config().interval;}}
 }catch(e){lastError=e.message;reconnectAt=Date.now()+15000;}finally{busy=false;}}
async function voice(old,next){if(old.channelId===next.channelId)return;if(next.channelId===live.WAIT&&!next.member?.user.bot){reconnectAt=0;return tick(next.guild,{force:true});}if(old.channelId===live.WAIT)return tick(next.guild);}
function status(guild){const c=config(),snap=live.snapshot(guild),labels={accueil:'Bienvenue',concertation:'Équipe en concertation','recruteurs-occupes':'Recruteurs en entretien','recruteurs-absents':'Aucun recruteur présent'},choice=snap.announcement;
 const p=u.payload('🎧 ACCUEIL VOCAL · QG','**Les annonces sont automatiques.**\nUn clic sur « Annoncer maintenant » diffuse immédiatement le message adapté à l’équipe. Le délai automatique repart après la fin de la voix.\n\nLa musique continue sous Jessica. Si une voix est déjà en cours, elle est remplacée.',[
 u.row(u.button('qgv:play:context','Annoncer maintenant',u.ButtonStyle.Primary),u.button('qgv:play:accueil','Dire bienvenue'),u.button('qgv:status','Actualiser'))]);
 p.embeds[0].addFields(
 {name:'Connexion & musique',value:`${c.enabled?'🟢 Activé':'🔴 Désactivé'} · ${connection?.state.status==='ready'?'Connecté':'Non connecté'}\nMusique : ${mixer&&!mixer.destroyed?'en lecture':'arrêtée'}\nSalon : <#${live.WAIT}>`},
 {name:'Annonce en cours',value:labels[current]||'Aucune',inline:true},
 {name:'Prochaine annonce automatique',value:current?`${c.interval/1000} s après la voix en cours`:!c.enabled||!live.state().queue.length?'En attente d’un candidat':!choice?'Musique seule — selon les disponibilités':Number.isFinite(nextAt)&&nextAt>Date.now()?u.time(nextAt):'À la prochaine vérification',inline:true},
 {name:'Situation de l’équipe',value:`${snap.available.length} disponible(s) · ${snap.occupied.length} en entretien · ${snap.concertation.length} en concertation\nMessage adapté : **${labels[choice]||'aucun — musique seule'}**`},
 {name:'Réglages',value:`Musique : ${Math.round(c.normal*100)} % → ${Math.round(c.duck*100)} % pendant Jessica\nVoix : ${Math.round(c.voice*100)} % · Répétition : ${c.interval/1000} s après chaque annonce`});
 if(lastError)p.embeds[0].addFields({name:'À résoudre',value:lastError.slice(0,1024)});return p;}
async function monitor(guild){return require('./qgRecruitmentHub').install(guild);}
async function auth(i){const m=await a.actor(i);if(!a.isDirection(m)&&!a.has(m,['recruitmentLead']))throw Error('Réservé à la direction et au responsable recrutement.');return m;}
const data=new u.SlashCommandBuilder().setName('accueil-vocal').setDescription('Configurer l’accueil vocal QG').setDMPermission(false);
for(const name of ['activer','desactiver','statut','volume','intervalle','tester','reconnecter'])data.addSubcommand(s=>{s.setName(name).setDescription('Accueil vocal : '+name);if(name==='volume'){for(const [key,label,min,max]of [['musique','Musique normale (%)',1,100],['jessica-fond','Musique pendant Jessica (%)',1,100],['voix','Jessica (%)',1,100],['baisse','Baisse en millisecondes',100,10000],['remontee','Remontée en millisecondes',100,10000]])s.addIntegerOption(o=>o.setName(key).setDescription(label).setMinValue(min).setMaxValue(max));}if(name==='intervalle')s.addIntegerOption(o=>o.setName('secondes').setDescription('Délai après la fin d’une annonce').setRequired(true).setMinValue(5).setMaxValue(300));if(name==='tester')s.addStringOption(o=>o.setName('annonce').setDescription('Fichier à jouer').setRequired(true).addChoices(...files.map(value=>({name:value,value}))));return s;});
async function execute(i){await auth(i);await i.deferReply({flags:u.MessageFlags.Ephemeral});const op=i.options.getSubcommand();if(op==='activer'){require('../utils/qgDurability').assertDurable();persist({enabled:true,autoJoinVersion:1});reconnectAt=0;welcome=live.state().queue.length>0;await tick(i.guild,{force:true});}if(op==='desactiver'){persist({enabled:false,autoJoinVersion:1});disconnect();}if(op==='volume'){const before=config(),patch={};for(const [field,key,factor]of [['musique','normal',100],['jessica-fond','duck',100],['voix','voice',100],['baisse','downMs',1],['remontee','upMs',1]]){const value=i.options.getInteger(field);if(value!=null){if(!Number.isInteger(value)||value<1||value>(factor===100?100:10000))throw Error('Réglage de volume ou durée invalide.');patch[key]=value/factor;}}if((patch.duck??before.duck)>(patch.normal??before.normal))throw Error('Le volume réduit doit être inférieur ou égal au volume normal.');persist(patch);if(mixer){mixer.options=config();if(!current)mixer.fade(config().normal,config().upMs);}}
 if(op==='intervalle'){const seconds=i.options.getInteger('secondes');if(!Number.isInteger(seconds)||seconds<5||seconds>300)throw Error('Intervalle entre 5 et 300 secondes.');persist({interval:seconds*1000});}if(op==='reconnecter'){disconnect();reconnectAt=0;await tick(i.guild,{force:true});}if(op==='tester'){if(!config().enabled)throw Error('Active d’abord l’accueil.');checkFiles();await connect(i.guild);if(!connection||connection.state.status!=='ready')throw Error('Connexion en cours. Réessaie.');if(current)throw Error('Une annonce est déjà en cours.');ensureMusic();testing=true;try{await announce(i.options.getString('annonce'));}finally{testing=false;}}
 if(op!=='statut')await a.audit(i.guild,{action:'voice-reception.'+op,actorId:i.user.id,after:config()});return i.editReply(status(i.guild));}
async function handle(i){await i.deferReply({flags:u.MessageFlags.Ephemeral});const member=await a.actor(i);if(!a.isDirection(member)&&!a.has(member,['recruitmentLead','recruitmentManagement']))throw Error('Réservé au recrutement.');let content=null;if(i.customId.startsWith('qgv:play:')){content=await playNow(i.guild,i.customId.split(':')[2]);await a.audit(i.guild,{action:'voice-reception.manual',actorId:i.user.id,after:{announcement:i.customId.split(':')[2]}});}return i.editReply({...status(i.guild),content});}
function shutdown(){stopped=true;disconnect();}
module.exports={playNow,disconnect,listeners,migrateAutoJoin,voice,data,execute,handle,tick,monitor,status,config,persist,checkFiles,files,root,shutdown,connect};
