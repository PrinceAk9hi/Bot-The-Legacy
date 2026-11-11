// /classement : classement du QG par niveaux (XP), temps vocal ou messages, avec pages.
const u=require('../utils/qgModuleUi'),{a}=u,config=require('../config/qg'),{read}=require('../utils/recruitmentData');
const PAGE=10,MEDALS=['🥇','🥈','🥉'];
const TYPES={niveaux:'Niveaux',vocal:'Temps vocal',messages:'Messages'};
const PERIODS=[7,30,90];

const data=new u.SlashCommandBuilder().setName('classement').setDescription('Voir le classement du serveur QG').setDMPermission(false)
 .addStringOption(o=>o.setName('type').setDescription('Classement à afficher (niveaux par défaut)').addChoices({name:'Niveaux (XP)',value:'niveaux'},{name:'Temps vocal',value:'vocal'},{name:'Messages',value:'messages'}))
 .addIntegerOption(o=>o.setName('periode').setDescription('Pour le vocal et les messages (7 jours par défaut)').addChoices({name:'7 jours',value:7},{name:'30 jours',value:30},{name:'90 jours',value:90}));

const duration=ms=>{const minutes=Math.floor(ms/60000),h=Math.floor(minutes/60);return h?`${h} h ${String(minutes%60).padStart(2,'0')}`:`${minutes} min`;};

// Liste triée [id, valeur] des membres encore présents et éligibles.
function ranking(type,days,members,state,now=Date.now()){
 const levels=require('./qgLevels'),present=id=>{const m=members.get(id);return m&&!m.user.bot?m:null;};
 let rows;
 if(type==='niveaux')rows=Object.entries(read('qgXp')).filter(([id,p])=>p?.xp>0&&levels.eligible(present(id),state)).map(([id,p])=>[id,Math.round(p.xp)]);
 else{
  const day=require('./qgMemberMetrics').day,from=day(now-(days-1)*86400000),field=type==='vocal'?'voiceMs':'messages';
  rows=Object.entries(state.schoolDailyActivity||{}).filter(([id])=>present(id)).map(([id,byDay])=>[id,Object.entries(byDay).filter(([key])=>key>=from).reduce((n,[,r])=>n+(r?.[field]||0),0)]).filter(([,v])=>v>0);
 }
 return rows.sort((x,y)=>y[1]-x[1]||x[0].localeCompare(y[0]));
}

function format(type,value){
 if(type==='niveaux')return`niveau **${require('./qgLevels').level(value)}** · ${value.toLocaleString('fr-FR')} XP`;
 return type==='vocal'?`**${duration(value)}**`:`**${value.toLocaleString('fr-FR')}** message${value>1?'s':''}`;
}

function view(type,days,page,viewerId,rows){
 const pages=Math.max(1,Math.ceil(rows.length/PAGE));page=Math.min(Math.max(0,page),pages-1);
 const lines=rows.slice(page*PAGE,page*PAGE+PAGE).map(([id,v],n)=>{const pos=page*PAGE+n;return`${MEDALS[pos]||`**${pos+1}.**`} <@${id}> — ${format(type,v)}`;});
 const mine=rows.findIndex(([id])=>id===viewerId);
 const scope=type==='niveaux'?'Progression totale':`${days} derniers jours`;
 const text=`*${scope} · ${rows.length} membre${rows.length>1?'s':''} classé${rows.length>1?'s':''}*\n\n${lines.join('\n')||'Le classement attend ses premiers participants.'}\n\n${mine>=0?`Ta position : **#${mine+1}** — ${format(type,rows[mine][1])}`:'Tu n’apparais pas encore dans ce classement.'}`;
 const id=(kind,t,d,p)=>`qgclass:${kind}:${t}:${d}:${p}:${viewerId}`;
 const nav=u.row(u.button(id('p',type,days,page-1),'◀').setDisabled(page===0),u.button(id('x',type,days,page),`Page ${page+1}/${pages}`).setDisabled(true),u.button(id('n',type,days,page+1),'▶').setDisabled(page>=pages-1));
 const tabs=u.row(...Object.entries(TYPES).map(([t,label])=>u.button(id('t',t,days,0),label,t===type?u.ButtonStyle.Primary:u.ButtonStyle.Secondary).setDisabled(t===type)));
 const components=[nav,tabs];
 if(type!=='niveaux')components.push(u.row(...PERIODS.map(d=>u.button(id('d',type,d,0),`${d} jours`,d===days?u.ButtonStyle.Primary:u.ButtonStyle.Secondary).setDisabled(d===days))));
 return u.payload(`🏆 Classement QG · ${TYPES[type]}`,text,components);
}

async function build(guild,type,days,page,viewerId){
 const members=await require('../utils/qgMembers')(guild);
 return view(type,days,page,viewerId,ranking(type,days,members,a.state()));
}

async function execute(i){
 if(i.guildId!==config.guildId)throw Error('Commande réservée au QG.');
 const member=await i.guild.members.fetch(i.user.id);
 if(!require('./qgLevels').eligible(member,a.state())&&i.user.id!==i.guild.ownerId)throw Error('Termine ta vérification dans le salon règlement pour accéder au classement.');
 await i.deferReply();
 const type=TYPES[i.options.getString('type')]?i.options.getString('type'):'niveaux',days=PERIODS.includes(i.options.getInteger('periode'))?i.options.getInteger('periode'):7;
 return i.editReply(await build(i.guild,type,days,0,i.user.id));
}

async function handle(i){
 const [,,type,days,page,viewerId]=i.customId.split(':');
 if(i.user.id!==viewerId)return i.reply({content:'Ce classement appartient à quelqu’un d’autre : lance ta propre commande /classement.',flags:u.MessageFlags.Ephemeral});
 if(!TYPES[type]||!PERIODS.includes(Number(days)))throw Error('Classement invalide. Relance /classement.');
 await i.deferUpdate();
 return i.editReply(await build(i.guild,type,Number(days),Number(page)||0,viewerId));
}
module.exports={data,execute,handle,_test:{ranking,view,duration}};
