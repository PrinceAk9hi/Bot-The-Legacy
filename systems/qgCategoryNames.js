const {ChannelType,MessageFlags}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg'),{embed}=require('./qgPanels');
function format(name){
 const original=String(name);
 // Conserve les graphèmes emoji complets : variantes, modificateurs et séquences ZWJ.
 const segments=[...new Intl.Segmenter('fr',{granularity:'grapheme'}).segment(original)];
 const firstLetter=original.search(/\p{L}/u);
 const prefix=firstLetter<0?original:original.slice(0,firstLetter);
 const emojis=segments.filter(s=>s.index<prefix.length&&/[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(s.segment)).map(s=>s.segment).join('');
 let title=firstLetter<0?original:original.slice(firstLetter);
 title=title.replace(/^[〃・\s]+|[〃・\s]+$/g,'').toLocaleUpperCase('fr');
 if(!title)return original;
 const choices=[[/FONDATION/,'👑'],[/BUREAU/,'💼'],[/RESPONSABLE/,'🛡️'],[/RECRUT|ENTRETIEN/,'📋'],[/VOC/,'🔊'],[/ACCUEIL/,'👋'],[/INFORMATION/,'📚'],[/COMMUNAUT/,'🌐'],[/FAMILLE/,'🏠'],[/SUPPORT|TICKET/,'🎫'],[/ANIMATION/,'🎉'],[/RÉSEAUX|RESEAUX/,'🌐'],[/LOGS/,'📜'],[/ISOLEMENT|PRISON/,'🔒'],[/GESTION/,'🛡️']];
 return `${emojis||choices.find(([re])=>re.test(title))?.[1]||'📁'}〃${title}`.slice(0,100);
}
async function execute(i){
 await i.deferReply({flags:MessageFlags.Ephemeral});
 if(i.guildId!==config.guildId)throw Error('Commande réservée au QG.');
 const actor=await i.guild.members.fetch({user:i.user.id,force:true});
 if(!a.isDirection(actor))throw Error('Commande réservée à la direction.');
 const all=await i.guild.channels.fetch();let changed=0,unchanged=0;const failures=[];
 for(const ch of all.values()){
  if(ch?.type!==ChannelType.GuildCategory)continue;
  const name=format(ch.name);
  if(name===ch.name){unchanged++;continue;}
  try{await ch.setName(name,'Format des catégories QG demandé : emoji〃NOM');changed++;}
  catch(e){failures.push(`${ch.name} (${e.code||'échec'})`);}
 }
 a.save(s=>{s.schoolCategoryNaming={enabled:true,updatedAt:Date.now()};});
 return i.editReply({embeds:[embed('Noms des catégories',`${changed} catégorie(s) renommée(s), ${unchanged} déjà au bon format.\nEmojis existants conservés. Ordre et permissions inchangés.${failures.length?'\nÉchecs :\n'+failures.join('\n').slice(0,2500):''}`)],allowedMentions:{parse:[]}});
}
async function created(ch){
 if(ch?.guild?.id!==config.guildId||ch.type!==ChannelType.GuildCategory||!a.state().schoolCategoryNaming?.enabled)return;
 const name=format(ch.name);if(name!==ch.name)await ch.setName(name,'Format des catégories QG');
}
module.exports={format,execute,created};
