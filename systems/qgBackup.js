// Sauvegarde des données du bot (dossier data/, fichiers .json) dans un salon privé de la Direction.
// - Chaque jour vers 4 h (heure de Paris) : un fichier compressé « qg-sauvegarde-AAAA-MM-JJ.json.gz ».
// - Les 14 dernières sauvegardes sont gardées, les plus anciennes sont supprimées du salon.
// - =sauvegarde : sauvegarde immédiate (Direction).
// - =restore : en réponse à un message de sauvegarde (ou la plus récente sinon). Bouton de confirmation ;
//   une sauvegarde de l'état actuel est faite juste avant, puis le bot redémarre pour relire les données.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,AttachmentBuilder,MessageFlags}=require('discord.js');
const a=require('../utils/qgAdmin'),config=require('../config/qg'),data=require('../utils/recruitmentData');
const KEEP=14,HOUR=4,MAX_BYTES=9.5*1024*1024,SKIP=/^\.soul-migration-backups\//;
const NAME=/^qg-sauvegarde-.+\.json\.gz$/;

// Tous les fichiers .json du dossier de données (sous-dossiers compris).
function collect(dir=data.getDataDirectory()){
 const files={};
 (function walk(d){
  if(!fs.existsSync(d))return;
  for(const f of fs.readdirSync(d,{withFileTypes:true})){
   const p=path.join(d,f.name),rel=path.relative(dir,p).split(path.sep).join('/');
   if(SKIP.test(rel+(f.isDirectory()?'/':'')))continue;
   if(f.isDirectory())walk(p);else if(f.name.endsWith('.json'))files[rel]=fs.readFileSync(p,'utf8');
  }
 })(dir);
 return files;
}
function pack(files,now=Date.now()){return zlib.gzipSync(JSON.stringify({version:1,createdAt:now,files}),{level:9});}
function unpack(buffer){
 const body=JSON.parse(zlib.gunzipSync(buffer).toString('utf8'));
 if(body?.version!==1||!body.files||typeof body.files!=='object')throw Error('Ce fichier n’est pas une sauvegarde du QG.');
 for(const [rel,content] of Object.entries(body.files)){
  if(!/^[\w.\-/]+\.json$/.test(rel)||rel.split('/').some(x=>x==='..'||!x))throw Error('Chemin invalide dans la sauvegarde : '+rel);
  JSON.parse(content);
 }
 return body;
}
// Écrit chaque fichier (écriture atomique). Les fichiers absents de la sauvegarde ne sont pas touchés.
function restoreFiles(files,dir=data.getDataDirectory()){
 for(const [rel,content] of Object.entries(files)){
  const file=path.join(dir,...rel.split('/'));
  if(!path.resolve(file).startsWith(path.resolve(dir)+path.sep))throw Error('Chemin hors du dossier de données : '+rel);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file+'.tmp',content,'utf8');fs.renameSync(file+'.tmp',file);
 }
 return Object.keys(files).length;
}

function parisParts(now=Date.now()){return Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));}

// Salon privé « sauvegardes », créé à côté du journal de la direction avec les mêmes accès.
async function channel(guild){
 const saved=a.state().schoolBackupChannelId;
 if(saved){const ch=await guild.channels.fetch(saved).catch(()=>null);if(ch?.isTextBased?.())return ch;}
 const journal=await guild.channels.fetch(require('./qgDirectionJournal').CHANNEL).catch(()=>null);
 if(!journal)throw Error('Salon du journal de la direction introuvable : impossible de créer le salon des sauvegardes.');
 const ch=await guild.channels.create({name:'💾・sauvegardes',type:ChannelType.GuildText,parent:journal.parentId||undefined,
  permissionOverwrites:[...journal.permissionOverwrites.cache.values()].map(o=>({id:o.id,type:o.type,allow:o.allow.bitfield,deny:o.deny.bitfield})),
  topic:'Sauvegardes automatiques des données du bot (une par jour, 14 gardées). =restore en réponse à un fichier pour le restaurer.',reason:'Sauvegardes du bot QG'});
 a.save(s=>{s.schoolBackupChannelId=ch.id;});
 return ch;
}

async function backup(guild,{reason='Sauvegarde quotidienne',actorId,now=Date.now()}={}){
 const files=collect(),buffer=pack(files,now);
 if(buffer.length>MAX_BYTES)throw Error(`Sauvegarde trop lourde pour Discord (${(buffer.length/1048576).toFixed(1)} Mo).`);
 const p=parisParts(now),name=`qg-sauvegarde-${p.year}-${p.month}-${p.day}-${p.hour}h${p.minute}.json.gz`;
 const ch=await channel(guild);
 const {embed}=require('./qgPanels');
 const msg=await ch.send({embeds:[embed('💾 '+reason,`${Object.keys(files).length} fichiers · ${(buffer.length/1024).toFixed(0)} Ko compressés${actorId?`\nDemandée par <@${actorId}>`:''}\n-# Pour restaurer : réponds à ce message avec \`=restore\`.`).setTimestamp(now)],files:[new AttachmentBuilder(buffer,{name})],allowedMentions:{parse:[]}});
 a.save(s=>{s.schoolBackup={...(s.schoolBackup||{}),lastAt:now,lastMessageId:msg.id,lastSize:buffer.length};});
 await prune(ch,guild.client.user.id).catch(e=>console.error('Sauvegardes QG (nettoyage) :',e.code||e.message));
 return{detail:`Sauvegarde envoyée (${Object.keys(files).length} fichiers)`,message:msg};
}
async function backups(ch,botId){
 const list=[...(await ch.messages.fetch({limit:100})).values()].filter(m=>m.author.id===botId&&m.attachments.some(x=>NAME.test(x.name)));
 return list.sort((x,y)=>y.createdTimestamp-x.createdTimestamp);
}
async function prune(ch,botId){for(const m of (await backups(ch,botId)).slice(KEEP))await m.delete().catch(()=>{});}

