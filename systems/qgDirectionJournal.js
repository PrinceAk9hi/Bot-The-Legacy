// Journal de la direction (salon 1570572219023630357) : seulement les actions importantes faites par
// une personne (direction, Fondation, responsables) — rankup/derank, avertissements et sanctions avec leur
// motif, notes, PDT, décisions et surveillances de la Fondation, recrutement… — et le détail complet de
// chaque réunion après /notesmp. Les actions automatiques du bot et les logs techniques n'y vont pas.
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const CHANNEL='1570572219023630357';
const IMPORTANT=/^(rankup|derank|demote|management|responsibility|discipline|sanction\.|note\.|pdt\.|foundation\.(decision|watch|unwatch|objective|proposal|report)|cd\.(on|off)|casino\.(enable|disable)|recruitment\.(oral|written)(accept|refuse)|referent\.|convocation|annonce\.|absence\.validation|alerte\.)/;
const LEVELS=['Avertissement 1','Avertissement 2','Dernière Chance'];
const clean=t=>require('../utils/qgAiKnowledge').clean(String(t??''));

// Valeur lisible : texte, grade ou niveau ; rien pour les objets techniques (listes de rôles…).
function readable(value,action){
 if(value===undefined||value===null||value==='')return null;
 if(action==='discipline'&&Number.isInteger(value))return LEVELS[value-1]||`Niveau ${value}`;
 if(typeof value!=='object')return clean(value).slice(0,300);
 if(value.grade)return clean(value.grade);
 return null;
}
function important(e,botId){return IMPORTANT.test(e.action)&&!!e.actorId&&e.actorId!==botId&&e.result!=='failed';}

function entryPayload(e){
 const {icon,title}=require('../utils/qgLog').describeAction(e.action);
 const before=readable(e.before,e.action),after=readable(e.after,e.action);
 const lines=[`Par <@${e.actorId}>${e.targetId?` · Membre : <@${e.targetId}>`:''}`];
 if(before||after)lines.push(before&&after?`${before} → **${after}**`:`**${after||before}**`);
 if(e.reason)lines.push(`**Motif :** ${clean(e.reason).slice(0,1000)}`);
 if(e.result==='review')lines.push('-# Transmis à la direction pour examen.');
 const {embed}=require('./qgPanels');
 return{embeds:[embed(`${icon} ${title}`,lines.join('\n')).setTimestamp(e.at||Date.now())],allowedMentions:{parse:[]}};
}

async function channel(guild){
 const ch=await guild.channels.fetch(CHANNEL).catch(()=>null);
 return ch?.isTextBased?.()&&ch.guildId===config.guildId?ch:null;
}

// Appelé par chaque audit : publie seulement les actions importantes faites par une personne.
async function fromAudit(guild,e){
 if(guild?.id!==config.guildId||!important(e,guild.client?.user?.id))return false;
 const ch=await channel(guild);if(!ch)return false;
 await ch.send(entryPayload(e));return true;
}

// Détail d'une réunion : notes, décisions, motifs et résultat pour chaque membre.
function meetingPayloads(r){
 const {embed}=require('./qgPanels'),status={blocked:'⛔ Bloquée',uncertain:'⚠️ Incertaine',skipped:'⏭️ Ignorée',pending:'⏳ En cours'};
 const ids=(r.roster||[]).map(m=>m.id).filter(id=>r.notes?.[id]||r.actions?.[id]);
 const notes=ids.filter(id=>r.notes?.[id]).length,decisions=ids.filter(id=>r.actions?.[id]).length;
 const head=[`**${clean(r.name)}**${r.description?`\n${clean(r.description)}`:''}`,
  `🗓️ <t:${Math.floor(r.start/1000)}:F> · ${r.duration} minutes`,
  `${r.approvedBy?`✅ Validée par <@${r.approvedBy}>`:''}${r.authorId?` · Programmée par <@${r.authorId}>`:''}`,
  `📝 ${notes} note${notes>1?'s':''} · ⚖️ ${decisions} décision${decisions>1?'s':''}`].filter(Boolean).join('\n');
 const blocks=ids.map(id=>{
  const n=r.notes?.[id],d=r.actions?.[id],res=r.results?.[id];
  const out=[`<@${id}>`];
  if(n)out.push(`Note : **${n.value}/10**${n.detail?` — ${clean(n.detail)}`:''}`);
  if(d)out.push(`Décision : **${clean(d.label)}**${d.reason?` — ${clean(d.reason)}`:''}`);
  if(res&&res.status!=='done')out.push(`-# ${status[res.status]||res.status} : ${clean(res.detail||'')}`);
  return out.join('\n');
 });
 const pages=[];let current=head;
 for(const b of blocks){if(current.length+2+b.length>3800){pages.push(current);current=b;}else current+='\n\n'+b;}
 pages.push(current);
 return pages.map((text,n)=>({embeds:[embed(n===0?'📋 Compte rendu de réunion':'📋 Compte rendu de réunion (suite)',text).setFooter(require('../utils/qgBrand').footer(' • Réunion '+r.id))],allowedMentions:{parse:[]}}));
}
// Publié une seule fois par réunion (relancer /notesmp ne le duplique pas).
async function meeting(guild,r){
 if(r.journalPostedAt)return false;
 const ch=await channel(guild);if(!ch)return false;
 for(const p of meetingPayloads(r))await ch.send(p);
 require('./qgMeetings').save(r.id,p=>{p.journalPostedAt=Date.now();});
 return true;
}
module.exports={CHANNEL,fromAudit,meeting,_test:{important,entryPayload,meetingPayloads,readable}};
