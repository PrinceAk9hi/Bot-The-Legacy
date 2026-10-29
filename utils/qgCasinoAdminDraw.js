// Images du centre d'administration du casino QG (tableau de bord et fiche joueur), style noir et or.
const {C,DISPLAY,LABEL,createCanvas,spaced,roundRect,diamond,frame}=require('./qgCasinoDraw');
const KINDS=['slots','roulette','blackjack','mines'];
const NAMES={slots:'MACHINES À SOUS',roulette:'ROULETTE',blackjack:'BLACKJACK',mines:'MINES'};

// 1 234 / 45,3 k / 1,2 M : lisible dans une tuile étroite.
function compact(n){const abs=Math.abs(n),sign=n<0?'-':'';if(abs>=1e6)return sign+(abs/1e6).toFixed(abs>=1e7?0:1).replace('.',',')+' M';if(abs>=1e4)return sign+(abs/1e3).toFixed(abs>=1e5?0:1).replace('.',',')+' k';return sign+abs.toLocaleString('fr-FR');}
function fit(ctx,text,max){let t=String(text);while(t.length>1&&ctx.measureText(t).width>max)t=t.slice(0,-1);return t===String(text)?t:t.slice(0,-1)+'…';}

function tile(ctx,x,y,w,h,label,value,sub,color=C.ink){
 ctx.fillStyle='rgba(20,19,17,0.92)';roundRect(ctx,x,y,w,h,10);ctx.fill();
 ctx.strokeStyle='rgba(212,189,134,0.45)';ctx.lineWidth=1;roundRect(ctx,x+.5,y+.5,w-1,h-1,10);ctx.stroke();
 ctx.fillStyle=C.gold;ctx.font=`17px ${LABEL}`;spaced(ctx,label,x+14,y+26,2);
 let size=40;ctx.font=`${size}px ${LABEL}`;while(size>22&&ctx.measureText(value).width>w-24)ctx.font=`${size-=2}px ${LABEL}`;
 ctx.fillStyle=color;ctx.fillText(fit(ctx,value,w-24),x+14,y+68);
 if(sub){ctx.fillStyle=C.dim;ctx.font=`16px ${LABEL}`;spaced(ctx,fit(ctx,sub,w-40),x+14,y+h-12,1);}
}
function pill(ctx,x,y,text,color){
 ctx.font=`18px ${LABEL}`;const w=ctx.measureText(text).width+text.length*2+44;
 ctx.fillStyle=color;roundRect(ctx,x-w,y,w,30,15);ctx.fill();
 ctx.fillStyle=C.bg;ctx.beginPath();ctx.arc(x-w+17,y+15,5,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=C.bg;spaced(ctx,text,x-w+30,y+22,2);
}

// Tableau de bord : indicateurs, résultat par jeu et meilleurs soldes.
function renderDashboard({players,circulation,wagered,returned,played,active,frozen,open,byKind,top,updatedAt}){
 const W=960,H=420,cv=createCanvas(W,H),ctx=cv.getContext('2d');frame(ctx);
 ctx.fillStyle=C.gold;ctx.font=`20px ${LABEL}`;spaced(ctx,'LE QG · CASINO · ADMINISTRATION',48,62,4);
 ctx.fillStyle=C.ink;ctx.font=`44px ${DISPLAY}`;ctx.fillText('Salle des coffres',46,112);
 ctx.fillStyle=C.gold;ctx.fillRect(48,126,250,2);diamond(ctx,306,127,5,C.gold);
 pill(ctx,W-44,44,open?'MISES OUVERTES':'MISES SUSPENDUES',open?C.greenLight:C.redLight);
 ctx.fillStyle=C.dim;ctx.font=`17px ${LABEL}`;ctx.textAlign='right';ctx.fillText('MIS À JOUR '+new Date(updatedAt).toLocaleString('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}),W-46,100);ctx.textAlign='left';
 const house=wagered-returned,edge=wagered?house/wagered*100:0;
 const tiles=[['JOUEURS',compact(players),frozen?frozen+' gelé(s)':'aucun gel',C.ink],['EN CIRCULATION',compact(circulation),'jetons',C.bright],['TOTAL MISÉ',compact(wagered),compact(returned)+' rendus',C.ink],['MARGE MAISON',(house>=0?'+':'')+compact(house),edge.toFixed(1).replace('.',',')+' % des mises',house>=0?C.greenLight:C.redLight],['PARTIES',compact(played),active+' en cours',C.ink]];
 const tw=(W-96-4*10)/5;tiles.forEach(([l,v,s,c],i)=>tile(ctx,48+i*(tw+10),146,tw,100,l,v,s,c));
 // Résultat de la maison par jeu
 ctx.fillStyle=C.gold;ctx.font=`18px ${LABEL}`;spaced(ctx,'PAR JEU · PARTIES ET MARGE',48,284,3);
 const maxPlayed=Math.max(1,...KINDS.map(k=>byKind[k]?.played||0));
 KINDS.forEach((k,i)=>{const s=byKind[k]||{played:0,wagered:0,returned:0},y=300+i*26,net=s.wagered-s.returned;
  ctx.fillStyle=C.ink;ctx.font=`17px ${LABEL}`;spaced(ctx,NAMES[k],48,y+15,1);
  ctx.fillStyle='rgba(212,189,134,0.15)';roundRect(ctx,200,y+3,240,14,7);ctx.fill();
  ctx.fillStyle=C.gold;roundRect(ctx,200,y+3,Math.max(14,240*s.played/maxPlayed),14,7);ctx.fill();
  ctx.fillStyle=C.dim;ctx.fillText(compact(s.played),452,y+15);
  ctx.fillStyle=net>=0?C.greenLight:C.redLight;ctx.textAlign='right';ctx.fillText((net>=0?'+':'')+compact(net),560,y+15);ctx.textAlign='left';
 });
 // Meilleurs soldes
 ctx.fillStyle=C.gold;ctx.font=`18px ${LABEL}`;spaced(ctx,'MEILLEURS SOLDES',600,284,3);
 if(!top.length){ctx.fillStyle=C.dim;ctx.font=`17px ${LABEL}`;ctx.fillText('AUCUN JOUEUR POUR LE MOMENT',600,316);}
 top.slice(0,4).forEach(([name,balance],i)=>{const y=300+i*26;
  ctx.fillStyle=i===0?C.bright:C.gold;ctx.font=`17px ${LABEL}`;ctx.fillText(String(i+1).padStart(2,'0'),600,y+15);
  ctx.fillStyle=C.ink;ctx.fillText(fit(ctx,String(name).toUpperCase(),190),632,y+15);
  ctx.fillStyle=C.bright;ctx.textAlign='right';ctx.fillText(compact(balance),W-48,y+15);ctx.textAlign='left';
 });
 return cv.toBuffer('image/png');
}

// Fiche joueur : solde, indicateurs et courbe des derniers résultats.
function renderPlayer({name,id,account}){
 const a=account,W=960,H=330,cv=createCanvas(W,H),ctx=cv.getContext('2d');frame(ctx);
 const net=a.returned-a.wagered,history=(a.history||[]).slice().reverse(),wins=(a.history||[]).filter(h=>h.payout>h.stake).length;
 ctx.fillStyle=C.gold;ctx.font=`18px ${LABEL}`;spaced(ctx,'FICHE JOUEUR · '+id,48,60,3);
 ctx.fillStyle=C.ink;ctx.font=`40px ${DISPLAY}`;ctx.fillText(fit(ctx,name,420),46,104);
 let px=W-44;
 if(a.frozen){pill(ctx,px,40,'COMPTE GELÉ',C.redLight);px-=190;}
 if(a.game)pill(ctx,px,40,'PARTIE EN COURS',C.gold);
 ctx.fillStyle=C.dim;ctx.font=`18px ${LABEL}`;spaced(ctx,'SOLDE',48,146,3);
 ctx.fillStyle=C.bright;ctx.font=`58px ${LABEL}`;ctx.fillText(a.balance.toLocaleString('fr-FR')+' JETONS',46,200);
 const tiles=[['PARTIES',compact(a.played)],['MISÉ',compact(a.wagered)],['NET',(net>=0?'+':'')+compact(net),net>=0?C.greenLight:C.redLight],['VICTOIRES',a.history?.length?Math.round(wins/a.history.length*100)+' %':'—']];
 tiles.forEach(([l,v,c],i)=>tile(ctx,48+i*110,218,100,86,l,v,null,c||C.ink));
 // Courbe du résultat cumulé sur les dernières parties
 const x0=520,y0=128,w=392,h=176;
 ctx.fillStyle='rgba(20,19,17,0.92)';roundRect(ctx,x0,y0,w,h,10);ctx.fill();ctx.strokeStyle='rgba(212,189,134,0.45)';roundRect(ctx,x0+.5,y0+.5,w-1,h-1,10);ctx.stroke();
 ctx.fillStyle=C.gold;ctx.font=`16px ${LABEL}`;spaced(ctx,'RÉSULTAT CUMULÉ · '+history.length+' DERNIÈRES PARTIES',x0+14,y0+24,2);
 if(history.length<2){ctx.fillStyle=C.dim;ctx.font=`18px ${LABEL}`;ctx.fillText('PAS ENCORE ASSEZ DE PARTIES',x0+14,y0+100);return cv.toBuffer('image/png');}
 let sum=0;const points=[0,...history.map(g=>sum+=g.payout-g.stake)],lo=Math.min(0,...points),hi=Math.max(0,...points),span=hi-lo||1;
 const X=i=>x0+20+(w-40)*i/(points.length-1),Y=v=>y0+h-18-(h-58)*(v-lo)/span;
 ctx.strokeStyle='rgba(125,120,109,0.6)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x0+20,Y(0));ctx.lineTo(x0+w-20,Y(0));ctx.stroke();ctx.setLineDash([]);
 const last=points[points.length-1],col=last>=0?C.greenLight:C.redLight;
 const grad=ctx.createLinearGradient(0,y0+40,0,y0+h);grad.addColorStop(0,last>=0?'rgba(63,174,117,0.35)':'rgba(224,82,91,0.35)');grad.addColorStop(1,'rgba(0,0,0,0)');
 ctx.beginPath();ctx.moveTo(X(0),Y(0));points.forEach((v,i)=>ctx.lineTo(X(i),Y(v)));ctx.lineTo(X(points.length-1),Y(0));ctx.closePath();ctx.fillStyle=grad;ctx.fill();
 ctx.beginPath();points.forEach((v,i)=>i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v)));ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.stroke();
 ctx.fillStyle=col;ctx.beginPath();ctx.arc(X(points.length-1),Y(last),5,0,Math.PI*2);ctx.fill();
 ctx.font=`18px ${LABEL}`;ctx.textAlign='right';ctx.fillText((last>=0?'+':'')+compact(last),x0+w-14,y0+24);ctx.textAlign='left';
 return cv.toBuffer('image/png');
}
module.exports={renderDashboard,renderPlayer,compact};
