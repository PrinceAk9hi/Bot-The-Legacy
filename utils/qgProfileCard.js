// Carte de membre du QG façon une de journal ancien : papier vieilli, manchette gothique,
// portrait en similigravure (trame de points), article rédigé à partir des statistiques et tampon du grade.
// Polices libres embarquées (assets/fonts, licence OFL) : rendu identique sur Railway et en local.
const {createCanvas,loadImage,FRAKTUR,SERIF,BOLD,ITALIC,DISPLAY,INK,SOFT,RED,fr,hours,plural,fit,sizeTo,spaced,rule,diamond,paper,aging,stamp}=require('./qgJournalDraw');
const W=1000,H=660;

// ---- Portrait en similigravure ----
function portrait(ctx,image,initial,x,y,w,h){
 const off=createCanvas(w,h),o=off.getContext('2d');
 if(image){const s=Math.max(w/image.width,h/image.height);o.fillStyle='#fff';o.fillRect(0,0,w,h);o.drawImage(image,(w-image.width*s)/2,(h-image.height*s)/2,image.width*s,image.height*s);}
 else{// Silhouette de remplacement
  const g=o.createLinearGradient(0,0,0,h);g.addColorStop(0,'#d8d8d8');g.addColorStop(1,'#9a9a9a');o.fillStyle=g;o.fillRect(0,0,w,h);
  o.fillStyle='#3a3a3a';o.beginPath();o.arc(w/2,h*.4,h*.2,0,Math.PI*2);o.fill();o.beginPath();o.ellipse(w/2,h*1.02,w*.38,h*.38,0,Math.PI,0);o.fill();
  o.fillStyle='#e8e8e8';o.font=`${Math.round(h*.18)}px ${DISPLAY}`;o.textAlign='center';o.fillText(initial,w/2,h*.47);
 }
 const d=o.getImageData(0,0,w,h).data,cell=5;
 ctx.fillStyle='#e6dabd';ctx.fillRect(x,y,w,h);ctx.fillStyle=INK;
 for(let cy=0;cy<h;cy+=cell)for(let cx=0;cx<w;cx+=cell){
  let sum=0,n=0;for(let yy=cy;yy<Math.min(cy+cell,h);yy++)for(let xx=cx;xx<Math.min(cx+cell,w);xx++){const i=(yy*w+xx)*4,alpha=d[i+3]/255;sum+=(.299*d[i]+.587*d[i+1]+.114*d[i+2])*alpha+255*(1-alpha);n++;}
  const l=Math.min(1,Math.max(0,(sum/n/255-.5)*1.25+.5)),r=Math.sqrt(1-l)*cell*.62;
  if(r>.35){ctx.beginPath();ctx.arc(x+cx+cell/2,y+cy+cell/2,r,0,Math.PI*2);ctx.fill();}
 }
 ctx.strokeStyle=INK;ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);ctx.lineWidth=.8;ctx.strokeRect(x-5,y-5,w+10,h+10);
}


// ---- Texte justifié avec lettrine ----
function words(text){return String(text).split(/\s+/).filter(Boolean);}
function lines(ctx,list,width,first,indent,dropLines){const out=[];let n=0;list=[...list];while(list.length){const offset=n<dropLines?indent:(!first&&n===0?14:0),max=width-offset,take=[];while(list.length&&ctx.measureText([...take,list[0]].join(' ')).width<=max)take.push(list.shift());if(!take.length)take.push(list.shift());out.push({take,offset,max,last:!list.length});n++;}return out;}
function layout(ctx,paragraphs,x,y,width,bottom,line){
 let cy=y;
 for(const [pi,para] of paragraphs.entries()){
  const list=words(para);let indent=0,dropLines=0,letter=null;
  if(pi===0){letter=list[0][0];list[0]=list[0].slice(1);ctx.font=`62px ${DISPLAY}`;indent=ctx.measureText(letter).width+8;dropLines=3;}
  ctx.font=`15px ${SERIF}`;
  const rows=lines(ctx,list,width,pi===0,indent,dropLines);
  if(cy+Math.max(rows.length,dropLines)*line>bottom)break;
  ctx.fillStyle=INK;
  if(letter){ctx.font=`62px ${DISPLAY}`;ctx.fillText(letter,x,cy+line*2+4);ctx.font=`15px ${SERIF}`;}
  for(const r of rows){const gaps=r.take.length-1;if(r.last||!gaps)ctx.fillText(r.take.join(' '),x+r.offset,cy+line-4);else{let cx=x+r.offset;const gap=(r.max-ctx.measureText(r.take.join('')).width)/gaps;for(const w of r.take){ctx.fillText(w,cx,cy+line-4);cx+=ctx.measureText(w).width+gap;}}cy+=line;}
  cy=Math.max(cy,y+dropLines*line)+6;
 }
 return cy;
}

