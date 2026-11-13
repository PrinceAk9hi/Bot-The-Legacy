// Panel d'aide du QG : remplace le centre de commandement (salon 1565484861660069978).
// Liste toutes les commandes et leur fonction :
//  - commandes slash : lues directement sur Discord (nom, description, sous-commandes), donc toujours à jour ;
//  - commandes préfixe (=) : liste ci-dessous, avec qui peut les utiliser.
// Republié seulement quand le contenu change ; découpé en plusieurs messages si besoin.
const {createHash}=require('node:crypto');
const {ContainerBuilder,TextDisplayBuilder,SeparatorBuilder,MessageFlags:F}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg');
const CHANNEL=require('./qgCommand').CHANNEL;

const PREFIX=[
 ['🎮 Membres',[
  ['=niveau [@membre]','Ta carte de niveau, ou celle d’un membre.'],
  ['=classement','Classement des niveaux du QG.'],
  ['=suggestion <texte>','Propose une idée dans le salon des suggestions.'],
  ['=aide','Indique le salon des commandes.']]],
 ['🛡️ Staff',[
  ['=mv @membre','Déplace un membre dans ton vocal (permission Déplacer des membres).'],
  ['=mvvoc [#vocal]','Déplace tout un vocal dans le prochain vocal que tu rejoins (2 minutes).'],
  ['=clear <nombre>','Supprime la commande et les messages précédents (1 à 100), sans réponse du bot.'],
  ['=giveaway <durée> <gagnants> <récompense>','Lance un giveaway (ex. `=giveaway 1h 1 Nitro`).'],
  ['=actualite catégorie | titre | texte | image','Publie une actualité.']]],
 ['👑 Direction et responsable recrutement',[
  ['=acp @membre | ID | PseudoRoblox','Accepte la demande d’adhésion au groupe Roblox et donne le rang Membre confirmé.'],
  ['=derank @membre motif','Retire le membre de la famille (grades, rôles d’exécutant) et de la communauté Roblox.'],
  ['=familles','Membres présents dans une autre famille School.'],
  ['=statsrecrutement [jours]','Statistiques de recrutement (7 jours par défaut).'],
  ['=sauvegarde','Sauvegarde immédiate des données du bot (Direction).'],
  ['=restore','Restaure une sauvegarde : en réponse au fichier, sinon la plus récente (Direction).'],
  ['=securite','État de la protection du serveur et dernières alertes (Direction).'],
  ['=raid on / off','Active ou arrête le mode anti-raid : comptes de moins de 7 jours expulsés (Direction).']]]];

// Commandes slash enregistrées sur le serveur : [nom, description, sous-commandes].
async function slashCommands(guild){
 const list=await guild.commands.fetch();
 return [...list.values()].map(c=>{
  const subs=(c.options||[]).filter(o=>o.type===1||o.type===2).flatMap(o=>o.type===2?(o.options||[]).map(s=>`${o.name} ${s.name}`):[o.name]);
  return[c.name,c.description||'',subs];
 }).sort((x,y)=>x[0].localeCompare(y[0],'fr'));
}

// Blocs de texte de l'aide (chacun < 1 900 caractères).
function sections(slash){
 const out=[];
 const push=(title,lines)=>{let current=`### ${title}`;for(const line of lines){if(current.length+1+line.length>1900){out.push(current);current=line;}else current+='\n'+line;}out.push(current);};
 if(slash?.length)push('⌨️ Commandes slash',slash.map(([name,desc,subs])=>`**/${name}** — ${desc}${subs.length?`\n-# ${subs.map(s=>'`'+s+'`').join(' · ')}`:''}`));
 for(const [title,items] of PREFIX)push(`${title} · commandes =`,items.map(([cmd,desc])=>`**\`${cmd}\`** — ${desc}`));
 return out;
}

// Pages : en-tête, blocs séparés, moins de 3 600 caractères de texte par message.
function pages(blocks){
 const head='## 📖 Aide · Commandes du QG\nToutes les commandes du bot et leur fonction. Les commandes réservées sont indiquées par leur rubrique.';
 const list=[[]];let size=head.length;
 for(const b of blocks){if(size+b.length>3600&&list.at(-1).length){list.push([]);size=0;}list.at(-1).push(b);size+=b.length;}
 return list.map((items,n)=>{
  const box=new ContainerBuilder().setAccentColor(0xffffff);
  if(n===0)box.addTextDisplayComponents(new TextDisplayBuilder().setContent(head));
  items.forEach((b,k)=>{if(n===0||k>0)box.addSeparatorComponents(new SeparatorBuilder());box.addTextDisplayComponents(new TextDisplayBuilder().setContent(b));});
  return{components:[box],flags:F.IsComponentsV2,allowedMentions:{parse:[]}};
 });
}

async function publish(guild){return a.serial('qg-help-panel',async()=>{
 if(guild.id!==config.guildId)throw Error('Serveur QG incorrect.');
 const ch=await guild.channels.fetch(CHANNEL).catch(e=>{if(e.code===10003)return null;throw e;});
 if(!ch?.isTextBased?.()||ch.guildId!==guild.id)throw Error('Salon du panel d’aide introuvable.');
 const slash=await slashCommands(guild).catch(e=>{console.error('Aide QG (commandes slash) :',e.code||e.message);return null;});
 const payloads=pages(sections(slash)),hash=createHash('sha256').update(JSON.stringify(payloads.map(p=>p.components.map(c=>c.toJSON())))).digest('hex');
 const saved=a.state().schoolHelpPanel;
 // Première publication : l'ancien centre de commandement devient la première page.
 const ids=saved?.messageIds||[a.state().schoolCommandPanel?.messageId].filter(Boolean);
 if(saved?.hash===hash&&ids.length===payloads.length)return{detail:'Panel d’aide à jour'};
 const kept=[];
 for(const [n,p] of payloads.entries()){
  let message=ids[n]?await ch.messages.fetch(ids[n]).catch(e=>{if(e.code===10008)return null;throw e;}):null;
  if(message&&!message.flags?.has(F.IsComponentsV2)){await message.delete().catch(()=>{});message=null;}
  if(message)await message.edit(p);else message=await ch.send(p);
  kept.push(message.id);
 }
 for(const old of ids.slice(payloads.length))await ch.messages.delete(old).catch(e=>{if(e.code!==10008)throw e;});
 a.save(s=>{s.schoolHelpPanel={channelId:ch.id,messageIds:kept,hash};});
 return{detail:'Panel d’aide publié'};
});}
let last=0;
// Toutes les 10 minutes au plus : la liste des commandes change rarement.
async function tick(guild){if(Date.now()-last<600000)return;last=Date.now();await publish(guild);}
module.exports={publish,tick,CHANNEL,_test:{sections,pages,slashCommands,PREFIX}};
