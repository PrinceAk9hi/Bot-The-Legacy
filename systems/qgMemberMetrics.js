const a=require('../utils/qgAdmin'),config=require('../config/qg');
const active=new Map();
const day=at=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(at);
function bucket(s,id,at){s.schoolDailyActivity||={};s.schoolDailyActivity[id]||={};const rows=s.schoolDailyActivity[id];for(const key of Object.keys(rows))if(key<day(at-90*86400000))delete rows[key];return rows[day(at)]||=( {voiceMs:0,messages:0} );}
function flush(id,now=Date.now()){
 const last=active.get(id);if(!last)return;
 // Never credit a long process suspension as observed voice activity.
 const elapsed=Math.max(0,Math.min(now-last,90000));
 a.save(s=>{s.schoolVoiceMetrics||={};const rec=s.schoolVoiceMetrics[id]||={milliseconds:0,measuredSince:last};rec.milliseconds+=elapsed;rec.updatedAt=now;
  // Split the short observed interval at the Paris midnight boundary.
  if(day(now-elapsed)!==day(now)){let lo=now-elapsed,hi=now;while(hi-lo>1){const mid=Math.floor((hi+lo)/2);if(day(mid)===day(now))hi=mid;else lo=mid;}bucket(s,id,now-elapsed).voiceMs+=hi-(now-elapsed);bucket(s,id,now).voiceMs+=now-hi;}
  else bucket(s,id,now).voiceMs+=elapsed;
 });
 active.set(id,now);
}
function voice(oldState,newState){
 if(newState.guild.id!==config.guildId||newState.member?.user.bot)return;
 const id=newState.id;if(active.has(id))flush(id);
 if(newState.channelId){if(!active.has(id))active.set(id,Date.now());}else active.delete(id);
}
function start(guild){
 if(guild.id!==config.guildId)return;
 a.save(s=>{s.schoolActivityStartedAt||=Date.now();});
 active.clear();for(const state of guild.voiceStates.cache.values())if(state.channelId&&!state.member?.user.bot)active.set(state.id,Date.now());
}
function tick(){for(const id of active.keys())flush(id);}
function total(id){const stored=a.state().schoolVoiceMetrics?.[id];if(!stored&&!active.has(id))return null;return{milliseconds:(stored?.milliseconds||0)+(active.has(id)?Math.min(90000,Math.max(0,Date.now()-active.get(id))):0),measuredSince:stored?.measuredSince||active.get(id)};}
const seen=new Map();
function message(m){if(m.guildId!==config.guildId||m.author.bot||seen.has(m.id))return;seen.set(m.id,Date.now());if(seen.size>5000)seen.delete(seen.keys().next().value);a.save(s=>{bucket(s,m.author.id,Date.now()).messages++;});}
function week(id,end=Date.now(),previous=false){
 const endDay=day(end),calendar=new Date(endDay+'T12:00:00Z');calendar.setUTCDate(calendar.getUTCDate()-7);const startDay=calendar.toISOString().slice(0,10),rows=a.state().schoolDailyActivity?.[id]||{};
 const values=Object.entries(rows).filter(([key])=>previous?key>=startDay&&key<endDay:key>startDay&&key<=endDay);
 return{voiceMs:values.reduce((n,[,r])=>n+r.voiceMs,0),messages:values.reduce((n,[,r])=>n+r.messages,0),since:a.state().schoolActivityStartedAt||null};
}
function lastRankup(id){const s=a.state();return Math.max(0,...(s.schoolAdminHistory||[]).filter(e=>e.targetId===id&&['rankup','meeting.rankup','validate'].includes(e.action)&&e.result==='success').map(e=>e.at),...Object.values(s.schoolPromotions||{}).filter(p=>p.memberId===id&&['accepted','accept'].includes(p.status)).map(p=>p.reviewedAt||0))||null;}
module.exports={voice,start,tick,total,message,week,lastRankup,day};
