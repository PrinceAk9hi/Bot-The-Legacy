const {Events,ActionRowBuilder,ButtonBuilder,ButtonStyle,ModalBuilder,TextInputBuilder,TextInputStyle,MessageFlags}=require('discord.js');
const {MAIN_RANKS}=require('../config/ranks');
const {IDENTITY}=require('../config/soulSociety');
const {hasBypass,isProtectedUser}=require('../utils/security');
const prison=require('../utils/prison');
const actions={derank:'Derank',up:'Rankup',down:'Rétrograder',prison:'Prison',release:'Libérer'};
function buttons(owner,target){return new ActionRowBuilder().addComponents(Object.entries(actions).map(([a,label])=>new ButtonBuilder().setCustomId(`memberctl:${a}:${owner}:${target}`).setLabel(label).setStyle(['derank','prison'].includes(a)?ButtonStyle.Danger:ButtonStyle.Secondary)));}
function adjacent(member,action){const ranks=Object.entries(MAIN_RANKS),held=ranks.filter(([,r])=>member.roles.cache.has(r.roleId));
 if(held.length!==1)throw Error('Le membre doit posséder un seul grade principal reconnu. Utilise =rank pour choisir explicitement son grade.');
 const index=ranks.findIndex(([k])=>k===held[0][0]),next=ranks[index+(action==='up'?1:-1)];
 if(!next)throw Error(action==='up'?'Ce membre possède déjà le dernier grade.':'Ce membre possède déjà le premier grade.');return {current:held[0][0],next:next[0],name:next[1].name};
}
function register(client){
 require("./candidateArchive")(client);
 const busy=new Set();let maintenance=false;
 async function reconcile(){if(maintenance||busy.size||require('../utils/lineState').isOff())return;maintenance=true;try{const guild=client.guilds.cache.get(IDENTITY.guildId);if(guild)await prison.reconcile(guild);}catch(e){console.error('Prison :',e.code||e.message);}finally{maintenance=false;}}
 client.on(Events.ChannelCreate,c=>{if(c.guildId===IDENTITY.guildId)reconcile();});
 const start=()=>{reconcile();const t=setInterval(reconcile,60000);t.unref();require('./foundationHelp')(client);};
 if(client.isReady())start();else client.once(Events.ClientReady,start);
 client.userActions=async i=>{
  if(!(i.isButton()||i.isModalSubmit())||!i.customId.startsWith('memberctl:'))return;
  const [,action,owner,target,expected]=i.customId.split(':');
  const fail=async text=>{const p={content:'❌ '+text};if(i.deferred||i.replied)return i.editReply(p);return i.reply({...p,flags:MessageFlags.Ephemeral});};
  try{
   if((!actions[action]&&action!=='profile')||owner!==i.user.id||i.guildId!==IDENTITY.guildId)return fail('Ce panneau ne t’appartient pas.');
   if(action==='profile'&&i.isButton()){if(expected==='open')await i.deferReply({flags:MessageFlags.Ephemeral});else await i.deferUpdate();}
   if(i.isModalSubmit())await i.deferReply({flags:MessageFlags.Ephemeral});
   const actor=await i.guild.members.fetch(i.user.id);if(!hasBypass(actor))return fail('Accès réservé à Aven, aux bypass et à la fondation.');
   if(action==='profile'){
    if(!i.isButton())return fail('Action incorrecte.');
    const member=await i.guild.members.fetch(target);
    const tab=['apps','history'].includes(expected)?expected:'summary';
    return i.editReply(require('./candidateProfile').payload(member,owner,tab,Number(i.customId.split(':')[5])||0));
   }
   if(i.user.id!=='547192186547077130'&&isProtectedUser(target,action==='derank'?'derank':action))return fail('Ce compte est protégé.');
   const member=await i.guild.members.fetch(target);if(member.user.bot)return fail('Choisis un membre humain.');
   let grade;if(action==='up'||action==='down')grade=adjacent(member,action);
   if(i.isButton()){
    const modal=new ModalBuilder().setCustomId(`memberctl:${action}:${owner}:${target}:${grade?.current||'none'}`).setTitle((grade?`${actions[action]} : ${grade.name}`:actions[action]).slice(0,45));
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Motif — valider confirme cette action').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)));
    return i.showModal(modal);
   }
   if(grade&&grade.current!==expected)return fail('Le grade a changé depuis l’ouverture. Rouvre le panneau.');
   if(busy.has(target)||maintenance)return fail('Une opération est déjà en cours. Réessaie dans quelques instants.');
   busy.add(target);
   try{
    const reason=i.fields.getTextInputValue('reason').trim();if(!reason)return fail('Le motif est obligatoire.');
    if(action==='prison'||action==='release'){
     if(action==='prison')await prison.imprison(member,reason);else await prison.release(member);
     return i.editReply(action==='prison'?'✅ Membre placé en prison : accès aux salons masqués, rôles conservés.':'✅ Membre libéré : accès précédents restaurés.');
    }
    const name=action==='derank'?'derank':'rank';
    const strings=action==='derank'?{raison:reason}:{categorie:'grade',action:'add',role:grade.next,note:reason};
    const options={data:[{name:'membre',type:6,value:member.id},...Object.entries(strings).map(([name,value])=>({name,type:3,value}))],getUser:()=>member.user,getMember:()=>member,getString:k=>strings[k]||null};
    const proxy=new Proxy(i,{get(obj,key){if(key==='options')return options;if(key==='commandName')return name;if(key==='member')return actor;if(key==='deferReply'&&obj.deferred)return async()=>{};const v=Reflect.get(obj,key,obj);return typeof v==='function'?v.bind(obj):v;}});
    await require('../commandes/'+name).execute(proxy);
   }finally{busy.delete(target);}
  }catch(e){await fail(e.message||'Action impossible. Vérifie les permissions du bot.').catch(()=>{});}
 };
}
module.exports=register;module.exports.buttons=buttons;module.exports.adjacent=adjacent;
