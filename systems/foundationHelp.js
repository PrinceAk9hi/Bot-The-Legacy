const {EmbedBuilder,ActionRowBuilder,StringSelectMenuBuilder,Events,MessageFlags}=require('discord.js');
const {hasBypass}=require('../utils/security');
const {IDENTITY}=require('../config/soulSociety');
const commands=['user','rank','mrankup','derank','suivi-test','analyse','avert','convocation','entretien','seelink','badge','bienvenue','mon-profil','absence','maintenance','line'];
const {COLORS}=require('../config/soulSociety');
const {ensurePanel}=require('../utils/recruitmentData');
module.exports=async function(client){
 if(!client.foundationHelpCopyRegistered){
  client.foundationHelpCopyRegistered=true;
  client.on(Events.InteractionCreate,async i=>{
   if(!i.isStringSelectMenu()||i.customId!=='foundation_help')return;
   if(i.guildId!==IDENTITY.guildId||!hasBypass(i))return i.reply({content:'❌ Aide réservée à la fondation et aux bypass.',flags:MessageFlags.Ephemeral});
   const name=i.values[0];if(!commands.includes(name))return;
   await i.reply({content:'Commande à copier :\n\x60\x60\x60\n/'+name+'\n\x60\x60\x60\nColle-la dans la zone de message puis complète les options proposées par Discord.',flags:MessageFlags.Ephemeral});
  });
 }
 let registered;
 try{registered=await client.guilds.cache.get(IDENTITY.guildId)?.commands.fetch();}catch(e){console.error('Liens commandes aide :',e.code||e.message);}
 const embed=new EmbedBuilder().setColor(COLORS.primary).setTitle('👑 Guide de gestion • La Soul Society')
 .setDescription('⛔ **Merci de ne pas écrire dans ce salon : il est réservé au guide des commandes.**\n\nAppuie sur une commande cliquable pour la préparer dans Discord. Le menu ci-dessous affiche aussi son texte à copier.\n\nAide destinée à la fondation. Les commandes de gestion sont réservées à Aven, aux rôles bypass et aux fondateurs / Bras droit. Les permissions propres à chaque action restent vérifiées.')
 .addFields(
 {name:'👤 /user membre',value:'Ouvre les contrôles du membre : vocal, rankup, rétrogradation, derank et prison. **Libérer** restaure les accès précédents. Les actions de grade demandent un motif.'},
 {name:'📈 /rank',value:'Choisir le membre, la catégorie, l’action et le rôle. Permet de sélectionner précisément un grade ou une gestion.'},
 {name:'👥 /mrankup grade membre1 … [note]',value:'Attribue le grade choisi à plusieurs membres en une seule commande. Ajoute les membres dans les options proposées ; la note est facultative.'},
 {name:'📉 /derank membre raison',value:'Retire les rôles configurés et expulse de la communauté Roblox selon la configuration. À utiliser avec précaution : ce n’est pas une simple rétrogradation d’un grade.'},
 {name:'🌸 /suivi-test membre',value:'Consulte le suivi de la période de test du membre.'},
 {name:'📊 /analyse',value:'Consulte le bilan du membre : grade, activité et informations disponibles sur son profil.'},
 {name:'⚠️ /avert membre choixavert raison',value:'Attribue le niveau d’avertissement choisi et publie la sanction dans le Carnet.'},
 {name:'📨 /convocation membre date [raison]',value:'Date obligatoire : **JJ/MM/AAAA HH:MM**, heure de Paris. Sans raison : « Révélé lors de la convocation. » Le membre confirme, reçoit le lien du vocal d’attente et un rappel 30 minutes avant. Son arrivée est signalée au convocateur.'},
 {name:'🎙️ /entretien',value:'Gérer l’entretien depuis un bureau autorisé ; le panel fixe permet également de consulter la candidature et les questions.'},
 {name:'🔗 /seelink • /badge membre',value:'Consulter une liaison Discord / Roblox ; attribuer le badge Roblox au compte lié.'},
 {name:'🏡 /bienvenue • /mon-profil • /absence',value:'Accueil initial du membre ; modification de son profil et de ses disponibilités ; déclaration d’une absence.'},
 {name:'🛠️ /maintenance • /line',value:'Gestion de la maintenance. **/line on|off est exclusivement réservé à Aven.**'}
 ).setFooter({text:'Les boutons de /user conservent les contrôles des commandes existantes.'});
 for(const field of embed.data.fields){
  const names=field.name.match(/\/[a-z-]+/g)||[];
  const links=names.map(text=>{const command=registered?.find(c=>c.name===text.slice(1));return command?' </'+command.name+':'+command.id+'>':'\x60'+text+'\x60';});
  if(links.length)field.value=links.join(' • ')+'\n'+field.value;
 }
 const menu=new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('foundation_help').setPlaceholder('Afficher une commande à copier').addOptions(commands.map(name=>({label:'/'+name,value:name}))));
 try{await ensurePanel(client,'1552041520851451995','foundation_help',{embeds:[embed],components:[menu],allowedMentions:{parse:[]}});}catch(e){console.error('Panel aide fondation :',e.code||e.message);}
};
