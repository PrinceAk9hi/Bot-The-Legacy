const {randomInt,randomUUID}=require('node:crypto');
const {read,update}=require('./recruitmentData');
function createStore(storeName='casino',{currency='Yens',command='=casino'}={}){
const DAY=86400000,MAX=10000;
function account(s,id){s.accounts||={};return s.accounts[id]||=( {balance:1000,dailyAt:0,played:0,wagered:0,returned:0,history:[],used:[]} );}
function transaction(id,fn){let result;update(storeName,s=>{const a=account(s,id);expire(a);result=fn(a,s);if(!Number.isSafeInteger(a.balance)||a.balance<0||a.balance>1e12)throw Error('Limite de portefeuille atteinte.');});return result;}
function snapshot(id){return transaction(id,a=>structuredClone(a));}
function score(cards){let sum=0,aces=0;for(const c of cards){const n=c%13+1;if(n===1){sum+=11;aces++;}else sum+=Math.min(n,10);}while(sum>21&&aces){sum-=10;aces--;}return sum;}
function shuffle(){const deck=Array.from({length:52},(_,i)=>i);for(let i=51;i>0;i--){const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}return deck;}
function cash(g){let chance=1;for(let i=0;i<g.revealed.length;i++)chance*=(13-i)/(16-i);return g.revealed.length?Math.floor(g.stake*.95/chance):g.stake;}
// Résumé lisible d'une partie, conservé dans l'historique pour l'administration.
function detail(g){
 if(g.kind==='slots')return 'Rouleaux '+g.reels.map(n=>n+1).join('-');
 if(g.kind==='roulette')return 'Pari '+g.bet+' → '+g.number+' '+g.color;
 if(g.kind==='blackjack')return 'Joueur '+score(g.player)+' · Banque '+score(g.dealer);
 if(g.kind==='mines')return g.revealed.filter(c=>!g.mines.includes(c)).length+' case(s) sûre(s)';
 return '';
}
function finish(a,g,payout,note){g.payout=payout;g.note=note;g.finishedAt=Date.now();a.balance+=payout;a.returned+=payout;a.played++;a.last=g;a.game=null;
 a.byKind||={};const k=a.byKind[g.kind]||={played:0,wagered:0,returned:0};k.played++;k.wagered+=g.stake;k.returned+=payout;
 a.history.unshift({id:g.id,kind:g.kind,stake:g.stake,payout,at:g.finishedAt,note,detail:detail(g)});a.history=a.history.slice(0,50);}
function stand(a,g){while(score(g.dealer)<17)g.dealer.push(g.deck.pop());const p=score(g.player),d=score(g.dealer);finish(a,g,p>21?0:d>21||p>d?g.stake*2:p===d?g.stake:0,p>21?'Tu dépasses 21.':d>21||p>d?'Tu remportes la main.':p===d?'Égalité : mise rendue.':'Le croupier gagne.');}
function expire(a){const g=a.game;if(!g||Date.now()<g.expiresAt)return;if(g.kind==='blackjack')stand(a,g);else finish(a,g,cash(g),'Partie expirée : encaissement automatique.');}
const FROZEN='Ton compte casino est gelé par l’équipe. Ouvre un ticket casino pour en savoir plus.';
function daily(id){return transaction(id,a=>{if(a.frozen)throw Error(FROZEN);if(Date.now()-a.dailyAt<DAY)throw Error('Récompense disponible <t:'+Math.floor((a.dailyAt+DAY)/1000)+':R>.');a.dailyAt=Date.now();a.balance+=500;return structuredClone(a);});}
function start(id,kind,stake,bet,token){return transaction(id,a=>{
 if(!['slots','roulette','blackjack','mines'].includes(kind))throw Error('Jeu inconnu.');
 if(a.frozen)throw Error(FROZEN);
 if(a.used.includes(token))throw Error('Cette mise a déjà été traitée.');
 if(a.game)throw Error('Termine ta partie en cours avec '+command+'.');
 if(!Number.isSafeInteger(stake)||stake<10||stake>MAX)throw Error('Choisis une mise entière de 10 à 10 000 '+currency+'.');
 if(a.balance<stake)throw Error('Solde insuffisant.');
 bet=String(bet||'').trim().toLowerCase();
 if(kind==='roulette'&&!['rouge','noir','pair','impair'].includes(bet)&&!(/^(?:[0-9]|[12][0-9]|3[0-6])$/.test(bet)))throw Error('Pari : rouge, noir, pair, impair ou un numéro de 0 à 36.');
 a.used.push(token);a.used=a.used.slice(-1000);a.balance-=stake;a.wagered+=stake;
 const g={id:randomUUID().slice(0,8),kind,stake,version:0,expiresAt:Date.now()+1800000};a.game=g;
 if(kind==='slots'){g.reels=Array.from({length:3},()=>randomInt(6));const unique=new Set(g.reels).size;finish(a,g,unique===1?stake*10:unique===2?stake:0,unique===1?'Trois symboles identiques : ×10 !':unique===2?'Une paire : mise rendue.':'Pas de combinaison gagnante.');}
 if(kind==='roulette'){g.number=randomInt(37);g.bet=bet;const red=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(g.number);g.color=g.number===0?'vert':red?'rouge':'noir';const exact=/^\d+$/.test(bet);const win=exact?g.number===Number(bet):g.number!==0&&(bet===g.color||bet==='pair'&&g.number%2===0||bet==='impair'&&g.number%2===1);finish(a,g,win?stake*(exact?36:2):0,win?'Pari gagnant !':'Le pari est perdu.');}
 if(kind==='blackjack'){g.deck=shuffle();g.player=[g.deck.pop(),g.deck.pop()];g.dealer=[g.deck.pop(),g.deck.pop()];if(score(g.player)===21||score(g.dealer)===21)finish(a,g,score(g.player)===21?(score(g.dealer)===21?stake:Math.floor(stake*2.5)):0,'Résolution du blackjack naturel.');}
 if(kind==='mines'){g.mines=[];while(g.mines.length<3){const cell=randomInt(16);if(!g.mines.includes(cell))g.mines.push(cell);}g.revealed=[];}
 return structuredClone(a);
 });}
function action(id,gameId,version,action){return transaction(id,a=>{
 const g=a.game;if(!g||g.id!==gameId||g.version!==version)throw Error('Ce bouton est ancien. Rouvre '+command+' pour reprendre ta partie.');
 if(g.kind==='blackjack'){
  if(action==='stand')stand(a,g);
  else if(action==='hit'){g.player.push(g.deck.pop());if(score(g.player)>21)finish(a,g,0,'Tu dépasses 21.');else if(score(g.player)===21)stand(a,g);}
  else if(action==='double'){if(g.player.length!==2||a.balance<g.stake)throw Error('Impossible de doubler cette main.');a.balance-=g.stake;a.wagered+=g.stake;g.stake*=2;g.player.push(g.deck.pop());stand(a,g);}
  else throw Error('Action incorrecte.');
 }else{
  if(action==='cash')finish(a,g,cash(g),'Gains encaissés.');
  else{if(!/^(?:[0-9]|1[0-5])$/.test(action))throw Error('Case incorrecte.');const cell=Number(action);if(g.revealed.includes(cell))throw Error('Case déjà ouverte.');g.revealed.push(cell);if(g.mines.includes(cell))finish(a,g,0,'Une mine ! Mise perdue.');else if(g.revealed.length===13)finish(a,g,cash(g),'Toutes les cases sûres découvertes !');}
 }g.version++;return structuredClone(a);
 });}
function leaderboard(){return Object.entries(read(storeName).accounts||{}).sort((a,b)=>b[1].balance-a[1].balance).slice(0,15);}
function expireAll(){update(storeName,s=>{for(const a of Object.values(s.accounts||{}))expire(a);});}

// ---- Administration : chaque opération est journalisée (auteur, avant/après, motif). ----
function peek(id){const a=read(storeName).accounts?.[id];return a?structuredClone(a):null;}
function accounts(){return Object.entries(structuredClone(read(storeName).accounts||{}));}
function adminLog(limit=50){return (read(storeName).adminLog||[]).slice(0,limit);}
function record(s,entry){s.adminLog||=[];s.adminLog.unshift({at:Date.now(),...entry});s.adminLog=s.adminLog.slice(0,300);}
function amount(n,max=1e9){if(!Number.isSafeInteger(n)||n<=0||n>max)throw Error('Montant invalide : nombre entier de 1 à '+max.toLocaleString('fr-FR')+'.');return n;}
function admin(id,type,{actorId,reason=''},fn){return transaction(id,(a,s)=>{const before=a.balance;const value=fn(a);record(s,{type,actorId,targetId:id,before,after:a.balance,amount:value,reason:String(reason).slice(0,300)});return structuredClone(a);});}
function credit(id,n,meta){return admin(id,'credit',meta,a=>{a.balance+=amount(n);return n;});}
function debit(id,n,meta){return admin(id,'debit',meta,a=>{amount(n);if(a.balance<n)throw Error('Le joueur n’a que '+a.balance.toLocaleString('fr-FR')+' '+currency+'.');a.balance-=n;return n;});}
function setBalance(id,n,meta){return admin(id,'set',meta,a=>{if(!Number.isSafeInteger(n)||n<0||n>1e9)throw Error('Solde invalide : nombre entier de 0 à 1 000 000 000.');a.balance=n;return n;});}
function resetDaily(id,meta){return admin(id,'daily',meta,a=>{a.dailyAt=0;return 0;});}
function freeze(id,frozen,meta){return admin(id,frozen?'freeze':'unfreeze',meta,a=>{a.frozen=frozen;return 0;});}
function cancelGame(id,meta){return admin(id,'cancel',meta,a=>{const g=a.game;if(!g)throw Error('Aucune partie en cours pour ce joueur.');a.balance+=g.stake;a.wagered-=g.stake;a.game=null;return g.stake;});}
function note(id,text,meta){return admin(id,'note',meta,a=>{text=String(text||'').trim().slice(0,500);if(!text)throw Error('La note est vide.');a.notes||=[];a.notes.unshift({at:Date.now(),actorId:meta.actorId,text});a.notes=a.notes.slice(0,20);return 0;});}
function resetAccount(id,meta){return admin(id,'reset',meta,a=>{const keep={notes:a.notes,frozen:a.frozen};for(const key of Object.keys(a))delete a[key];Object.assign(a,{balance:1000,dailyAt:0,played:0,wagered:0,returned:0,history:[],used:[]},keep);return 1000;});}
function creditAll(n,{actorId,reason=''}){amount(n,100000);let count=0;update(storeName,s=>{for(const a of Object.values(s.accounts||{})){a.balance+=n;count++;}record(s,{type:'bonus',actorId,targetId:null,amount:n,count,reason:String(reason).slice(0,300)});});return count;}
return {snapshot,daily,start,action,score,cash,leaderboard,expireAll,peek,accounts,adminLog,credit,debit,setBalance,resetDaily,freeze,cancelGame,note,resetAccount,creditAll,DAY,MAX};
}
module.exports={...createStore(),createStore};
