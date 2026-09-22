const {Events}=require('discord.js');
const {IDENTITY}=require('../config/soulSociety');
const {read,update}=require('../utils/recruitmentData');
const {SOURCES,ingest}=require('../utils/candidateArchive');
const {isOff}=require('../utils/lineState');
module.exports=function(client){
 if(client.candidateArchiveRegistered)return;client.candidateArchiveRegistered=true;
 let busy=false,index=0;
 const ids=Object.keys(SOURCES);
 async function page(){
  if(busy||isOff())return;busy=true;
  const channelId=ids[index++%ids.length];
  try{
   const state=read('candidateArchive'),s=state.sources?.[channelId]||{};
   if(s.retryAt>Date.now()||(s.complete&&!s.catchup&&s.nextCheck>Date.now()))return;
   const c=await client.channels.fetch(channelId);
   if(!c?.isTextBased()||c.guildId!==IDENTITY.guildId)throw Error('Salon source inaccessible ou hors serveur');
   const before=s.complete?s.catchup?.before:s.before;
   const collection=await c.messages.fetch({limit:100,...(before?{before}:{})});
   const messages=[...collection.values()].sort((a,b)=>BigInt(a.id)>BigInt(b.id)?-1:1);
   update('candidateArchive',all=>{
    all.sources||={};const cursor=all.sources[channelId]||{};
    const relevant=cursor.complete?messages.filter(m=>!cursor.high||BigInt(m.id)>BigInt(cursor.high)):messages;
    ingest(all,relevant,channelId);cursor.scanned=(cursor.scanned||0)+relevant.length;cursor.updatedAt=Date.now();delete cursor.error;delete cursor.retryAt;
    if(!cursor.complete){
     if(!cursor.high&&messages[0])cursor.high=messages[0].id;
     if(messages.length<100){cursor.complete=true;delete cursor.before;cursor.nextCheck=0;}
     else cursor.before=messages.at(-1).id;
    }else{
     cursor.catchup||={head:messages[0]?.id||cursor.high};
     const reached=messages.length<100||messages.some(m=>cursor.high&&BigInt(m.id)<=BigInt(cursor.high));
     if(reached){cursor.high=cursor.catchup.head;delete cursor.catchup;cursor.nextCheck=Date.now()+300000;}
     else cursor.catchup.before=messages.at(-1).id;
    }
    all.sources[channelId]=cursor;
   });
  }catch(e){
   update('candidateArchive',all=>{all.sources||={};all.sources[channelId]||={};Object.assign(all.sources[channelId],{error:String(e.code||e.message).slice(0,180),retryAt:Date.now()+60000});});
   console.error('Import profils candidat : salon '+channelId+' — '+(e.code||e.message));
  }finally{busy=false;}
 }
 function receive(m){if(isOff()||m.guildId!==IDENTITY.guildId||!SOURCES[m.channelId]||m.partial)return;
  try{update('candidateArchive',all=>ingest(all,[m],m.channelId));}catch(e){console.error('Archivage candidat :',e.code||e.message);}
 }
 client.on(Events.MessageCreate,receive);client.on(Events.MessageUpdate,(_,m)=>receive(m));
 const start=()=>{page();const timer=setInterval(page,2500);timer.unref();};
 if(client.isReady())start();else client.once(Events.ClientReady,start);
};
