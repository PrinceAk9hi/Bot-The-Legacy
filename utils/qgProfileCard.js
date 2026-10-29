// Carte de membre du QG (noir et or) : avatar, grade, niveau, activité, casino et badges.
const {loadImage}=require('@napi-rs/canvas');
const {C,DISPLAY,LABEL,createCanvas,spaced,roundRect,diamond,frame}=require('./qgCasinoDraw');
const {compact}=require('./qgCasinoAdminDraw');

function fit(ctx,text,max){let t=String(text);if(ctx.measureText(t).width<=max)return t;while(t.length>1&&ctx.measureText(t+'…').width>max)t=t.slice(0,-1);return t+'…';}
function sized(ctx,text,max,size,family,min=20){ctx.font=`${size}px ${family}`;while(size>min&&ctx.measureText(text).width>max)ctx.font=`${size-=2}px ${family}`;return size;}
function tile(ctx,x,y,w,h,label,value,sub){
 ctx.fillStyle='rgba(20,19,17,0.92)';roundRect(ctx,x,y,w,h,10);ctx.fill();
 ctx.strokeStyle='rgba(212,189,134,0.45)';ctx.lineWidth=1;roundRect(ctx,x+.5,y+.5,w-1,h-1,10);ctx.stroke();
 ctx.fillStyle=C.gold;ctx.font=`16px ${LABEL}`;spaced(ctx,label,x+12,y+24,2);
 sized(ctx,value,w-24,36,LABEL);ctx.fillStyle=C.ink;ctx.fillText(value,x+12,y+60);
 if(sub){ctx.fillStyle=C.dim;ctx.font=`15px ${LABEL}`;ctx.fillText(fit(ctx,sub,w-24),x+12,y+h-10);}
}
function badge(ctx,x,y,text,filled){
 ctx.font=`16px ${LABEL}`;const w=ctx.measureText(text).width+text.length*1.5+26;
 roundRect(ctx,x,y,w,26,13);if(filled){ctx.fillStyle=C.gold;ctx.fill();}else{ctx.strokeStyle=C.gold;ctx.lineWidth=1.5;ctx.stroke();}
 diamond(ctx,x+11,y+13,4,filled?C.bg:C.gold);ctx.fillStyle=filled?C.bg:C.bright;spaced(ctx,text,x+20,y+19,1.5);return w;
}
const hours=ms=>{const h=ms/3600000;return h>=10?Math.round(h)+' H':h>=1?h.toFixed(1).replace('.',',')+' H':Math.round(ms/60000)+' MIN';};

// Avatar rond ; sans image, initiale sur fond doré.
function avatar(ctx,image,x,y,r,initial){
 ctx.save();ctx.fillStyle=C.gold;ctx.beginPath();ctx.arc(x,y,r+6,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=C.bg;ctx.beginPath();ctx.arc(x,y,r+2,0,Math.PI*2);ctx.fill();
 ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
 if(image)ctx.drawImage(image,x-r,y-r,r*2,r*2);else{ctx.fillStyle='#2b241a';ctx.fillRect(x-r,y-r,r*2,r*2);ctx.fillStyle=C.gold;ctx.font=`${r}px ${DISPLAY}`;ctx.textAlign='center';ctx.fillText(initial,x,y+r*.35);ctx.textAlign='left';}
 ctx.restore();
}

async function render(p){
 const W=960,H=380,cv=createCanvas(W,H),ctx=cv.getContext('2d');frame(ctx);
 let image=null;if(p.avatar)try{image=await loadImage(p.avatar);}catch{}
 avatar(ctx,image,124,142,78,[...String(p.name||'?')][0].toUpperCase());
 // Ancienneté sous l'avatar
 ctx.textAlign='center';ctx.fillStyle=C.dim;ctx.font=`16px ${LABEL}`;spaced(ctx,'MEMBRE DEPUIS',124,268,2,'center');
 ctx.fillStyle=C.bright;ctx.font=`38px ${LABEL}`;ctx.fillText(p.days===null?'—':p.days+(p.days>1?' JOURS':' JOUR'),124,308);
 if(p.position){ctx.fillStyle=C.gold;ctx.font=`18px ${LABEL}`;spaced(ctx,'#'+p.position+' DU SERVEUR',124,336,2,'center');}
 ctx.textAlign='left';
 // Identité
 const X=236;
 ctx.fillStyle=C.gold;ctx.font=`18px ${LABEL}`;spaced(ctx,'LE QG · CARTE DE MEMBRE',X,58,4);
 sized(ctx,p.name,W-X-60,46,DISPLAY,26);ctx.fillStyle=C.ink;ctx.fillText(fit(ctx,p.name,W-X-60),X-2,106);
 ctx.fillStyle=C.dim;ctx.font=`19px ${LABEL}`;spaced(ctx,fit(ctx,('@'+p.username+(p.roblox?'  ·  ROBLOX : '+p.roblox:'')).toUpperCase(),W-X-80),X,134,1.5);
 let bx=X;for(const [i,text]of [p.title,...p.badges].filter(Boolean).slice(0,5).entries()){const w=badge(ctx,bx,148,text.toUpperCase(),i===0);bx+=w+8;if(bx>W-140)break;}
 // Niveau
 const into=p.xp-p.current,need=Math.max(1,p.next-p.current),ratio=Math.max(0,Math.min(1,into/need));
 ctx.fillStyle=C.ink;ctx.font=`26px ${LABEL}`;spaced(ctx,'NIVEAU '+p.level,X,212,2);
 ctx.fillStyle=C.dim;ctx.font=`18px ${LABEL}`;ctx.textAlign='right';ctx.fillText(Math.floor(into).toLocaleString('fr-FR')+' / '+need.toLocaleString('fr-FR')+' XP',W-48,212);ctx.textAlign='left';
 ctx.fillStyle='rgba(212,189,134,0.15)';roundRect(ctx,X,222,W-X-48,14,7);ctx.fill();
 const g=ctx.createLinearGradient(X,0,W-48,0);g.addColorStop(0,C.gold);g.addColorStop(1,C.bright);ctx.fillStyle=g;roundRect(ctx,X,222,Math.max(14,(W-X-48)*ratio),14,7);ctx.fill();
 // Indicateurs
 const tiles=[['MESSAGES · 7 J',compact(p.weekMessages),'cette semaine'],['VOCAL · 7 J',hours(p.weekVoice),'cette semaine'],['VOCAL TOTAL',hours(p.voiceTotal),'depuis le suivi'],['JETONS CASINO',p.casino?compact(p.casino.balance):'—',p.casino?p.casino.played+' partie(s)':'jamais joué']];
 const tw=(W-X-48-3*10)/4;tiles.forEach(([l,v,s],i)=>tile(ctx,X+i*(tw+10),254,tw,96,l,v,s));
 return cv.toBuffer('image/png');
}
module.exports={render};
