// Carte d'arrivée façon « Journal du QG » : skin Roblox en pied (API publique des miniatures, sans cookie)
// dans un cadre photo de presse, gros titre de bienvenue, numéro du membre, arrivée, ancienneté du compte et parrain.
const path=require('node:path');
const roblox=require('./qgRobloxAvatar');
const {read}=require('./recruitmentData');
const J=require('./qgJournalDraw');
const {createCanvas,loadImage,FRAKTUR,SERIF,BOLD,ITALIC,DISPLAY,INK,SOFT,RED,fr,fit,sizeTo,rule,paper,aging,stamp}=J;
const W=1100,H=400,DAY=86400000;

function cropBounds(image){
 const surface=createCanvas(image.width,image.height),ctx=surface.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,image.width,image.height).data;
 let left=image.width,top=image.height,right=-1,bottom=-1,transparent=false;
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const alpha=pixels[(y*image.width+x)*4+3];if(alpha<255)transparent=true;if(alpha>5){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
 return transparent&&right>=left?{x:left,y:top,width:right-left+1,height:bottom-top+1}:null;
}
const ordinal=n=>n===1?'1er':n+'e';
function since(at,now){if(!at)return '—';const d=Math.max(0,Math.floor((now-at)/DAY));return d>=365?(Math.floor(d/365)>1?Math.floor(d/365)+' ans':'1 an'):d>=30?Math.floor(d/30)+' mois':d>1?d+' jours':d===1?'1 jour':'aujourd’hui';}
// Texte aligné à gauche avec espacement des lettres.
function tracked(ctx,text,x,y,gap){ctx.letterSpacing=gap+'px';ctx.textAlign='left';ctx.fillText(text,x,y);ctx.letterSpacing='0px';}

// Cadre photo de presse : fond de studio, rayons discrets, ombre au sol, personnage légèrement teinté par le papier.
function pressPhoto(ctx,character,bounds,x,y,w,h){
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 const g=ctx.createRadialGradient(x+w/2,y+h*.42,10,x+w/2,y+h*.42,h*.8);g.addColorStop(0,'#f8f1de');g.addColorStop(1,'#cdbd96');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
 ctx.translate(x+w/2,y+h*.42);for(let n=0;n<24;n++){ctx.rotate(Math.PI/12);ctx.fillStyle=n%2?'rgba(120,90,40,0.05)':'rgba(255,250,235,0.06)';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(h,-h*.13);ctx.lineTo(h,h*.13);ctx.closePath();ctx.fill();}
 ctx.setTransform(1,0,0,1,0,0);
 const floor=y+h-26;const s=ctx.createRadialGradient(x+w/2,floor,4,x+w/2,floor,w*.36);s.addColorStop(0,'rgba(40,28,10,0.35)');s.addColorStop(1,'rgba(40,28,10,0)');ctx.fillStyle=s;ctx.beginPath();ctx.ellipse(x+w/2,floor,w*.36,14,0,0,Math.PI*2);ctx.fill();
 const scale=Math.min((w-40)/bounds.width,(h-44)/bounds.height),cw=bounds.width*scale,ch=bounds.height*scale;
 const off=createCanvas(Math.ceil(cw),Math.ceil(ch)),o=off.getContext('2d');o.drawImage(character,bounds.x,bounds.y,bounds.width,bounds.height,0,0,cw,ch);
 o.globalCompositeOperation='source-atop';o.fillStyle='rgba(214,190,140,0.18)';o.fillRect(0,0,cw,ch);
 ctx.drawImage(off,x+(w-cw)/2,floor-ch+6);
 ctx.restore();
 ctx.strokeStyle=INK;ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);ctx.lineWidth=.8;ctx.strokeRect(x-5,y-5,w+10,h+10);
}

