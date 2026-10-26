const config=require('../config/qg'),db=require('../utils/qgAiStore'),ctx=require('../utils/qgAiContext'),service=require('./qgAiService');
const pending=new Set(),last=new Map();
async function message(m){
 if(m.guildId!==config.guildId||m.author.bot)return false;
 const cfg=db.read().config;if(!cfg.enabled||cfg.publicScope==='selected'&&!(cfg.publicChannels||[]).includes(m.channelId))return false;
 const mentioned=m.mentions.users.has(m.client.user.id);if((cfg.publicScope!=='selected'||cfg.mentionsOnly!==false)&&!mentioned)return false;
 if(!m.channel.permissionsFor(m.guild.members.me)?.has(['ViewChannel',m.channel.isThread()?'SendMessagesInThreads':'SendMessages']))return false;
 const key=ctx.key(m.guildId,m.channelId,m.author.id);if(pending.has(key)||Date.now()-(last.get(key)||0)<10000)return true;
 pending.add(key);last.set(key,Date.now());if(last.size>10000)for(const [k,t]of last)if(t<Date.now()-60000)last.delete(k);
 try{
  const question=m.content.replace(new RegExp('<@!?'+m.client.user.id+'>','g'),'').trim();if(!question)return true;
  const member=await m.guild.members.fetch({user:m.author.id,force:true}),discord=await ctx.discord(m.guild,member),mem=ctx.memory(m.guildId,m.channelId,m.author.id);
  const result=await service.generate({question,history:mem.recent,excerpts:mem.excerpts,previousTopic:mem.topic,discord});
  const latest=db.read().config;if(!latest.enabled||latest.publicScope==='selected'&&!(latest.publicChannels||[]).includes(m.channelId))return true;
  const answer=result.decision==='escalate'?'Cette demande nécessite un responsable. Ouvre un ticket support pour que l’équipe puisse examiner ton dossier en privé.':result.answer;
  await m.reply({content:answer.slice(0,1900),allowedMentions:{parse:[],repliedUser:false}});
  ctx.remember(m.guildId,m.channelId,m.author.id,question,answer,result.topic);
  db.event({id:'answer:'+m.id,type:'answer',channelId:m.channelId,question,answer,topic:result.topic,elapsedMs:result.elapsedMs,usage:result.usage,unresolved:result.unresolved});
 }catch(e){db.event({id:'error:'+m.id,type:'error',channelId:m.channelId,code:e.code||e.name});await m.reply({content:'Je ne peux pas répondre pour le moment. Réessaie plus tard ou contacte le support.',allowedMentions:{parse:[],repliedUser:false}}).catch(()=>{});}finally{pending.delete(key);}return true;
}
module.exports={message};
