// =acp @membre | =acp ID | =acp PseudoRoblox [motif]
// Accepte le joueur dans le groupe (communauté) Roblox du QG et lui donne le rang « Membre confirmé ».
// Aucun rôle Discord n'est modifié. Accès : direction et responsable recrutement (comme /rankup).
//
// Variables Railway :
//   QG_ROBLOX_GROUP_ID         facultatif : remplace le groupe de config/qg.js (1031372038)
//   QG_ROBLOX_CONFIRMED_RANK   numéro du rang (1-254) ; sinon le rang nommé « Membre confirmé » est cherché
//   ROBLOX_COOKIE              compte Roblox du bot, autorisé à accepter les demandes et changer les rangs
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const PATTERN=/^=acp(?:\s+(?:<@!?(\d{17,20})>|(\d{17,20})|@?([A-Za-z0-9_]{3,20})(?=\s|$)))?(?:\s+([\s\S]+))?$/i;
const normalize=s=>String(s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function parse(content){
 const match=PATTERN.exec(String(content||'').trim());
 if(!match)return null;
 return{discordId:match[1]||match[2]||null,robloxName:match[3]||null,reason:(match[4]||'').trim().slice(0,800)};
}

// Rang cible : numéro imposé par variable, sinon le rôle du groupe nommé « Membre confirmé ».
function confirmedRole(roles,env=process.env){
 const forced=Number(env.QG_ROBLOX_CONFIRMED_RANK);
 if(env.QG_ROBLOX_CONFIRMED_RANK){
  const role=roles.find(r=>r.rank===forced);
  if(!Number.isInteger(forced)||forced<1||forced>254||!role)throw Error(`QG_ROBLOX_CONFIRMED_RANK (${env.QG_ROBLOX_CONFIRMED_RANK}) ne correspond à aucun rang du groupe.`);
  return role;
 }
 const matches=roles.filter(r=>normalize(r.name).includes('membreconfirme'));
 if(matches.length!==1)throw Error(matches.length?'Plusieurs rangs « Membre confirmé » dans le groupe : renseigne QG_ROBLOX_CONFIRMED_RANK.':'Aucun rang « Membre confirmé » dans le groupe Roblox : renseigne QG_ROBLOX_CONFIRMED_RANK.');
 return matches[0];
}

function groupId(env=process.env,fallback=config.robloxGroupId){
 const id=Number(env.QG_ROBLOX_GROUP_ID||fallback);
 if(!Number.isInteger(id)||id<=0)throw Error('Groupe Roblox du QG non configuré : renseigne robloxGroupId dans config/qg.js ou QG_ROBLOX_GROUP_ID.');
 return id;
}

// Accès Roblox (noblox.js), remplaçable dans les tests.
let session=null;
function robloxApi(){
 const noblox=require('noblox.js');
 const login=async()=>{if(!process.env.ROBLOX_COOKIE)throw Error('ROBLOX_COOKIE absent : le bot ne peut pas agir sur Roblox.');session||=noblox.setCookie(process.env.ROBLOX_COOKIE).catch(e=>{session=null;throw Error('Connexion Roblox impossible : cookie invalide ou expiré.');});await session;};
 return{
  async rank(group,user){await login();return Number(await noblox.getRankInGroup(group,user));},
  async joinRequest(group,user){await login();try{return await noblox.getJoinRequest(group,user);}catch(e){if(/404|not found/i.test(String(e?.message||e)))return null;throw e;}},
  async accept(group,user){await login();await noblox.handleJoinRequest(group,user,true);},
  async roles(group){return noblox.getRoles(group);},
  async setRank(group,user,rank){await login();await noblox.setRank(group,user,rank);},
  async userByName(name){const r=await require('../utils/robloxAccount').findRobloxUserByUsername(name);return r.success?r.user:null;}
 };
}

// Compte Roblox d'un membre Discord : vérification QG, sinon liaison enregistrée.
function robloxOf(discordId,state){
 const p=state.schoolEntryVerification?.[discordId];
 if(/^\d+$/.test(String(p?.robloxId||'')))return{id:Number(p.robloxId),name:p.robloxName||String(p.robloxId)};
 const link=require('../utils/robloxLinks').getRobloxLink(discordId);
 if(/^\d+$/.test(String(link?.robloxUserId||'')))return{id:Number(link.robloxUserId),name:link.robloxUsername||String(link.robloxUserId)};
 return null;
}

// Accepte la demande si besoin, puis place au rang Membre confirmé. Ne rétrograde jamais.
async function acceptInGroup(api,group,user,{attempts=6,delay=1500}={}){
 const target=confirmedRole(await api.roles(group));
 let rank=await api.rank(group,user),accepted=false;
 if(rank<=0){
  if(!await api.joinRequest(group,user))throw Error('Aucune demande d’adhésion en attente : le joueur doit d’abord demander à rejoindre le groupe Roblox.');
  await api.accept(group,user);accepted=true;
  for(let n=0;n<attempts&&rank<=0;n++){if(n)await wait(delay);rank=await api.rank(group,user);}
  if(rank<=0)throw Error('Demande acceptée, mais l’adhésion n’est pas encore visible sur Roblox. Relance =acp dans un instant.');
 }
 if(rank>target.rank)return{accepted,changed:false,higher:true,target};
 if(rank===target.rank)return{accepted,changed:false,higher:false,target};
 await api.setRank(group,user,target.rank);
 return{accepted,changed:true,higher:false,target};
}

async function command(m,api){
 if(m.guildId!==config.guildId)return false;
 const parsed=parse(m.content);if(!parsed)return false;
 const say=content=>m.reply({content,allowedMentions:{parse:[]}});
 const actor=await m.guild.members.fetch({user:m.author.id,force:true});
 if(!a.can(actor,'rankup')){await say('Commande réservée à la direction et au responsable recrutement.');return true;}
 if(!parsed.discordId&&!parsed.robloxName){await say('Utilisation : `=acp @membre`, `=acp ID` ou `=acp PseudoRoblox` (motif facultatif). Accepte le joueur dans le groupe Roblox et lui donne le rang Membre confirmé.');return true;}
 try{
  const group=groupId();api||=robloxApi();
  let player;
  if(parsed.discordId){
   player=robloxOf(parsed.discordId,a.state());
   if(!player)throw Error(`Aucun compte Roblox connu pour <@${parsed.discordId}> : il doit terminer sa vérification, ou utilise \`=acp PseudoRoblox\`.`);
  }else{
   const user=await api.userByName(parsed.robloxName);
   if(!user)throw Error(`Compte Roblox « ${parsed.robloxName} » introuvable.`);
   player={id:Number(user.id),name:user.username};
  }
  await a.serial('roblox:'+player.id,async()=>{
   const r=await acceptInGroup(api,group,player.id);
   const who=parsed.discordId?`<@${parsed.discordId}> (Roblox : **${player.name}**)`:`**${player.name}**`;
   const steps=[r.accepted?'demande d’adhésion acceptée':'déjà dans le groupe',r.changed?`rang **${r.target.name}** donné`:r.higher?`rang actuel supérieur à ${r.target.name}, inchangé`:`déjà au rang **${r.target.name}**`];
   await a.audit(m.guild,{action:'rankup.roblox',actorId:actor.id,targetId:parsed.discordId||null,after:`Groupe Roblox ${group} : ${player.name} (${player.id}) → ${steps.join(', ')}`,reason:parsed.reason||'Acceptation via =acp'});
   await m.reply({content:`✅ ${who} : ${steps.join(' · ')}.`,allowedMentions:{parse:[]}});
  });
 }catch(error){await say('❌ '+String(error?.message||error).slice(0,500));}
 return true;
}
module.exports={command,_test:{parse,confirmedRole,groupId,robloxOf,acceptInGroup}};
