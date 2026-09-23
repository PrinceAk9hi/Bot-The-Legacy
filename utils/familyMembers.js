const {Collection}=require('discord.js');
let cache=null,expires=0,pending=null;
async function members(guild,force=false){if(!force&&cache&&expires>Date.now())return cache;if(pending)return pending;
 pending=(async()=>{const found=new Collection();let after;for(;;){const page=await guild.members.list({limit:1000,...(after?{after}:{})});for(const [id,m]of page)found.set(id,m);if(page.size<1000)break;after=[...page.keys()].reduce((a,b)=>BigInt(a)>BigInt(b)?a:b);}
 cache=found;expires=Date.now()+300000;return found;})();try{return await pending;}finally{pending=null;}
}
module.exports={members};
