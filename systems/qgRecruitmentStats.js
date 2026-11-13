// Statistiques de recrutement : candidatures reçues, décisions écrites et orales, taux d'acceptation,
// attente moyenne entre l'acceptation écrite et l'entretien, et décisions par recruteur.
// - Rapport chaque lundi à partir de 9 h (heure de Paris) dans le journal de la direction (7 derniers jours).
// - =statsrecrutement [jours] : rapport à la demande (Direction et responsable recrutement), 7 jours par défaut.
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const DAY=86400000,DECISION=/^recruitment\.(written|oral)(accept|refuse)$/;
const pct=(n,d)=>d?Math.round(n*100/d)+' %':'—';
function duration(ms){
 if(!Number.isFinite(ms))return '—';
 const h=Math.round(ms/3600000);
 return h<48?`${h} h`:`${Math.round(h/24)} j`;
}

function compute({history=[],applications={},from,to}){
 const decisions=history.filter(e=>DECISION.test(e.action)&&e.result!=='failed');
 const inWindow=decisions.filter(e=>e.at>=from&&e.at<to);
 const count=k=>inWindow.filter(e=>e.action==='recruitment.'+k).length;
 const apps=Object.values(applications).filter(x=>x.caseId);
 const received=apps.filter(x=>(x.submittedAt||0)>=from&&(x.submittedAt||0)<to).length;
 // Attente : dernière acceptation écrite du même candidat avant sa décision orale.
 const waits=inWindow.filter(e=>e.action.startsWith('recruitment.oral')).map(e=>{
  const w=decisions.filter(x=>x.action==='recruitment.writtenaccept'&&x.targetId===e.targetId&&x.at<=e.at).at(-1);
  return w?e.at-w.at:null;
 }).filter(x=>x!==null);
 const byRecruiter={};
 for(const e of inWindow){const r=byRecruiter[e.actorId]||={written:0,oral:0};r[e.action.includes('.oral')?'oral':'written']++;}
 const waiting=apps.filter(x=>x.status==='waiting_interview'),pending=apps.filter(x=>['submitted','in_review'].includes(x.status));
 return{
  received,
  written:{accept:count('writtenaccept'),refuse:count('writtenrefuse')},
  oral:{accept:count('oralaccept'),refuse:count('oralrefuse')},
  averageWait:waits.length?waits.reduce((s,x)=>s+x,0)/waits.length:NaN,
  recruiters:Object.entries(byRecruiter).sort(([,x],[,y])=>y.written+y.oral-x.written-x.oral),
  pending:pending.length,waiting:waiting.length,
  oldestWaiting:waiting.length?Math.min(...waiting.map(x=>x.updatedAt||x.submittedAt||to)):null,
 };
}

function payload(s,{days,to}){
 const w=s.written.accept+s.written.refuse,o=s.oral.accept+s.oral.refuse;
 const lines=[
  `📥 **${s.received}** candidature${s.received>1?'s':''} reçue${s.received>1?'s':''}`,
  `📝 Écrit : **${s.written.accept}** acceptée${s.written.accept>1?'s':''} · **${s.written.refuse}** refusée${s.written.refuse>1?'s':''} (${pct(s.written.accept,w)} d’acceptation)`,
  `🎙️ Entretien : **${s.oral.accept}** accepté${s.oral.accept>1?'s':''} · **${s.oral.refuse}** refusé${s.oral.refuse>1?'s':''} (${pct(s.oral.accept,o)} d’acceptation)`,
  `⏱️ Attente moyenne avant l’entretien : **${duration(s.averageWait)}**`,
  '',
  `**En ce moment**`,
  `📂 ${s.pending} candidature${s.pending>1?'s':''} à traiter · ⏳ ${s.waiting} en attente d’entretien${s.oldestWaiting?` (la plus ancienne depuis <t:${Math.floor(s.oldestWaiting/1000)}:R>)`:''}`,
  '',
  `**Décisions par recruteur**`,
  s.recruiters.length?s.recruiters.map(([id,r])=>`<@${id}> — ${r.written} écrite${r.written>1?'s':''} · ${r.oral} entretien${r.oral>1?'s':''}`).join('\n'):'Aucune décision sur la période.',
 ];
 const {embed}=require('./qgPanels');
 return{embeds:[embed(`📊 Statistiques de recrutement · ${days} derniers jours`,lines.join('\n').slice(0,4000)).setTimestamp(to)],allowedMentions:{parse:[]}};
}

function report(days=7,to=Date.now()){
 const s=a.state();
 return payload(compute({history:s.schoolAdminHistory||[],applications:s.schoolFamilyRecruitment||{},from:to-days*DAY,to}),{days,to});
}

// Chaque lundi à partir de 9 h (Paris), une fois.
async function tick(guild,{now=Date.now()}={}){
 if(guild.id!==config.guildId)return false;
 const p=require('./qgBackup')._test.parisParts(now);
 const weekday=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',weekday:'long'}).format(now);
 const key=`${p.year}-${p.month}-${p.day}`;
 if(weekday!=='Monday'||Number(p.hour)<9||a.state().schoolRecruitmentStats?.week===key)return false;
 const ch=await guild.channels.fetch(require('./qgDirectionJournal').CHANNEL).catch(()=>null);
 if(!ch?.isTextBased?.())return false;
 a.save(s=>{s.schoolRecruitmentStats={...(s.schoolRecruitmentStats||{}),week:key};});
 await ch.send(report(7,now));
 return true;
}

async function command(m){
 const match=/^=statsrecrutement(?:\s+(\d{1,3}))?\s*$/i.exec(m.content.trim());
 if(m.guildId!==config.guildId||!match)return false;
 const actor=await m.guild.members.fetch({user:m.author.id,force:true});
 if(!a.can(actor,'rankup')){await m.reply({content:'Commande réservée à la direction et au responsable recrutement.',allowedMentions:{parse:[]}});return true;}
 const days=Math.min(365,Math.max(1,Number(match[1]||7)));
 await m.reply(report(days));
 return true;
}
module.exports={tick,command,report,_test:{compute,payload,duration}};
