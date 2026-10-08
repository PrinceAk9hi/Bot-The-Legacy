const {createHash}=require('node:crypto');
const INTRO='Annonce de la fondation de la Soul Society';
const RATE=24000,cache=new Map();
function melody(notes,length,level){
 const out=Buffer.alloc(Math.round(length*RATE)*2);
 for(let n=0;n<out.length/2;n++){
  const t=n/RATE;let sample=0;
  for(const [at,freq,duration]of notes){const age=t-at;if(age<0||age>=duration)continue;
   const envelope=Math.min(1,age/0.015)*Math.exp(-age*2.2)*Math.min(1,(duration-age)/0.15);
   sample+=Math.sin(2*Math.PI*freq*age)*envelope*level;
  }
  out.writeInt16LE(Math.round(Math.max(-0.95,Math.min(0.95,sample))*32767),n*2);
 }return out;
}
function decorate(speech){
 const chime=melody([[0,659.25,1.1],[0.35,523.25,1.3]],1.8,0.3);
 const outro=melody([[0,261.63,2.4],[0,329.63,2.4],[0,392,2.4],[1,493.88,1],[2.1,220,2.8],[2.1,261.63,2.8],[2.1,329.63,2.8],[3.2,392,1.7]],5,0.1);
 const mono=Buffer.concat([chime,Buffer.alloc(RATE/4*2),speech,Buffer.alloc(RATE/3*2),outro]);
 // Speech PCM is signed 16-bit little-endian, mono at 24 kHz. Linear resampling
 // to Discord's 48 kHz stereo avoids a new decoder process for every room.
 const out=Buffer.alloc(mono.length*4),samples=mono.length/2;
 for(let n=0;n<samples;n++){const a=mono.readInt16LE(n*2),b=n+1<samples?mono.readInt16LE((n+1)*2):a;for(let k=0;k<2;k++){const value=k?Math.round((a+b)/2):a;out.writeInt16LE(value,n*8+k*4);out.writeInt16LE(value,n*8+k*4+2);}}
 return out;
}
function wav(pcm){const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(pcm.length+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);h.writeUInt32LE(48000,24);h.writeUInt32LE(192000,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);return Buffer.concat([h,pcm]);}
async function generate(body,signal){
 const input=`${INTRO}. ${String(body).trim()}`;
 if(!body?.trim()||body.length>600)throw Error('L’annonce doit contenir entre 1 et 600 caractères.');
 const key=createHash('sha256').update(input).digest('hex');if(cache.has(key))return cache.get(key);
 if(!process.env.OPENAI_API_KEY)throw Error('La clé de synthèse vocale OPENAI_API_KEY n’est pas configurée.');
 const OpenAI=require('openai');const api=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:45000,maxRetries:0});
 const response=await api.audio.speech.create({model:'gpt-4o-mini-tts',voice:'coral',input,response_format:'pcm',instructions:'Lis ce texte exactement en français, clairement, comme une annonce au micro. Ton calme, posé et accueillant. Ne rajoute pas de texte.'},{signal});
 const speech=Buffer.from(await response.arrayBuffer());
 if(signal?.aborted)throw Error('Diffusion arrêtée.');
 if(!speech.length||speech.length%2||speech.length>RATE*2*90)throw Error('Audio absent, invalide ou supérieur à 90 secondes.');
 const pcm=decorate(speech);if(cache.size>=4)cache.delete(cache.keys().next().value);cache.set(key,pcm);return pcm;
}
function preview(pcm){return new Promise((resolve,reject)=>{
 const child=require('node:child_process').spawn(require('ffmpeg-static'),['-hide_banner','-loglevel','error','-f','s16le','-ar','48000','-ac','2','-i','pipe:0','-f','mp3','-b:a','96k','pipe:1'],{stdio:['pipe','pipe','ignore'],windowsHide:true});
 const chunks=[];let done=false,size=0;const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);if(error){child.kill();reject(error);}else resolve(Buffer.concat(chunks));};
 const timer=setTimeout(()=>finish(Error('Préécoute expirée.')),20000);
 child.on('error',()=>finish(Error('FFmpeg est indisponible.')));child.stdout.on('error',()=>finish(Error('Préécoute interrompue.')));child.stdin.on('error',()=>{});
 child.stdout.on('data',chunk=>{size+=chunk.length;if(size>3*1024*1024)return finish(Error('Préécoute trop volumineuse.'));chunks.push(chunk);});
 child.on('close',code=>finish(code||!size?Error('Impossible de préparer la préécoute.'):null));child.stdin.end(pcm);
});}
module.exports={INTRO,generate,decorate,wav,preview};
