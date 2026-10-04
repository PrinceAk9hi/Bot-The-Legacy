const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const DIRECTORY=path.resolve(process.env.SOUND_DIRECTORY||path.join(__dirname,'../sounds'));
const formats=new Set(['.mp3','.wav','.ogg']);
async function list(){
 let entries;try{entries=await fs.readdir(DIRECTORY,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return [];throw e;}
 return entries.filter(e=>e.isFile()&&formats.has(path.extname(e.name).toLowerCase())).map(e=>({
  id:createHash('sha256').update(e.name).digest('hex').slice(0,32),file:e.name,
  name:path.basename(e.name,path.extname(e.name)).replace(/[_-]+/g,' ').trim()||e.name
 })).sort((a,b)=>a.name.localeCompare(b.name,'fr')||a.file.localeCompare(b.file));
}
async function resolve(id){
 const sound=(await list()).find(s=>s.id===id);if(!sound)throw Error('Ce son est introuvable. Sélectionne-le à nouveau dans /sound.');
 const root=await fs.realpath(DIRECTORY),file=await fs.realpath(path.join(DIRECTORY,sound.file));
 if(path.dirname(file)!==root)throw Error('Fichier audio non autorisé.');
 return {...sound,path:file};
}
async function choices(query){const all=await list(),q=String(query||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return all.filter(s=>s.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(q)).slice(0,25).map(s=>({name:(s.name+(all.filter(x=>x.name===s.name).length>1?' ('+s.file+')':'')).slice(0,100),value:s.id}));}
module.exports={list,resolve,choices,DIRECTORY};
