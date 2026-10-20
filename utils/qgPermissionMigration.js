const {Routes}=require('discord.js');
const snapshot=ch=>[...ch.permissionOverwrites.cache.values()].map(o=>({id:o.id,type:o.type,allow:o.allow.bitfield,deny:o.deny.bitfield}));
function detail(error){
 const parts=[];
 function walk(value,path=''){
  if(!value||typeof value!=='object')return;
  for(const [key,item] of Object.entries(value)){
   if(key==='_errors'&&Array.isArray(item))parts.push(`${path}: ${item.map(e=>e.message).join(', ')}`);
   else walk(item,path?`${path}.${key}`:key);
  }
 }
 walk(error.rawError?.errors||error.errors);
 return `${error.code||'échec'}${error.permissionTarget?` • rôle/cible ${error.permissionTarget}`:''}${parts.length?' • '+parts.join('; '):error.code?'':` • ${error.message||'Erreur inconnue'}`}${error.rollbackFailed?' • restauration incomplète : contrôle manuel requis':''}`.slice(0,650);
}
// Ne renvoie pas les anciennes entrées inchangées : Discord ne doit valider que
// les accès effectivement migrés. Ajout du séparateur avant retrait des sources.
async function apply(channel,desired,reason){
 const original=snapshot(channel),before=new Map(original.map(x=>[x.id,x])),after=new Map(desired.map(x=>[x.id,x]));
 if(after.size!==desired.length)throw Error('Cibles de permission en double.');
 for(const x of desired)if(!/^\d{17,20}$/.test(x.id)||![0,1].includes(x.type)||BigInt(x.allow)<0n||BigInt(x.deny)<0n)throw Error('Permission invalide avant envoi.');
 const writes=desired.filter(x=>{const old=before.get(x.id);return !old||old.type!==x.type||BigInt(old.allow)!==BigInt(x.allow)||BigInt(old.deny)!==BigInt(x.deny);});
 const removals=original.filter(x=>!after.has(x.id));
 const attempted=[];
 async function put(x){
  await channel.client.rest.put(Routes.channelPermission(channel.id,x.id),{body:{type:x.type,allow:String(x.allow),deny:String(x.deny)},reason});
 }
 try{
  for(const x of writes){attempted.push(x.id);await put(x);}
  for(const x of removals){attempted.push(x.id);await channel.client.rest.delete(Routes.channelPermission(channel.id,x.id),{reason});}
 }catch(error){
  error.permissionTarget=attempted.at(-1);
  // Une réponse réseau incertaine peut avoir appliqué la dernière opération.
  for(const id of [...attempted].reverse()){
   try{const old=before.get(id);if(old)await put(old);else await channel.client.rest.delete(Routes.channelPermission(channel.id,id),{reason:'Annulation de migration QG incomplète'});}
   catch{error.rollbackFailed=true;}
  }
  throw error;
 }
 return channel.guild.channels.fetch({channel:channel.id,force:true});
}
module.exports={apply,detail};
