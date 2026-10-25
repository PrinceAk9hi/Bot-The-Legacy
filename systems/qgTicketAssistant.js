const {read,update}=require('../utils/recruitmentData');
const config=require('../config/qg');
const routing=require('./qgTicketRouting');
const db=require('../utils/qgAiStore');
const kb=require('../utils/qgAiKnowledge');
const context=require('../utils/qgAiContext');
const service=require('./qgAiService');
const pending=new Map(),running=new Set();
async function sendText(channel,answer){
 let remaining=kb.clean(answer);const ids=[];
 while(remaining.length){let end=remaining.length>1900?Math.max(remaining.lastIndexOf('\n',1900),remaining.lastIndexOf(' ',1900)):remaining.length;if(end<500)end=Math.min(1900,remaining.length);const sent=await channel.send({content:remaining.slice(0,end),allowedMentions:{parse:[]}});if(sent?.id)ids.push(sent.id);remaining=remaining.slice(end).trimStart();}return ids;
}
function incident(id,channelId,code){try{db.event({id,type:'error',channelId,code:String(code||'internal').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60)});}catch{console.error('IA QG : stockage indisponible');}}
async function escalate(message,reason){
 const moved=await routing.escalate(message.channel,kb.clean(reason));
 if(moved)db.event({id:'escalation:'+message.channelId,type:'escalation',channelId:message.channelId,reason:kb.clean(reason).slice(0,1000),unresolved:true});
}
async function respond(message){
 const rec=read('qgServer').tickets?.[message.channelId];
 if(!rec||rec.escalatedAt||rec.claimedBy||rec.aiLastMessage===message.id)return;
 const s=db.read(),question=message.content||'[Pièce jointe ; contenu non analysé]';
 if(s.config.channels.length&&!s.config.channels.includes(message.channelId))return;
 if(!s.config.enabled||process.env.TICKET_AI_ENABLED==='false'){
  if(service.needsHuman(question))await escalate(message,'Demande nécessitant l’équipe : '+kb.clean(question).slice(0,700));return;
 }
 let mem=context.memory(message.guildId,message.channelId,rec.ownerId);
 {
  const history=await message.channel.messages.fetch({limit:30});
  const recent=[...history.values()].filter(m=>m.id!==message.id&&m.createdTimestamp<=message.createdTimestamp&&m.createdTimestamp>(mem.resetAt||0)&&(m.author.id===rec.ownerId||m.author.id===message.client.user.id&&((rec.aiResponseIds||[]).includes(m.id)||m.embeds?.some(e=>/Assistant officiel|Assistance du QG/.test(e.title||''))))).sort((a,b)=>a.createdTimestamp-b.createdTimestamp).map(m=>({role:m.author.id===rec.ownerId?'user':'assistant',content:kb.clean(m.content||m.embeds?.map(e=>e.description||'').join('\n')||'').slice(0,1600)})).filter(m=>m.content).slice(-12);
  mem={...mem,recent:recent.length?recent:mem.recent};
  for(const m of mem.recent.filter(m=>m.role==='user'))mem.topic=kb.intent(m.content,mem.topic);
 }
 const member=await message.guild.members.fetch(rec.ownerId),discord=await context.discord(message.guild,member);
 let result;
 try{result=await service.generate({question,history:mem.recent,excerpts:mem.excerpts,previousTopic:mem.topic,discord,type:rec.type});}
 catch(e){
  incident('error:'+message.id,message.channelId,e.status||e.code||e.name);
  const current=read('qgServer').tickets?.[message.channelId];if(!current||current.escalatedAt||current.claimedBy)return;
  if(!current.aiUnavailableAt||Date.now()-current.aiUnavailableAt>600000){
   await sendText(message.channel,'Je ne peux pas répondre pour le moment. Tu peux réessayer un peu plus tard ou demander un gestionnaire dans ce ticket.');
   update('qgServer',s=>{if(s.tickets?.[message.channelId])s.tickets[message.channelId].aiUnavailableAt=Date.now();});
  }return;
 }
 const current=read('qgServer').tickets?.[message.channelId],latest=db.read().config;
 if(!current||current.escalatedAt||current.claimedBy||!latest.enabled||process.env.TICKET_AI_ENABLED==='false'||latest.channels.length&&!latest.channels.includes(message.channelId))return;
 if(pending.has(message.channelId))return;
 if(result.decision==='escalate')await escalate(message,result.reason);
 else {const ids=await sendText(message.channel,result.answer);update('qgServer',s=>{const t=s.tickets?.[message.channelId];if(t)t.aiResponseIds=[...(t.aiResponseIds||[]),...ids].slice(-40);});}
 update('qgServer',s=>{if(s.tickets?.[message.channelId])s.tickets[message.channelId].aiLastMessage=message.id;});
 context.remember(message.guildId,message.channelId,rec.ownerId,question,result.answer,result.topic);
 db.event({id:'answer:'+message.id,type:'answer',channelId:message.channelId,question:kb.clean(question).slice(0,600),answer:result.answer.slice(0,1800),topic:result.topic,decision:result.decision,unresolved:result.unresolved||result.decision==='escalate',elapsedMs:result.elapsedMs,usage:result.usage,faults:result.faults});
}
async function message(m){
 if(m.guildId!==config.guildId||m.author.bot)return false;
 const rec=read('qgServer').tickets?.[m.channelId];if(!rec||rec.type==='casino'||rec.ownerId!==m.author.id||rec.escalatedAt||rec.claimedBy)return false;
 pending.set(m.channelId,m);if(running.has(m.channelId))return true;running.add(m.channelId);
 try{while(pending.has(m.channelId)){const next=pending.get(m.channelId);pending.delete(m.channelId);try{await respond(next);}catch(e){incident('handler:'+next.id,next.channelId,e.code||e.name);}}}finally{running.delete(m.channelId);}return true;
}
// Preserve the former parser interface for existing consumers; generation uses the strict service parser.
function parse(raw){const v=JSON.parse(raw);return service.parse(JSON.stringify({sourceIds:[],basis:'unknown',...v}));}
module.exports={message,respond,parse,clean:kb.clean,sendText};