async function render(member,{avatar=true,robloxId,fetchAvatar=roblox.fullBody,fetcher=fetch,now=Date.now()}={}){
 const state=read('qgServer'),verification=state.schoolEntryVerification?.[member.id];
 if(robloxId===undefined)robloxId=verification?.robloxId;
 const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');paper(ctx);ctx.textBaseline='alphabetic';
 const name=(member.displayName||member.user?.username||'Nouveau membre').replace(/[\r\n\u0000-\u001f]/g,' ').slice(0,80);
 // Photo : skin Roblox en pied, sinon photo Discord en similigravure.
 const PX=40,PY=34,PW=290,PH=318;
 let character,bounds;
 if(avatar)try{const buffer=await fetchAvatar(robloxId);if(buffer){character=await loadImage(buffer);if(character.width>1024||character.height>1024)character=null;else bounds=cropBounds(character);}}catch{}
 if(character&&bounds)pressPhoto(ctx,character,bounds,PX,PY,PW,PH);
 else{
  let image=null;
  if(avatar&&member.user?.displayAvatarURL)try{const response=await fetcher(member.user.displayAvatarURL({extension:'png',size:256}),{signal:AbortSignal.timeout(5000),redirect:'error'});if(response.ok){const bytes=await roblox.bytes(response,2000000);if(bytes.length<2000000)image=await loadImage(bytes);}}catch{}
  require('./qgProfileCard').portrait(ctx,image,[...name][0]?.toUpperCase()||'Q',PX,PY,PW,PH);
 }
 ctx.textAlign='center';ctx.fillStyle=SOFT;ctx.font=`14px ${ITALIC}`;
 const robloxName=verification?.robloxName;ctx.fillText(fit(ctx,robloxName?`Notre nouvelle recrue · Roblox : ${robloxName}`:'Notre nouvelle recrue, au QG.',PW+10),PX+PW/2,PY+PH+28);
 stamp(ctx,'BIENVENUE',PX+PW-62,PY+PH-46,-.2,{size:24});
 // En-tête
 const X=372,R=W-40;ctx.textAlign='left';
 sizeTo(ctx,'Le Journal du QG',380,40,FRAKTUR,28);ctx.fillStyle=INK;ctx.fillText('Le Journal du QG',X,72);
 const date=new Date(now).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Paris'});
 ctx.textAlign='right';ctx.font=`13px ${BOLD}`;ctx.letterSpacing='1.5px';ctx.fillText('ÉDITION SPÉCIALE',R,56);ctx.letterSpacing='0px';ctx.font=`14px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText(date.charAt(0).toUpperCase()+date.slice(1),R,76);
 rule(ctx,X,R,90,3);rule(ctx,X,R,96,1);
 // Titre
 ctx.fillStyle=RED;ctx.font=`14px ${BOLD}`;tracked(ctx,'✶ DERNIÈRE MINUTE ✶'.replace(/✶/g,'—'),X,126,3);
 ctx.fillStyle=INK;sizeTo(ctx,'BIENVENUE À',R-X,54,DISPLAY,30);ctx.fillText('BIENVENUE À',X,180);
 const headSize=sizeTo(ctx,name.toUpperCase(),R-X,54,DISPLAY,26);ctx.fillText(fit(ctx,name.toUpperCase(),R-X),X,180+Math.max(34,headSize)+4);
 const count=member.guild?.memberCount;
 ctx.font=`19px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText(fit(ctx,count?`Le QG accueille son ${ordinal(count)} membre. Une nouvelle rencontre, une place parmi nous.`:'Une nouvelle rencontre, une place parmi nous.',R-X),X,268);
 rule(ctx,X,R,284,1);
 // Encadrés : arrivée, compte, parrain
 const inviterId=state.schoolInviteAttribution?.[member.id]?.inviterId,inviter=inviterId?(member.guild?.members?.cache?.get(inviterId)?.displayName||'Un membre du QG'):null;
 const joined=member.joinedTimestamp||now;
 const cells=[['ARRIVÉE',new Date(joined).toLocaleDateString('fr-FR',{day:'numeric',month:'long',timeZone:'Europe/Paris'}),'à '+new Date(joined).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'})],['COMPTE DISCORD',since(member.user?.createdTimestamp,now),'d’ancienneté'],['INVITÉ PAR',inviter||'Lien du serveur',inviter?'parrain':'arrivée directe']];
 const cw=(R-X)/3;
 cells.forEach(([label,value,sub],n)=>{const cx=X+n*cw;if(n)ctx.fillStyle='rgba(29,26,22,0.55)',ctx.fillRect(cx,296,1,62);
  ctx.textAlign='center';ctx.fillStyle=INK;ctx.font=`12px ${BOLD}`;ctx.letterSpacing='2px';ctx.fillText(label,cx+cw/2+1,312);ctx.letterSpacing='0px';
  sizeTo(ctx,value,cw-24,24,DISPLAY,14);ctx.fillText(fit(ctx,value,cw-24),cx+cw/2,340);
  ctx.font=`13px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText(sub,cx+cw/2,358);});
 // Pied
 rule(ctx,X,R,368,1);ctx.textAlign='left';
 try{const emblem=await loadImage(path.join(__dirname,'../assets/qg-direction-emblem.png'));ctx.globalAlpha=.85;ctx.drawImage(emblem,X,374,18,18);ctx.globalAlpha=1;}catch{}
 ctx.font=`13px ${ITALIC}`;ctx.fillStyle=SOFT;ctx.fillText(require('./qgBrand').label+' · Bienvenue dans la communauté',X+24,388);
 ctx.textAlign='right';ctx.fillText('Prix : 1 crédit',R,388);ctx.textAlign='left';
 aging(ctx,{cup:[W-90,H-60]});
 return canvas.toBuffer('image/png');
}
module.exports={render,cropBounds};
