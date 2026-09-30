const {randomUUID}=require('node:crypto');
const {Events,EmbedBuilder,ActionRowBuilder,UserSelectMenuBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags}=require('discord.js');
const {IDENTITY}=require('../config/soulSociety');
const {hasBypass}=require('../utils/security');
const {ensurePanel}=require('../utils/recruitmentData');
const {isOff}=require('../utils/lineState');
const CHANNEL='1554953804796010697',KEY='sanctions_member';
const CHOICES={rappel:'Avertissement 1',avertissement:'Avertissement 2',derniere_chance:'Dernière chance'};
const requests=new Map();
const row=c=>new ActionRowBuilder().addComponents(c);
function payload(){return {embeds:[new EmbedBuilder().setColor(0xed4245).setTitle('⚠️ Sanctions • La Soul Society').setDescription('Sélectionne un membre, puis choisis sa sanction et indique une raison.\n\n**Avertissement 1 · Avertissement 2 · Dernière chance**\n\nAccès réservé aux personnes autorisées à gérer les commandes du bot. Les protections des comptes restent appliquées.')],components:[row(new UserSelectMenuBuilder().setCustomId(KEY).setPlaceholder('Choisir un membre à sanctionner').setMinValues(1).setMaxValues(1))],allowedMentions:{parse:[]}};}
function proxy(i,target,kind,reason){return new Proxy(i,{get(obj,key){if(key==='commandName')return 'avert';if(key==='options')return {data:[{name:'membre',type:6,value:target}],getUser:()=>({id:target}),getString:name=>name==='raison'?reason:kind};const value=Reflect.get(obj,key,obj);return typeof value==='function'?value.bind(obj):value;}});}
async function handle(i){if(i.customId!==KEY&&!i.customId?.startsWith('sanction_panel:'))return;
 if(i.guildId!==IDENTITY.guildId||i.channelId!==CHANNEL||isOff())return i.reply({content:'Ce panel est indisponible.',flags:MessageFlags.Ephemeral});
 const actor=await i.guild.members.fetch(i.user.id);
 if(!hasBypass(actor))return i.reply({content:'Tu n’as pas accès au panel de sanctions.',flags:MessageFlags.Ephemeral});
 if(i.isUserSelectMenu()&&i.customId===KEY){const target=i.values[0];return i.reply({content:`Sanction pour <@${target}> :`,components:[new ActionRowBuilder().addComponents(Object.entries(CHOICES).map(([kind,label])=>new ButtonBuilder().setCustomId(`sanction_panel:choose:${i.user.id}:${target}:${kind}`).setLabel(label).setStyle(ButtonStyle.Danger)))],allowedMentions:{parse:[]},flags:MessageFlags.Ephemeral});}
 const [,action,owner,target,kind]=i.customId.split(':');
 if(owner!==i.user.id)return i.reply({content:'Ce choix appartient à un autre modérateur.',flags:MessageFlags.Ephemeral});
 if(action==='choose'&&i.isButton()&&CHOICES[kind]){const token=randomUUID();requests.set(token,{owner,target,kind,expires:Date.now()+300000});return i.showModal(new ModalBuilder().setCustomId(`sanction_panel:apply:${owner}:${token}`).setTitle(CHOICES[kind]).addComponents(row(new TextInputBuilder().setCustomId('reason').setLabel('Raison de la sanction').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000))));}
 if(action==='apply'&&i.isModalSubmit()){const request=requests.get(target);if(!request||request.owner!==owner||request.expires<Date.now())return i.reply({content:'Formulaire expiré ou déjà traité. Sélectionne à nouveau le membre.',flags:MessageFlags.Ephemeral});requests.delete(target);return require('../commandes/avert').execute(proxy(i,request.target,request.kind,i.fields.getTextInputValue('reason')));}
}
function register(client){if(client.sanctionPanelRegistered)return;client.sanctionPanelRegistered=true;
 client.on(Events.InteractionCreate,i=>handle(i).catch(async e=>{console.error('Panel sanctions :',e.code||e.message);const p={content:'Impossible de traiter cette sanction. Vérifie les permissions du bot.'};if(i.deferred||i.replied)await i.editReply(p).catch(()=>{});else await i.reply({...p,flags:MessageFlags.Ephemeral}).catch(()=>{});}));
 let busy=false;async function refresh(){for(const [id,r]of requests)if(r.expires<Date.now())requests.delete(id);if(busy||isOff())return;busy=true;try{await ensurePanel(client,CHANNEL,KEY,payload());}catch(e){console.error('Publication panel sanctions :',e.code||e.message);}finally{busy=false;}}
 const start=()=>{refresh();setInterval(refresh,300000).unref();};if(client.isReady())start();else client.once(Events.ClientReady,start);
}
module.exports={register,handle,payload,CHANNEL,KEY};
