const {Events, EmbedBuilder, MessageFlags}=require('discord.js');
const {read,update}=require('../utils/recruitmentData');
const {IDENTITY}=require('../config/soulSociety');
const {isOff}=require('../utils/lineState');
const WAIT='1479868892569669773', CHAT='1471562633802023115', REQUESTS='1550248050226892810';
function register(client){
 const busy=new Set();
 async function once(key,fn){if(busy.has(key))return;busy.add(key);try{await fn();}catch(e){console.error('Convocation :',e.code||e.message);}finally{busy.delete(key);}}
 async function arrival(member){
  if(isOff()||member.guild.id!==IDENTITY.guildId||member.voice.channelId!==WAIT)return;
  for(const [id,r] of Object.entries(read('memberConvocations'))){
   if(r.userId!==member.id||r.guildId!==member.guild.id||!r.scheduledAt||r.arrivalNotifiedAt||Date.now()>r.scheduledAt+86400000)continue;
   await once('arrival:'+id,async()=>{if(read('memberConvocations')[id]?.arrivalNotifiedAt)return;
    const c=await member.guild.channels.fetch(REQUESTS);
    await c.send({content:`<@${r.authorId}>, le membre convoqué <@${member.id}> est en attente de convocation dans <#${WAIT}>.`,allowedMentions:{parse:[],users:[r.authorId]},nonce:id,enforceNonce:true});
    update('memberConvocations',all=>{if(all[id])all[id].arrivalNotifiedAt=Date.now();});
   });
  }
 }
 async function tick(){if(isOff())return;
  for(const [id,r] of Object.entries(read('memberConvocations'))){
   const remaining=r.scheduledAt-Date.now();
   if(r.guildId!==IDENTITY.guildId||!r.scheduledAt||r.remindedAt||remaining<=0||remaining>1800000)continue;
   await once('reminder:'+id,async()=>{if(read('memberConvocations')[id]?.remindedAt)return;
    const c=await client.channels.fetch(CHAT);const minutes=Math.max(1,Math.ceil((r.scheduledAt-Date.now())/60000));
    await c.send({content:`<@${r.userId}>, ta convocation commence dans ${minutes} minutes (<t:${Math.floor(r.scheduledAt/1000)}:t>). Rejoins le salon d’attente <#${WAIT}> à l’heure prévue.`,allowedMentions:{parse:[],users:[r.userId]},nonce:id,enforceNonce:true});
    update('memberConvocations',all=>{if(all[id])all[id].remindedAt=Date.now();});
   });
  }
 }
 client.on(Events.InteractionCreate,async i=>{
  if(!i.isButton()||!i.customId.startsWith('membercare_confirm:'))return;
  const id=i.customId.split(':')[1],r=read('memberConvocations')[id];
  if(!r||r.guildId!==i.guildId||r.userId!==i.user.id)return i.reply({content:'❌ Cette confirmation est réservée au membre convoqué.',flags:MessageFlags.Ephemeral});
  await i.deferReply({flags:MessageFlags.Ephemeral});
  await once('confirm:'+id,async()=>{
   update('memberConvocations',all=>{all[id].confirmedAt=all[id].confirmedAt||Date.now();});
   const embeds=i.message.embeds.map(e=>EmbedBuilder.from(e));
   if(embeds[0]){const fields=embeds[0].data.fields||[];embeds[0].setFields(fields.map(f=>f.name==='Réponse'?{name:'Réponse',value:'✅ Présence confirmée.'}:f));}
   await i.message.edit({embeds});
   await i.editReply(`✅ Ta présence est confirmée. À l’heure prévue, rejoins <#${WAIT}> : https://discord.com/channels/${i.guildId}/${WAIT}`);
   const m=await i.guild.members.fetch(i.user.id);await arrival(m);
  });
  if(!i.replied)await i.editReply('Confirmation enregistrée.');
 });
 client.on(Events.VoiceStateUpdate,(old,s)=>{if(s.channelId===WAIT&&old.channelId!==WAIT&&s.member)arrival(s.member).catch(e=>console.error('Arrivée convocation :',e.code||e.message));});
 const start=()=>{tick().catch(console.error);const timer=setInterval(()=>tick().catch(console.error),15000);timer.unref();
  const c=client.channels.cache.get(WAIT);for(const m of c?.members?.values()||[])arrival(m).catch(console.error);
 };
 if(client.isReady())start();else client.once(Events.ClientReady,start);
}
module.exports=register;
