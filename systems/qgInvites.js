const a=require('../utils/qgAdmin');
let baseline=null,timer=null,pending=[];
async function snapshot(guild){const invites=await guild.invites.fetch();return new Map([...invites.values()].map(i=>[i.code,{uses:i.uses||0,inviter:i.inviter?.id}]));}
async function start(guild){try{baseline=await snapshot(guild);}catch{baseline=null;}}
function joined(member){
 pending.push(member.id);if(timer)return;
 timer=setTimeout(()=>{timer=null;a.serial('invite-observation',async()=>{
  const batch=pending.splice(0);let next;try{next=await snapshot(member.guild);}catch{next=null;}
  const changed=baseline&&next?[...next].filter(([code,v])=>baseline.has(code)&&v.uses!==baseline.get(code).uses):[];
  const unchangedCodes=baseline&&next&&baseline.size===next.size&&[...baseline.keys()].every(code=>next.has(code));
  const matched=batch.length===1&&pending.length===0&&unchangedCodes&&changed.length===1&&changed[0][1].uses-baseline.get(changed[0][0]).uses===1?changed[0][1]:null;
  a.save(s=>{s.schoolInviteAttribution||={};for(const id of batch)s.schoolInviteAttribution[id]={at:Date.now(),inviterId:matched?.inviter||null,method:matched?.inviter?'single-use-correlation':'unknown'};});baseline=next;
 }).catch(()=>{baseline=null;});},1500);
 timer.unref();
}
function description(id){const r=a.state().schoolInviteAttribution?.[id];return r?.inviterId?`<@${r.inviterId}> — déduit du suivi d’une utilisation unique`:'Inconnu (aucune attribution fiable)';}
module.exports={start,joined,description};
