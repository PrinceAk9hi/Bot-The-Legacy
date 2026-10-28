// Vérifie que chaque commande se charge et respecte les limites de l’API Discord
// avant l’enregistrement : une seule commande invalide fait échouer tout le PUT.
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..','commandes');
const NAME=/^[-_\p{L}\p{N}]{1,32}$/u;
function check(option,where,problems){
 if(!NAME.test(option.name)||option.name!==option.name.toLowerCase())problems.push(`${where} : nom invalide « ${option.name} »`);
 if(!option.description||option.description.length>100)problems.push(`${where} : description vide ou > 100 caractères`);
 const children=option.options||[];
 if(children.length>25)problems.push(`${where} : plus de 25 options`);
 let optional=false;const seen=new Set();
 for(const child of children){
  if(seen.has(child.name))problems.push(`${where} : option en double « ${child.name} »`);seen.add(child.name);
  if(child.type>2){if(child.required&&optional)problems.push(`${where} : option obligatoire « ${child.name} » après une option facultative`);if(!child.required)optional=true;}
  for(const choice of child.choices||[])if(String(choice.value).length>100||choice.name.length>100)problems.push(`${where}/${child.name} : choix trop long`);
  if((child.choices||[]).length>25)problems.push(`${where}/${child.name} : plus de 25 choix`);
  check(child,`${where}/${child.name}`,problems);
 }
}
test('toutes les commandes se chargent avec un schéma Discord valide',()=>{
 const problems=[],names=new Map();
 for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.js'))){
  let command;try{command=require(path.join(dir,file));}catch(e){problems.push(`${file} : chargement impossible (${e.message})`);continue;}
  if(!command?.data||typeof command.execute!=='function'){problems.push(`${file} : data ou execute manquant`);continue;}
  const json=typeof command.data.toJSON==='function'?command.data.toJSON():command.data;
  if(names.has(json.name))problems.push(`${file} : nom « ${json.name} » déjà utilisé par ${names.get(json.name)}`);names.set(json.name,file);
  if(json.type&&json.type!==1)continue;
  check(json,file,problems);
 }
 assert.deepEqual(problems,[]);
});
