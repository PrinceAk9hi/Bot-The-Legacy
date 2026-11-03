// Carte =niveau façon « Journal du QG » : portrait tramé, gros chiffre du niveau, jauge en losanges,
// rang au classement, gains du jour et prochain palier de rôle.
const {createCanvas,loadImage,FRAKTUR,SERIF,BOLD,ITALIC,DISPLAY,INK,SOFT,fr,fit,sizeTo,spaced,rule,diamond,paper,aging,stamp}=require('./qgJournalDraw');
const {portrait}=require('./qgProfileCard');
const W=1000,H=420;

function gauge(ctx,ratio,cx,y,count,step){
 for(let n=0;n<count;n++){const dx=cx+(n-(count-1)/2)*step;
  if(n<Math.round(ratio*count))diamond(ctx,dx,y,7);
  else{ctx.strokeStyle=INK;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(dx,y-7);ctx.lineTo(dx+5.2,y);ctx.lineTo(dx,y+7);ctx.lineTo(dx-5.2,y);ctx.closePath();ctx.stroke();}}
}
function box(ctx,x,y,w,h,label,value,note){
 ctx.strokeStyle=INK;ctx.lineWidth=1.2;ctx.strokeRect(x,y,w,h);ctx.lineWidth=.6;ctx.strokeRect(x+3,y+3,w-6,h-6);
 ctx.textAlign='center';ctx.fillStyle=INK;ctx.font=`11px ${BOLD}`;spaced(ctx,label,x+w/2,y+22,1.6);
 sizeTo(ctx,value,w-20,24,DISPLAY,14);ctx.fillText(fit(ctx,value,w-20),x+w/2,y+46);
 ctx.font=`12px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText(fit(ctx,note,w-16),x+w/2,y+63);ctx.textAlign='left';
}
async function render(p){
 const cv=createCanvas(W,H),ctx=cv.getContext('2d');paper(ctx);
 let image=null;if(p.avatar)try{image=await loadImage(p.avatar);}catch{}
 ctx.textBaseline='alphabetic';ctx.fillStyle=INK;ctx.textAlign='center';
 sizeTo(ctx,'Le Journal du QG',W-300,52,FRAKTUR,36);ctx.fillText('Le Journal du QG',W/2,62);
 rule(ctx,30,W-30,76,3);rule(ctx,30,W-30,81,1);
 ctx.font=`12px ${SERIF}`;spaced(ctx,'RUBRIQUE  —  PROGRESSION ET NIVEAUX  —  CLASSEMENT DU QG',W/2,98,1.6);rule(ctx,30,W-30,106,1);
 // Portrait
 portrait(ctx,image,[...String(p.name||'?')][0].toUpperCase(),44,126,220,220);
 ctx.font=`13px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.textAlign='center';ctx.fillText(fit(ctx,'@'+p.username,220),154,372);
 if(p.rank)stamp(ctx,'N° '+p.rank,W-110,152,-.12,{size:30,max:150});
 // Titre
 ctx.fillStyle=INK;const head=String(p.name).toUpperCase();sizeTo(ctx,head,W-500,46,DISPLAY,24);ctx.textAlign='left';ctx.fillText(fit(ctx,head,W-500),296,160);
 ctx.font=`17px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText(fit(ctx,p.rank?`Classé n°${p.rank} sur ${fr(p.ranked)} membres actifs du QG`:'Pas encore classé : un premier message suffit.',W-360),296,186);
 rule(ctx,296,W-40,200,1);
 // Niveau
 ctx.textAlign='center';ctx.fillStyle=INK;ctx.font=`12px ${BOLD}`;spaced(ctx,'NIVEAU',380,226,2.4);
 ctx.font=`86px ${DISPLAY}`;ctx.fillText(String(p.level),380,304);
 for(const x of [466]){ctx.fillStyle='rgba(29,26,22,0.55)';ctx.fillRect(x,214,1,108);}
 const into=p.xp-p.current,need=Math.max(1,p.next-p.current),ratio=Math.max(0,Math.min(1,into/need)),mid=(480+W-40)/2;
 ctx.font=`12px ${BOLD}`;spaced(ctx,`VERS LE NIVEAU ${p.level+1}`,mid,226,2);
 gauge(ctx,ratio,mid,256,20,22);
 ctx.font=`26px ${DISPLAY}`;ctx.fillText(`${fr(into)} / ${fr(need)} XP`,mid,298);
 ctx.font=`14px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText(`encore ${fr(need-into)} XP  ·  ${Math.floor(ratio*100)} % du chemin`,mid,320);
 // Encadrés
 const bw=(W-40-296-24)/3;
 box(ctx,296,338,bw,70,'XP TOTAL',fr(p.xp),'depuis ton arrivée');
 box(ctx,296+bw+12,338,bw,70,'AUJOURD’HUI',`+${fr(p.today)} XP`,`${fr(p.messageDaily)} écrit · ${fr(p.voiceDaily)} vocal`);
 box(ctx,296+2*(bw+12),338,bw,70,'PROCHAIN RÔLE',p.milestone?`Niveau ${p.milestone}`:'Tous obtenus',p.milestone?`dans ${p.milestone-p.level} niveau${p.milestone-p.level>1?'x':''}`:'palier maximal atteint');
 aging(ctx,{cup:[W-90,46]});
 return cv.toBuffer('image/png');
}
module.exports={render};
