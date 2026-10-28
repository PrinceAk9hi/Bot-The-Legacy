// Dessin du casino QG (noir et or) : primitives partagées par les GIF de présentation
// (scripts/generate-casino-art.cjs) et les images de parties rendues en direct.
// Polices libres embarquées (assets/fonts) : le rendu est identique sur Railway et en local.
const path=require('node:path');
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
const FONTS=path.join(__dirname,'..','assets','fonts');
GlobalFonts.registerFromPath(path.join(FONTS,'AbrilFatface-Regular.ttf'),'QG Display');
GlobalFonts.registerFromPath(path.join(FONTS,'BebasNeue-Regular.ttf'),'QG Label');
const DISPLAY='"QG Display"',LABEL='"QG Label"';
const C={bg:'#0b0b0d',panel:'#141311',ink:'#f2ede1',dim:'#7d786d',gold:'#d4bd86',bright:'#f6e3ad',red:'#b8262f',redLight:'#e0525b',black:'#18181b',green:'#1f6b45',greenLight:'#3fae75'};
const WHEEL=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const REDS=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const RANKS=['A','2','3','4','5','6','7','8','9','10','V','D','R'];
const NAMES={slots:'MACHINES À SOUS',roulette:'ROULETTE',blackjack:'BLACKJACK',mines:'MINES'};

// Grain fixe (graine constante) : même texture sur chaque image, GIF plus légers.
const grains=new Map();
function grain(w,h){const key=w+'x'+h;if(grains.has(key))return grains.get(key);let seed=7;const rand=()=>(seed=(seed*16807)%2147483647)/2147483647;const cv=createCanvas(w,h),g=cv.getContext('2d');for(let n=0;n<w*h/34;n++){g.fillStyle=`rgba(242,237,225,${rand()*.05})`;g.fillRect(rand()*w,rand()*h,1+rand()*1.5,1+rand()*1.5);}grains.set(key,cv);return cv;}

function spaced(ctx,text,x,y,gap,align='left'){
 const chars=[...String(text)],widths=chars.map(ch=>ctx.measureText(ch).width),total=widths.reduce((a,b)=>a+b,0)+gap*(chars.length-1);
 let cx=align==='center'?x-total/2:align==='right'?x-total:x;const prev=ctx.textAlign;ctx.textAlign='left';
 chars.forEach((ch,i)=>{ctx.fillText(ch,cx,y);cx+=widths[i]+gap;});ctx.textAlign=prev;return total;
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function diamond(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r*.78,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r*.78,y);ctx.closePath();ctx.fill();}
function sparkle(ctx,x,y,r,alpha){if(alpha<=0)return;ctx.save();ctx.globalAlpha=Math.min(1,alpha);ctx.fillStyle=C.bright;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,v=i%2?r*.18:r;ctx.lineTo(x+Math.cos(a)*v,y+Math.sin(a)*v);}ctx.closePath();ctx.fill();ctx.restore();}

// Enseignes dessinées en vecteurs (aucune police de symboles requise sur le serveur).
function heart(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y+r);ctx.bezierCurveTo(x-r*1.35,y-r*.05,x-r*.75,y-r*1.15,x,y-r*.42);ctx.bezierCurveTo(x+r*.75,y-r*1.15,x+r*1.35,y-r*.05,x,y+r);ctx.fill();}
function spade(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-r);ctx.bezierCurveTo(x+r*1.35,y-r*.05,x+r*.75,y+r*.95,x,y+r*.35);ctx.bezierCurveTo(x-r*.75,y+r*.95,x-r*1.35,y-r*.05,x,y-r);ctx.fill();stem(ctx,x,y,r,color);}
function club(ctx,x,y,r,color){ctx.fillStyle=color;for(const [dx,dy]of [[0,-.48],[-.48,.1],[.48,.1]]){ctx.beginPath();ctx.arc(x+dx*r,y+dy*r,r*.43,0,Math.PI*2);ctx.fill();}ctx.fillRect(x-r*.12,y-r*.2,r*.24,r*.5);stem(ctx,x,y,r,color);}
function stem(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y+r*.15);ctx.lineTo(x+r*.32,y+r);ctx.lineTo(x-r*.32,y+r);ctx.closePath();ctx.fill();}
function star(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,v=i%2?r*.42:r;ctx.lineTo(x+Math.cos(a)*v,y+Math.sin(a)*v);}ctx.closePath();ctx.fill();}
function suit(ctx,s,x,y,r,color){[spade,heart,diamond,club][s](ctx,x,y,r,color);}
const suitColor=s=>s===1||s===2?C.red:'#111111';

