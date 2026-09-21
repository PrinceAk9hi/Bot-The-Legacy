const {Events,MessageFlags}=require('discord.js');
const {isOff,OWNER_ID}=require('../utils/lineState');
const {IDENTITY}=require('../config/soulSociety');
module.exports=function(client){
 const request=client.rest.request.bind(client.rest);
 client.rest.request=async function(options){
  const route=options.fullRoute||'';
  const permitted=options.method==='GET'||/^\/interactions\//.test(route)||/^\/webhooks\//.test(route)||/^\/applications\/[^/]+\/(?:guilds\/[^/]+\/)?commands/.test(route)||/^\/channels\/1551563872647905400\/messages/.test(route);
  if(isOff()&&!permitted){const error=new Error('Bot en pause (/line off).');error.code='BOT_OFF';throw error;}
  return request(options);
 };
 const emit=client.emit;
 // Filtrer avant tous les listeners : un return dans un seul listener ne suffit pas.
 client.emit=function(event,...args){
  if(event===Events.InteractionCreate&&isOff()){
   const i=args[0];
   if(!(i.isChatInputCommand?.()&&i.commandName==='line'&&i.user.id===OWNER_ID)){
    const response=i.isAutocomplete?.()?i.respond([]):i.reply({content:'🔴 Le bot est en pause.',flags:MessageFlags.Ephemeral});
    Promise.resolve(response).catch(()=>{});return true;
   }
  }
  return emit.call(this,event,...args);
 };
 client.once(Events.ClientReady,async()=>{
  try{if(isOff())client.user.setPresence({status:'idle',activities:[{name:'En pause • /line on',type:0}]});const guild=client.guilds.cache.get(IDENTITY.guildId);if(guild)await require('../commandes/maintenance').maintenanceSystem.refreshMaintenancePanel(guild);}
  catch(e){console.error('Panel /line :',e.message);}
 });
};
