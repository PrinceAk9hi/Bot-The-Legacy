const {Readable}=require('node:stream');
const {ChannelType,PermissionFlagsBits:P,Events}=require('discord.js');
const voice=require('@discordjs/voice');
const audio=require('../utils/radioAudio');
const {isOff}=require('../utils/lineState');
const data=require('../utils/radioData');
const {update}=require('../utils/recruitmentData');
function humans(channel){return [...channel.members.values()].filter(m=>!m.user.bot).map(m=>m.id);}
function destinations(guild){return [...guild.channels.cache.values()].filter(c=>[ChannelType.GuildVoice,ChannelType.GuildStageVoice].includes(c.type)&&humans(c).length).sort((a,b)=>a.rawPosition-b.rawPosition||a.id.localeCompare(b.id));}
function register(client){
 if(client.soulRadio)return client.soulRadio;
 const runs=new Map();
 function stopped(s){return s.abort.signal.aborted||isOff();}
 async function refresh(s){await s.progress(s).catch(()=>{});}
 function stop(guildId){const s=runs.get(guildId);if(!s)return false;s.abort.abort();s.interrupt?.('stopped');try{s.connection?.destroy();}catch{}return true;}
 async function play(s,channel,pcm){
  const permissions=channel.permissionsFor(s.guild.members.me);
  if(!permissions?.has([P.ViewChannel,P.Connect,P.Speak]))return 'permissions';
  if(!humans(channel).length)return 'empty';
  if(humans(channel).some(id=>s.heard.has(id)))return 'duplicate';
  s.current=channel.id;s.phase='connecting';await refresh(s);
  const connection=voice.joinVoiceChannel({guildId:s.guild.id,channelId:channel.id,adapterCreator:s.guild.voiceAdapterCreator,group:'soul-radio',selfDeaf:true,selfMute:false});
  s.connection=connection;
  const player=voice.createAudioPlayer({behaviors:{noSubscriber:voice.NoSubscriberBehavior.Stop}});
  // The error listener exists before waiting for Ready, so connection failures
  // cannot emit an unhandled EventEmitter error.
  let connectionError=null;const onError=e=>{connectionError=e;s.interrupt?.('connection');};connection.on('error',onError);
  try{
   await voice.entersState(connection,voice.VoiceConnectionStatus.Ready,AbortSignal.any([s.abort.signal,AbortSignal.timeout(15000)]));
   if(stopped(s))return 'stopped';
   if(connectionError)return 'connection';
   if(channel.type===ChannelType.GuildStageVoice)await s.guild.members.me.voice.setSuppressed(false);
   if(!humans(channel).length)return 'empty';
   if(humans(channel).some(id=>s.heard.has(id)))return 'duplicate';
   s.audience=new Set();s.phase='playing';await refresh(s);
   return await new Promise(resolve=>{
    let done=false,timer;const finish=reason=>{if(done)return;done=true;clearTimeout(timer);s.abort.signal.removeEventListener('abort',cancel);s.interrupt=null;resolve(reason);};
    const cancel=()=>finish('stopped');s.interrupt=finish;s.abort.signal.addEventListener('abort',cancel,{once:true});
    player.on('error',()=>finish('audio'));
    player.on(voice.AudioPlayerStatus.Idle,()=>finish('done'));
    player.on(voice.AudioPlayerStatus.Playing,()=>{
     if(humans(channel).some(id=>s.heard.has(id)&&!s.audience.has(id)))return finish('duplicate-arrival');
     for(const id of humans(channel)){s.heard.add(id);s.audience.add(id);}
    });
    connection.on(voice.VoiceConnectionStatus.Disconnected,()=>finish('connection'));
    connection.on(voice.VoiceConnectionStatus.Destroyed,()=>finish('connection'));
    if(!humans(channel).length)return finish('empty');
    if(humans(channel).some(id=>s.heard.has(id)))return finish('duplicate');
    const resource=voice.createAudioResource(Readable.from([pcm]),{inputType:voice.StreamType.Raw,inlineVolume:true});resource.volume.setVolume(1);
    connection.subscribe(player);player.play(resource);
    timer=setTimeout(()=>finish('timeout'),pcm.length/192000*1000+20000);timer.unref();
    if(stopped(s))cancel();
   });
  }finally{
   s.current=null;s.phase='between';s.interrupt=null;player.stop(true);
   if(connection.state.status!==voice.VoiceConnectionStatus.Destroyed)connection.destroy();s.connection=null;
  }
 }
 async function start(guild,draft,progress){
  if(runs.has(guild.id))throw Error('Une diffusion est déjà en cours.');
  if(isOff())throw Error('Le bot est en pause.');
  if(client.soulSoundboard?.active(guild.id))throw Error('Termine la soundboard avec /stopsound avant de lancer la radio.');
  for(const group of voice.getGroups().values()){
   const c=group.get(guild.id),music=client.soulMusic?.sessions.get(guild.id)?.connection;
   if(c&&c!==music&&c.state.status!==voice.VoiceConnectionStatus.Destroyed)throw Error('Une autre activité utilise le vocal. Termine-la avant la radio.');
  }
  const rooms=destinations(guild);if(!rooms.length)throw Error('Aucun salon vocal occupé.');
  const s={guild,id:draft.id,authorId:draft.authorId,rooms,index:0,results:[],heard:new Set(),audience:new Set(),abort:new AbortController(),phase:'preparing',progress};runs.set(guild.id,s);
  try{data.save(draft.id,r=>{r.status='running';r.startedAt=Date.now();r.total=rooms.length;r.results=[];});}catch(e){runs.delete(guild.id);throw e;}
  // Start asynchronously; the interaction is acknowledged before synthesis/playback.
  s.done=(async()=>{
   let musicToken;
   try{
    await refresh(s);const pcm=await audio.generate(draft.text,s.abort.signal);if(stopped(s))return;
    const actor=await guild.members.fetch({user:s.authorId,force:true});if(!data.allowed(actor))throw Error('Les permissions de l’auteur ont changé.');
    musicToken=await client.soulMusic?.suspendForRadio(guild.id);
    for(let n=0;n<rooms.length;n++){
     if(stopped(s))break;
     const actor=await guild.members.fetch({user:s.authorId,force:true});if(!data.allowed(actor))throw Error('L’auteur n’est plus autorisé à diffuser.');
     s.index=n+1;const channel=guild.channels.cache.get(rooms[n].id);let result;
     try{result=channel?await play(s,channel,pcm):'missing';}catch(e){result=stopped(s)?'stopped':'connection';}
     s.results.push({channelId:rooms[n].id,status:result});await refresh(s);
    }
   }catch(e){if(!stopped(s))s.error='La diffusion a été interrompue : '+(e.status?'synthèse vocale indisponible ('+e.status+').':String(e.message||'erreur audio').slice(0,200));}
   finally{
    s.phase='restoring';await refresh(s);
    if(musicToken){try{await client.soulMusic.resumeAfterRadio(guild.id,musicToken);}catch{ s.restoreError='La musique n’a pas pu reprendre. Consulte son panel.';}}
    s.phase=stopped(s)?'stopped':s.error?'error':'finished';
    try{data.save(s.id,r=>{r.status=s.phase;r.results=s.results;r.error=s.error||'';r.restoreError=s.restoreError||'';r.heard=s.heard.size;r.finishedAt=Date.now();});
     update('radioHistory',all=>{all[s.id]={guildId:guild.id,authorId:s.authorId,at:Date.now(),status:s.phase,results:s.results,heard:s.heard.size};const ids=Object.keys(all).sort((a,b)=>all[b].at-all[a].at);for(const id of ids.slice(100))delete all[id];});
    }finally{runs.delete(guild.id);await refresh(s);}
   }
  })();s.done.catch(e=>console.error('Radio :',e.code||e.name));return s;
 }
 client.on(Events.VoiceStateUpdate,(before,after)=>{
  const s=runs.get(after.guild.id);if(!s?.current||s.phase!=='playing')return;
  if(after.id===client.user.id){if(after.channelId!==s.current)stop(after.guild.id);return;}
  if(after.member?.user.bot||after.channelId!==s.current||before.channelId===after.channelId)return;
  if(s.heard.has(after.id)&&!s.audience.has(after.id)){s.interrupt?.('duplicate-arrival');return;}
  s.audience.add(after.id);s.heard.add(after.id);
 });
 const timer=setInterval(()=>{if(isOff()||client.maintenanceSystem?.checkCommandMaintenance?.('radio')?.blocked)for(const id of runs.keys())stop(id);},1000);timer.unref();
 const api={start,stop,active:id=>runs.has(id),state:id=>runs.get(id)};client.soulRadio=api;return api;
}
module.exports=register;module.exports.destinations=destinations;
