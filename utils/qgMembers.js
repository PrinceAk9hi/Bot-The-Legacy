// Une seule requête Gateway opcode 8 en cours par serveur, partagée par les panels.
const states=new WeakMap();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function members(guild){
 let state=states.get(guild);
 if(!state){state={loadedAt:0,pending:null,retryAt:0};states.set(guild,state);}
 if(state.pending)return state.pending;
 // Le cache vivant continue de recevoir les arrivées, départs et changements de rôles.
 if(state.loadedAt&&Date.now()-state.loadedAt<120000)return guild.members.cache;
 state.pending=(async()=>{
  for(let attempt=0;attempt<2;attempt++){
   const delay=state.retryAt-Date.now();
   if(delay>65000)throw Error('Discord limite temporairement la liste des membres. Réessaie dans quelques minutes.');
   if(delay>0)await wait(delay);
   try{await guild.members.fetch();state.loadedAt=Date.now();state.retryAt=0;return guild.members.cache;}
   catch(error){
    if(error.data?.opcode!==8||!Number.isFinite(Number(error.data?.retry_after)))throw error;
    const seconds=Math.max(1,Number(error.data.retry_after));
    state.retryAt=Date.now()+seconds*1000+1000;
    if(attempt===1||seconds>64)throw Error(`Discord limite temporairement la liste des membres. Réessaie dans ${Math.ceil(seconds)+1} secondes.`);
   }
  }
 })();
 try{return await state.pending;}finally{state.pending=null;}
}
module.exports=members;
