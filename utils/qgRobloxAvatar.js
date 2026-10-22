const PNG=Buffer.from([137,80,78,71,13,10,26,10]);
const MAX_BYTES=4*1024*1024;
async function bytes(response,max=MAX_BYTES){
 if(!response.ok||Number(response.headers.get('content-length')||0)>max)throw Error('Image indisponible ou trop volumineuse');
 const reader=response.body.getReader(),parts=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Réponse trop volumineuse');parts.push(Buffer.from(value));}}
 finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(parts);
}
function trustedImage(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='rbxcdn.com'||u.hostname.endsWith('.rbxcdn.com'));}catch{return false;}}
async function fullBody(id,{fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),timeoutMs=12000}={}){
 if(!/^[1-9]\d{0,15}$/.test(String(id||'')))return null;
 const signal=AbortSignal.timeout(timeoutMs);
 const url=`https://thumbnails.roblox.com/v1/users/avatar?userIds=${id}&size=420x420&format=Png&isCircular=false`;
 try{
  for(let attempt=0;attempt<3;attempt++){
   signal.throwIfAborted();
   const response=await fetcher(url,{signal,redirect:'error'});
   if(response.status===429||response.status>=500){if(attempt<2){await sleep(500*(attempt+1));continue;}return null;}
   const data=JSON.parse((await bytes(response,65536)).toString('utf8'));
   const item=data.data?.find(x=>String(x.targetId)===String(id));
   if(item?.state==='Completed'&&trustedImage(item.imageUrl)){
    const image=await bytes(await fetcher(item.imageUrl,{signal,redirect:'error'}));
    return image.subarray(0,8).equals(PNG)?image:null;
   }
   if(!['Pending','InReview'].includes(item?.state))return null;
   if(attempt<2)await sleep(500*(attempt+1));
  }
 }catch{/* Roblox ne doit jamais empêcher la bienvenue. */}
 return null;
}
module.exports={fullBody,bytes,trustedImage};
