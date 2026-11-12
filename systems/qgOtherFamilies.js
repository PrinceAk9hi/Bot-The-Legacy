// Autres familles School : repère les membres du serveur (tous, pas seulement la famille) qui font
// partie d'une communauté Roblox créée par le compte « schoolfamily » (@colonelrqt2), hors la nôtre.
// Le nom affiché est celui de la communauté sans la partie « School » : « KITSUNE | SCHOOLRP » → « KITSUNE »,
// « ECLIPSE | SCHOOL RP », « APOCALYPSE / SCHOOLRP », « School Staff | X » → le nom seul.
// Les communautés d'un joueur sont publiques : aucun cookie Roblox n'est utilisé.
// Vérification de chaque membre une fois par jour (10 membres par minute) ; chaque nouvelle
// famille détectée est signalée dans le journal de modération. =familles affiche la liste actuelle.
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const OWNER=()=>String(config.otherFamiliesOwner||'colonelrqt2').toLowerCase();
const DAY=86400000,PER_TICK=10,RETRY=3600000;

// Retire la partie « School » (SCHOOLRP, SCHOOL RP, SCHOOL, School Staff…) du nom de la communauté.
const SCHOOL=/^school\s*(rp|staff)?$/i;
function familyName(name){
 const text=String(name||'').trim();
 const parts=text.split(/[|/]/).map(x=>x.trim()).filter(x=>x&&!SCHOOL.test(x));
 const kept=parts.length?parts.join(' | '):text;
 return kept.replace(/\bschool\s*(rp|staff)?\b/ig,'').replace(/\s{2,}/g,' ').trim()||kept;
}

// Compte Roblox d'un membre Discord : vérification QG, sinon liaison Roblox enregistrée.
function robloxOf(discordId,state=a.state()){
 const p=state.schoolEntryVerification?.[discordId];
 if(/^\d+$/.test(String(p?.robloxId||'')))return{id:Number(p.robloxId),name:p.robloxName||String(p.robloxId)};
 const link=require('../utils/robloxLinks').getRobloxLink(discordId);
 if(/^\d+$/.test(String(link?.robloxUserId||'')))return{id:Number(link.robloxUserId),name:link.robloxUsername||String(link.robloxUserId)};
 return null;
}

// Communautés publiques d'un joueur Roblox (avec leur créateur).
async function fetchGroups(robloxId,http=fetch){
 const response=await http(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`,{signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('Roblox '+response.status);
 const body=await response.json();
 return(body.data||[]).map(x=>({id:Number(x.group?.id),name:x.group?.name||'',owner:String(x.group?.owner?.username||'').toLowerCase(),ownerId:Number(x.group?.owner?.userId)||null}));
}

// Familles créées par le compte schoolfamily, sauf la communauté du QG.
function otherFamilies(groups){
 const own=Number(config.robloxGroupId);
 return groups.filter(g=>g.owner===OWNER()&&g.id!==own).map(g=>({id:g.id,name:familyName(g.name)}));
}

async function report(guild,member,roblox,families){
 const id=a.state().schoolChannels?.[config.otherFamiliesChannel||'logsModeration'];if(!id)return false;
 const ch=await guild.channels.fetch(id).catch(()=>null);
 if(!ch?.isTextBased()||ch.guildId!==config.guildId)return false;
 const {embed}=require('./qgPanels');
 await ch.send({embeds:[embed('🏴 Membre dans une autre famille School',
  `Membre : <@${member.id}>\nRoblox : [${roblox.name}](https://www.roblox.com/users/${roblox.id}/profile)\nFamille${families.length>1?'s':''} : ${families.map(f=>`**${f.name}**`).join(', ')}`).setTimestamp()],allowedMentions:{parse:[]}});
 return true;
}

let busy=false;
async function tick(guild,{http=fetch,now=Date.now()}={}){
 if(busy||guild.id!==config.guildId)return 0;busy=true;
 try{
  const seen=a.state().schoolOtherFamilies||{};
  const members=[...(await require('../utils/qgMembers')(guild)).values()].filter(m=>!m.user.bot);
  const due=members.map(m=>({m,roblox:robloxOf(m.id)})).filter(x=>x.roblox&&!(seen[x.m.id]?.next>now))
   .sort((x,y)=>(seen[x.m.id]?.checkedAt||0)-(seen[y.m.id]?.checkedAt||0)).slice(0,PER_TICK);
  let reported=0;
  for(const {m,roblox} of due){
   let families;
   try{families=otherFamilies(await fetchGroups(roblox.id,http));}
   catch(e){a.save(s=>{s.schoolOtherFamilies||={};s.schoolOtherFamilies[m.id]={...(s.schoolOtherFamilies[m.id]||{}),next:now+RETRY};});continue;}
   const before=new Set((seen[m.id]?.families||[]).map(f=>f.id)),fresh=families.filter(f=>!before.has(f.id));
   if(fresh.length&&await report(guild,m,roblox,fresh).catch(e=>{console.error('Autres familles QG :',e.code||e.message);return false;}))reported++;
   a.save(s=>{s.schoolOtherFamilies||={};s.schoolOtherFamilies[m.id]={robloxId:roblox.id,robloxName:roblox.name,families,checkedAt:now,next:now+DAY};});
  }
  return reported;
 }finally{busy=false;}
}

// =familles : membres actuellement dans une autre famille School (direction et responsable recrutement).
async function command(m){
 if(m.guildId!==config.guildId||!/^=familles\s*$/i.test(m.content.trim()))return false;
 const actor=await m.guild.members.fetch({user:m.author.id,force:true});
 if(!a.can(actor,'rankup')){await m.reply({content:'Commande réservée à la direction et au responsable recrutement.',allowedMentions:{parse:[]}});return true;}
 const members=await require('../utils/qgMembers')(m.guild),seen=a.state().schoolOtherFamilies||{};
 const rows=Object.entries(seen).filter(([id,x])=>members.has(id)&&x.families?.length).map(([id,x])=>`<@${id}> (${x.robloxName}) — ${x.families.map(f=>`**${f.name}**`).join(', ')}`);
 const humans=[...members.values()].filter(x=>!x.user.bot),linked=humans.filter(x=>robloxOf(x.id)).length,checked=humans.filter(x=>seen[x.id]?.checkedAt).length;
 const {embed}=require('./qgPanels');
 const text=`${rows.join('\n')||'Aucun membre dans une autre famille School pour le moment.'}\n\n-# ${checked}/${linked} comptes Roblox vérifiés · ${humans.length-linked} membre(s) sans compte Roblox connu.`;
 await m.reply({embeds:[embed(`🏴 Autres familles School · ${rows.length}`,text.slice(0,4000))],allowedMentions:{parse:[]}});
 return true;
}
module.exports={tick,command,_test:{familyName,otherFamilies,fetchGroups,robloxOf}};
