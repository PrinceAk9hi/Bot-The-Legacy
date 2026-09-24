const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags,ContainerBuilder,TextDisplayBuilder}=require('discord.js');
const {hasBypass,isProtectedUser}=require('./security');
const {RANK_ALLOWED_ROLES,MAIN_RANKS}=require('../config/ranks');
const {IDENTITY,ROLES,COLORS}=require('../config/soulSociety');
const busy=new Set();
function modal(id,title,inputs){return new ModalBuilder().setCustomId(id).setTitle(title).addComponents(inputs.map(({name,label,required=true,placeholder,max=500})=>{
 const input=new TextInputBuilder().setCustomId(name).setLabel(label).setStyle(name==='date'?TextInputStyle.Short:TextInputStyle.Paragraph).setRequired(required).setMaxLength(max);
 if(placeholder)input.setPlaceholder(placeholder);
 return new ActionRowBuilder().addComponents(input);
}));}
function adapter(i,member,actor,name,strings){return new Proxy(i,{get(obj,key){
 if(key==='commandName')return name;if(key==='member')return actor;
 if(key==='options')return {getUser:()=>member.user,getMember:()=>member,getString:k=>strings[k]??null,data:[{name:'membre',type:6,value:member.id},...Object.entries(strings).map(([name,value])=>({name,type:3,value}))]};
 if(key==='deferReply')return async()=>{};
 if(key==='reply')return payload=>i.editReply(typeof payload==='string'?payload:Object.fromEntries(Object.entries(payload).filter(([k])=>k!=='flags')));
 const value=Reflect.get(obj,key,obj);return typeof value==='function'?value.bind(obj):value;
}});}
async function handle(i){
 const [,owner,target,action,level]=i.customId.split(':');
 const fail=text=>i.deferred||i.replied?i.editReply({content:'❌ '+text}):i.reply({content:'❌ '+text,flags:MessageFlags.Ephemeral});
 if(i.guildId!==IDENTITY.guildId||i.user.id!==owner)return fail('Ce panneau ne t’appartient pas.');
 if(!hasBypass(i)&&!RANK_ALLOWED_ROLES.some(id=>i.member.roles.cache.has(id)))return fail('Accès refusé.');
 const warnings=require('../commandes/avert').WARNING_ROLES;
 if(!['convocation','validate','sanctions','warning'].includes(action))return fail('Action incorrecte.');
 if(action==='warning'&&!warnings[level])return fail('Niveau d’avertissement inconnu.');
 try{
  if(i.isButton()){
   if(action==='sanctions'){
    await i.deferReply({flags:MessageFlags.Ephemeral});
    const member=await i.guild.members.fetch({user:target,force:true});
    const held=Object.values(warnings).filter(w=>member.roles.cache.has(w.roleId)).map(w=>w.label);
    const c=new ContainerBuilder().setAccentColor(COLORS.sanction).addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ⚠️ Sanctions\n<@${target}>\n**Avertissements actuels :** ${held.join(', ')||'Aucun'}\nChoisis le niveau à attribuer, puis renseigne le motif. Le fonctionnement et les protections de =avert s’appliquent.`));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(Object.entries(warnings).map(([key,w])=>new ButtonBuilder().setCustomId(`userpage:${owner}:${target}:warning:${key}`).setLabel(w.label).setStyle(ButtonStyle.Danger))));
    return i.editReply({components:[c],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[]}});
   }
   if(action==='convocation')return i.showModal(modal(i.customId,'Convoquer le membre',[
    {name:'date',label:'Date et heure de Paris',placeholder:'JJ/MM/AAAA HH:MM',max:16},
    {name:'reason',label:'Raison (facultative)',required:false,max:900}
   ]));
   if(action==='validate')return i.showModal(modal(i.customId,'Valider : Test → Membre Aspirant',[
    {name:'reason',label:'Bilan — envoyer confirme la validation',placeholder:'Motif de validation de la période de test'}
   ]));
   return i.showModal(modal(i.customId,warnings[level].label,[{name:'reason',label:'Motif de l’avertissement'}]));
  }
  if(!i.isModalSubmit()||action==='sanctions')return fail('Action incorrecte.');
  await i.deferReply({flags:MessageFlags.Ephemeral});
  const key=i.guildId+':'+target;
  if(busy.has(key))return fail('Une action est déjà en cours sur ce membre.');
  busy.add(key);
  try{
   const actor=await i.guild.members.fetch({user:i.user.id,force:true});
   if(!hasBypass(actor)&&!RANK_ALLOWED_ROLES.some(id=>actor.roles.cache.has(id)))return fail('Tu n’as plus la permission nécessaire.');
   const member=await i.guild.members.fetch({user:target,force:true});if(member.user.bot)return fail('Choisis un membre humain.');
   const reason=i.fields.getTextInputValue('reason').trim();
   if(action!=='convocation'&&!reason)return fail('Le motif est obligatoire.');
   if(action==='convocation')return await require('../commandes/convocation').execute(adapter(i,member,actor,'convocation',{date:i.fields.getTextInputValue('date').trim(),raison:reason}));
   if(action==='warning')return await require('../commandes/avert').execute(adapter(i,member,actor,'avert',{choixavert:level,raison:reason}));
   if(i.user.id!=='547192186547077130'&&isProtectedUser(target,'rank'))return fail('Ce compte est protégé.');
   if(!member.roles.cache.has(ROLES.test))return fail('Ce membre n’est plus en période de test. Aucune modification effectuée.');
   if(Object.values(MAIN_RANKS).some(r=>r.roleId!==ROLES.test&&member.roles.cache.has(r.roleId))||member.roles.cache.has(ROLES.confirmed))return fail('Le membre possède déjà un autre grade : vérifie ses rôles avec =rank avant de valider son test.');
   return await require('../commandes/rank').execute(adapter(i,member,actor,'rank',{categorie:'grade',action:'add',role:'confirme',note:'Validation de la période de test : '+reason}));
  }finally{busy.delete(key);}
 }catch(e){console.error('Gestion =user :',e.code||e.message);return fail('Action interrompue. Vérifie les rôles et les logs avant de réessayer.').catch(()=>{});}
}
module.exports={handle,adapter};
