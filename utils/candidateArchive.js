const {IDENTITY,ROLES}=require('../config/soulSociety');
const {MAIN_RANKS}=require('../config/ranks');
const SOURCES={'1468699236873801975':'accepted','1468699236156702862':'refused','1540832394217529447':'ranks','1506723822840315957':'roles'};
const APPY='853327905357561948';
const roleNames=Object.fromEntries(Object.values(MAIN_RANKS).map(r=>[r.roleId,r.name]));
Object.assign(roleNames,{[ROLES.member]:'Membres de la Soul Society',[ROLES.waitingInterview||'1468703799995666636']:'Attente entretien','1471548646322475252':'Membre Confirmé','1468701262102134891':'Visiteur','1490049554538823861':'Anciens membres'});
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[*_`]/g,'').trim();
const unique=a=>[...new Set(a)];
function mentions(s){return unique([...String(s||'').matchAll(/<@!?(\d{17,20})>/g)].map(m=>m[1]));}
function roles(s){const ids=unique([...String(s||'').matchAll(/\d{17,20}/g)].map(m=>m[0]).filter(id=>roleNames[id]));if(ids.length)return ids;const n=normalize(s);return Object.entries(roleNames).filter(([,name])=>n===normalize(name)).map(([id])=>id);}
function textOf(e){return [e.title,e.description,...(e.fields||[]).map(f=>f.name+'\n'+f.value)].filter(Boolean).join('\n');}
function parse(message,channelId){
 const type=SOURCES[channelId];const apps=[],grades=[],unmatched=[];
 if(!type||!message.id)return {apps,grades,unmatched};
 const source={messageId:message.id,channelId,authorId:message.author?.id,url:`https://discord.com/channels/${IDENTITY.guildId}/${channelId}/${message.id}`};
 const timestamp=Date.parse(message.timestamp||message.createdAt)||Number((BigInt(message.id)>>22n)+1420070400000n);
 const embeds=(message.embeds||[]).map(e=>e.toJSON?e.toJSON():e);
 if(type==='accepted'||type==='refused'){
  if(message.author?.id!==APPY)return {apps,grades,unmatched};
  const stat=embeds.flatMap(e=>e.fields||[]).filter(f=>/submission stats/i.test(f.name)).map(f=>f.value).join('\n');
  const statsIds=unique([...stat.matchAll(/UserId\s*:\s*`?(\d{17,20})/gi)].map(m=>m[1]));
  const contentId=message.content?.match(/^<@!?(\d{17,20})>['’]s submission/i)?.[1];
  const userId=statsIds.length===1?statsIds[0]:contentId;
  if(!userId||statsIds.length>1||(contentId&&contentId!==userId)){unmatched.push({...source,kind:'application',reason:'ID candidat absent ou contradictoire'});return {apps,grades,unmatched};}
  const body=embeds.map(e=>e.description||'').join('\n\n');
  const questions=[...body.matchAll(/^###\s*\*\*(\d+)\.\*\*\s*([^\n]*)\n([\s\S]*?)(?=^###\s*\*\*\d+\.\*\*|(?![\s\S]))/gm)].map(m=>({number:Number(m[1]),question:m[2],answer:m[3].trim()}));
  apps.push({...source,userId,status:type,decidedAt:timestamp,submittedAt:Number(stat.match(/Submitted:\s*<t:(\d+)/i)?.[1]||0)*1000||null,body,questions,externalOnly:/too large to display/i.test(body),dashboardUrl:body.match(/https:\/\/appy\.bot\/dashboard\/[^\s)]+/)?.[0]||null,decision:message.content||'',attachments:(message.attachments?.values?[...message.attachments.values()]:message.attachments||[]).map(a=>({name:a.name||a.filename,url:a.url}))});
  return {apps,grades,unmatched};
 }
 function emit(userId,roleId,action,index,evidence,time=timestamp){grades.push({...source,id:`${message.id}:${index}:${userId}:${roleId}:${action}`,userId,roleId,roleName:roleNames[roleId],action,timestamp:time,evidence});}
 if(type==='ranks'){
  const match=(message.content||'').match(/^\s*((?:<@!?\d{17,20}>[\s,;&]*)+)\s*(?:passage en|passe en|passe au grade|rankup(?: en)?|r[eé]trograd[eé](?: en)?)\s+(<@&\d{17,20}>)/i);
  if(match){for(const user of mentions(match[1]))for(const role of roles(match[2]))emit(user,role,'set','text','announcement');}
 }
 if(message.author?.bot){
  for(const [index,e] of embeds.entries()){
   const fields=e.fields||[],text=textOf(e),heading=normalize([e.title,e.author?.name].join(' '));
   const roleChange=/membre modifie|roles?.*(?:ajout|retir|modifi|added|removed|updated)|(?:ajout|retrait|modifi|added|removed|updated).*roles?/.test(heading)||fields.some(f=>/roles?.*(?:ajout|retir|added|removed)|(?:ajout|retrait|added|removed).*roles?/.test(normalize(f.name)));
   const rankChange=type==='ranks'&&/rank|grade|promotion|retrograd/.test(heading)&&!/commande executee/.test(heading);
   if(!roleChange&&!rankChange)continue;
   const memberFields=fields.filter(f=>/^(?:[\s\S]*?\s)?(?:membre|membres|utilisateur|user|member|target|cible)$/i.test(normalize(f.name)));
   let ids=unique(memberFields.flatMap(f=>mentions(f.value).concat([...f.value.matchAll(/(?:^|[\s`])(\d{17,20})(?=$|[\s`])/g)].map(m=>m[1]))));
   if(!ids.length){const first=e.description?.match(/^\s*(?:<@!?)?(\d{17,20})(?:>|\s|$)/);if(first)ids=[first[1]];}
   if(!ids.length){const descIds=mentions(e.description);if(descIds.length===1)ids=descIds;}
   if(!ids.length){const footer=e.footer?.text?.match(/(?:user|membre|utilisateur)(?:\s*id)?\s*:\s*(\d{17,20})/i);if(footer)ids=[footer[1]];}
   if(!ids.length&&roleChange){const avatar=e.author?.icon_url?.match(/\/(?:avatars|users)\/(\d{17,20})\//);if(avatar)ids=[avatar[1]];}
   const changes=[];
   for(const f of fields){const n=normalize(f.name);if(/roles?.*(ajout|added)|(?:ajout|added).*roles?/.test(n))changes.push(...roles(f.value).map(id=>[id,'add']));if(/roles?.*(retir|removed)|(?:retrait|removed).*roles?/.test(n))changes.push(...roles(f.value).map(id=>[id,'remove']));if(rankChange&&/nouveau grade|new rank/.test(n))changes.push(...roles(f.value).map(id=>[id,'set']));}
   for(const m of text.matchAll(/R[oô]les? (ajout[eé]s?|retir[eé]s?)\s*:\s*([^\n]*)/gi))changes.push(...roles(m[2]).map(id=>[id,/ajout/i.test(m[1])?'add':'remove']));
   if(roleChange&&!changes.length){
    const before=fields.find(f=>/^(avant|anciens? roles?|old roles?|before)$/.test(normalize(f.name)));
    const after=fields.find(f=>/^(apres|nouveaux? roles?|new roles?|after)$/.test(normalize(f.name)));
    if(before&&after){const previous=roles(before.value),next=roles(after.value);changes.push(...next.filter(id=>!previous.includes(id)).map(id=>[id,'add']),...previous.filter(id=>!next.includes(id)).map(id=>[id,'remove']));}
    else if(/ajout|added/.test(heading)&&!/retir|removed/.test(heading))changes.push(...roles(text).map(id=>[id,'add']));
    else if(/retir|retrait|removed/.test(heading)&&!/ajout|added/.test(heading))changes.push(...roles(text).map(id=>[id,'remove']));
   }
   if(!changes.length)continue;
   if(ids.length!==1){unmatched.push({...source,kind:'roles',reason:'Membre du changement non identifié sans ambiguïté'});continue;}
   const time=Date.parse(e.timestamp)||timestamp;
   for(const [role,action] of changes)emit(ids[0],role,action,index,roleChange?'role-log':'announcement',time);
  }
 }
 if(type==='ranks'&&!grades.length&&/rank|derank|grade|passage en/i.test([message.content,...embeds.map(textOf)].join('\n')))unmatched.push({...source,kind:'announcement',reason:'Annonce non interprétée : consulter la source'});
 return {apps,grades,unmatched};
}
function ingest(state,messages,channelId){state.applications||={};state.grades||={};state.unmatched||={};
 const replaced=new Set(messages.map(m=>m.id));for(const [id,event] of Object.entries(state.grades))if(replaced.has(event.messageId))delete state.grades[id];
 for(const message of messages){const result=parse(message,channelId);delete state.applications[message.id];delete state.unmatched[message.id];
  for(const a of result.apps)state.applications[a.messageId]=a;for(const g of result.grades)state.grades[g.id]=g;if(result.unmatched.length)state.unmatched[message.id]=result.unmatched[0];
 }
}
function testPeriod(userId,state,currentTest,local){
 const events=Object.values(state.grades||{}).filter(g=>g.userId===userId).sort((a,b)=>a.timestamp-b.timestamp||String(a.id).localeCompare(String(b.id)));
 const testId=ROLES.test,main=new Set([...Object.values(MAIN_RANKS).map(r=>r.roleId),'1471548646322475252','1468701262102134891','1490049554538823861']);let period=null;
 for(const e of events){if(e.roleId===testId&&e.action!=='remove'){if(!period||period.endedAt)period={startedAt:e.timestamp,source:e.url,evidence:e.evidence};}
  else if(period&&!period.endedAt&&((e.roleId===testId&&e.action==='remove')||(main.has(e.roleId)&&e.action!=='remove')))period.endedAt=e.timestamp;
 }
 if(local?.startedAt&&(!period||local.startedAt>period.startedAt))period={...local,evidence:'observed'};
 if(currentTest&&period?.endedAt)return null;
 return period;
}
module.exports={SOURCES,parse,ingest,roles,roleNames,testPeriod};
