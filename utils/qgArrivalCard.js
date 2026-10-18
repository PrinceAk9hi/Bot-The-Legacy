const {createCanvas,loadImage}=require('@napi-rs/canvas');
async function render(member,{avatar=true}={}){
 const canvas=createCanvas(1100,400),c=canvas.getContext('2d');
 c.fillStyle='#101114';c.fillRect(0,0,1100,400);
 const g=c.createLinearGradient(0,0,1100,400);g.addColorStop(0,'#35373c');g.addColorStop(1,'#090a0c');c.fillStyle=g;c.fillRect(18,18,1064,364);
 c.strokeStyle='#77797d';c.lineWidth=1;c.strokeRect(30,30,1040,340);
 for(let n=0;n<5;n++){c.strokeStyle=`rgba(255,255,255,${0.04+n*.015})`;c.beginPath();c.arc(960,360,100+n*55,0,Math.PI*2);c.stroke();}
 c.save();c.beginPath();c.arc(185,195,105,0,Math.PI*2);c.clip();c.fillStyle='#e9e9eb';c.fillRect(80,90,210,210);
 let image;if(avatar)try{const response=await fetch(member.user.displayAvatarURL({extension:'png',size:256}),{signal:AbortSignal.timeout(5000)});if(response.ok){const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length<2000000)image=await loadImage(bytes);}}catch{}
 if(image)c.drawImage(image,80,90,210,210);else{c.fillStyle='#222';c.font='bold 70px sans-serif';c.textAlign='center';c.fillText((member.displayName||'QG').slice(0,2).toUpperCase(),185,220);}c.restore();
 c.textAlign='left';c.fillStyle='#b4b5bb';c.font='20px sans-serif';c.fillText('LA COMMUNAUTÉ DU QG',340,112);
 c.fillStyle='#fff';c.font='bold 48px sans-serif';c.fillText('BIENVENUE',337,178);
 let size=38;const name=(member.displayName||member.user.username).slice(0,80);do{c.font=`${size--}px sans-serif`;}while(c.measureText(name).width>675&&size>17);c.fillText(name,340,237);
 c.fillStyle='#c7c8cc';c.font='20px sans-serif';c.fillText('Une nouvelle rencontre. Une place parmi nous.',340,285);
 c.fillStyle='#999ba1';c.font='16px sans-serif';c.fillText('Fondateur - QG',340,337);
 return canvas.toBuffer('image/png');
}
module.exports={render};
