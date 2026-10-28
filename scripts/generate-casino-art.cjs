// Génère les visuels du casino QG (bannières et GIF animés) dans assets/casino/qg.
// Usage : node scripts/generate-casino-art.cjs — à relancer seulement pour modifier l'art.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {createCanvas}=require('@napi-rs/canvas');
const ffmpeg=require('ffmpeg-static');
const OUT=path.join(__dirname,'..','assets','casino','qg');
const W=960,H=320;
const C={bg:'#0b0b0d',ink:'#f2ede1',dim:'#6d6a63',gold:'#d4bd86',bright:'#f6e3ad',red:'#b8262f',black:'#18181b',green:'#1f6b45'};
const WHEEL=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const REDS=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const ease=t=>1-Math.pow(1-Math.min(1,Math.max(0,t)),3);

// Grain fixe : identique sur chaque image pour garder des GIF légers.
let seed=7;const rand=()=>(seed=(seed*16807)%2147483647)/2147483647;
const grain=createCanvas(W,H);{const g=grain.getContext('2d');for(let n=0;n<9000;n++){g.fillStyle=`rgba(242,237,225,${rand()*.05})`;g.fillRect(rand()*W,rand()*H,1+rand()*1.5,1+rand()*1.5);}}

function spaced(ctx,text,x,y,gap,align='left'){
 const widths=[...text].map(ch=>ctx.measureText(ch).width),total=widths.reduce((a,b)=>a+b,0)+gap*(text.length-1);
 let cx=align==='center'?x-total/2:align==='right'?x-total:x;
 [...text].forEach((ch,i)=>{ctx.fillText(ch,cx,y);cx+=widths[i]+gap;});
}
function diamond(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.fill();}
function sparkle(ctx,x,y,r,alpha){if(alpha<=0)return;ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=C.bright;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,v=i%2?r*.18:r;ctx.lineTo(x+Math.cos(a)*v,y+Math.sin(a)*v);}ctx.closePath();ctx.fill();ctx.restore();}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

// Cadre commun : fond noir, vignette, double filet or, idéogrammes verticaux.
function frame(ctx,kanji){
 ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);
 const v=ctx.createRadialGradient(W/2,H/2,60,W/2,H/2,W*.62);v.addColorStop(0,'rgba(212,189,134,0.10)');v.addColorStop(1,'rgba(0,0,0,0.55)');ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
 ctx.drawImage(grain,0,0);
 ctx.strokeStyle=C.gold;ctx.lineWidth=2;ctx.strokeRect(14,14,W-28,H-28);ctx.lineWidth=1;ctx.globalAlpha=.55;ctx.strokeRect(21,21,W-42,H-42);ctx.globalAlpha=1;
 for(const [x,y]of [[14,14],[W-14,14],[14,H-14],[W-14,H-14]])diamond(ctx,x,y,7,C.gold);
 if(kanji){ctx.font='600 20px "Yu Gothic"';ctx.fillStyle=C.gold;ctx.globalAlpha=.7;ctx.textAlign='center';[...kanji].forEach((k,i)=>ctx.fillText(k,44,70+i*26));ctx.globalAlpha=1;ctx.textAlign='left';}
}
function heading(ctx,small,big,sub,x=78,top=92,size=78){
 ctx.textBaseline='alphabetic';ctx.fillStyle=C.gold;ctx.font='600 16px "Gill Sans MT"';spaced(ctx,small,x,top,5);
 ctx.fillStyle=C.ink;ctx.font=`bold ${size}px "Bodoni MT"`;ctx.fillText(big,x-4,top+size+8);
 const w=ctx.measureText(big).width;ctx.fillStyle=C.gold;ctx.fillRect(x,top+size+26,Math.min(w,320),2);diamond(ctx,x+Math.min(w,320)+10,top+size+27,4,C.gold);
 if(sub){ctx.fillStyle=C.dim;ctx.font='15px "Gill Sans MT"';spaced(ctx,sub,x,top+size+58,3);}
 return w;
}
// Reflet lumineux qui balaie un titre.
function sweep(ctx,x,y,w,h,t){const px=x-120+(w+240)*t;const g=ctx.createLinearGradient(px-60,0,px+60,0);g.addColorStop(0,'rgba(246,227,173,0)');g.addColorStop(.5,'rgba(246,227,173,0.38)');g.addColorStop(1,'rgba(246,227,173,0)');ctx.save();ctx.globalCompositeOperation='source-atop';ctx.fillStyle=g;ctx.fillRect(x,y,w,h);ctx.restore();}

