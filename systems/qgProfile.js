// /profil : carte de membre du QG générée en image (grade, niveau, activité, casino, badges).
const {SlashCommandBuilder,AttachmentBuilder,EmbedBuilder,MessageFlags:F}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg'),{read}=require('../utils/recruitmentData');
const levels=require('./qgLevels'),metrics=require('./qgMemberMetrics'),grades=require('./qgGrades');
const DAY=86400000,HOUR=3600000;

const data=new SlashCommandBuilder().setName('profil').setDescription('Afficher la carte de membre du QG').setDMPermission(false)
 .addUserOption(o=>o.setName('membre').setDescription('Membre à afficher (toi par défaut)'));

// Badges gagnés automatiquement, du plus prestigieux au plus courant.
function badges({days,voiceTotal,weekMessages,casino,team,verified}){
 const list=[];
 if(team)list.push('Équipe du QG');
 if(days!==null&&days>=365)list.push('Ancien');else if(days!==null&&days>=180)list.push('Vétéran');
 if(voiceTotal>=50*HOUR)list.push('Pilier du vocal');
 if(weekMessages>=200)list.push('Bavard');
 if(casino?.wagered>=100000)list.push('Flambeur');else if(casino&&casino.returned-casino.wagered>=10000)list.push('Chanceux');
 if(verified)list.push('Roblox vérifié');
 return list;
}
function title(member){
 if(a.isDirection(member))return 'Direction du QG';
 let rank=null;try{rank=require('./qgUserPanel').rank(member);}catch{}
 return rank?grades.names[grades.ranks.indexOf(rank)]:'Communauté';
}
function collect(member,now=Date.now()){
 const id=member.id,s=a.state(),xpAll=read('qgXp'),xp=xpAll[id]?.xp||0,level=levels.level(xp);
 const position=xp>0?Object.entries(xpAll).filter(([,v])=>typeof v?.xp==='number').sort((p,q)=>q[1].xp-p[1].xp).findIndex(([k])=>k===id)+1:0;
 const week=metrics.week(id,now),voiceTotal=metrics.total(id)?.milliseconds||0;
 const casino=require('./qgCasinoGames').store.peek(id),verification=s.schoolEntryVerification?.[id];
 const roles=s.schoolRoles||{},team=Object.entries(roles).some(([k,rid])=>/(Management|Lead)$/.test(k)&&member.roles.cache.has(rid));
 const days=member.joinedTimestamp?Math.max(0,Math.floor((now-member.joinedTimestamp)/DAY)):null;
 const p={name:member.displayName,username:member.user.username,roblox:verification?.robloxName||null,title:title(member),level,xp,current:levels.threshold(level),next:levels.threshold(level+1),position,days,weekMessages:week.messages,weekVoice:week.voiceMs,voiceTotal,casino};
 p.badges=badges({...p,team,verified:Boolean(verification?.robloxName)});
 return p;
}
// Avatar Discord : délai et taille limités, la carte s'affiche sans en cas d'échec.
async function avatarBytes(member){
 try{const res=await fetch(member.displayAvatarURL({extension:'png',size:256}),{signal:AbortSignal.timeout(5000)});if(!res.ok)return null;const buf=Buffer.from(await res.arrayBuffer());return buf.length<2e6?buf:null;}catch{return null;}
}
async function payload(member){
 const p=collect(member);p.avatar=await avatarBytes(member);
 const file=new AttachmentBuilder(await require('../utils/qgProfileCard').render(p),{name:'profil-qg.png'});
 const e=new EmbedBuilder().setColor(0xd4bd86).setImage('attachment://profil-qg.png').setFooter(require('../utils/qgBrand').footer(' · Carte de membre'));
 return {embeds:[e],files:[file],allowedMentions:{parse:[]}};
}
async function execute(i){
 if(i.guildId!==config.guildId)throw Error('Commande réservée au QG.');
 const self=await i.guild.members.fetch({user:i.user.id,force:true});
 if(!require('../utils/qgCasinoAccess').memberAllowed(self))return i.reply({content:'Accepte le règlement du QG pour accéder aux cartes de membre.',flags:F.Ephemeral});
 const user=i.options.getUser('membre')||i.user;
 if(user.bot)return i.reply({content:'Les bots n’ont pas de carte de membre.',flags:F.Ephemeral});
 const member=await i.guild.members.fetch(user.id).catch(()=>null);
 if(!member)return i.reply({content:'Ce membre n’est pas sur le serveur.',flags:F.Ephemeral});
 await i.deferReply();
 return i.editReply(await payload(member));
}
module.exports={data,execute,collect,badges,payload};