// Une sauvegarde par jour, à partir de 4 h (heure de Paris).
let running=false;
async function tick(guild,{now=Date.now()}={}){
 if(running||guild.id!==config.guildId)return false;
 const p=parisParts(now),key=`${p.year}-${p.month}-${p.day}`;
 if(Number(p.hour)<HOUR||a.state().schoolBackup?.day===key)return false;
 running=true;
 try{await backup(guild,{now});a.save(s=>{s.schoolBackup.day=key;});return true;}
 finally{running=false;}
}

const allowed=m=>m.author.id===config.ownerId||m.author.id===m.guild.ownerId||a.isDirection(m.member);
async function command(m){
 if(m.guildId!==config.guildId)return false;
 const text=m.content.trim();
 if(!/^=(sauvegarde|restore)\s*$/i.test(text))return false;
 if(!allowed(m)){await m.reply({content:'Commande réservée à la Direction.',allowedMentions:{parse:[]}});return true;}
 if(/^=sauvegarde/i.test(text)){
  try{const r=await backup(m.guild,{reason:'Sauvegarde manuelle',actorId:m.author.id});await m.reply({content:`Sauvegarde faite : ${r.message.url}`,allowedMentions:{parse:[]}});}
  catch(e){await m.reply({content:'Sauvegarde impossible : '+(e.code?`code ${e.code}, vérifie les permissions du bot.`:e.message),allowedMentions:{parse:[]}});}
  return true;
 }
 const ch=await channel(m.guild);
 let target=m.reference?.messageId&&m.channelId===ch.id?await ch.messages.fetch(m.reference.messageId).catch(()=>null):null;
 if(target&&!target.attachments.some(x=>NAME.test(x.name)))target=null;
 if(!target)target=(await backups(ch,m.client.user.id))[0];
 if(!target){await m.reply({content:'Aucune sauvegarde trouvée.',allowedMentions:{parse:[]}});return true;}
 await m.reply({content:`⚠️ Restaurer la sauvegarde du <t:${Math.floor(target.createdTimestamp/1000)}:f> ? Les données actuelles seront remplacées (une sauvegarde de l’état actuel est faite avant), puis le bot redémarre.`,
  components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`qgbk:restore:${target.id}:${m.author.id}`).setLabel('Restaurer').setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId(`qgbk:cancel:0:${m.author.id}`).setLabel('Annuler').setStyle(ButtonStyle.Secondary))],allowedMentions:{parse:[]}});
 return true;
}

async function handle(i,{exit=()=>setTimeout(()=>process.exit(1),3000),download=url=>fetch(url).then(r=>{if(!r.ok)throw Error('Téléchargement '+r.status);return r.arrayBuffer();})}={}){
 if(!i.customId?.startsWith('qgbk:'))return false;
 const [,action,messageId,authorId]=i.customId.split(':');
 if(i.user.id!==authorId){await i.reply({content:'Seule la personne qui a lancé =restore peut confirmer.',flags:MessageFlags.Ephemeral});return true;}
 if(action==='cancel'){await i.update({content:'Restauration annulée.',components:[]});return true;}
 await i.update({content:'⏳ Restauration en cours…',components:[]});
 try{
  const ch=await channel(i.guild),msg=await ch.messages.fetch(messageId);
  const file=msg.attachments.find(x=>NAME.test(x.name));if(!file)throw Error('Fichier de sauvegarde introuvable.');
  const body=unpack(Buffer.from(await download(file.url)));
  await backup(i.guild,{reason:'Sauvegarde avant restauration',actorId:i.user.id});
  const count=restoreFiles(body.files);
  await a.audit(i.guild,{action:'backup.restore',actorId:i.user.id,after:`${count} fichiers · sauvegarde du ${new Date(body.createdAt).toISOString()}`}).catch(()=>{});
  await i.editReply({content:`✅ ${count} fichiers restaurés (sauvegarde du <t:${Math.floor(body.createdAt/1000)}:f>). Le bot redémarre dans quelques secondes.`});
  exit();
 }catch(e){await i.editReply({content:'Restauration impossible : '+e.message});}
 return true;
}
module.exports={tick,backup,command,handle,_test:{collect,pack,unpack,restoreFiles,parisParts}};
