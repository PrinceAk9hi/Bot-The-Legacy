const {randomUUID}=require('node:crypto');
const {Events,ActionRowBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder,AttachmentBuilder,MessageFlags}=require('discord.js');
const {IDENTITY,COLORS}=require('../config/soulSociety');
const {blockProtectedInteraction,canUseCommand}=require('../utils/security');
const {isOff,OWNER_ID}=require('../utils/lineState');
const {ownerLineReply}=require('../utils/prefixContext');
const {PrefixError,parse,resolver,usages}=require('../utils/prefixOptions');
const DIRECT=new Set(['mv','derank','line']);
function register(client){
 if(client.prefixCommands)return client.prefixCommands;
 const pending=new Map(),results=new Map(),busy=new Set();
 const control=(id,label)=>[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(ButtonStyle.Primary))];
 const reply=(message,payload,name='')=>{
  const send=()=>message.reply({...payload,allowedMentions:{parse:[],repliedUser:false}});
  return name==='line'&&message.author.id===OWNER_ID?ownerLineReply(message.channelId,send):send();
 };
 function check(subject,name){if(subject.guildId!==IDENTITY.guildId||!canUseCommand(subject,name))throw new PrefixError('Tu n’as pas accès à cette commande.');if(isOff()&&!(name==='line'&&subject.user.id===OWNER_ID))throw new PrefixError('Le bot est en pause.');const blocked=client.maintenanceSystem?.checkCommandMaintenance?.(name);if(blocked?.blocked)throw new PrefixError('Cette commande est temporairement en maintenance.');}
 function commandProxy(interaction,name,data){const options=resolver(client,data);return new Proxy(interaction,{get(target,key){if(key==='commandName')return name;if(key==='commandPrefix')return '=';if(key==='options')return options;if(key==='isChatInputCommand')return()=>true;if(['isAutocomplete','isMessageComponent','isButton','isStringSelectMenu','isUserSelectMenu','isModalSubmit'].includes(key))return()=>false;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});}
 async function execute(interaction,name,data){const i=commandProxy(interaction,name,data),started=Date.now();let error,status='success';
  try{check(i,name);if(await blockProtectedInteraction(i,name)){status='blocked';return;}const command=client.commands.get(name);if(!command?.execute)throw new PrefixError('Commande introuvable.');await command.execute(i,client);}
  catch(e){error=e;const payload={content:'❌ '+(e instanceof PrefixError?e.message:'La commande n’a pas pu être exécutée.'),flags:MessageFlags.Ephemeral};if(i.deferred||i.replied){delete payload.flags;await i.editReply(payload).catch(()=>{});}else await i.reply(payload).catch(()=>{});console.error('Commande ='+name+' :',e.code||e.name);}
  finally{await client.logs?.logCommand?.(i,{status:error?'error':status,durationMs:Date.now()-started,error}).catch(()=>{});}
 }
 function directInteraction(message,name){let response,privateReply=false;const key=randomUUID();const i={id:message.id,client,guild:message.guild,guildId:message.guildId,channel:message.channel,channelId:message.channelId,user:message.author,member:message.member,deferred:false,replied:false,isChatInputCommand:()=>true,isAutocomplete:()=>false,inGuild:()=>true};
  async function send(payload){if(typeof payload==='string')payload={content:payload};privateReply=privateReply||Boolean(Number(payload.flags||0)&MessageFlags.Ephemeral)||payload.ephemeral===true;const body={...payload};delete body.flags;delete body.ephemeral;delete body.fetchReply;
   if(privateReply){results.set(key,{owner:message.author.id,expires:Date.now()+900000,payload:body});const visible={content:`📬 <@${message.author.id}>, le résultat de **=${name}** est disponible ci-dessous.`,components:control('prefix-result:'+key,'Voir mon résultat')};if(response){const edit=()=>response.edit({...visible,allowedMentions:{parse:[]}});await(name==='line'&&message.author.id===OWNER_ID?ownerLineReply(message.channelId,edit):edit());}else response=await reply(message,visible,name);}
   else if(response)await response.edit({...body,allowedMentions:{parse:[]}});else response=await reply(message,body,name);
   i.replied=true;return response;
  }
  i.deferReply=async payload=>{privateReply=Boolean(Number(payload?.flags||0)&MessageFlags.Ephemeral)||payload?.ephemeral===true;i.deferred=true;};i.reply=send;i.editReply=send;i.followUp=send;i.fetchReply=async()=>response;i.deleteReply=async()=>response?.delete();return i;
 }
 async function help(message,name){const subject={guildId:message.guildId,user:message.author,member:message.member};if(name){const command=client.commands.get(name);if(!command||!canUseCommand(subject,name))throw new PrefixError('Commande introuvable ou non autorisée.');const text=usages(command.data.toJSON());return reply(message,{embeds:[new EmbedBuilder().setColor(COLORS.primary).setTitle('📖 ='+name).setDescription(('```text\n'+text.slice(0,3300)+'\n```\nUtilise une mention ou un ID pour les membres. Mets les textes de plusieurs mots entre guillemets. Tu peux aussi nommer les options : `raison:texte` et `note:texte`.').slice(0,4096))]});}
  const names=[...client.commands.keys()].filter(name=>canUseCommand(subject,name)).sort();if(!names.length)throw new PrefixError('Aucune commande accessible.');return reply(message,{embeds:[new EmbedBuilder().setColor(COLORS.primary).setTitle('📚 Commandes de La Soul Society').setDescription(names.map(n=>'`='+n+'`').join(' • ')+'\n\n**=aide nom** : syntaxe et paramètres.\n**=mv @membre** : déplacer dans ton vocal.\n**=derank @membre raison** : derank.\nLes commandes à interface s’ouvrent avec le bouton affiché ; les réponses privées restent visibles uniquement par toi.')]});
 }
 async function onMessage(message){if(message.author.bot||message.webhookId||message.guildId!==IDENTITY.guildId||!message.content?.startsWith('='))return;const match=/^=([\p{L}\d_-]+)(?:\s+([\s\S]*))?$/u.exec(message.content.trim());if(!match)return;const name=match[1].toLowerCase(),text=match[2]||'';
  if(isOff()&&!(name==='line'&&message.author.id===OWNER_ID))return;
  if(busy.has(message.author.id))return;busy.add(message.author.id);
  try{
   if(name==='aide'||name==='help')return await help(message,text.trim().replace(/^=/,''));
   const command=client.commands.get(name);if(!command)return await reply(message,{content:'❌ Commande inconnue. Utilise =aide.'});
   const subject={guildId:message.guildId,guild:message.guild,client,user:message.author,member:message.member,attachments:message.attachments};check(subject,name);
   const data=await parse(command,text,subject);check(subject,name);
   if(DIRECT.has(name))return await execute(directInteraction(message,name),name,data);
   const key=randomUUID();pending.set(key,{owner:message.author.id,guildId:message.guildId,name,data,expires:Date.now()+600000});
   await reply(message,{content:`<@${message.author.id}>, ouvre **=${name}** avec le bouton ci-dessous.`,components:control('prefix-run:'+key,'Ouvrir ='+name)});
  }catch(e){await reply(message,{content:'❌ '+(e instanceof PrefixError?e.message:'Impossible de préparer cette commande. Réessaie avec une mention ou un ID.')},name).catch(()=>{});if(!(e instanceof PrefixError))console.error('Préparation commande :',e.code||e.name);}
  finally{busy.delete(message.author.id);}
 }
 async function handle(i){
  const result=i.customId.startsWith('prefix-result:'),key=i.customId.split(':')[1],store=result?results:pending,record=store.get(key);
  if(!record||record.expires<Date.now())return i.reply({content:'Ce bouton a expiré. Relance la commande avec =.',flags:MessageFlags.Ephemeral});
  if(record.owner!==i.user.id||i.guildId!==IDENTITY.guildId)return i.reply({content:'Ce bouton appartient à un autre membre.',flags:MessageFlags.Ephemeral});
  if(result)return i.reply({...record.payload,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
  // Consommer le lancement avant l'action : les doubles clics ne répètent pas une sanction.
  store.delete(key);
  await execute(i,record.name,record.data);
  await i.message.edit({components:[]}).catch(()=>{});
 }
 client.on(Events.MessageCreate,message=>onMessage(message).catch(e=>console.error('Commandes préfixées :',e.code||e.name)));
 const timer=setInterval(()=>{for(const store of [pending,results])for(const [id,r]of store)if(r.expires<Date.now())store.delete(id);},60000);timer.unref();
 const api={handle,onMessage,execute,pending,results};client.prefixCommands=api;return api;
}
module.exports=register;
