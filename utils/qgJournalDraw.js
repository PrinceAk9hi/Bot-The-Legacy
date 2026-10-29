// Primitives du « Journal du QG » partagées par les cartes (profil, arrivée) : polices OFL embarquées,
// papier vieilli, filets, losanges et tampon encreur. Les fonctions s’adaptent à la taille du canevas.
const path=require('node:path');
const {createCanvas,loadImage,GlobalFonts}=require('@napi-rs/canvas');
const FONTS=path.join(__dirname,'..','assets','fonts');
for(const [file,family]of [['UnifrakturMaguntia-Book.ttf','QG Fraktur'],['OldStandard-Regular.ttf','QG Serif'],['OldStandard-Bold.ttf','QG Serif Bold'],['OldStandard-Italic.ttf','QG Serif Italic'],['AbrilFatface-Regular.ttf','QG Display']])GlobalFonts.registerFromPath(path.join(FONTS,file),family);
const FRAKTUR='"QG Fraktur"',SERIF='"QG Serif"',BOLD='"QG Serif Bold"',ITALIC='"QG Serif Italic"',DISPLAY='"QG Display"';
const INK='#1d1a16',SOFT='rgba(29,26,22,0.72)',PAPER='#eee4cb',RED='#a3262a';

// Hasard à graine fixe : même texture à chaque carte.
function seeded(seed){return()=>(seed=(seed*16807)%2147483647)/2147483647;}
const fr=n=>Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g,' ');
const hours=ms=>{const h=ms/3600000;return h>=10?fr(h)+' heures':h>=1?h.toFixed(1).replace('.',',')+' heures':fr(ms/60000)+' minutes';};
const plural=(n,word)=>fr(n)+' '+word+(n>1?'s':'');
function fit(ctx,text,max){let t=String(text);if(ctx.measureText(t).width<=max)return t;while(t.length>1&&ctx.measureText(t+'…').width>max)t=t.slice(0,-1);return t+'…';}
function sizeTo(ctx,text,max,size,family,min){ctx.font=`${size}px ${family}`;while(size>min&&ctx.measureText(text).width>max)ctx.font=`${size-=2}px ${family}`;return size;}
// Texte centré et espacé : espacement natif du canevas.
function spaced(ctx,text,x,y,gap){const align=ctx.textAlign;ctx.letterSpacing=gap+'px';ctx.textAlign='center';ctx.fillText(text,x+gap/2,y);ctx.letterSpacing='0px';ctx.textAlign=align;}
function rule(ctx,x1,x2,y,width=1){ctx.fillStyle=INK;ctx.fillRect(x1,y,x2-x1,width);}
function diamond(ctx,x,y,r,color=INK){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r*.75,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r*.75,y);ctx.closePath();ctx.fill();}

// ---- Papier vieilli ----
function paper(ctx){
 const W=ctx.canvas.width,H=ctx.canvas.height,rand=seeded(20251029);
 ctx.fillStyle=PAPER;ctx.fillRect(0,0,W,H);
 for(let n=0;n<W*H/22;n++){const dark=rand()<.6;ctx.fillStyle=dark?`rgba(90,64,30,${rand()*.07})`:`rgba(255,250,235,${rand()*.08})`;ctx.fillRect(rand()*W,rand()*H,1+rand()*1.6,1+rand()*1.6);}
 for(let n=0;n<70;n++){const x=rand()*W,y=rand()*H,l=8+rand()*24,a=rand()*Math.PI;ctx.strokeStyle=`rgba(110,80,40,${.05+rand()*.05})`;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);ctx.stroke();}
 // Rousseurs
 for(let n=0;n<14;n++){const x=rand()*W,y=rand()*H,r=3+rand()*16,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(140,95,40,${.10+rand()*.10})`);g.addColorStop(1,'rgba(140,95,40,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
 // Bords jaunis
 const v=ctx.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,W*.66);v.addColorStop(0,'rgba(120,85,35,0)');v.addColorStop(1,'rgba(120,85,35,0.34)');ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
}
function aging(ctx,{cup=[ctx.canvas.width-132,70]}={}){
 // Trace de tasse de café
 const [cx,cy]=cup;ctx.save();for(const [r,w,a]of [[58,5,.10],[55,1.5,.16],[61,1,.08]]){ctx.strokeStyle=`rgba(120,75,25,${a})`;ctx.lineWidth=w;ctx.beginPath();ctx.arc(cx,cy,r,.3,Math.PI*1.86);ctx.stroke();}ctx.restore();
}

// ---- Tampon encreur ----
function stamp(ctx,text,cx,cy,angle,{size=30,max=200}={}){
 const rand=seeded(4242),pad=18;ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);
 ctx.font=`${size}px ${DISPLAY}`;const tw=Math.min(ctx.measureText(text).width,max),w=tw+pad*2,h=Math.round(size*2.07);
 const off=createCanvas(w+8,h+8),o=off.getContext('2d');o.translate(4,4);o.strokeStyle=RED;o.fillStyle=RED;
 o.lineWidth=4;o.strokeRect(0,0,w,h);o.lineWidth=1.5;o.strokeRect(7,7,w-14,h-14);
 o.font=`${size}px ${DISPLAY}`;o.textAlign='center';o.fillText(text,w/2,h/2+size*.37,tw);
 // Encre irrégulière : quelques manques
 o.globalCompositeOperation='destination-out';for(let n=0;n<(w*h)/14;n++){o.fillStyle=`rgba(0,0,0,${.35+rand()*.65})`;o.fillRect(rand()*w,rand()*h,1+rand()*2.2,1+rand()*1.6);}
 ctx.globalAlpha=.86;ctx.drawImage(off,-w/2-4,-h/2-4);ctx.restore();
}
module.exports={createCanvas,loadImage,FRAKTUR,SERIF,BOLD,ITALIC,DISPLAY,INK,SOFT,PAPER,RED,seeded,fr,hours,plural,fit,sizeTo,spaced,rule,diamond,paper,aging,stamp};
