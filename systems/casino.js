const path=require('node:path');const {randomUUID}=require('node:crypto');
const {Events,EmbedBuilder,AttachmentBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags}=require('discord.js');
const {COLORS}=require('../config/soulSociety');const {allowed}=require('../utils/memberCare');const {isOff}=require('../utils/lineState');const store=require('../utils/casinoStore');
const {renderGame}=require('../utils/casinoImage');
const offers=new Map();
const names={slots:'Slots',roulette:'Roulette',blackjack:'Blackjack',mines:'Mines'};
const row=(...buttons)=>new ActionRowBuilder().addComponents(...buttons);
const btn=(id,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const money=n=>n.toLocaleString('fr-FR')+' ¥';
function payload(id,view='home',notice=''){
 const a=store.snapshot(id),g=a.game||(view==='game'?a.last:null),e=new EmbedBuilder().setColor(COLORS.primary).setAuthor({name:'Casino • La Soul Society'});
 const nav=row(btn('cs:home:'+id,'Accueil'),btn('cs:balance:'+id,'Mon solde'),btn('cs:daily:'+id,'Récompense quotidienne',ButtonStyle.Success),btn('cs:board:'+id,'Classement'),btn('cs:rules:'+id,'Règles'));
 let components=[row(btn('cs:games:'+id,'🎮 Jeux',ButtonStyle.Primary)),nav],files=[];
 if(g&&(view==='game'||a.game)){
  const done=Boolean(g.finishedAt),net=done?g.payout-g.stake:0;
  e.setColor(done?(net>0?0x35d28e:net<0?0xf15067:0xf8c45e):COLORS.primary)
   .setTitle(names[g.kind]+(done?(net>0?' • Gagné !':net<0?' • Perdu':' • Égalité'):' • À toi de jouer'))
   .setDescription(done?`<@${id}> • **${net>0?'+':''}${money(net)}** • Solde : **${money(a.balance)}**`:`<@${id}> • Mise : **${money(g.stake)}**`)
   .setImage('attachment://casino-game.png');
  files=[new AttachmentBuilder(renderGame(g),{name:'casino-game.png'})];
  const prefix=`cs:act:${id}:${g.id}:${g.version}:`;
  components=done?[row(btn(`cs:play:${id}:${g.kind}`,'Rejouer',ButtonStyle.Primary))]:[];
  if(g.kind==='blackjack'&&!done)components=[row(btn(prefix+'hit','Tirer',ButtonStyle.Primary),btn(prefix+'stand','Rester'),btn(prefix+'double','Doubler').setDisabled(g.player.length!==2||a.balance<g.stake))];
  if(g.kind==='mines'&&!done){
   components=Array.from({length:4},(_,y)=>row(...Array.from({length:4},(_,x)=>{const n=y*4+x,seen=g.revealed.includes(n);return btn(prefix+n,seen?'💎':String(n+1),seen?ButtonStyle.Success:ButtonStyle.Secondary).setDisabled(seen);})));components.push(row(btn(prefix+'cash','Encaisser',ButtonStyle.Success)));
  }
 }else if(view==='games'){
  e.setTitle('🎮 Choisis ton jeu').setDescription('Sélectionne un jeu pour choisir ta mise.');
  components=[row(...Object.entries(names).map(([key,label])=>btn(`cs:play:${id}:${key}`,label,ButtonStyle.Primary))),row(btn('cs:home:'+id,'Retour'))];
 }else if(view==='board'){
  e.setTitle('Classement du casino').setDescription(store.leaderboard().map(([user,v],index)=>`${index+1}. <@${user}> — **${money(v.balance)}**`).join('\n')||'Aucun joueur pour le moment.');components=[nav];
 }else if(view==='rules'){
  e.setTitle('Règles du casino').setDescription('**Monnaie fictive uniquement** : 1 000 Yens offerts à la première visite, puis 500 avec la récompense toutes les 24 h. Mises : 10 à 10 000. Une partie interactive à la fois.\n\n**Slots** : six symboles équiprobables. Triple : retour ×10 ; paire : mise rendue ; sinon perte.\n**Roulette** : 37 cases (0 à 36). Rouge/noir/pair/impair : retour ×2 ; numéro exact : ×36. Le zéro fait perdre les paris simples.\n**Blackjack** : un jeu de 52 cartes, sans remise. Le croupier reste à 17, même souple. Victoire ×2 ; blackjack naturel ×2,5 arrondi à l’entier inférieur ; égalité : mise rendue. Doubler après les deux premières cartes, sans séparation ni assurance.\n**Mines** : 3 mines cachées sur 16 cases. Encaissement calculé selon la probabilité des cases découvertes, avec une retenue de 5 %, arrondi à l’entier inférieur.\n\nLes retours comprennent la mise. Après 30 minutes, le blackjack se termine automatiquement avec « Rester » et les mines sont encaissées au montant atteint. Les boutons anciens ne rejouent pas la mise.');components=[nav];
 }else if(view==='balance'){
  e.setTitle('Ton portefeuille').setDescription(`<@${id}>\n**Solde : ${money(a.balance)}**\nParties terminées : ${a.played}\nTotal misé : ${money(a.wagered)}\nTotal retourné : ${money(a.returned)}\n\n**Dernières parties**\n`+a.history.slice(0,8).map(h=>`${names[h.kind]} : ${money(h.payout-h.stake)} nets`).join('\n'));components=[nav];
 }else{
  e.setTitle('Bienvenue au casino').setDescription(`<@${id}>, appuie sur **🎮 Jeux** pour choisir ton jeu.\n\n**Ton solde : ${money(a.balance)}**\nRécompense quotidienne : **500 Yens**.\n\nSlots · Roulette · Blackjack · Mines\nTu peux aussi utiliser directement les commandes avec une mise, par exemple **=slots 50**.`).setImage('attachment://casino-banner.png');
  files=[new AttachmentBuilder(path.join(__dirname,'../assets/casino/banner.png'),{name:'casino-banner.png'})];
 }
 return {content:notice||null,embeds:[e],components,files,attachments:[],allowedMentions:{parse:[]}};
}
async function launch(i,name='casino'){
 if(!allowed(i)||isOff())return i.reply({content:'Le casino est réservé aux membres de la famille lorsque le bot est actif.',flags:MessageFlags.Ephemeral});
 await i.deferReply();let note='',view=name==='solde'||name==='stats-casino'?'balance':name==='classement-casino'?'board':'home';
 try{
  if(name==='daily'){store.daily(i.user.id);note='✅ 500 Yens ajoutés à ton portefeuille.';}
  if(names[name]){const stake=i.options.getInteger('mise');if(stake!==null){if(name==='roulette'&&!i.options.getString('pari'))throw Error('Précise ton pari : =roulette 50 rouge, ou un numéro de 0 à 36.');store.start(i.user.id,name,stake,i.options.getString('pari'),i.id);view='game';}else note='Choisis ton jeu avec les boutons pour saisir une mise.';}
  return i.editReply(payload(i.user.id,view,note));
 }catch(e){return i.editReply({content:'❌ '+e.message});}
}
async function handle(i){if(!i.customId?.startsWith('cs:'))return;
 const [,action,owner,arg,version,move]=i.customId.split(':');
 if(owner!==i.user.id||!allowed(i)||isOff())return i.reply({content:'Ce panneau ne t’appartient pas ou le casino est indisponible.',flags:MessageFlags.Ephemeral});
 try{
  if(i.isButton()&&action==='play'){
   if(!names[arg])throw Error('Jeu inconnu.');
   const token=randomUUID().slice(0,8);offers.set(token,{owner,kind:arg,expires:Date.now()+300000});
   const modal=new ModalBuilder().setCustomId(`cs:stake:${owner}:${token}`).setTitle(names[arg]+' • Ta mise').addComponents(row(new TextInputBuilder().setCustomId('amount').setLabel('Mise : 10 à 10 000 Yens').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(5)));
   if(arg==='roulette')modal.addComponents(row(new TextInputBuilder().setCustomId('bet').setLabel('Rouge, noir, pair, impair ou numéro 0 à 36').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)));
   return i.showModal(modal);
  }
  if(i.isModalSubmit()&&action==='stake'){
   const offer=offers.get(arg);if(!offer||offer.owner!==owner||offer.expires<Date.now())throw Error('Formulaire expiré : rouvre le jeu.');
   offers.delete(arg);await i.deferReply();store.start(owner,offer.kind,Number(i.fields.getTextInputValue('amount')),offer.kind==='roulette'?i.fields.getTextInputValue('bet'):'',arg);
   return i.editReply(payload(owner,'game'));
  }
  if(!i.isButton())return;
  await i.deferUpdate();let view='home',note='';
  if(action==='daily'){store.daily(owner);note='✅ Récompense de 500 Yens récupérée.';}
  else if(action==='act'){store.action(owner,arg,Number(version),move);view='game';}
  else if(['balance','board','rules','home','games'].includes(action))view=action;
  else throw Error('Action inconnue.');
  return i.editReply(payload(owner,view,note));
 }catch(e){const p={content:'❌ '+e.message+' Tu peux rouvrir =casino pour retrouver ton état sauvegardé.',flags:MessageFlags.Ephemeral};if(i.deferred||i.replied)return i.followUp(p).catch(()=>{});return i.reply(p).catch(()=>{});}
}
function register(client){if(client.casinoRegistered)return;client.casinoRegistered=true;client.on(Events.InteractionCreate,i=>handle(i).catch(e=>console.error('Casino :',e.code||e.message)));
 const timer=setInterval(()=>{for(const [id,o]of offers)if(o.expires<Date.now())offers.delete(id);if(!isOff())try{store.expireAll();}catch(e){console.error('Sauvegarde casino :',e.code||e.message);}},60000);timer.unref();}
module.exports={register,launch,handle,payload};
