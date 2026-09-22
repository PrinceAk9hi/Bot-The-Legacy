const {EmbedBuilder}=require('discord.js');
const {COLORS}=require('../config/soulSociety');
const {ensurePanel}=require('../utils/recruitmentData');
module.exports=async function(client){
 const embed=new EmbedBuilder().setColor(COLORS.primary).setTitle('👑 Guide de gestion • La Soul Society')
 .setDescription('Aide destinée à la fondation. Les commandes de gestion sont réservées à Aven, aux rôles bypass et aux fondateurs / Bras droit. Les permissions propres à chaque action restent vérifiées.')
 .addFields(
 {name:'👤 /user membre',value:'Ouvre les contrôles du membre : vocal, rankup, rétrogradation, derank et prison. **Libérer** restaure les accès précédents. Les actions de grade demandent un motif.'},
 {name:'📈 /rank',value:'Choisir le membre, la catégorie, l’action et le rôle. Permet de sélectionner précisément un grade ou une gestion.'},
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
 try{await ensurePanel(client,'1552041520851451995','foundation_help',{embeds:[embed],allowedMentions:{parse:[]}});}catch(e){console.error('Panel aide fondation :',e.code||e.message);}
};