function article(p){
 const name=p.name,paras=[];
 paras.push(`${name} ${p.days!==null?`a rejoint le QG il y a ${plural(p.days,'jour')}`:'fait partie du QG'} et porte aujourd’hui le titre de ${p.title}.`);
 paras.push(p.weekMessages||p.weekVoice?`Cette semaine, la rédaction a relevé ${plural(p.weekMessages,'message')} et ${hours(p.weekVoice)} en vocal${p.voiceTotal?`, soit ${hours(p.voiceTotal)} au total depuis le début du suivi`:''}.`:`Semaine discrète : aucun message ni passage en vocal relevé par la rédaction ces sept derniers jours.`);
 paras.push(p.position?`Au classement de l’activité, ${name} occupe la ${p.position===1?'1re':p.position+'e'} place avec ${fr(p.xp)} points d’expérience.`:`${name} n’apparaît pas encore au classement de l’activité.`);
 paras.push(p.casino?`Au casino, ${plural(p.casino.played,'partie')} au compteur ; le portefeuille affiche ${plural(p.casino.balance,'jeton')}.`:`Aucune partie au casino pour l’instant : la table attend toujours.`);
 return paras;
}

async function render(p){
 const cv=createCanvas(W,H),ctx=cv.getContext('2d');paper(ctx);
 let image=null;if(p.avatar)try{image=await loadImage(p.avatar);}catch{}
 const date=new Date(p.now||Date.now()).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Paris'}).toUpperCase();
 ctx.textBaseline='alphabetic';
 // Oreilles de part et d'autre de la manchette
 for(const [x,a,b]of [[30,'ÉDITION SPÉCIALE','Portrait de membre'],[W-180,'N° '+String(p.days??0).padStart(3,'0'),'Prix : 1 crédit']]){
  ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.strokeRect(x,28,150,60);ctx.strokeRect(x+3,31,144,54);
  ctx.textAlign='center';ctx.fillStyle=INK;ctx.font=`13px ${BOLD}`;spaced(ctx,a,x+75,54,1.2);ctx.font=`14px ${ITALIC}`;ctx.fillText(b,x+75,74);ctx.textAlign='left';
 }
 ctx.textAlign='center';ctx.fillStyle=INK;sizeTo(ctx,'Le Journal du QG',W-400,78,FRAKTUR,48);ctx.fillText('Le Journal du QG',W/2,96);
 rule(ctx,30,W-30,112,3);rule(ctx,30,W-30,118,1);
 ctx.font=`13px ${SERIF}`;spaced(ctx,'LE QG  —  '+date+'  —  ÉDITION DU SOIR',W/2,137,1.6);
 rule(ctx,30,W-30,146,1);
 // Gros titre
 ctx.font=`17px ${ITALIC}`;ctx.fillText('— Portrait exclusif —',W/2,174);
 const head=String(p.name).toUpperCase();sizeTo(ctx,head,W-90,74,DISPLAY,34);ctx.fillText(fit(ctx,head,W-90),W/2,244);
 ctx.font=`20px ${ITALIC}`;ctx.fillStyle=SOFT;
 ctx.fillText(fit(ctx,`${p.title}${/QG/.test(p.title)?'':' du QG'}${p.days!==null?' depuis '+plural(p.days,'jour'):''}${p.position?', classé n°'+p.position+' du serveur':''}`,W-120),W/2,276);
 ctx.textAlign='left';rule(ctx,30,W-30,292,1);rule(ctx,30,W-30,296,1);
 // Colonnes
 const top=312,bottom=612;
 for(const x of [350,668]){ctx.fillStyle='rgba(29,26,22,0.55)';ctx.fillRect(x,top,1,bottom-top);}
 // Colonne 1 : portrait et légende
 portrait(ctx,image,[...String(p.name||'?')][0].toUpperCase(),44,top+6,292,262);
 ctx.font=`14px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText(fit(ctx,`Portrait de ${p.name}${p.roblox?' · Roblox : '+p.roblox:', au QG'}.`,292),44,top+290);
 stamp(ctx,String(p.title).toUpperCase(),190,top+216,-.14);
 // Colonne 2 : l'article
 ctx.fillStyle=INK;ctx.font=`24px ${DISPLAY}`;ctx.fillText('Une semaine au QG',366,top+24);
 ctx.font=`13px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText('Par la rédaction',366,top+44);
 layout(ctx,article(p),366,top+52,288,bottom,18);
 // Colonne 3 : niveau, casino, distinctions
 const X=684,CW=W-36-X;ctx.textAlign='center';
 ctx.strokeStyle=INK;ctx.lineWidth=1.5;ctx.strokeRect(X,top+4,CW,128);ctx.lineWidth=.8;ctx.strokeRect(X+4,top+8,CW-8,120);
 ctx.fillStyle=INK;ctx.font=`13px ${BOLD}`;spaced(ctx,'—  NIVEAU  —',X+CW/2,top+30,2);
 ctx.font=`58px ${DISPLAY}`;ctx.fillText(String(p.level),X+CW/2,top+86);
 const into=p.xp-p.current,need=Math.max(1,p.next-p.current),ratio=Math.max(0,Math.min(1,into/need)),N=17;
 for(let n=0;n<N;n++){const dx=X+CW/2+(n-(N-1)/2)*14;if(n<Math.round(ratio*N))diamond(ctx,dx,top+102,5.5);else{ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(dx,top+96.5);ctx.lineTo(dx+4.1,top+102);ctx.lineTo(dx,top+107.5);ctx.lineTo(dx-4.1,top+102);ctx.closePath();ctx.stroke();}}
 ctx.font=`13px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText(`encore ${fr(need-into)} XP pour le niveau ${p.level+1}`,X+CW/2,top+124);
 // La cote du casino
 let y=top+152;ctx.fillStyle=INK;ctx.font=`13px ${BOLD}`;spaced(ctx,'LA COTE DU CASINO',X+CW/2,y,2);rule(ctx,X+30,X+CW-30,y+8,1);
 if(p.casino){const net=p.casino.returned-p.casino.wagered;
  ctx.font=`30px ${DISPLAY}`;ctx.fillText(fr(p.casino.balance),X+CW/2,y+42);ctx.font=`14px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText(`jetons · ${plural(p.casino.played,'partie')} · net ${net>0?'+':''}${fr(net)}`,X+CW/2,y+60);}
 else{ctx.font=`15px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText('Cotation suspendue : aucune partie.',X+CW/2,y+42);}
 // Distinctions
 y=top+238;ctx.fillStyle=INK;ctx.font=`13px ${BOLD}`;spaced(ctx,'DISTINCTIONS',X+CW/2,y,2);rule(ctx,X+30,X+CW-30,y+8,1);ctx.textAlign='left';
 const list=p.badges.slice(0,3);ctx.font=`16px ${ITALIC}`;
 if(!list.length){ctx.fillStyle=SOFT;ctx.textAlign='center';ctx.fillText('Aucune pour l’instant.',X+CW/2,y+30);ctx.textAlign='left';}
 list.forEach((b,i)=>{diamond(ctx,X+22,y+25+i*20,4.5);ctx.fillStyle=INK;ctx.fillText(fit(ctx,b,CW-50),X+34,y+30+i*20);});
 // Pied de page
 rule(ctx,30,W-30,624,1);ctx.font=`12px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.textAlign='center';ctx.fillText('Imprimé par la Direction du QG  ·  Toute reproduction sans tampon officiel est interdite  ·  Suite en page 2',W/2,644);ctx.textAlign='left';
 aging(ctx);
 return cv.toBuffer('image/png');
}
module.exports={render,article,portrait};
