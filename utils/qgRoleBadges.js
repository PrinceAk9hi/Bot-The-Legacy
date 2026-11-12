// Badges de rôle → emojis du serveur.
// Chaque rôle du QG a un badge (icône de rôle) dont l'image existe aussi en emoji sur le serveur.
// On compare les images (réduites en 16 × 16) pour retrouver l'emoji de chaque badge.
// Le résultat est mémorisé par rôle et recalculé seulement si le badge change.
const a=require('./qgAdmin');
const SIZE=16,THRESHOLD=28; // écart moyen maximal (0-255) pour accepter une correspondance

// Empreinte : pixels RGB d'une image réduite, posée sur un fond gris (la transparence compte).
async function fingerprint(url){
 const {createCanvas,loadImage}=require('@napi-rs/canvas');
 const response=await fetch(url,{signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('Image indisponible ('+response.status+')');
 const image=await loadImage(Buffer.from(await response.arrayBuffer()));
 const canvas=createCanvas(SIZE,SIZE),ctx=canvas.getContext('2d');
 ctx.fillStyle='#808080';ctx.fillRect(0,0,SIZE,SIZE);ctx.drawImage(image,0,0,SIZE,SIZE);
 const data=ctx.getImageData(0,0,SIZE,SIZE).data,out=new Uint8Array(SIZE*SIZE*3);
 for(let p=0,q=0;p<data.length;p+=4){out[q++]=data[p];out[q++]=data[p+1];out[q++]=data[p+2];}
 return out;
}
const distance=(x,y)=>{let d=0;for(let n=0;n<x.length;n++)d+=Math.abs(x[n]-y[n]);return d/x.length;};
// Emoji le plus proche du badge, s'il est assez ressemblant.
function closest(badge,emojis){
 let best=null;
 for(const e of emojis){const d=distance(badge,e.print);if(!best||d<best.d)best={id:e.id,d};}
 return best&&best.d<=THRESHOLD?best.id:null;
}

const prints=new Map(); // emoji -> empreinte (cache du processus)
const emojiUrl=e=>`https://cdn.discordapp.com/emojis/${e.id}.png?size=64`;
const show=e=>`<${e.animated?'a':''}:${e.name}:${e.id}>`;

// Map rôle → emoji (texte <:nom:id>) pour les rôles qui ont un badge reconnu.
async function badgeEmojis(guild,roles,{print=fingerprint}={}){
 const emojis=[...(guild.emojis?.cache?.values()||[])].filter(e=>e.available!==false&&e.id&&e.name);
 const saved=a.state().schoolRoleBadgeEmojis||{},result=new Map(),changes={};
 let loaded=null;
 const all=async()=>{
  if(loaded)return loaded;
  loaded=[];
  for(const e of emojis){
   if(!prints.has(e.id))prints.set(e.id,await print(emojiUrl(e)).catch(()=>null));
   if(prints.get(e.id))loaded.push({id:e.id,print:prints.get(e.id)});
  }
  return loaded;
 };
 for(const role of roles){
  if(!role?.icon)continue;
  const known=saved[role.id];
  let emojiId=known?.icon===role.icon?known.emojiId:undefined;
  if(emojiId===undefined||(emojiId&&!emojis.some(e=>e.id===emojiId))){
   const badge=await print(role.iconURL({extension:'png',size:64})).catch(()=>null);
   if(!badge)continue;
   emojiId=closest(badge,await all());
   changes[role.id]={icon:role.icon,emojiId};
  }
  const emoji=emojis.find(e=>e.id===emojiId);
  if(emoji)result.set(role.id,show(emoji));
 }
 if(Object.keys(changes).length)a.save(s=>{s.schoolRoleBadgeEmojis={...(s.schoolRoleBadgeEmojis||{}),...changes};});
 return result;
}
module.exports={badgeEmojis,_test:{closest,distance,prints}};
