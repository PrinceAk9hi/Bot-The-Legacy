const {PermissionFlagsBits:P}=require('discord.js');
const {read,update}=require('./recruitmentData');
const MASK=P.ViewChannel|P.Connect;
const key=m=>m.guild.id+':'+m.id;
const active=m=>Boolean(read('memberPrisons')[key(m)]);
function save(k,r){update('memberPrisons',all=>{if(r)all[k]=r;else delete all[k];});}
function snapshot(c,id){const o=c.permissionOverwrites.cache.get(id);return {existed:!!o,allow:String(o?.allow.bitfield||0n),deny:String(o?.deny.bitfield||0n)};}
async function restore(guild,id,k,r){
 const errors=[];
 for(const [cid,s] of Object.entries(r.channels)){
  try{const c=await guild.channels.fetch(cid).catch(e=>{if(e.code===10003)return null;throw e;});
   if(c){const current=c.permissionOverwrites.cache.get(id);const a=BigInt(s.allow),d=BigInt(s.deny);
    if(current||s.existed){const other=((current?.allow.bitfield||0n)|(current?.deny.bitfield||0n))&~MASK;
     if(!s.existed&&!other)await c.permissionOverwrites.delete(id,'Libération : restauration des accès');
     else await c.permissionOverwrites.edit(id,{ViewChannel:a&P.ViewChannel?true:d&P.ViewChannel?false:null,Connect:a&P.Connect?true:d&P.Connect?false:null}, {reason:'Libération : restauration des accès'});
    }
   }
   delete r.channels[cid];save(k,r);
  }catch(e){errors.push(cid);}
 }
 if(!errors.length)save(k,null);
 else throw Error('Restauration incomplète sur '+errors.length+' salon(s). Réessaie Libérer.');
}
async function imprison(member,reason){
 if(member.id===member.guild.ownerId||member.permissions.has(P.Administrator))throw Error('Ce membre possède Administrateur ou est propriétaire : Discord ne permet pas de lui masquer les salons sans modifier ses rôles.');
 if(active(member))throw Error('Ce membre est déjà en prison.');
 const channels=await member.guild.channels.fetch();const k=key(member),r={userId:member.id,guildId:member.guild.id,createdAt:Date.now(),channels:{},state:'applying'};
 const list=[...channels.values()].filter(c=>c&&!c.isThread()&&c.permissionOverwrites).sort((a,b)=>(a.parentId?1:0)-(b.parentId?1:0));
 for(const c of list)r.channels[c.id]=snapshot(c,member.id);
 save(k,r);
 try{for(const c of list)await c.permissionOverwrites.edit(member.id,{ViewChannel:false,Connect:false},{reason});
  if(member.voice.channelId)await member.voice.disconnect(reason);
  r.state='active';save(k,r);
 }catch(e){r.state='restoring';save(k,r);await restore(member.guild,member.id,k,r);throw Error('Prison non appliquée : les accès précédents ont été restaurés. Vérifie les permissions du bot.');}
}
async function release(member){const k=key(member),r=read('memberPrisons')[k];if(!r)throw Error('Ce membre n’est pas en prison.');r.state='restoring';save(k,r);await restore(member.guild,member.id,k,r);}
async function reconcile(guild){
 if(!Object.values(read('memberPrisons')).some(r=>r.guildId===guild.id))return;
 const channels=await guild.channels.fetch();
 for(const [k,r] of Object.entries(read('memberPrisons'))){if(r.guildId!==guild.id)continue;
  if(r.state!=='active'){await restore(guild,r.userId,k,r);continue;}
  for(const c of channels.values()){if(!c||c.isThread()||!c.permissionOverwrites)continue;
   if(!r.channels[c.id]){r.channels[c.id]=snapshot(c,r.userId);save(k,r);}
   const overwrite=c.permissionOverwrites.cache.get(r.userId);
   if(!overwrite||(overwrite.deny.bitfield&MASK)!==MASK)await c.permissionOverwrites.edit(r.userId,{ViewChannel:false,Connect:false},{reason:'Maintien de la prison'});
  }
 }
}
module.exports={imprison,release,reconcile,active};
