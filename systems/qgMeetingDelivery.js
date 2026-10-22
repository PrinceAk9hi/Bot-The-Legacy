const {MessageFlags:F}=require('discord.js');
const a=require('../utils/qgAdmin'),meetings=require('./qgMeetings'),panel=require('./qgUserPanel'),{embed}=require('./qgPanels');
async function execute(i){
 await i.deferReply({flags:F.Ephemeral});await meetings.authorized(i);
 const id=i.options.getString('reunion',true);
 return a.serial('meeting:'+id,async()=>{
  let r=meetings.get(id);if(!r||!['approved','sending','finished'].includes(r.status))throw Error('La réunion doit être validée avant /notesmp.');
  meetings.save(id,p=>{p.status='sending';p.deliveryStartedAt||=Date.now();});
  const targets=r.roster.filter(m=>r.notes[m.id]||r.actions[m.id]);let progress=0;
  for(const item of targets){
   // Refresh permission before each target. Revocation stops the remaining work.
   const actor=await meetings.authorized(i);
   await a.serial('member:'+item.id,async()=>{
    r=meetings.get(id);const decision=r.actions[item.id];let result=r.results[item.id];
    if(!result){
     let member;try{member=await i.guild.members.fetch({user:item.id,force:true});}catch(e){if(e.code!==10007)throw e;meetings.save(id,p=>{p.results[item.id]={status:'skipped',detail:'Membre parti du serveur'};});return;}
     if(!require('./qgWeeklyReport').family(member)){meetings.save(id,p=>{p.results[item.id]={status:'skipped',detail:'Ne fait plus partie de la famille'};});return;}
     if(decision){
      let plan;try{
       a.hierarchy(actor,member,await i.guild.members.fetchMe());
       if(panel.rank(member)!==decision.expectedGrade)throw Error('Grade modifié depuis la préparation.');
       if(decision.action!=='warn'){
        plan=panel.plan(actor,member,decision.action,decision.choice,decision.reason||'Décision de réunion QG');
        a.hierarchy(actor,member,await i.guild.members.fetchMe(),[...plan.add,...plan.remove].map(id=>i.guild.roles.cache.get(id)));
        const separators=require('./qgSchoolSeparators'),projected=new Map(member.roles.cache);
        for(const id of plan.remove)projected.delete(id);for(const id of plan.add)projected.set(id,i.guild.roles.cache.get(id));
        const changed=[...new Set([...separators.desiredSeparatorIds(member),...separators.desiredSeparatorIds({...member,roles:{cache:projected}})])].map(id=>i.guild.roles.cache.get(id));
        if(changed.some(role=>!role||role.permissions.bitfield!==0n))throw Error('Séparateur absent ou doté de permissions sensibles.');
        a.hierarchy(actor,member,await i.guild.members.fetchMe(),changed);
       }
      }catch(e){meetings.save(id,p=>{p.results[item.id]={status:'blocked',detail:e.code?'Permissions ou membre indisponible':e.message};});return;}
      meetings.save(id,p=>{p.results[item.id]={status:'pending',detail:'Application en cours ; ne pas rejouer si interrompue'};});
      try{
       if(decision.action==='warn'){
        a.save(s=>{s.schoolSanctions||=[];const caseId=`meeting:${id}:${item.id}`;if(!s.schoolSanctions.some(x=>x.id===caseId))s.schoolSanctions.push({id:caseId,at:Date.now(),action:'warn',targetId:item.id,actorId:actor.id,reason:decision.reason||'Décision de réunion QG',result:'success'});s.schoolSanctions=s.schoolSanctions.slice(-5000);});
       }else{await panel.changeRoles(member,plan);await require('./qgSchoolSeparators').syncMember(await i.guild.members.fetch({user:member.id,force:true}));}
       meetings.save(id,p=>{p.results[item.id]={status:'done',detail:decision.label,at:Date.now()};});
       await a.audit(i.guild,{action:'meeting.'+decision.action,targetId:item.id,actorId:actor.id,reason:decision.reason,after:{meetingId:id,grade:plan?.choice}});
      }catch(e){meetings.save(id,p=>{p.results[item.id]={status:'uncertain',detail:'Action interrompue : vérifier les rôles et logs avant correction manuelle.'};});return;}
     }else meetings.save(id,p=>{p.results[item.id]={status:'done',detail:'Note uniquement, aucun rôle modifié'};});
    }
    r=meetings.get(id);if(r.results[item.id]?.status!=='done')return;
    const delivery=r.deliveries[item.id];if(delivery&&delivery.status!=='failed')return;
    const note=r.notes[item.id],decisionText=decision?`\n\n**Décision : ${decision.action==='rankup'?require('../utils/qgModuleUi').up:['derank','demote'].includes(decision.action)?require('../utils/qgModuleUi').down:''} ${decision.label}**${decision.reason?'\n'+decision.reason:''}`:'';
    meetings.save(id,p=>{p.deliveries[item.id]={status:'pending',at:Date.now()};});
    try{
     const user=await i.client.users.fetch(item.id);
     const sent=await user.send({embeds:[embed(`Réunion QG • ${r.name}`,`${note?`**Ta note : ${note.value}/10**\n${'★'.repeat(note.value)}${'☆'.repeat(10-note.value)}\n${note.detail||'Aucun détail supplémentaire.'}`:'Aucune note attribuée.'}${decisionText}\n\nLa direction reste disponible pour en discuter avec toi.`)],allowedMentions:{parse:[]}});
     meetings.save(id,p=>{p.deliveries[item.id]={status:'sent',messageId:sent.id,at:Date.now()};});
    }catch(e){meetings.save(id,p=>{p.deliveries[item.id]={status:e.code===50007?'failed':'uncertain',at:Date.now(),detail:e.code===50007?'MP fermés, relancer /notesmp pour réessayer':'Envoi incertain : vérifier avant toute reprise'};});}
   });
   progress++;if(progress%10===0)await i.editReply(`Traitement : ${progress}/${targets.length} membres.`);
  }
  r=meetings.save(id,p=>{p.status='finished';});
  const sent=Object.values(r.deliveries).filter(x=>x.status==='sent').length,done=Object.values(r.results).filter(x=>x.status==='done').length;
  return i.editReply(`Réunion ${id} : ${done}/${targets.length} dossiers traités, ${sent} MP remis. Les échecs et opérations incertaines sont consultables avec /réunion. Relancer /notesmp ne rejoue pas les sanctions et ne renvoie pas les MP déjà remis.`);
 });
}
module.exports={execute};