function frame(ctx,kanji){
 const W=ctx.canvas.width,H=ctx.canvas.height;
 ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);
 const v=ctx.createRadialGradient(W/2,H/2,60,W/2,H/2,W*.62);v.addColorStop(0,'rgba(212,189,134,0.10)');v.addColorStop(1,'rgba(0,0,0,0.55)');ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
 ctx.drawImage(grain(W,H),0,0);
 ctx.strokeStyle=C.gold;ctx.lineWidth=2;ctx.strokeRect(14,14,W-28,H-28);ctx.lineWidth=1;ctx.globalAlpha=.55;ctx.strokeRect(21,21,W-42,H-42);ctx.globalAlpha=1;
 for(const [x,y]of [[14,14],[W-14,14],[14,H-14],[W-14,H-14]])diamond(ctx,x,y,7,C.gold);
 // Idéogrammes décoratifs : seulement si une police japonaise est installée (génération locale).
 if(kanji&&GlobalFonts.has('Yu Gothic')){ctx.font='600 20px "Yu Gothic"';ctx.fillStyle=C.gold;ctx.globalAlpha=.7;ctx.textAlign='center';[...kanji].forEach((k,i)=>ctx.fillText(k,44,70+i*26));ctx.globalAlpha=1;ctx.textAlign='left';}
}
function heading(ctx,small,big,sub,x=78,top=92,size=72){
 ctx.textBaseline='alphabetic';ctx.fillStyle=C.gold;ctx.font=`22px ${LABEL}`;spaced(ctx,small,x,top,5);
 ctx.fillStyle=C.ink;ctx.font=`${size}px ${DISPLAY}`;ctx.fillText(big,x-3,top+size+6);
 const w=Math.min(ctx.measureText(big).width,330);ctx.fillStyle=C.gold;ctx.fillRect(x,top+size+24,w,2);diamond(ctx,x+w+10,top+size+25,5,C.gold);
 if(sub){ctx.fillStyle=C.dim;ctx.font=`21px ${LABEL}`;spaced(ctx,sub,x,top+size+58,3);}
}
// Reflet lumineux qui balaie une zone déjà dessinée.
function sweep(ctx,x,y,w,h,t){const px=x-120+(w+240)*t;const g=ctx.createLinearGradient(px-60,0,px+60,0);g.addColorStop(0,'rgba(246,227,173,0)');g.addColorStop(.5,'rgba(246,227,173,0.38)');g.addColorStop(1,'rgba(246,227,173,0)');ctx.save();ctx.globalCompositeOperation='source-atop';ctx.fillStyle=g;ctx.fillRect(x,y,w,h);ctx.restore();}

