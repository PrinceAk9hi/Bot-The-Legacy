const {Readable,PassThrough}=require('node:stream'),{spawn}=require('node:child_process'),fs=require('node:fs');
const FRAME=3840; // 20 ms, stereo PCM16 at 48 kHz
function mix(music,voice,musicGain,voiceGain){const out=Buffer.alloc(FRAME);for(let n=0;n<FRAME;n+=2){const x=(music&&n+1<music.length?music.readInt16LE(n)*musicGain:0)+(voice&&n+1<voice.length?voice.readInt16LE(n)*voiceGain:0);out.writeInt16LE(Math.round(Math.max(-31000,Math.min(31000,x))),n);}return out;}
function decode(file,loop=false){if(!fs.existsSync(file))throw Error('Fichier audio manquant : '+require('node:path').basename(file));const ffmpeg=process.env.FFMPEG_PATH||require('ffmpeg-static');if(!ffmpeg||!fs.existsSync(ffmpeg))throw Error('FFmpeg indisponible');const p=spawn(ffmpeg,['-hide_banner','-loglevel','error',...(loop?['-stream_loop','-1']:[]),'-i',file,'-vn','-f','s16le','-ar','48000','-ac','2','pipe:1'],{stdio:['ignore','pipe','pipe'],windowsHide:true});const stream=new PassThrough({highWaterMark:FRAME*25});p.stdout.pipe(stream);const source={process:p,stream,ended:false,error:null};stream.on('finish',()=>{source.ended=true;});stream.on('error',e=>{source.error=e;});p.stderr.on('data',()=>{});p.on('error',e=>{source.error=e;});p.on('close',code=>{if(code&&code!==255)source.error=Error('Décodage audio impossible');});p.stdout.on('error',e=>{source.error=e;});return source;}
function take(s){const b=s.stream.read(FRAME);if(b)return b;if(s.ended&&s.stream.readableLength)return s.stream.read(Math.min(FRAME,s.stream.readableLength));return null;}
class Mixer extends Readable{
 constructor(file,options){super({highWaterMark:FRAME*10});this.options=options;this.music=decode(file,true);this.gain=options.normal;this.ramp=null;this.announcement=null;this.timer=null;this.demand=false;this.pumping=false;this.on('error',()=>{});this.watch(this.music);}
 fade(target,ms,done){this.ramp={from:this.gain,to:target,frames:Math.max(1,Math.round(ms/20)),step:0,done};}
 announce(file){if(this.destroyed)throw Error('Lecture arrêtée');if(this.announcement)throw Error('Une annonce est déjà en cours.');const source=decode(file);this.watch(source);return new Promise((resolve,reject)=>{this.announcement={source,resolve,reject,speaking:false,started:false};});}
 // Discord already clocks playback at 20 ms. Produce buffered PCM on demand,
 // without adding another timer that accumulates scheduling/encoding delays.
 watch(source){
  source.stream.on('readable',()=>this.pump());
  source.stream.on('finish',()=>this.pump());
  source.stream.on('error',e=>this.destroy(e));
  source.process.on('error',e=>this.destroy(e));
  source.process.on('close',()=>{if(source.error&&!this.destroyed)this.destroy(source.error);});
 }
 _read(){this.demand=true;this.pump();}
 pump(){
  if(!this.demand||this.pumping||this.destroyed)return;
  this.pumping=true;
  try{while(this.demand&&!this.destroyed){
   if(this.music.error)throw this.music.error;
   const ann=this.announcement;
   if(ann&&!ann.started&&(ann.source.stream.readableLength>=FRAME||ann.source.ended)){ann.started=true;this.fade(this.options.duck,this.options.downMs,()=>{ann.speaking=true;});}
   if(ann?.source.error)throw ann.source.error;
   // Wait for decoded samples instead of inserting gaps or consuming only one track.
   if(this.music.stream.readableLength<FRAME&&!this.music.ended)break;
   if(ann?.speaking&&ann.source.stream.readableLength<FRAME&&!ann.source.ended)break;
   const m=take(this.music);
   if(!m){if(this.music.ended)throw Error('La boucle musicale s’est arrêtée.');break;}
   if(this.ramp){const r=this.ramp;this.gain=r.from+(r.to-r.from)*Math.min(1,++r.step/r.frames);if(r.step>=r.frames){this.gain=r.to;this.ramp=null;r.done?.();}}
   let v=null;
   if(ann?.speaking){v=take(ann.source);if(!v&&ann.source.ended&&!ann.finished){ann.finished=true;ann.speaking=false;this.voiceEndedAt=Date.now();this.fade(this.options.normal,this.options.upMs,()=>{this.announcement=null;ann.resolve();});}}
   this.demand=this.push(mix(m,v,this.gain,this.options.voice));
  }}catch(e){this.destroy(e);}finally{this.pumping=false;}
 }
 _destroy(error,done){clearTimeout(this.timer);const sources=[this.music,this.announcement?.source].filter(Boolean);const stopped=sources.map(s=>new Promise(resolve=>{s.stream.destroy();if(s.process.exitCode!==null||s.process.signalCode!==null)return resolve();s.process.once('close',resolve);s.process.kill();}));if(this.announcement){this.announcement.reject(error||Error('Lecture arrêtée'));this.announcement=null;}Promise.all(stopped).then(()=>done(error),done);}
}
module.exports={Mixer,mix,decode,FRAME};
