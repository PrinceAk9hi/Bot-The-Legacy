// Alerte d'urgence du QG : le bot passe dans chaque salon vocal occupé, diffuse la sirène et le message,
// et laisse une alerte écrite dans le chat du salon. Rassemblement : déplace tout le monde vers un salon choisi.
const {Readable}=require('node:stream');
const {EmbedBuilder,PermissionFlagsBits:P}=require('discord.js');
const a=require('../utils/qgAdmin'),audio=require('../utils/qgAlertAudio');
const RED=0xd62f2f;
let run=null;

const humans=channel=>[...channel.members.values()].filter(m=>!m.user.bot);
function rooms(guild){return [...guild.channels.cache.values()].filter(c=>c.isVoiceBased?.()&&humans(c).length).sort((x,y)=>(x.rawPosition??0)-(y.rawPosition??0));}
function status(){return run?{active:true,actorId:run.actorId,startedAt:run.startedAt,done:run.done,total:run.total,phase:run.phase}:{active:false,last:a.state().schoolEmergency?.last||null};}
function notice(text,actorId){return new EmbedBuilder().setColor(RED).setTitle('🚨  ALERTE · CRISE EN COURS').setDescription(`${text}\n\n**Consignes**\n> Restez connectés, ne quittez pas le vocal.\n> Préparez-vous à être déplacés par la direction.\n> Gardez les salons libres pour les consignes.`).setFooter(require('../utils/qgBrand').footer(' · Alerte lancée par la direction')).setTimestamp().addFields({name:'Lancée par',value:`<@${actorId}>`,inline:true});}

// Passe dans un salon, joue l'audio puis se déconnecte. Ne lève jamais : renvoie un résultat lisible.
async function play(guild,channel,pcm,signal,voice=require('@discordjs/voice')){
 const me=guild.members.me;if(!channel.permissionsFor(me)?.has([P.ViewChannel,P.Connect,P.Speak]))return 'permissions';
 if(!humans(channel).length)return 'vide';
 const connection=voice.joinVoiceChannel({guildId:guild.id,channelId:channel.id,adapterCreator:guild.voiceAdapterCreator,group:'qg-alert',selfDeaf:true,selfMute:false});
 connection.on('error',()=>{});
 const player=voice.createAudioPlayer({behaviors:{noSubscriber:voice.NoSubscriberBehavior.Play}});
 try{
  await voice.entersState(connection,voice.VoiceConnectionStatus.Ready,AbortSignal.any([signal,AbortSignal.timeout(15000)]));
  if(channel.type===13)await me.voice.setSuppressed(false).catch(()=>{});
  return await new Promise(resolve=>{
   let done=false;const finish=r=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',stop);resolve(r);};
   const stop=()=>finish('arrêtée');signal.addEventListener('abort',stop,{once:true});
   player.on('error',()=>finish('audio'));player.on(voice.AudioPlayerStatus.Idle,()=>finish('diffusée'));
   connection.on(voice.VoiceConnectionStatus.Disconnected,()=>finish('déconnecté'));
   connection.subscribe(player);player.play(voice.createAudioResource(Readable.from([pcm]),{inputType:voice.StreamType.Raw}));
   const timer=setTimeout(()=>finish('délai'),pcm.length/192000*1000+15000);timer.unref?.();
  });
 }catch{return signal.aborted?'arrêtée':'connexion';}
 finally{player.stop(true);if(connection.state.status!==voice.VoiceConnectionStatus.Destroyed)connection.destroy();}
}

async function start(guild,{text,actorId},onUpdate=()=>{}){
 if(run)throw Error('Une alerte est déjà en cours.');
 const list=rooms(guild);if(!list.length)throw Error('Aucun salon vocal occupé : personne à alerter.');
 text=String(text||'').trim()||audio.DEFAULT;
 run={actorId,startedAt:Date.now(),abort:new AbortController(),total:list.length,done:0,results:[],phase:'préparation'};
 const current=run;
 a.save(s=>{s.schoolEmergency={...s.schoolEmergency,active:{actorId,startedAt:current.startedAt,text}};});
 current.promise=(async()=>{
  const reception=require('./qgVoiceReception');
  try{
   const {pcm,spoken}=await audio.build(text,{signal:current.abort.signal});current.spoken=spoken;
   await reception.pause();
   // Une connexion vocale par serveur : on libère toute autre connexion du bot ici.
   const voice=require('@discordjs/voice');for(const group of voice.getGroups().values()){const c=group.get(guild.id);if(c&&c.state.status!==voice.VoiceConnectionStatus.Destroyed)c.destroy();}
   current.phase='diffusion';onUpdate();
   for(const room of list){
    if(current.abort.signal.aborted)break;
    const channel=guild.channels.cache.get(room.id);if(!channel)continue;
    await channel.send({embeds:[notice(text,actorId)],allowedMentions:{parse:[]}}).catch(()=>{});
    current.results.push([room.id,await play(guild,channel,pcm,current.abort.signal)]);current.done++;onUpdate();
   }
  }catch(e){current.error=e.message;}
  finally{
   reception.resume();
   const summary={actorId,startedAt:current.startedAt,endedAt:Date.now(),text,spoken:!!current.spoken,stopped:current.abort.signal.aborted,results:current.results,error:current.error||null};
   a.save(s=>{s.schoolEmergency={last:summary};});
   await a.audit(guild,{action:'alerte.urgence',actorId,after:{salons:current.results.length,diffusees:current.results.filter(([,r])=>r==='diffusée').length},reason:text}).catch(()=>{});
   run=null;onUpdate();
  }
 })();
 return {total:list.length,rooms:list.map(c=>c.id)};
}
function stop(){if(!run)return false;run.abort.abort();return true;}

// Rassemble tous les membres en vocal dans un salon choisi.
async function gather(guild,targetId,actorId){
 const target=guild.channels.cache.get(targetId);if(!target?.isVoiceBased?.())throw Error('Choisis un salon vocal.');
 const me=guild.members.me;if(!me.permissions.has(P.MoveMembers))throw Error('Le bot doit avoir la permission « Déplacer des membres ».');
 let moved=0,failed=0;
 for(const channel of rooms(guild)){if(channel.id===target.id)continue;for(const m of humans(channel)){try{await m.voice.setChannel(target,'Rassemblement d’urgence QG');moved++;}catch{failed++;}}}
 await a.audit(guild,{action:'alerte.rassemblement',actorId,after:{salon:target.id,deplaces:moved,echecs:failed}}).catch(()=>{});
 return {moved,failed,target:target.id};
}
module.exports={start,stop,status,rooms,gather,play,notice};
