// Carte /classement façon « Journal du QG », assortie à la carte =niveau :
// en-tête du journal, une ligne par membre avec portrait tramé, tampon pour le podium,
// et l'encadré « Ta position » en pied de page.
const {createCanvas,loadImage,FRAKTUR,SERIF,BOLD,ITALIC,DISPLAY,INK,SOFT,RED,fr,fit,sizeTo,spaced,rule,diamond,paper,aging,stamp}=require('./qgJournalDraw');
const {portrait}=require('./qgProfileCard');
const W=1000,TOP=124,ROW=56,FOOT=110;
const MEDALS=['OR','ARGENT','BRONZE'];

// p = { title, scope, page, pages, total, rows:[{position,name,username,avatar,value,note}], mine:{position,value}|null }
async function render(p){
 const rows=p.rows.slice(0,10),H=TOP+Math.max(1,rows.length)*ROW+FOOT;
 const cv=createCanvas(W,H),ctx=cv.getContext('2d');paper(ctx);
 const images=await Promise.all(rows.map(r=>r.avatar?loadImage(r.avatar).catch(()=>null):null));
 ctx.textBaseline='alphabetic';ctx.fillStyle=INK;ctx.textAlign='center';
 sizeTo(ctx,'Le Journal du QG',W-300,52,FRAKTUR,36);ctx.fillText('Le Journal du QG',W/2,62);
 rule(ctx,30,W-30,76,3);rule(ctx,30,W-30,81,1);
 ctx.font=`12px ${SERIF}`;spaced(ctx,`RUBRIQUE  —  CLASSEMENT DU QG  —  ${String(p.title).toUpperCase()}  —  ${String(p.scope).toUpperCase()}`,W/2,98,1.6);
 rule(ctx,30,W-30,106,1);

 if(!rows.length){
  ctx.font=`22px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText('Le classement attend ses premiers participants.',W/2,TOP+36);
 }
 rows.forEach((r,n)=>{
  const y=TOP+n*ROW,mid=y+ROW/2,podium=r.position<=3;
  if(n)for(let x=60;x<W-60;x+=14)diamond(ctx,x,y-2,1.6,'rgba(29,26,22,0.35)');
  // Position
  ctx.textAlign='center';ctx.fillStyle=podium?RED:INK;ctx.font=`${podium?34:28}px ${DISPLAY}`;ctx.fillText(String(r.position),78,mid+11);
  // Portrait
  portrait(ctx,images[n],[...String(r.name||'?')][0].toUpperCase(),122,y+6,ROW-12,ROW-12);
  ctx.strokeStyle=INK;ctx.lineWidth=1;ctx.strokeRect(122,y+6,ROW-12,ROW-12);
  // Nom
  ctx.textAlign='left';ctx.fillStyle=INK;sizeTo(ctx,String(r.name),420,24,DISPLAY,16);ctx.fillText(fit(ctx,String(r.name),420),190,mid+2);
  ctx.font=`13px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText(fit(ctx,'@'+r.username,420),190,mid+20);
  if(podium){ctx.save();ctx.globalAlpha=.85;stamp(ctx,MEDALS[r.position-1],640,mid,-.08,{size:15,max:110});ctx.restore();}
  // Valeur
  ctx.textAlign='right';ctx.fillStyle=INK;sizeTo(ctx,String(r.value),230,26,DISPLAY,16);ctx.fillText(fit(ctx,String(r.value),230),W-50,mid+4);
  if(r.note){ctx.font=`13px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText(fit(ctx,r.note,230),W-50,mid+21);}
 });

 // Pied : ta position et pagination
 const fy=TOP+Math.max(1,rows.length)*ROW+10;
 rule(ctx,30,W-30,fy,1);rule(ctx,30,W-30,fy+4,3);
 const bx=30,bw=W-60-200,bh=62;
 ctx.strokeStyle=INK;ctx.lineWidth=1.2;ctx.strokeRect(bx,fy+16,bw,bh);ctx.lineWidth=.6;ctx.strokeRect(bx+3,fy+19,bw-6,bh-6);
 ctx.textAlign='left';ctx.fillStyle=INK;ctx.font=`11px ${BOLD}`;ctx.letterSpacing='1.6px';ctx.fillText('TA POSITION',bx+16,fy+38);ctx.letterSpacing='0px';
 const mine=p.mine?`N° ${p.mine.position}  ·  ${p.mine.value}`:'Pas encore classé : un peu d’activité suffit.';
 sizeTo(ctx,mine,bw-32,24,DISPLAY,14);ctx.fillText(fit(ctx,mine,bw-32),bx+16,fy+66);
 ctx.textAlign='center';ctx.font=`12px ${BOLD}`;spaced(ctx,'PAGE',W-130,fy+38,2);
 ctx.font=`26px ${DISPLAY}`;ctx.fillText(`${p.page} / ${p.pages}`,W-130,fy+68);
 ctx.font=`12px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText(`${fr(p.total)} membre${p.total>1?'s':''} classé${p.total>1?'s':''}`,W-130,fy+84);
 aging(ctx,{cup:[W-90,46]});
 return cv.toBuffer('image/png');
}
module.exports={render};
