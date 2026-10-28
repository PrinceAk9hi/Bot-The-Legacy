const {randomUUID}=require('node:crypto');
const {Events,EmbedBuilder,AttachmentBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags}=require('discord.js');
const {allowed}=require('../utils/qgCasinoAccess');const store=require('../utils/casinoStore').createStore('qgCasino',{currency:'jetons',command:'/casino'});const isOff=()=>false;
const {renderGame}=require('../utils/qgCasinoDraw');
const offers=new Map();
const art=name=>require('../utils/discordPanelImage').localImage(require('node:path').join(__dirname,'..','assets','casino','qg',name),name);
const spins={slots:['slots-spin.gif','🎰 Les rouleaux tournent…'],roulette:['roulette-spin.gif','🎡 La bille est lancée…']};
const names={slots:'Machines à sous',roulette:'Roulette',blackjack:'Blackjack',mines:'Mines'};
const row=(...buttons)=>new ActionRowBuilder().addComponents(...buttons);
const btn=(id,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const money=n=>n.toLocaleString('fr-FR')+' jetons';
// Fiche de chaque table : accroche, règles détaillées et visuel animé.
const tables={
 slots:{emoji:'🎰',gif:'slots.gif',pitch:'Trois rouleaux, six symboles. Aligne trois fois le même et ta mise est multipliée par **10**.',odds:'Triple **×10** · Paire : mise rendue',rules:'**Déroulement**\nTu mises, les trois rouleaux tournent puis s’arrêtent.\n\n**Gains** (la mise est comprise)\n> Trois symboles identiques → **×10**\n> Deux symboles identiques → **mise rendue**\n> Aucune paire → mise perdue\n\nLes six symboles ont la même chance de sortir.'},
 roulette:{emoji:'🎡',gif:'roulette.gif',pitch:'37 cases de 0 à 36. Joue une couleur, la parité ou tente le numéro exact.',odds:'Couleur ou parité **×2** · Numéro **×36**',rules:'**Ton pari** (à saisir avec la mise)\n> `rouge` ou `noir` → **×2**\n> `pair` ou `impair` → **×2**\n> Un numéro de `0` à `36` → **×36**\n\n**À savoir**\nLe **0** est vert : il fait perdre les paris rouge, noir, pair et impair.\nLes gains comprennent la mise.'},
 blackjack:{emoji:'🃏',gif:'blackjack.gif',pitch:'Approche-toi de 21 sans dépasser et bats la banque.',odds:'Victoire **×2** · Blackjack naturel **×2,5**',rules:'**Valeur des cartes**\nAs : 1 ou 11 · Figures : 10 · Autres : leur valeur.\n\n**Tes actions**\n> **Tirer** : prendre une carte\n> **Rester** : la banque joue\n> **Doubler** : doubler la mise et recevoir une seule carte (après les deux premières)\n\n**La banque** tire jusqu’à 17 puis reste.\n\n**Gains** : victoire **×2**, blackjack naturel **×2,5**, égalité mise rendue. Pas de séparation ni d’assurance.'},
 mines:{emoji:'💣',gif:'mines.gif',pitch:'16 cases, 3 mines cachées. Chaque case sûre fait grimper tes gains : encaisse avant l’explosion.',odds:'Multiplicateur croissant · jusqu’à **×532**',rules:'**Déroulement**\nOuvre les cases une par une avec les boutons numérotés.\n\n> 💎 Case sûre → ton multiplicateur augmente\n> 💣 Mine → la mise est perdue\n> **Encaisser** → tu récupères le montant affiché\n\nLe multiplicateur suit la probabilité réelle des cases ouvertes, avec une retenue de 5 %. Ouvrir les 13 cases sûres encaisse automatiquement.'}};
const GOLD=0xd4bd86;
function payload(id,view='home',notice='',kind=''){
 const a=store.snapshot(id),g=a.game||(view==='game'?a.last:null),e=new EmbedBuilder().setColor(GOLD).setAuthor({name:'Casino • Le QG'}).setFooter(require('../utils/qgBrand').footer(' · Jetons fictifs'));
 const dailyReady=!a.dailyAt||Date.now()-a.dailyAt>=86400000;
 const back=(target='home',label='Mon compte')=>btn(`qgcs:${target}:${id}`,label).setEmoji(target==='games'?'🎮':'👛');
 let components=[],files=[];
 if(g&&(view==='game'||a.game)){
  const done=Boolean(g.finishedAt),net=done?g.payout-g.stake:0;
  e.setColor(done?(net>0?0x3fae75:net<0?0xe0525b:GOLD):GOLD)
   .setTitle(`${tables[g.kind].emoji}  ${names[g.kind]}`+(done?(net>0?' • Gagné !':net<0?' • Perdu':' • Égalité'):' • À toi de jouer'))
   .setDescription(done?`${net>0?'+':''}**${money(net)}** · Solde : **${money(a.balance)}**`:`Mise : **${money(g.stake)}** · Solde : **${money(a.balance)}**`)
   .setImage('attachment://partie.png');
  files=[new AttachmentBuilder(renderGame(g),{name:'partie.png'})];
  const prefix=`qgcs:act:${id}:${g.id}:${g.version}:`;
  components=done?[row(btn(`qgcs:play:${id}:${g.kind}`,'Rejouer',ButtonStyle.Success).setEmoji('🔁'),back('games','Changer de jeu'),back())]:[];
  if(g.kind==='blackjack'&&!done)components=[row(btn(prefix+'hit','Tirer',ButtonStyle.Primary),btn(prefix+'stand','Rester'),btn(prefix+'double','Doubler').setDisabled(g.player.length!==2||a.balance<g.stake))];
  if(g.kind==='mines'&&!done){
   components=Array.from({length:4},(_,y)=>row(...Array.from({length:4},(_,x)=>{const n=y*4+x,seen=g.revealed.includes(n);return btn(prefix+n,seen?'💎':String(n+1),seen?ButtonStyle.Success:ButtonStyle.Secondary).setDisabled(seen);})));components.push(row(btn(prefix+'cash','Encaisser '+money(store.cash(g)),ButtonStyle.Success)));
  }
 }else if((view==='intro'||view==='howto')&&tables[kind]){
  const t=tables[kind],gif=art(t.gif);
  e.setTitle(`${t.emoji}  ${names[kind]}`).setImage(gif.url).setDescription(view==='intro'?`${t.pitch}\n\n${t.odds}\nMise : **10 à 10 000 jetons** · Ton solde : **${money(a.balance)}**`:t.rules);
  files=[gif.file];
  components=[row(btn(`qgcs:play:${id}:${kind}`,'Miser',ButtonStyle.Success).setEmoji('🪙'),view==='intro'?btn(`qgcs:howto:${id}:${kind}`,'Règles du jeu').setEmoji('📜'):btn(`qgcs:intro:${id}:${kind}`,'Présentation').setEmoji('🎬'),back('games','Autres jeux'))];
 }else if(view==='games'){
  e.setTitle('🎮  Choisis ta table').setDescription(Object.entries(tables).map(([key,t])=>`${t.emoji} **${names[key]}** — ${t.odds}`).join('\n')+`\n\nTon solde : **${money(a.balance)}**`);
  components=[row(...Object.entries(tables).map(([key,t])=>btn(`qgcs:intro:${id}:${key}`,names[key],ButtonStyle.Primary).setEmoji(t.emoji))),row(back())];
 }else if(view==='board'){
  const medals=['🥇','🥈','🥉'];
  e.setTitle('🏆  Classement du casino').setDescription(store.leaderboard().map(([user,v],index)=>`${medals[index]||`**${index+1}.**`} <@${user}> — **${money(v.balance)}**`).join('\n')||'Aucun joueur pour le moment.');components=[row(back())];
 }else if(view==='rules'){
  e.setTitle('📜  Règles du casino').setDescription('**Monnaie fictive uniquement** : 1 000 jetons offerts à la première visite, puis 500 avec la récompense toutes les 24 h. Mises de 10 à 10 000. Une partie interactive à la fois.\n\nLes gains comprennent la mise. Après 30 minutes d’inactivité, le blackjack se termine avec « Rester » et les mines sont encaissées au montant atteint. Les anciens boutons ne rejouent jamais une mise.\n\nLes règles de chaque jeu sont sur sa fiche : **Jouer** → choisis la table → **Règles du jeu**.');components=[row(btn('qgcs:games:'+id,'Jouer',ButtonStyle.Success).setEmoji('🎮'),back())];
 }else{
  const recent=a.history.slice(0,5).map(h=>{const n=h.payout-h.stake;return `${tables[h.kind].emoji} ${names[h.kind]} · ${n>0?'+':''}${money(n)}`;}).join('\n');
  e.setTitle('👛  Mon compte')
   .setDescription(`<@${id}>\n## ${money(a.balance)}\n${dailyReady?'🎁 Ta récompense du jour est disponible.':'🎁 Prochaine récompense <t:'+Math.floor((a.dailyAt+86400000)/1000)+':R>.'}`)
   .addFields({name:'Parties',value:String(a.played),inline:true},{name:'Total misé',value:money(a.wagered),inline:true},{name:'Total gagné',value:money(a.returned),inline:true},{name:'Dernières parties',value:recent||'Aucune partie pour le moment.'});
  components=[row(btn('qgcs:games:'+id,'Jouer',ButtonStyle.Success).setEmoji('🎮'),btn('qgcs:daily:'+id,'Récompense du jour',ButtonStyle.Primary).setEmoji('🎁').setDisabled(!dailyReady),btn('qgcs:board:'+id,'Classement').setEmoji('🏆'),btn('qgcs:rules:'+id,'Règles').setEmoji('📜'))];
 }
 return {content:notice||null,embeds:[e],components,files,attachments:[],allowedMentions:{parse:[]}};
}
async function launch(i,name='casino'){
 if(!await allowed(i)||isOff())return i.reply({content:'Le casino est réservé aux membres vérifiés du QG.',flags:MessageFlags.Ephemeral});
 await i.deferReply({flags:MessageFlags.Ephemeral});let note='',view=name==='jouer'?'games':name==='classement-casino'?'board':'home';
 try{
  if(name==='daily'){store.daily(i.user.id);note='✅ 500 jetons ajoutés à ton portefeuille.';}
  if(names[name]){const stake=i.options.getInteger('mise');if(stake!==null){if(name==='roulette'&&!i.options.getString('pari'))throw Error('Précise ton pari : roulette : 50 jetons sur rouge, ou un numéro de 0 à 36.');store.start(i.user.id,name,stake,i.options.getString('pari'),i.id);view='game';}else note='Choisis ton jeu avec les boutons pour saisir une mise.';}
  return i.editReply(payload(i.user.id,view,note));
 }catch(e){return i.editReply({content:'❌ '+e.message});}
}
function prompt(i,owner,kind){
 if(!names[kind])throw Error('Jeu inconnu.');
 if(require('../utils/qgAdmin').state().schoolCasino?.enabled===false)throw Error('Les nouvelles mises sont momentanément fermées. Ta partie en cours reste accessible.');
 for(const [key,offer]of offers)if(offer.expires<Date.now())offers.delete(key);
 const token=randomUUID().slice(0,8);offers.set(token,{owner,kind,expires:Date.now()+300000});
 const modal=new ModalBuilder().setCustomId(`qgcs:stake:${owner}:${token}`).setTitle(names[kind]+' • Ta mise').addComponents(row(new TextInputBuilder().setCustomId('amount').setLabel('Mise : 10 à 10 000 jetons').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(5)));
 if(kind==='roulette')modal.addComponents(row(new TextInputBuilder().setCustomId('bet').setLabel('Rouge, noir, pair, impair ou numéro 0 à 36').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)));
 return i.showModal(modal);
}
async function handle(i){if(!i.customId?.startsWith('qgcs:'))return;
 const [,action,owner,arg,version,move]=i.customId.split(':');
 if(owner!==i.user.id||!await allowed(i)||isOff())return i.reply({content:'Ce panneau ne t’appartient pas ou le casino est indisponible.',flags:MessageFlags.Ephemeral});
 try{
  if(['play','stake'].includes(action)&&require('../utils/qgAdmin').state().schoolCasino?.enabled===false)throw Error('Les nouvelles mises sont momentanément fermées. Ta partie en cours reste accessible.');
  if(i.isButton()&&action==='play')return prompt(i,owner,arg);
  if(i.isModalSubmit()&&action==='stake'){
   const offer=offers.get(arg);if(!offer||offer.owner!==owner||offer.expires<Date.now())throw Error('Formulaire expiré : rouvre le jeu.');
   offers.delete(arg);await i.deferReply({flags:MessageFlags.Ephemeral});if(require('../utils/qgAdmin').state().schoolCasino?.enabled===false)throw Error('Les nouvelles mises viennent de fermer.');store.start(owner,offer.kind,Number(i.fields.getTextInputValue('amount')),offer.kind==='roulette'?i.fields.getTextInputValue('bet'):'',arg);
   if(spins[offer.kind]){
    // Le tirage est déjà enregistré : l'animation ne fait que précéder l'affichage du résultat.
    const [file,label]=spins[offer.kind],spin=art(file);
    await i.editReply({embeds:[new EmbedBuilder().setColor(0xd4bd86).setAuthor({name:'Casino • Le QG'}).setTitle(label).setDescription(`<@${owner}> • Mise : **${money(store.snapshot(owner).last.stake)}**`).setImage(spin.url)],files:[spin.file],components:[],allowedMentions:{parse:[]}});
    await new Promise(r=>setTimeout(r,2600));
   }
   return i.editReply(payload(owner,'game'));
  }
  if(!i.isButton())return;
  await i.deferUpdate();let view='home',note='';
  if(action==='daily'){store.daily(owner);note='✅ Récompense de 500 jetons récupérée.';}
  else if(action==='act'){store.action(owner,arg,Number(version),move);view='game';}
  else if(['board','rules','home','games','intro','howto'].includes(action))view=action;
  else throw Error('Action inconnue.');
  return i.editReply(payload(owner,view,note,arg));
 }catch(e){const p={content:'❌ '+e.message+' Tu peux rouvrir /casino pour retrouver ton état sauvegardé.',flags:MessageFlags.Ephemeral};if(i.deferred||i.replied)return i.followUp(p).catch(()=>{});return i.reply(p).catch(()=>{});}
}
module.exports={launch,handle,payload,prompt,store};
