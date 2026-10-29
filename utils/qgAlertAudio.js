// Audio de l'alerte d'urgence du QG : sirène à deux tons + message lu par la synthèse vocale.
// Sortie PCM signé 16 bits, 48 kHz stéréo (format attendu par @discordjs/voice en StreamType.Raw).
const RATE=48000;
const DEFAULT='Alerte du QG. Une crise est en cours. Préparez-vous à être déplacés. Restez connectés et attendez les consignes de la direction.';

function silence(seconds){return Buffer.alloc(Math.round(seconds*RATE)*4);}
// Sirène deux tons (type police européenne), enveloppe douce pour éviter les claquements.
function siren(seconds=3.2,level=.32){
 const n=Math.round(seconds*RATE),out=Buffer.alloc(n*4);let phase=0;
 for(let k=0;k<n;k++){const t=k/RATE,freq=Math.floor(t/.45)%2?740:960;phase+=2*Math.PI*freq/RATE;
  const env=Math.min(1,t/.05,(seconds-t)/.1);const v=Math.round(Math.max(-1,Math.min(1,(Math.sin(phase)+.25*Math.sin(3*phase))*level*env))*32767);
  out.writeInt16LE(v,k*4);out.writeInt16LE(v,k*4+2);}
 return out;
}
// 24 kHz mono (sortie OpenAI) vers 48 kHz stéréo, interpolation linéaire.
function upsample(mono){
 const samples=mono.length/2,out=Buffer.alloc(samples*8);
 for(let n=0;n<samples;n++){const a=mono.readInt16LE(n*2),b=n+1<samples?mono.readInt16LE((n+1)*2):a;for(let k=0;k<2;k++){const v=k?Math.round((a+b)/2):a;out.writeInt16LE(v,n*8+k*4);out.writeInt16LE(v,n*8+k*4+2);}}
 return out;
}
async function speech(text,signal){
 if(!process.env.OPENAI_API_KEY)return null;
 const OpenAI=require('openai'),api=new OpenAI({apiKey:process.env.OPENAI_API_KEY,timeout:30000,maxRetries:0});
 const response=await api.audio.speech.create({model:'gpt-4o-mini-tts',voice:'onyx',input:text,response_format:'pcm',instructions:'Lis ce texte exactement, en français, comme une alerte officielle au micro : voix ferme, claire, posée et urgente, sans panique. N’ajoute rien.'},{signal});
 const pcm=Buffer.from(await response.arrayBuffer());
 if(!pcm.length||pcm.length%2||pcm.length>24000*2*60)return null;
 return upsample(pcm);
}
// Sirène, message (lu deux fois s'il est court), sirène courte. Sans synthèse : sirène seule.
async function build(text=DEFAULT,{signal,tts=speech}={}){
 text=String(text||DEFAULT).trim().slice(0,400)||DEFAULT;
 let voice=null;try{voice=await tts(text,signal);}catch{voice=null;}
 if(signal?.aborted)throw Error('Alerte arrêtée.');
 if(!voice)return {pcm:Buffer.concat([siren(),silence(.4),siren(2.4)]),spoken:false};
 const repeat=voice.length/(RATE*4)<12;
 return {pcm:Buffer.concat([siren(),silence(.35),voice,...(repeat?[silence(.8),voice]:[]),silence(.4),siren(1.6)]),spoken:true};
}
module.exports={DEFAULT,RATE,siren,silence,upsample,build};
