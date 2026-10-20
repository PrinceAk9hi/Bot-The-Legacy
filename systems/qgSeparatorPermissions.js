const {PermissionFlagsBits:P,MessageFlags:F,ActionRowBuilder:Row,ButtonBuilder:Button,ButtonStyle:B}=require('discord.js');
const {randomUUID}=require('node:crypto');
const a=require('../utils/qgAdmin'),config=require('../config/qg'),separators=require('./qgSchoolSeparators'),{embed}=require('./qgPanels');
const pending=new Map();
const snapshot=ch=>[...ch.permissionOverwrites.cache.values()].map(o=>({id:o.id,type:o.type,allow:o.allow.bitfield,deny:o.deny.bitfield}));
const signature=entries=>JSON.stringify(entries.map(o=>[o.id,o.type,String(o.allow),String(o.deny)]).sort((x,y)=>x[0].localeCompare(y[0])));
function converted(ch){
 const s=a.state(),r=s.schoolRoles||{},cats=s.schoolCategories||{};
 const original=snapshot(ch),entries=new Map(original.map(o=>[o.id,o]));
 // Les espaces confidentiels et les autorisations individuelles restent intacts.
 const common=new Set(['welcome','information','community','communityVoice','support','familyInfo','family','familyVoice','responsibles','intermanagement'].map(k=>cats[k]).filter(Boolean));
 const privateTicket=Object.hasOwn(s.tickets||{},ch.id)||/^(qg-ticket:|qgr:|qgs-)/.test(ch.topic||'');
 if(privateTicket||(!common.has(ch.id)&&!common.has(ch.parentId)))return original;
 for(const [divider,keys] of Object.entries(separators.groups)){
  const target=r[divider],sources=keys.map(k=>r[k]);
  if(!target||sources.some(id=>!id)||!ch.guild.roles.cache.has(target))continue;
  const values=sources.map(id=>entries.get(id));
  // Des droits différents ne sont jamais fusionnés : ils constituent une exception privée.
  if(values.some(x=>!x||x.type!==0)||values.some(x=>x.allow!==values[0].allow||x.deny!==values[0].deny))continue;
  const current=entries.get(target),source=values[0];
  if(current&&(current.allow!==source.allow||current.deny!==source.deny))continue;
  entries.set(target,{...source,id:target});
  sources.forEach(id=>{if(id!==target)entries.delete(id);});
 }
 return [...entries.values()];
}
async function authorized(i){
 if(i.guildId!==config.guildId)throw Error('Action réservée au QG.');
 const member=await i.guild.members.fetch({user:i.user.id,force:true});
 if(!a.isDirection(member))throw Error('Migration réservée à la direction.');
 const bot=await i.guild.members.fetchMe();
 if(!bot.permissions.has([P.ManageRoles,P.ManageChannels]))throw Error('Le bot doit gérer les rôles et les salons.');
}
async function plan(guild){
 const {missing}=await separators.resolveExisting(guild);
 if(missing.length)throw Error(`Séparateurs existants à associer : ${missing.join(', ')}. Utilise /sync associer-separateur. Le Fondateur conserve ses droits directs et ne nécessite aucun séparateur.`);
 const all=await guild.channels.fetch(),result=[];
 for(const ch of all.values()){
  if(!ch?.permissionOverwrites||ch.isThread())continue;
  const before=snapshot(ch),after=converted(ch);
  if(signature(before)!==signature(after))result.push({id:ch.id,name:ch.name,before:signature(before),after});
 }
 return result;
}
async function associate(i){
 await i.deferReply({flags:F.Ephemeral});await authorized(i);
 const key=i.options.getString('section',true),selected=i.options.getRole('role',true);
 if(key==='dividerFoundation')throw Error('Le rôle Directeur / Fondateur conserve ses permissions directes. Aucune association Fondation n’est nécessaire ; relance /sync separateurs.');
 if(!separators.groups[key])throw Error('Section inconnue.');
 const role=await i.guild.roles.fetch(selected.id),r=a.state().schoolRoles||{};
 if(!role||role.managed||role.id===i.guild.id||!role.editable||role.permissions.bitfield!==0n)throw Error('Choisis un séparateur existant sans permissions globales, placé sous le bot. Ses permissions de salon sont conservées.');
 if(Object.entries(r).some(([k,id])=>id===role.id&&((k.startsWith('divider')&&k!==key)||(!k.startsWith('divider')&&!k.startsWith('separator')))))throw Error('Ce rôle est déjà associé à une autre section ou à une fonction métier.');
 a.save(s=>{s.schoolRoles||={};s.schoolRoles[key]=role.id;});
 return i.editReply({embeds:[embed('Séparateur existant associé',`**${separators.labels[key]}** utilise désormais <@&${role.id}>.\nAucun rôle créé, renommé ou supprimé.\nRelance \`/sync separateurs\` pour prévisualiser puis appliquer les accès.`)],allowedMentions:{parse:[]}});
}
async function execute(i){
 await i.deferReply({flags:F.Ephemeral});await authorized(i);
 const changes=await plan(i.guild),id=randomUUID();
 pending.set(id,{actor:i.user.id,changes,expires:Date.now()+300000});setTimeout(()=>pending.delete(id),300000).unref();
 return i.editReply({embeds:[embed('Permissions par séparateurs',`${changes.length} catégorie(s)/salon(s) à convertir.\n${changes.slice(0,25).map(x=>'• '+x.name).join('\n')}\n\nLes accès communs identiques seront transférés vers leurs séparateurs. Les droits spécifiques, tickets, sanctions et espaces confidentiels restent inchangés. Les membres existants seront synchronisés avant la conversion.\nAucun rôle n’est créé ou supprimé.`)],components:[new Row().addComponents(new Button().setCustomId('sync:separators:'+id).setLabel('Appliquer la migration').setStyle(B.Primary))],allowedMentions:{parse:[]}});
}
async function confirm(i){
 const id=i.customId.split(':')[2],p=pending.get(id);
 if(!p||p.actor!==i.user.id||p.expires<Date.now())return i.reply({content:'Prévisualisation expirée ou réservée à son auteur.',flags:F.Ephemeral});
 pending.delete(id);await i.deferUpdate();await authorized(i);
 const current=await plan(i.guild);
 const fingerprint=list=>JSON.stringify(list.map(x=>[x.id,x.before,signature(x.after)]).sort((x,y)=>x[0].localeCompare(y[0])));
 if(fingerprint(current)!==fingerprint(p.changes))throw Error('Les permissions ont changé. Relance /sync separateurs.');
 await separators.syncGuild(i.guild);
 const failures=[];let count=0;
 for(const item of current){
  try{
   const ch=await i.guild.channels.fetch({channel:item.id,force:true});
   // Une modification de catégorie peut déjà avoir propagé ses droits à ses enfants.
   if(signature(snapshot(ch))===signature(item.after)){count++;continue;}
   if(signature(snapshot(ch))!==item.before)throw Error('permissions modifiées');
   await ch.permissionOverwrites.set(item.after,'Migration des accès communs vers les séparateurs QG');count++;
  }catch(e){failures.push(`${item.name} : ${e.code||e.message}`);}
 }
 a.save(s=>{s.schoolSeparatorPermissions={enabled:true,at:Date.now(),actor:i.user.id};});
 return i.editReply({embeds:[embed('Migration des permissions',`${count}/${current.length} éléments convertis.\nExceptions privées conservées.\n${failures.slice(0,15).join('\n')}`)],components:[],allowedMentions:{parse:[]}});
}
async function refresh(ch){
 if(ch?.guild?.id!==config.guildId||!ch.permissionOverwrites||!a.state().schoolSeparatorPermissions?.enabled)return;
 return a.serial('separator-acl:'+ch.id,async()=>{
  ch=await ch.guild.channels.fetch({channel:ch.id,force:true}).catch(e=>{if(e.code===10003)return null;throw e;});
  if(!ch)return;
  const after=converted(ch);
  if(signature(snapshot(ch))!==signature(after))await ch.permissionOverwrites.set(after,'Maintien des permissions par séparateurs QG');
 });
}
module.exports={execute,confirm,refresh,associate};
