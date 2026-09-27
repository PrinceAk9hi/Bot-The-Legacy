const {Events,EmbedBuilder,ActionRowBuilder,UserSelectMenuBuilder,MessageFlags}=require('discord.js');
const {IDENTITY,COLORS}=require('../config/soulSociety');
const {hasBypass}=require('../utils/security');
const {ensurePanel}=require('../utils/recruitmentData');
const {isOff}=require('../utils/lineState');
const CHANNEL='1553759963061682277',KEY='foundation_member';
function payload(){return {embeds:[new EmbedBuilder().setColor(COLORS.primary).setTitle('Gestion des membres • Fondation').setDescription('Sélectionne un membre pour accéder à ses actions de gestion.\n\n**Derank · Rankup · Rétrograder · Convoquer · Sanctions · Valider le test · Prison / Libérer**\n\nLes rubriques du panel permettent également de consulter son profil, sa candidature, ses statistiques et les contrôles vocaux.\nAccès réservé à Aven, aux bypass et à la fondation.')],components:[new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(KEY).setPlaceholder('Rechercher et sélectionner un membre').setMinValues(1).setMaxValues(1))],allowedMentions:{parse:[]}};}
async function handle(i){if(!i.isUserSelectMenu()||i.customId!==KEY)return;
 if(i.guildId!==IDENTITY.guildId||i.channelId!==CHANNEL||!hasBypass(i)||isOff())return i.reply({content:'❌ Tu n’as pas accès à ce panel ou le bot est en pause.',flags:MessageFlags.Ephemeral});
 const target=i.values[0];
 const proxy=new Proxy(i,{get(obj,key){if(key==='options')return {getUser:()=>({id:target})};if(key==='userPanelCategory')return 'management';if(key==='commandName')return 'user';const value=Reflect.get(obj,key,obj);return typeof value==='function'?value.bind(obj):value;}});
 return require('../commandes/user').execute(proxy);
}
function register(client){if(client.foundationPanelRegistered)return;client.foundationPanelRegistered=true;
 client.on(Events.InteractionCreate,i=>handle(i).catch(async e=>{console.error('Panel fondation :',e.code||e.message);const p={content:'❌ Impossible d’ouvrir ce membre.'};if(i.replied||i.deferred)await i.editReply(p).catch(()=>{});else await i.reply({...p,flags:MessageFlags.Ephemeral}).catch(()=>{});}));
 let running=false;const refresh=async()=>{if(running||isOff())return;running=true;try{await ensurePanel(client,CHANNEL,KEY,payload());}catch(e){console.error('Publication panel fondation :',e.code||e.message);}finally{running=false;}};
 const start=()=>{refresh();setInterval(refresh,300000).unref();};if(client.isReady())start();else client.once(Events.ClientReady,start);
}
module.exports={register,payload,handle,CHANNEL,KEY};