function wheel(ctx,cx,cy,r,angle,ball,result){
 ctx.save();ctx.fillStyle=C.gold;ctx.beginPath();ctx.arc(cx,cy,r+10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#2b241a';ctx.beginPath();ctx.arc(cx,cy,r+4,0,Math.PI*2);ctx.fill();
 const step=Math.PI*2/37;
 WHEEL.forEach((n,i)=>{const a=angle+i*step-Math.PI/2;ctx.fillStyle=n===0?C.green:REDS.has(n)?C.red:C.black;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,a,a+step);ctx.closePath();ctx.fill();
  ctx.save();ctx.translate(cx,cy);ctx.rotate(a+step/2+Math.PI/2);ctx.fillStyle=C.ink;ctx.font=`bold ${Math.round(r*.085)}px "Gill Sans MT"`;ctx.textAlign='center';ctx.fillText(String(n),0,-r*.84);ctx.restore();});
 ctx.strokeStyle=C.gold;ctx.lineWidth=1;for(let i=0;i<37;i++){const a=angle+i*step-Math.PI/2;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r*.62,cy+Math.sin(a)*r*.62);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.stroke();}
 const hub=ctx.createRadialGradient(cx-r*.1,cy-r*.1,2,cx,cy,r*.62);hub.addColorStop(0,'#3a3226');hub.addColorStop(1,'#0f0d0a');ctx.fillStyle=hub;ctx.beginPath();ctx.arc(cx,cy,r*.62,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle=C.gold;ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,r*.62,0,Math.PI*2);ctx.stroke();
 ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.fillStyle=C.gold;for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);ctx.fillRect(-3,-r*.42,6,r*.42);}ctx.beginPath();ctx.arc(0,0,r*.1,0,Math.PI*2);ctx.fill();ctx.restore();
 if(result!==undefined){ctx.fillStyle='#0f0d0a';ctx.beginPath();ctx.arc(cx,cy,r*.3,0,Math.PI*2);ctx.fill();ctx.strokeStyle=C.gold;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=REDS.has(result)?'#e0525b':result===0?'#3fae75':C.ink;ctx.font=`bold ${Math.round(r*.3)}px "Bodoni MT"`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(result),cx,cy+2);ctx.textBaseline='alphabetic';ctx.textAlign='left';}
 if(ball!==null){const br=r*.9;ctx.fillStyle='#ffffff';ctx.shadowColor='rgba(255,255,255,.6)';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(cx+Math.cos(ball.a)*ball.r*br,cy+Math.sin(ball.a)*ball.r*br,r*.045,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
 ctx.restore();
}
const SUITS=['♠','♥','♦','♣'];
function card(ctx,x,y,w,h,rank,suit,down,tilt=0){
 ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(tilt);ctx.translate(-w/2,-h/2);
 ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=14;ctx.shadowOffsetY=6;roundRect(ctx,0,0,w,h,9);ctx.fillStyle=down?'#141210':C.ink;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 ctx.strokeStyle=C.gold;ctx.lineWidth=2;roundRect(ctx,0,0,w,h,9);ctx.stroke();
 if(down){ctx.strokeStyle=C.gold;ctx.globalAlpha=.45;ctx.lineWidth=1;for(let i=-h;i<w+h;i+=12){ctx.beginPath();ctx.moveTo(i,6);ctx.lineTo(i+h,h-6);ctx.stroke();ctx.beginPath();ctx.moveTo(i+h,6);ctx.lineTo(i,h-6);ctx.stroke();}ctx.globalAlpha=1;diamond(ctx,w/2,h/2,12,C.gold);}
 else{const red=suit===1||suit===2;ctx.fillStyle=red?C.red:'#111';ctx.font=`bold ${Math.round(w*.26)}px "Bodoni MT"`;ctx.fillText(rank,8,w*.3);ctx.font=`${Math.round(w*.2)}px "Segoe UI Symbol"`;ctx.fillText(SUITS[suit],9,w*.52);ctx.font=`${Math.round(w*.55)}px "Segoe UI Symbol"`;ctx.textAlign='center';ctx.fillText(SUITS[suit],w/2,h*.7);ctx.textAlign='left';}
 ctx.restore();
}
function chip(ctx,x,y,r,color=C.red){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle=C.ink;ctx.lineWidth=r*.22;ctx.setLineDash([r*.38,r*.38]);ctx.beginPath();ctx.arc(x,y,r*.84,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle=C.gold;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,r*.56,0,Math.PI*2);ctx.stroke();diamond(ctx,x,y,r*.25,C.gold);}

function render(name,frames,fps,draw){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qgcasino-'));
 for(let f=0;f<frames;f++){const cv=createCanvas(W,H),ctx=cv.getContext('2d');draw(ctx,f,frames);fs.writeFileSync(path.join(dir,`f${String(f).padStart(3,'0')}.png`),cv.toBuffer('image/png'));}
 const target=path.join(OUT,name);
 if(frames===1)fs.copyFileSync(path.join(dir,'f000.png'),target);
 else execFileSync(ffmpeg,['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(dir,'f%03d.png'),'-vf','split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle','-loop','0',target]);
 fs.rmSync(dir,{recursive:true,force:true});
 console.log(name,(fs.statSync(target).size/1024).toFixed(0)+' Ko');
}

fs.mkdirSync(OUT,{recursive:true});

// Accueil : titre balayé par la lumière, roue qui tourne, jetons et étincelles.
render('hero.gif',36,14,(ctx,f,n)=>{const t=f/n;frame(ctx,'運命の勝負');
 ctx.font='bold 112px "Bodoni MT"';const w=ctx.measureText('CASINO').width;
 ctx.fillStyle=C.gold;ctx.font='600 18px "Gill Sans MT"';spaced(ctx,'LE QG  ·  SALLE DE JEU',80,84,6);
 const tc=createCanvas(W,H),tx=tc.getContext('2d');tx.fillStyle=C.ink;tx.font='bold 112px "Bodoni MT"';tx.fillText('CASINO',74,196);sweep(tx,74,90,w,120,t);ctx.drawImage(tc,0,0);
 ctx.fillStyle=C.gold;ctx.fillRect(80,218,w-8,2);diamond(ctx,80+w+4,219,5,C.gold);
 ctx.fillStyle=C.ink;ctx.font='16px "Gill Sans MT"';spaced(ctx,'MACHINES À SOUS · ROULETTE · BLACKJACK · MINES',80,256,3);
 ctx.fillStyle=C.dim;ctx.font='14px "Gill Sans MT"';spaced(ctx,'JETONS FICTIFS · 500 OFFERTS CHAQUE JOUR',80,282,3);
 const a=t*Math.PI*2;wheel(ctx,770,160,118,a,{a:-a*2-1,r:.86},undefined);
 chip(ctx,664,280,22,C.red);chip(ctx,698,292,16,C.black);chip(ctx,902,272,24,C.green);
 [[600,60,0],[915,58,.33],[680,120,.66],[900,170,.5]].forEach(([x,y,o])=>sparkle(ctx,x,y,11,Math.sin((t+o)*Math.PI*2)));
});

// Machines à sous : rouleaux qui défilent puis s'arrêtent sur 7 7 7.
const SYMBOLS=['7','★','♦','♠','♥','♣'];
render('slots.gif',40,16,(ctx,f,n)=>{frame(ctx,'大当たり');heading(ctx,'LE QG · CASINO','SLOTS','TRIPLE : ×10 · PAIRE : MISE RENDUE');
 const stops=[14,20,26];
 for(let r=0;r<3;r++){const x=470+r*150,y=60,w=128,h=200;
  roundRect(ctx,x,y,w,h,12);ctx.fillStyle='#16130f';ctx.fill();ctx.strokeStyle=C.gold;ctx.lineWidth=2;ctx.stroke();
  ctx.save();roundRect(ctx,x+4,y+4,w-8,h-8,10);ctx.clip();
  const spinning=f<stops[r],offset=spinning?(f*37+r*23)%60/60:0;
  for(let k=-1;k<=1;k++){const sym=spinning?SYMBOLS[(f*2+r*3+k+6)%6]:k===0?'7':SYMBOLS[(r+k+7)%6];const sy=y+h/2+k*76+offset*76;const center=k===0&&!spinning;
   ctx.globalAlpha=center?1:.35;ctx.fillStyle=sym==='7'?(center?C.bright:C.gold):sym==='♥'||sym==='♦'?C.red:C.ink;ctx.font=sym==='7'?'bold 76px "Bodoni MT"':'60px "Segoe UI Symbol"';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(sym,x+w/2,sy);}
  if(spinning){ctx.globalAlpha=.5;ctx.fillStyle='#16130f';ctx.fillRect(x,y,w,h);}
  ctx.restore();ctx.globalAlpha=1;ctx.textAlign='left';ctx.textBaseline='alphabetic';}
 ctx.strokeStyle=C.gold;ctx.globalAlpha=.6;ctx.beginPath();ctx.moveTo(460,160);ctx.lineTo(908,160);ctx.stroke();ctx.globalAlpha=1;
 if(f>=27){const on=(f-27)%4<2;ctx.fillStyle=on?C.bright:C.gold;ctx.font='bold 26px "Bodoni MT"';ctx.textAlign='center';spaced(ctx,'JACKPOT ×10',689,296,6,'center');ctx.textAlign='left';[[470,56],[908,64],[690,48]].forEach(([x,y],i)=>sparkle(ctx,x,y,14,on===!(i%2)?1:.3));}
});

// Roulette : la roue ralentit, la bille tombe sur le 17.
render('roulette.gif',44,16,(ctx,f,n)=>{frame(ctx,'回転');heading(ctx,'LE QG · CASINO','ROULETTE','ROUGE · NOIR · PAIR · IMPAIR · ×2 — NUMÉRO · ×36');
 const t=ease(f/34),index=WHEEL.indexOf(17),step=Math.PI*2/37;const angle=t*Math.PI*5;
 const pocket=angle+index*step+step/2-Math.PI/2;
 const ballR=f<26?.98:f<34?.98-(f-26)/8*.2:.78;
 wheel(ctx,740,160,124,angle,{a:f<34?pocket-(1-t)*Math.PI*8:pocket,r:ballR},f>=34?17:undefined);
 if(f>=34){ctx.fillStyle=C.bright;ctx.font='bold 22px "Bodoni MT"';spaced(ctx,'RÉSULTAT : 17 ROUGE',80,276,4);}
});

// Blackjack : distribution, retournement de la carte du croupier, 21.
render('blackjack.gif',40,14,(ctx,f,n)=>{frame(ctx,'二十一');heading(ctx,'LE QG · CASINO','BLACKJACK','LE CROUPIER RESTE À 17 · BLACKJACK ×2,5');
 const deal=[[600,40,'R',3,false],[700,40,'9',1,true],[560,150,'A',0,false],[660,150,'R',1,false]];
 ctx.fillStyle=C.dim;ctx.font='13px "Gill Sans MT"';spaced(ctx,'BANQUE',870,70,3,'right');spaced(ctx,'TOI',870,182,3,'right');
 deal.forEach(([x,y,rank,suit,down],i)=>{const t=ease((f-i*5)/6);if(t<=0)return;const sx=900,sy=-120;card(ctx,sx+(x-sx)*t,sy+(y-sy)*t,88,124,rank,suit,down&&f<30,(1-t)*.6+(i%2?.05:-.05));});
 if(f>=24){const on=(f-24)%6<3;ctx.save();ctx.translate(800,250);ctx.rotate(-.12);ctx.strokeStyle=on?C.bright:C.gold;ctx.lineWidth=3;ctx.strokeRect(-70,-22,140,44);ctx.fillStyle=on?C.bright:C.gold;ctx.font='bold 28px "Bodoni MT"';ctx.textAlign='center';ctx.fillText('21 !',0,10);ctx.restore();}
});

// Mines : les cases se découvrent, encaissement avant la mine.
render('mines.gif',42,12,(ctx,f,n)=>{frame(ctx,'地雷');heading(ctx,'LE QG · CASINO','MINES','16 CASES · 3 MINES · ENCAISSE QUAND TU VEUX');
 const order=[5,10,0,15,6,9],mines=[3,12,13];let cashed=f>=order.length*5+4;
 for(let k=0;k<16;k++){const x=560+(k%4)*66,y=34+Math.floor(k/4)*64,open=order.indexOf(k)>-1&&f>=order.indexOf(k)*5+2,mine=cashed&&mines.includes(k);
  roundRect(ctx,x,y,58,56,8);ctx.fillStyle=open?'#1d1a14':'#141416';ctx.fill();ctx.strokeStyle=open?C.gold:'#34322d';ctx.lineWidth=open?2:1;ctx.stroke();
  if(open){const pop=Math.min(1,(f-order.indexOf(k)*5-2)/3);diamond(ctx,x+29,y+28,14*pop,C.bright);diamond(ctx,x+29,y+28,7*pop,'#fff');}
  else if(mine){ctx.globalAlpha=.8;ctx.fillStyle=C.red;ctx.beginPath();ctx.arc(x+29,y+28,11,0,Math.PI*2);ctx.fill();ctx.fillRect(x+27,y+12,4,32);ctx.fillRect(x+13,y+26,32,4);ctx.globalAlpha=1;}}
 const found=order.filter((k,i)=>f>=i*5+2).length;let p=1;for(let i=0;i<found;i++)p*=(13-i)/(16-i);
 ctx.fillStyle=C.dim;ctx.font='13px "Gill Sans MT"';spaced(ctx,'GAINS',838,200,3);ctx.fillStyle=cashed?C.bright:C.ink;ctx.font='bold 30px "Bodoni MT"';ctx.fillText('×'+(found?(.95/p).toFixed(2):'1.00'),838,236);
 if(cashed){ctx.fillStyle=C.gold;ctx.font='600 14px "Gill Sans MT"';spaced(ctx,'ENCAISSÉ',838,262,3);}
});

// Classement : couronne et podium avec reflet.
render('classement.gif',30,12,(ctx,f,n)=>{const t=f/n;frame(ctx,'番付');heading(ctx,'LE QG · CASINO','CLASSEMENT','LES 15 MEILLEURS SOLDES · EN DIRECT');
 const podium=[[640,190,'2'],[730,150,'1'],[820,210,'3']];
 const pc=createCanvas(W,H),px=pc.getContext('2d');podium.forEach(([x,y,rank])=>{px.fillStyle=rank==='1'?C.gold:'#2a2620';px.fillRect(x,y,86,H-40-y);px.strokeStyle=C.gold;px.lineWidth=2;px.strokeRect(x,y,86,H-40-y);px.fillStyle=rank==='1'?'#0b0b0d':C.gold;px.font='bold 40px "Bodoni MT"';px.textAlign='center';px.fillText(rank,x+43,y+52);});sweep(px,640,140,266,150,t);ctx.drawImage(pc,0,0);
 const bob=Math.sin(t*Math.PI*2)*4;ctx.fillStyle=C.bright;ctx.beginPath();const cx=773,cy=96+bob;ctx.moveTo(cx-36,cy+20);ctx.lineTo(cx-40,cy-16);ctx.lineTo(cx-18,cy+2);ctx.lineTo(cx,cy-28);ctx.lineTo(cx+18,cy+2);ctx.lineTo(cx+40,cy-16);ctx.lineTo(cx+36,cy+20);ctx.closePath();ctx.fill();ctx.fillRect(cx-36,cy+24,72,7);[[-40,-16],[0,-28],[40,-16]].forEach(([dx,dy])=>diamond(ctx,cx+dx,cy+dy-4,5,C.red));
 [[650,80,0],[890,110,.4],[700,60,.7]].forEach(([x,y,o])=>sparkle(ctx,x,y,10,Math.sin((t+o)*Math.PI*2)));
});

// Animations d'attente des parties privées : aucun résultat affiché, le vrai tirage suit.
render('slots-spin.gif',12,16,(ctx,f)=>{frame(ctx,'大当たり');heading(ctx,'LE QG · CASINO','SLOTS','LES ROULEAUX TOURNENT…');
 for(let r=0;r<3;r++){const x=470+r*150,y=60,w=128,h=200;roundRect(ctx,x,y,w,h,12);ctx.fillStyle='#16130f';ctx.fill();ctx.strokeStyle=C.gold;ctx.lineWidth=2;ctx.stroke();
  ctx.save();roundRect(ctx,x+4,y+4,w-8,h-8,10);ctx.clip();const offset=((f*5+r*3)%12)/12;
  for(let k=-2;k<=1;k++){const sym=SYMBOLS[(k+r*2+12-Math.floor((f*5+r*3)/12))%6];ctx.globalAlpha=.55;ctx.fillStyle=sym==='7'?C.gold:sym==='♥'||sym==='♦'?C.red:C.ink;ctx.font=sym==='7'?'bold 76px "Bodoni MT"':'60px "Segoe UI Symbol"';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(sym,x+w/2,y+h/2+(k+offset)*76);}
  ctx.restore();ctx.globalAlpha=1;ctx.textAlign='left';ctx.textBaseline='alphabetic';}
});
render('roulette-spin.gif',24,16,(ctx,f,n)=>{frame(ctx,'回転');heading(ctx,'LE QG · CASINO','ROULETTE','LA BILLE EST LANCÉE…');
 const a=f/n*Math.PI*2*(37/37);wheel(ctx,740,160,124,a,{a:-a*3,r:.98},undefined);});

// Règlement et support : bannières fixes.
render('reglement.png',1,1,ctx=>{frame(ctx,'規則');heading(ctx,'LE QG · CASINO','RÈGLEMENT','JEU RESPONSABLE · JETONS SANS VALEUR MONÉTAIRE');
 [['A',0,-.28,600],['R',1,-.1,660],['D',2,.1,720],['V',3,.28,780]].forEach(([r,s,tilt,x])=>card(ctx,x,70+Math.abs(tilt)*80,96,136,r,s,false,tilt));chip(ctx,880,250,30,C.red);chip(ctx,846,268,24,C.black);});
render('support.png',1,1,ctx=>{frame(ctx,'相談');heading(ctx,'LE QG · CASINO','SUPPORT','UN TICKET PRIVÉ · UNE ÉQUIPE DÉDIÉE');
 chip(ctx,720,160,74,C.red);chip(ctx,830,120,46,C.black);chip(ctx,836,226,38,C.green);sparkle(ctx,640,80,14,1);sparkle(ctx,900,70,10,.8);});
