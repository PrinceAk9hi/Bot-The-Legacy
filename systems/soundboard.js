const {spawn}=require('node:child_process');
const {ChannelType,PermissionFlagsBits,Events}=require('discord.js');
const {joinVoiceChannel,createAudioPlayer,createAudioResource,AudioPlayerStatus,VoiceConnectionStatus,NoSubscriberBehavior,StreamType,entersState}=require('@discordjs/voice');
const catalog=require('../utils/soundCatalog');
const {assertFree}=require('../utils/musicVoiceGuard');
const {personal}=require('../utils/memberCare');
const {hasBypass}=require('../utils/security');
const {isOff}=require('../utils/lineState');
function setting(name,fallback,min,max){const n=Number(process.env[name]);return process.env[name]!==undefined&&Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
const SOUND_COOLDOWN=setting('SOUND_COOLDOWN',3,0,60)*1000;
const DEFAULT_VOLUME=setting('DEFAULT_VOLUME',0.5,0,1);
const IDLE_DELAY=setting('SOUND_IDLE_SECONDS',5,1,60)*1000;
const MAX_QUEUE=50;
function register(client){
 if(client.soulSoundboard)return client.soulSoundboard;
 const sessions=new Map(),locks=new Map(),cooldowns=new Map(),epochs=new Map();
 function serial(id,fn){const next=(locks.get(id)||Promise.resolve()).catch(()=>{}).then(fn);locks.set(id,next);next.finally(()=>{if(locks.get(id)===next)locks.delete(id);}).catch(()=>{});return next;}
 function permitted(i){if(!i.guild||!personal(i.member))throw Error('La soundboard est réservée aux membres de la famille.');if(isOff())throw Error('Le bot est en pause.');}
 function voice(i,s){permitted(i);const channel=i.guild.members.cache.get(i.user.id)?.voice?.channel||i.member?.voice?.channel;
  if(!channel||channel.type!==ChannelType.GuildVoice)throw Error('Tu dois être connecté à un salon vocal classique.');
  if(s&&s.channel.id!==channel.id)throw Error('Un son est déjà en cours dans un autre vocal. Rejoins le même salon que le bot.');
  if(!channel.permissionsFor(i.guild.members.me)?.has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.Connect,PermissionFlagsBits.Speak]))throw Error('Il me faut les permissions Voir le salon, Se connecter et Parler dans ce vocal.');return channel;
 }
 function dispose(s){clearTimeout(s.startTimer);s.startTimer=null;if(s.process){const child=s.process;s.process=null;child.stdout.destroy();child.kill();}}
 function close(s){if(s.closed)return;s.closed=true;clearTimeout(s.idleTimer);dispose(s);s.queue=[];s.current=null;s.player.stop(true);panel.refresh(s.guild.id);if(sessions.get(s.guild.id)===s)sessions.delete(s.guild.id);if(s.connection&&s.connection.state.status!==VoiceConnectionStatus.Destroyed)s.connection.destroy();}
 function report(track){if(track?.channel?.isTextBased())Promise.resolve().then(()=>track.channel.send({content:'❌ Impossible de lire ce son. Le suivant sera essayé.',allowedMentions:{parse:[]}})).catch(()=>{});}
 function finish(s,token,error){if(s.closed||s.current?.token!==token)return;const track=s.current;s.current=null;dispose(s);s.player.stop(true);if(error){console.error('Soundboard :',error.code||error.message);report(track);}setImmediate(()=>pump(s));}
 function pump(s){if(s.closed||s.current)return;if(isOff())return close(s);const track=s.queue.shift();
  if(!track){panel.refresh(s.guild.id);clearTimeout(s.idleTimer);s.idleTimer=setTimeout(()=>{if(!s.current&&!s.queue.length)close(s);},IDLE_DELAY);s.idleTimer.unref();return;}
  clearTimeout(s.idleTimer);s.paused=false;s.current={...track,token:++s.generation};const token=s.current.token;
  try{
   const ffmpeg=require('ffmpeg-static');if(!ffmpeg)throw Error('FFmpeg indisponible sur cette plateforme.');
   const child=spawn(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-protocol_whitelist','file,pipe','-i',track.path,'-vn','-f','s16le','-ar','48000','-ac','2','pipe:1'],{stdio:['ignore','pipe','ignore'],windowsHide:true});s.process=child;
   child.on('error',e=>finish(s,token,e));child.stdout.on('error',e=>finish(s,token,e));child.on('close',code=>{if(code!==0)finish(s,token,new Error('Décodage audio interrompu.'));});
   const resource=createAudioResource(child.stdout,{inputType:StreamType.Raw,inlineVolume:true,metadata:{token}});resource.volume.setVolume(s.volume);s.resource=resource;s.player.play(resource);panel.refresh(s.guild.id);
   s.startTimer=setTimeout(()=>finish(s,token,new Error('Le son ne démarre pas.')),20000);s.startTimer.unref();
  }catch(e){finish(s,token,e);}
 }
 async function connect(i,channel){
  assertFree(i.guild);
  const s={guild:i.guild,channel,player:createAudioPlayer({behaviors:{noSubscriber:NoSubscriberBehavior.Stop}}),queue:[],current:null,generation:0,closed:false,volume:DEFAULT_VOLUME,paused:false};sessions.set(i.guildId,s);
  s.player.on(AudioPlayerStatus.Idle,old=>{if(s.current)finish(s,old.resource?.metadata?.token);});
  s.player.on(AudioPlayerStatus.Playing,()=>{clearTimeout(s.startTimer);s.startTimer=null;});
  s.player.on('error',e=>finish(s,e.resource?.metadata?.token,e));
  try{
   s.connection=joinVoiceChannel({guildId:i.guildId,channelId:channel.id,adapterCreator:i.guild.voiceAdapterCreator,group:'soul-soundboard',selfDeaf:true,selfMute:false});
   s.connection.on('error',()=>close(s));s.connection.on(VoiceConnectionStatus.Destroyed,()=>close(s));
   s.connection.on(VoiceConnectionStatus.Disconnected,()=>close(s));
   s.connection.subscribe(s.player);await entersState(s.connection,VoiceConnectionStatus.Ready,15000);
   if(s.closed)throw Error('La connexion vocale a été arrêtée.');pump(s);return s;
  }catch(e){close(s);throw Error('Impossible de rejoindre le vocal. Vérifie mes permissions et réessaie.');}
 }
 async function enqueue(i,id){return serial(i.guildId,async()=>{
  const epoch=epochs.get(i.guildId)||0;let s=sessions.get(i.guildId);const channel=voice(i,s);
  if(client.maintenanceSystem?.checkCommandMaintenance?.('sound')?.blocked)throw Error('La soundboard est en maintenance.');
  const now=Date.now(),until=cooldowns.get(i.user.id)||0;
  if(!hasBypass(i)&&!i.member.permissions?.has(PermissionFlagsBits.Administrator)&&until>now)throw Error(`Patiente ${Math.ceil((until-now)/1000)} seconde(s) avant un autre son.`);
  if(s&&s.queue.length>=MAX_QUEUE)throw Error('La file est pleine (50 sons).');
  cooldowns.set(i.user.id,Date.now()+SOUND_COOLDOWN);
  const sound=await catalog.resolve(id);if((epochs.get(i.guildId)||0)!==epoch)throw Error("La demande de son a été annulée.");if(!s)s=await connect(i,channel);
  if(s.closed)throw Error('Session arrêtée. Relance /sound.');voice(i,s);
  const queued=Boolean(s.current||s.queue.length);s.queue.push({...sound,channel:i.channel});pump(s);panel.refresh(s.guild.id);return {name:sound.name,queued};
 });}
 function stop(i){const s=sessions.get(i.guildId);voice(i,s);epochs.set(i.guildId,(epochs.get(i.guildId)||0)+1);if(!s)return false;close(s);return true;}
 client.on(Events.VoiceStateUpdate,(before,after)=>{if(after.id!==client.user.id)return;const s=sessions.get(after.guild.id);if(s&&after.channelId!==s.channel.id)close(s);});
 const timer=setInterval(()=>{const now=Date.now();for(const [id,until]of cooldowns)if(until<=now)cooldowns.delete(id);if(isOff())for(const s of sessions.values())close(s);},1000);timer.unref();
 function check(i){const s=sessions.get(i.guildId);voice(i,s);if(!s)throw Error('Cette session est terminée.');if(client.maintenanceSystem?.checkCommandMaintenance?.('sound')?.blocked)throw Error('La soundboard est en maintenance.');return s;}
 function control(i,action){const s=check(i);
  if(action==='stop')return stop(i);
  if(action==='pause'&&s.current){if(s.paused){s.player.unpause();s.paused=false;}else if(s.player.pause()){s.paused=true;clearTimeout(s.startTimer);}}
  else if(action==='next'&&s.current)finish(s,s.current.token);
  else if(action==='down'||action==='up'){s.volume=Math.max(0,Math.min(1,Math.round((s.volume+(action==='up'?0.1:-0.1))*10)/10));s.resource?.volume?.setVolume(s.volume);}
  panel.refresh(i.guildId);
 }
 const api={enqueue,stop,check,control,state:id=>sessions.get(id),active:id=>sessions.has(id),shutdown:()=>{clearInterval(timer);for(const s of sessions.values())close(s);}};const panel=require('./soundboardPanel')(client,api);api.showPanel=panel.show;client.soulSoundboard=api;return api;
}
module.exports=register;
