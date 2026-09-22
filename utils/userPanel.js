const {ContainerBuilder,TextDisplayBuilder,SeparatorBuilder,SectionBuilder,ThumbnailBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags,escapeMarkdown}=require('discord.js');
const {hasBypass}=require('./security');
const {RANK_ALLOWED_ROLES}=require('../config/ranks');
const {IDENTITY,COLORS}=require('../config/soulSociety');
const categories={profile:'👤 Profil',voice:'🔊 Vocal',management:'🛡️ Gestion'};
function render(embed,rows,owner,target,category='profile'){
 if(!categories[category])category='profile';
 const e=embed.toJSON(),container=new ContainerBuilder().setAccentColor(COLORS.primary);
 const title=new TextDisplayBuilder().setContent(`## ${escapeMarkdown(e.title)}\n${e.description}`);
 if(e.thumbnail?.url)container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(title).setThumbnailAccessory(new ThumbnailBuilder().setURL(e.thumbnail.url).setDescription('Avatar du membre')));
 else container.addTextDisplayComponents(title);
 container.addActionRowComponents(new ActionRowBuilder().addComponents(Object.entries(categories).map(([key,label])=>new ButtonBuilder().setCustomId(`userpage:${owner}:${target}:${key}`).setLabel(label).setStyle(key===category?ButtonStyle.Primary:ButtonStyle.Secondary))));
 container.addSeparatorComponents(new SeparatorBuilder());
 const selected=category==='profile'?[0,1,5]:category==='voice'?[2,4]:[3,4];
 for(const n of selected){const f=e.fields[n];if(f)container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### ${f.name}\n${f.value}`));}
 container.addSeparatorComponents(new SeparatorBuilder());
 if(category==='voice')container.addActionRowComponents(rows[0],rows[1],rows[3]);
 else if(category==='management'){
  container.addActionRowComponents(rows[4]);
  const locks=rows[2].components.filter(c=>!c.data.custom_id?.startsWith('memberctl:profile:'));
  container.addActionRowComponents(new ActionRowBuilder().addComponents(locks));
 }else{
  const profile=rows[2].components.filter(c=>c.data.custom_id?.startsWith('memberctl:profile:'));
  if(profile.length)container.addActionRowComponents(new ActionRowBuilder().addComponents(profile));
 }
 container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${escapeMarkdown(e.footer?.text||'Panel de gestion')} • Choisis une rubrique pour actualiser les informations.`));
 return {content:null,embeds:[],components:[container],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[]}};
}
async function handle(i){
 if(!i.isButton())return;
 const [,owner,target,category]=i.customId.split(':');
 if(owner!==i.user.id||i.guildId!==IDENTITY.guildId||!categories[category])return i.reply({content:'❌ Ce panneau ne t’appartient pas.',flags:MessageFlags.Ephemeral});
 if(!hasBypass(i)&&!RANK_ALLOWED_ROLES.some(id=>i.member.roles.cache.has(id)))return i.reply({content:'❌ Tu n’as plus accès à ce panneau.',flags:MessageFlags.Ephemeral});
 await i.deferUpdate();
 const proxy=new Proxy(i,{get(obj,key){
  if(key==='options')return {getUser:()=>({id:target})};
  if(key==='userPanelCategory')return category;
  if(key==='deferReply')return async()=>{};
  if(key==='editReply')return async payload=>{
   if(typeof payload==='string'||payload.content){
    return i.followUp({content:typeof payload==='string'?payload:payload.content,flags:MessageFlags.Ephemeral});
   }
   return i.editReply(payload);
  };
  const value=Reflect.get(obj,key,obj);return typeof value==='function'?value.bind(obj):value;
 }});
 await require('../commandes/user').execute(proxy);
}
module.exports={render,handle};
