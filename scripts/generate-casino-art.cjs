// Génère les visuels de présentation du casino QG (GIF et bannières) dans assets/casino/qg.
// Usage : node scripts/generate-casino-art.cjs — à relancer seulement pour modifier l'art.
// Les images des parties sont dessinées en direct par utils/qgCasinoDraw.js.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const ffmpeg=require('ffmpeg-static');
const d=require('../utils/qgCasinoDraw');
const {C,DISPLAY,LABEL,createCanvas,spaced,diamond,sparkle,frame,heading,sweep,wheel,pocketAngle,card,chip,reel,tile}=d;
const OUT=path.join(__dirname,'..','assets','casino','qg');
const W=960,H=320;
const ease=t=>1-Math.pow(1-Math.min(1,Math.max(0,t)),3);

function render(name,frames,fps,draw){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qgcasino-'));
 for(let f=0;f<frames;f++){const cv=createCanvas(W,H),ctx=cv.getContext('2d');draw(ctx,f,frames);fs.writeFileSync(path.join(dir,`f${String(f).padStart(3,'0')}.png`),cv.toBuffer('image/png'));}
 const target=path.join(OUT,name);
 if(frames===1)fs.writeFileSync(target,fs.readFileSync(path.join(dir,'f000.png')));
 else execFileSync(ffmpeg,['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(dir,'f%03d.png'),'-vf','split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle','-loop','0',target]);
 fs.rmSync(dir,{recursive:true,force:true});
 console.log(name,(fs.statSync(target).size/1024).toFixed(0)+' Ko');
}
const flash=(f,from)=>f>=from&&(f-from)%6<3;

fs.mkdirSync(OUT,{recursive:true});

// Accueil : titre balayé par la lumière, roue qui tourne, jetons et étincelles.
render('hero.gif',36,14,(ctx,f,n)=>{const t=f/n;frame(ctx,'運命の勝負');
 ctx.fillStyle=C.gold;ctx.font=`24px ${LABEL}`;spaced(ctx,'LE QG  ·  SALLE DE JEU',80,84,6);
 const tc=createCanvas(W,H),tx=tc.getContext('2d');tx.fillStyle=C.ink;tx.font=`112px ${DISPLAY}`;tx.fillText('CASINO',74,200);const w=tx.measureText('CASINO').width;sweep(tx,74,90,w,130,t);ctx.drawImage(tc,0,0);
 ctx.fillStyle=C.gold;ctx.fillRect(80,222,w-8,2);diamond(ctx,80+w+4,223,5,C.gold);
 ctx.fillStyle=C.ink;ctx.font=`24px ${LABEL}`;spaced(ctx,'SLOTS · ROULETTE · BLACKJACK · MINES',80,262,4);
 ctx.fillStyle=C.dim;ctx.font=`20px ${LABEL}`;spaced(ctx,'JETONS FICTIFS · 500 OFFERTS CHAQUE JOUR',80,288,3);
 const a=t*Math.PI*2;wheel(ctx,770,160,118,a,{a:-a*2-1,r:.86});
 chip(ctx,630,276,22,C.red);chip(ctx,664,288,16,C.black);chip(ctx,904,272,24,C.green);
 [[600,60,0],[915,58,.33],[680,120,.66],[900,170,.5]].forEach(([x,y,o])=>sparkle(ctx,x,y,11,Math.sin((t+o)*Math.PI*2)));
});

// Machines à sous : les rouleaux défilent puis s'arrêtent un par un sur 7 7 7.
render('slots.gif',42,16,(ctx,f)=>{frame(ctx,'大当たり');heading(ctx,'LE QG · CASINO','SLOTS','TRIPLE ×10 · PAIRE : MISE RENDUE');
 const stops=[14,20,26];
 for(let r=0;r<3;r++){const spinning=f<stops[r],top=(f*2+r*3)%6;
  reel(ctx,470+r*150,40,128,200,spinning?[top,(top+1)%6,(top+2)%6]:[(r+3)%6,0,(r+1)%6],spinning?((f*0.6)%1):0,!spinning&&f>=27,spinning);}
 ctx.strokeStyle=C.gold;ctx.globalAlpha=.7;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(452,140);ctx.lineTo(906,140);ctx.stroke();ctx.globalAlpha=1;
 if(f>=27){ctx.fillStyle=flash(f,27)?C.bright:C.gold;ctx.font=`28px ${DISPLAY}`;ctx.textAlign='center';ctx.fillText('JACKPOT ×10',689,282);ctx.textAlign='left';[[466,40],[906,48],[690,30]].forEach(([x,y],i)=>sparkle(ctx,x,y,14,flash(f+i*2,27)?1:.35));}
});

// Roulette : la roue ralentit, la bille spirale puis tombe sur le 17.
render('roulette.gif',46,16,(ctx,f)=>{frame(ctx,'回転');heading(ctx,'LE QG · CASINO','ROULETTE','COULEUR ×2 · NUMÉRO EXACT ×36');
 const t=ease(f/34),angle=t*Math.PI*5,target=pocketAngle(17,angle),landed=f>=34;
 wheel(ctx,740,160,124,angle,{a:landed?target:target-(1-t)*Math.PI*8,r:landed?.8:f<24?.98:.98-(f-24)/10*.18},landed?17:undefined);
 if(landed){ctx.fillStyle=flash(f,34)?C.bright:C.gold;ctx.font=`26px ${DISPLAY}`;ctx.fillText('17 ROUGE',80,286);}
});

// Blackjack : distribution, retournement de la carte cachée, as + roi = 21.
render('blackjack.gif',42,14,(ctx,f)=>{frame(ctx,'二十一');heading(ctx,'LE QG · CASINO','BLACKJACK','LA BANQUE RESTE À 17 · BLACKJACK ×2,5');
 const deal=[[590,34,'R',3,false],[690,34,'9',1,true],[560,162,'A',0,false],[660,162,'R',1,false]];
 ctx.fillStyle=C.dim;ctx.font=`20px ${LABEL}`;spaced(ctx,'BANQUE',906,64,3,'right');spaced(ctx,'TOI',906,192,3,'right');
 deal.forEach(([x,y,rank,s,down],i)=>{const t=ease((f-i*5)/6);if(t<=0)return;const sx=900,sy=-130;card(ctx,sx+(x-sx)*t,sy+(y-sy)*t,84,118,rank,s,down&&f<30,(1-t)*.6+(i%2?.05:-.05));});
 if(f>=24){ctx.save();ctx.translate(840,262);ctx.rotate(-.1);ctx.strokeStyle=flash(f,24)?C.bright:C.gold;ctx.lineWidth=3;ctx.strokeRect(-62,-24,124,48);ctx.fillStyle=ctx.strokeStyle;ctx.font=`30px ${DISPLAY}`;ctx.textAlign='center';ctx.fillText('21 !',0,11);ctx.restore();}
});

// Mines : les cases sûres se révèlent, le multiplicateur grimpe, puis encaissement.
render('mines.gif',44,12,(ctx,f)=>{frame(ctx,'地雷');heading(ctx,'LE QG · CASINO','MINES','16 CASES · 3 MINES · ENCAISSE QUAND TU VEUX');
 const order=[5,10,0,15,6,9],mines=[3,12,13],cashed=f>=order.length*5+4;
 const at=k=>{const i=order.indexOf(k);return i>-1&&f>=i*5+2;};
 for(let k=0;k<16;k++)tile(ctx,560+(k%4)*64,30+Math.floor(k/4)*64,56,at(k)?'safe':cashed&&mines.includes(k)?'mine':'hidden',String(k+1));
 const found=order.filter(k=>at(k)).length;let p=1;for(let i=0;i<found;i++)p*=(13-i)/(16-i);
 ctx.fillStyle=C.dim;ctx.font=`20px ${LABEL}`;spaced(ctx,'GAINS',830,196,3);ctx.fillStyle=cashed?C.greenLight:C.ink;ctx.font=`32px ${DISPLAY}`;ctx.fillText('×'+(found?(.95/p).toFixed(2):'1.00').replace('.',','),828,234);
 if(cashed){ctx.fillStyle=flash(f,order.length*5+4)?C.bright:C.gold;ctx.font=`22px ${LABEL}`;spaced(ctx,'ENCAISSÉ !',830,264,3);}
});

// Classement : couronne et podium avec reflet.
render('classement.gif',30,12,(ctx,f,n)=>{const t=f/n;frame(ctx,'番付');heading(ctx,'LE QG · CASINO','CLASSEMENT','LES 15 MEILLEURS SOLDES · EN DIRECT');
 const pc=createCanvas(W,H),px=pc.getContext('2d');[[640,190,'2'],[730,150,'1'],[820,210,'3']].forEach(([x,y,rank])=>{px.fillStyle=rank==='1'?C.gold:'#2a2620';px.fillRect(x,y,86,H-40-y);px.strokeStyle=C.gold;px.lineWidth=2;px.strokeRect(x,y,86,H-40-y);px.fillStyle=rank==='1'?'#0b0b0d':C.gold;px.font=`40px ${DISPLAY}`;px.textAlign='center';px.fillText(rank,x+43,y+52);});sweep(px,640,140,266,150,t);ctx.drawImage(pc,0,0);
 const cx=773,cy=96+Math.sin(t*Math.PI*2)*4;ctx.fillStyle=C.bright;ctx.beginPath();ctx.moveTo(cx-36,cy+20);ctx.lineTo(cx-40,cy-16);ctx.lineTo(cx-18,cy+2);ctx.lineTo(cx,cy-28);ctx.lineTo(cx+18,cy+2);ctx.lineTo(cx+40,cy-16);ctx.lineTo(cx+36,cy+20);ctx.closePath();ctx.fill();ctx.fillRect(cx-36,cy+24,72,7);[[-40,-16],[0,-28],[40,-16]].forEach(([dx,dy])=>diamond(ctx,cx+dx,cy+dy-4,5,C.red));
 [[650,80,0],[890,110,.4],[700,60,.7]].forEach(([x,y,o])=>sparkle(ctx,x,y,10,Math.sin((t+o)*Math.PI*2)));
});

// Animations d'attente des parties privées : aucun résultat affiché, le vrai tirage suit.
render('slots-spin.gif',12,16,(ctx,f)=>{frame(ctx,'大当たり');heading(ctx,'LE QG · CASINO','SLOTS','LES ROULEAUX TOURNENT…');
 for(let r=0;r<3;r++){const top=(f+r*2)%6;reel(ctx,470+r*150,40,128,200,[top,(top+1)%6,(top+2)%6],(f*0.5+r*.3)%1,false,true);}
});
render('roulette-spin.gif',24,16,(ctx,f,n)=>{frame(ctx,'回転');heading(ctx,'LE QG · CASINO','ROULETTE','LA BILLE EST LANCÉE…');
 const a=f/n*Math.PI*2;wheel(ctx,740,160,124,a,{a:-a*3,r:.98});});

// Règlement et support : bannières fixes.
render('reglement.png',1,1,ctx=>{frame(ctx,'規則');heading(ctx,'LE QG · CASINO','RÈGLEMENT','JEU RESPONSABLE · JETONS SANS VALEUR');
 [['A',0,-.28,600],['R',1,-.1,664],['D',2,.1,728],['V',3,.28,792]].forEach(([r,s,tilt,x])=>card(ctx,x,60+Math.abs(tilt)*80,96,136,r,s,false,tilt));chip(ctx,890,250,30,C.red);chip(ctx,852,270,24,C.black);});
render('support.png',1,1,ctx=>{frame(ctx,'相談');heading(ctx,'LE QG · CASINO','SUPPORT','UN TICKET PRIVÉ · UNE ÉQUIPE DÉDIÉE');
 chip(ctx,720,160,74,C.red);chip(ctx,830,120,46,C.black);chip(ctx,836,226,38,C.green);sparkle(ctx,640,80,14,1);sparkle(ctx,900,70,10,.8);});