function wheel(ctx,cx,cy,r,angle,ball,result){
 ctx.save();ctx.fillStyle=C.gold;ctx.beginPath();ctx.arc(cx,cy,r+10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#2b241a';ctx.beginPath();ctx.arc(cx,cy,r+4,0,Math.PI*2);ctx.fill();
 const step=Math.PI*2/37;
 WHEEL.forEach((n,i)=>{const a=angle+i*step-Math.PI/2;ctx.fillStyle=n===0?C.green:REDS.has(n)?C.red:C.black;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,a,a+step);ctx.closePath();ctx.fill();
  ctx.save();ctx.translate(cx,cy);ctx.rotate(a+step/2+Math.PI/2);ctx.fillStyle=C.ink;ctx.font=`${Math.round(r*.11)}px ${LABEL}`;ctx.textAlign='center';ctx.fillText(String(n),0,-r*.83);ctx.restore();});
 ctx.strokeStyle=C.gold;ctx.lineWidth=1;for(let i=0;i<37;i++){const a=angle+i*step-Math.PI/2;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r*.62,cy+Math.sin(a)*r*.62);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.stroke();}
 const hub=ctx.createRadialGradient(cx-r*.1,cy-r*.1,2,cx,cy,r*.62);hub.addColorStop(0,'#3a3226');hub.addColorStop(1,'#0f0d0a');ctx.fillStyle=hub;ctx.beginPath();ctx.arc(cx,cy,r*.62,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=C.gold;ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,r*.62,0,Math.PI*2);ctx.stroke();
 ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.fillStyle=C.gold;for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.fillRect(-3,-r*.42,6,r*.42);}ctx.beginPath();ctx.arc(0,0,r*.1,0,Math.PI*2);ctx.fill();ctx.restore();
 if(result!==undefined){ctx.fillStyle='#0f0d0a';ctx.beginPath();ctx.arc(cx,cy,r*.3,0,Math.PI*2);ctx.fill();ctx.strokeStyle=C.gold;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=REDS.has(result)?C.redLight:result===0?C.greenLight:C.ink;ctx.font=`${Math.round(r*.3)}px ${DISPLAY}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(result),cx,cy+2);ctx.textBaseline='alphabetic';ctx.textAlign='left';}
 if(ball){const br=r*.9;ctx.fillStyle='#ffffff';ctx.shadowColor='rgba(255,255,255,.6)';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(cx+Math.cos(ball.a)*ball.r*br,cy+Math.sin(ball.a)*ball.r*br,r*.05,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
 ctx.restore();
}
// Angle de la case d'un numéro pour une rotation donnée (la bille s'y pose).
const pocketAngle=(number,angle)=>angle+WHEEL.indexOf(number)*Math.PI*2/37+Math.PI/37-Math.PI/2;

function card(ctx,x,y,w,h,rank,s,down,tilt=0){
 ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(tilt);ctx.translate(-w/2,-h/2);
 ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=14;ctx.shadowOffsetY=6;roundRect(ctx,0,0,w,h,9);ctx.fillStyle=down?'#141210':C.ink;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 ctx.strokeStyle=C.gold;ctx.lineWidth=2;roundRect(ctx,0,0,w,h,9);ctx.stroke();
 if(down){ctx.save();roundRect(ctx,6,6,w-12,h-12,6);ctx.clip();ctx.strokeStyle=C.gold;ctx.globalAlpha=.4;ctx.lineWidth=1;for(let i=-h;i<w+h;i+=12){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+h,h);ctx.stroke();ctx.beginPath();ctx.moveTo(i+h,0);ctx.lineTo(i,h);ctx.stroke();}ctx.restore();diamond(ctx,w/2,h/2,14,C.gold);}
 else{const color=suitColor(s);ctx.fillStyle=color;ctx.font=`${Math.round(w*.3)}px ${DISPLAY}`;ctx.fillText(rank,w*.1,w*.34);suit(ctx,s,w*.18,w*.5,w*.09,color);suit(ctx,s,w/2,h*.6,w*.24,color);}
 ctx.restore();
}
function chip(ctx,x,y,r,color=C.red){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=C.ink;ctx.lineWidth=r*.22;ctx.setLineDash([r*.38,r*.38]);ctx.beginPath();ctx.arc(x,y,r*.84,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle=C.gold;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,r*.56,0,Math.PI*2);ctx.stroke();diamond(ctx,x,y,r*.25,C.gold);}

// Symboles des rouleaux, dans l'ordre des index tirés par casinoStore (0 à 5).
function symbol(ctx,n,x,y,size,alpha=1){
 ctx.save();ctx.globalAlpha=alpha;
 if(n===0){ctx.fillStyle=C.bright;ctx.font=`${Math.round(size*1.25)}px ${DISPLAY}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('7',x,y+size*.06);}
 else if(n===1)star(ctx,x,y,size*.62,C.gold);
 else if(n===2)diamond(ctx,x,y,size*.62,C.red);
 else if(n===3)spade(ctx,x,y-size*.08,size*.5,C.ink);
 else if(n===4)heart(ctx,x,y,size*.52,C.red);
 else club(ctx,x,y-size*.08,size*.5,C.ink);
 ctx.restore();
}
function reel(ctx,x,y,w,h,symbols,offset=0,lit=false,blur=false){
 roundRect(ctx,x,y,w,h,12);ctx.fillStyle='#16130f';ctx.fill();ctx.strokeStyle=lit?C.bright:C.gold;ctx.lineWidth=lit?3:2;ctx.stroke();
 ctx.save();roundRect(ctx,x+4,y+4,w-8,h-8,10);ctx.clip();const row=h*.38;
 symbols.forEach((n,k)=>symbol(ctx,n,x+w/2,y+h/2+(k-1+offset)*row,w*.46,blur?.5:k===1?1:.28));
 const shade=ctx.createLinearGradient(0,y,0,y+h);shade.addColorStop(0,'rgba(11,11,13,.85)');shade.addColorStop(.3,'rgba(11,11,13,0)');shade.addColorStop(.7,'rgba(11,11,13,0)');shade.addColorStop(1,'rgba(11,11,13,.85)');ctx.fillStyle=shade;ctx.fillRect(x,y,w,h);
 ctx.restore();
}
function mineIcon(ctx,x,y,r,color=C.redLight){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.fillRect(x-r*.14,y-r*1.45,r*.28,r*2.9);ctx.fillRect(x-r*1.45,y-r*.14,r*2.9,r*.28);ctx.fillStyle='rgba(255,255,255,.7)';ctx.beginPath();ctx.arc(x-r*.35,y-r*.35,r*.22,0,Math.PI*2);ctx.fill();}
function tile(ctx,x,y,s,state,label){
 roundRect(ctx,x,y,s,s,9);ctx.fillStyle=state==='boom'?'#4a1216':state==='safe'?'#1d1a14':'#141416';ctx.fill();
 ctx.strokeStyle=state==='boom'?C.redLight:state==='safe'?C.gold:'#3a372f';ctx.lineWidth=state==='hidden'?1:2;ctx.stroke();
 if(state==='safe'){diamond(ctx,x+s/2,y+s/2,s*.27,C.bright);diamond(ctx,x+s/2,y+s/2,s*.12,'#ffffff');}
 else if(state==='mine'||state==='boom')mineIcon(ctx,x+s/2,y+s/2,s*.17);
 else if(label){ctx.fillStyle=C.dim;ctx.font=`${Math.round(s*.36)}px ${LABEL}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x+s/2,y+s/2+2);ctx.textAlign='left';ctx.textBaseline='alphabetic';}
}

const score=cards=>{let sum=0,aces=0;for(const c of cards){const n=c%13+1;if(n===1){sum+=11;aces++;}else sum+=Math.min(n,10);}while(sum>21&&aces){sum-=10;aces--;}return sum;};
const fr=n=>Number(n).toLocaleString('fr-FR').replace(/\s/g,' ');
function minesCash(g){let p=1;for(let i=0;i<g.revealed.length;i++)p*=(13-i)/(16-i);return g.revealed.length?Math.floor(g.stake*.95/p):g.stake;}

// Image d'une partie (en cours ou terminée), 960×440.
function renderGame(g){
 const W=960,H=440,cv=createCanvas(W,H),ctx=cv.getContext('2d');frame(ctx);
 const done=Boolean(g.finishedAt),net=done?g.payout-g.stake:0,accent=done?(net>0?C.greenLight:net<0?C.redLight:C.gold):C.gold;
 const status=done?(net>0?'GAGNÉ':net<0?'PERDU':'ÉGALITÉ'):'EN JEU';
 ctx.fillStyle=C.gold;ctx.font=`20px ${LABEL}`;spaced(ctx,'LE QG · CASINO',48,62,5);
 ctx.fillStyle=C.ink;ctx.font=`46px ${DISPLAY}`;ctx.fillText(NAMES[g.kind],46,114);
 ctx.font=`24px ${LABEL}`;const sw=[...status].reduce((n,ch)=>n+ctx.measureText(ch).width,0)+4*(status.length-1);
 roundRect(ctx,912-sw-36,40,sw+36,38,19);ctx.fillStyle=done?(net>0?'rgba(63,174,117,.16)':net<0?'rgba(224,82,91,.16)':'rgba(212,189,134,.14)'):'rgba(212,189,134,.14)';ctx.fill();ctx.strokeStyle=accent;ctx.lineWidth=1.5;ctx.stroke();
 ctx.fillStyle=accent;spaced(ctx,status,912-18,68,4,'right');
 ctx.fillStyle=C.ink;ctx.font=`30px ${DISPLAY}`;ctx.textAlign='right';ctx.fillText(fr(g.stake),912,114);const mw=ctx.measureText(fr(g.stake)).width;ctx.textAlign='left';
 ctx.fillStyle=C.dim;ctx.font=`20px ${LABEL}`;spaced(ctx,'MISE',912-mw-12,110,3,'right');
 ctx.fillStyle=C.gold;ctx.globalAlpha=.6;ctx.fillRect(46,134,868,1);ctx.globalAlpha=1;

 let prompt='';
 if(g.kind==='blackjack'){
  const rows=[['BANQUE',g.dealer,!done,done?score(g.dealer):'?',150],['TOI',g.player,false,score(g.player),268]];
  for(const [label,cards,hide,value,y]of rows){
   ctx.fillStyle=C.dim;ctx.font=`22px ${LABEL}`;spaced(ctx,label,60,y+40,4);
   ctx.beginPath();ctx.arc(92,y+80,28,0,Math.PI*2);ctx.fillStyle='#16130f';ctx.fill();ctx.strokeStyle=label==='TOI'?accent:C.gold;ctx.lineWidth=2;ctx.stroke();
   ctx.fillStyle=label==='TOI'?accent:C.ink;ctx.font=`28px ${DISPLAY}`;ctx.textAlign='center';ctx.fillText(String(value),92,y+91);ctx.textAlign='left';
   const w=76,h=106,gap=-14+Math.max(0,6-cards.length)*6;cards.forEach((c,i)=>card(ctx,190+i*(w+gap),y,w,h,RANKS[c%13],Math.floor(c/13),hide&&i===1,(i-(cards.length-1)/2)*.03));
  }
  const p=score(g.player);ctx.fillStyle=C.gold;ctx.globalAlpha=.25;ctx.fillRect(640,150,1,224);ctx.globalAlpha=1;
  const verdict=done?(p>21?'TU DÉPASSES 21':g.player.length===2&&p===21&&net>0?'BLACKJACK !':score(g.dealer)>21?'LA BANQUE DÉPASSE 21':net>0?'MAIN GAGNANTE':net<0?(score(g.dealer)===21&&g.dealer.length===2?'BLACKJACK DE LA BANQUE':'LA BANQUE GAGNE'):'ÉGALITÉ'):'À TOI DE JOUER';
  ctx.fillStyle=done?accent:C.ink;ctx.font=`34px ${DISPLAY}`;wrapCenter(ctx,verdict,780,250,230,40);
  prompt=done?'':'TIRER · RESTER · DOUBLER';
 }
 if(g.kind==='roulette'){
  const angle=-0.6;wheel(ctx,230,262,108,angle,{a:pocketAngle(g.number,angle),r:.8},g.number);
  const exact=/^\d+$/.test(g.bet),colorOf=n=>n===0?C.greenLight:REDS.has(n)?C.redLight:C.ink;
  ctx.fillStyle=C.dim;ctx.font=`22px ${LABEL}`;spaced(ctx,'TON PARI',420,184,4);
  ctx.fillStyle=exact?colorOf(Number(g.bet)):g.bet==='rouge'?C.redLight:C.ink;ctx.font=`44px ${DISPLAY}`;ctx.fillText(exact?'N° '+g.bet:g.bet.toUpperCase(),418,232);
  ctx.fillStyle=C.dim;ctx.font=`20px ${LABEL}`;spaced(ctx,exact?'GAIN ×36':'GAIN ×2',420,262,3);
  ctx.fillStyle=C.dim;ctx.font=`22px ${LABEL}`;spaced(ctx,'RÉSULTAT',650,184,4);
  ctx.beginPath();ctx.arc(686,226,30,0,Math.PI*2);ctx.fillStyle=g.number===0?C.green:REDS.has(g.number)?C.red:C.black;ctx.fill();ctx.strokeStyle=C.gold;ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle=C.ink;ctx.font=`28px ${DISPLAY}`;ctx.textAlign='center';ctx.fillText(String(g.number),686,237);ctx.textAlign='left';
  ctx.fillStyle=colorOf(g.number);ctx.font=`30px ${LABEL}`;spaced(ctx,g.color.toUpperCase(),730,224,4);ctx.fillStyle=C.dim;ctx.font=`20px ${LABEL}`;spaced(ctx,g.number===0?'ZÉRO':g.number%2?'IMPAIR':'PAIR',730,250,3);
  ctx.fillStyle=accent;ctx.font=`34px ${DISPLAY}`;ctx.fillText(net>0?'PARI GAGNANT !':'PARI PERDU',418,334);
 }
 if(g.kind==='slots'){
  const unique=new Set(g.reels).size,win=unique===1;
  g.reels.forEach((n,i)=>{const lit=win||g.reels.filter(x=>x===n).length===2;reel(ctx,248+i*160,150,140,214,[(n+5)%6,n,(n+1)%6],0,lit);});
  ctx.strokeStyle=accent;ctx.globalAlpha=.8;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(228,257);ctx.lineTo(728,257);ctx.stroke();ctx.globalAlpha=1;diamond(ctx,228,257,7,accent);diamond(ctx,728,257,7,accent);
  ctx.fillStyle=accent;ctx.font=`30px ${DISPLAY}`;wrapCenter(ctx,win?'JACKPOT ×10':unique===2?'UNE PAIRE':'PERDU',834,250,140,36);
  ctx.fillStyle=C.dim;ctx.font=`20px ${LABEL}`;spaced(ctx,win?'TRIPLE':unique===2?'MISE RENDUE':'AUCUNE COMBINAISON',834,296,2,'center');
  if(win)[[240,150],[700,160],[470,146]].forEach(([x,y])=>sparkle(ctx,x,y,14,1));
 }
 if(g.kind==='mines'){
  const s=50,gap=8,x0=60,y0=150;const hit=done&&g.revealed.some(n=>g.mines.includes(n));
  for(let n=0;n<16;n++){const seen=g.revealed.includes(n),mine=g.mines.includes(n);tile(ctx,x0+(n%4)*(s+gap),y0+Math.floor(n/4)*(s+gap),s,seen&&mine?'boom':seen?'safe':done&&mine?'mine':'hidden',String(n+1));}
  const safe=g.revealed.filter(n=>!g.mines.includes(n)).length,value=done?g.payout:minesCash(g);
  ctx.fillStyle=C.dim;ctx.font=`22px ${LABEL}`;spaced(ctx,'CASES SÛRES',330,184,4);ctx.fillStyle=C.ink;ctx.font=`40px ${DISPLAY}`;ctx.fillText(safe+' / 13',328,228);
  ctx.fillStyle=C.dim;ctx.font=`22px ${LABEL}`;spaced(ctx,'MULTIPLICATEUR',560,184,4);ctx.fillStyle=C.gold;ctx.font=`40px ${DISPLAY}`;ctx.fillText(hit?'—':'×'+(value/g.stake).toFixed(2).replace('.',','),558,228);
  ctx.fillStyle=C.dim;ctx.font=`22px ${LABEL}`;spaced(ctx,done?(hit?'MINE TOUCHÉE':'ENCAISSÉ'):'ENCAISSEMENT ACTUEL',330,290,4);
  ctx.fillStyle=done?accent:C.greenLight;ctx.font=`40px ${DISPLAY}`;ctx.fillText(fr(value)+' jetons',328,336);
  prompt=done?'':'OUVRE UNE CASE OU ENCAISSE';
 }
 // Bandeau de résultat.
 ctx.fillStyle=done?(net>0?'rgba(63,174,117,.12)':net<0?'rgba(224,82,91,.12)':'rgba(212,189,134,.10)'):'rgba(212,189,134,.08)';ctx.fillRect(22,388,W-44,30);
 ctx.fillStyle=accent;ctx.font=`24px ${LABEL}`;spaced(ctx,done?`${net>0?'+'+fr(net)+' JETONS':net<0?fr(net)+' JETONS':'MISE RENDUE'}   ·   RETOUR ${fr(g.payout)}`:prompt,W/2,412,4,'center');
 return cv.toBuffer('image/png');
}
function wrapCenter(ctx,text,x,y,max,line){const words=String(text).split(' '),lines=[];let cur='';for(const w of words){const next=cur?cur+' '+w:w;if(ctx.measureText(next).width>max&&cur){lines.push(cur);cur=w;}else cur=next;}lines.push(cur);ctx.textAlign='center';lines.forEach((l,i)=>ctx.fillText(l,x,y+(i-(lines.length-1)/2)*line));ctx.textAlign='left';}

module.exports={C,DISPLAY,LABEL,WHEEL,REDS,RANKS,createCanvas,spaced,roundRect,diamond,sparkle,heart,spade,club,star,suit,frame,heading,sweep,wheel,pocketAngle,card,chip,symbol,reel,tile,mineIcon,renderGame};
