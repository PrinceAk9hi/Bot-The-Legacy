const a=require('../utils/qgAdmin'),config=require('../config/qg');
const active=new Map();
function flush(id,now=Date.now()){
 const last=active.get(id);if(!last)return;
 // Never credit a long process suspension as observed voice activity.
 const elapsed=Math.max(0,Math.min(now-last,90000));
 a.save(s=>{s.schoolVoiceMetrics||={};const rec=s.schoolVoiceMetrics[id]||={milliseconds:0,measuredSince:last};rec.milliseconds+=elapsed;rec.updatedAt=now;});
 active.set(id,now);
}
function voice(oldState,newState){
 if(newState.guild.id!==config.guildId||newState.member?.user.bot)return;
 const id=newState.id;if(active.has(id))flush(id);
 if(newState.channelId){if(!active.has(id))active.set(id,Date.now());}else active.delete(id);
}
function start(guild){
 if(guild.id!==config.guildId)return;
 active.clear();for(const state of guild.voiceStates.cache.values())if(state.channelId&&!state.member?.user.bot)active.set(state.id,Date.now());
}
function tick(){for(const id of active.keys())flush(id);}
function total(id){const stored=a.state().schoolVoiceMetrics?.[id];if(!stored&&!active.has(id))return null;return{milliseconds:(stored?.milliseconds||0)+(active.has(id)?Math.min(90000,Math.max(0,Date.now()-active.get(id))):0),measuredSince:stored?.measuredSince||active.get(id)};}
module.exports={voice,start,tick,total};
