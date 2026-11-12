// Aide et FAQ (salon 📚・aide-et-faq) en version communautaire : présentation du QG, histoire,
// fondateurs, inspiration, valeurs, repères sur le serveur, et tout à la fin, comment rejoindre la famille.
// Contenu tiré des informations officielles (utils/qgAiOfficial.js, config/qgFamily.js) : à modifier ici
// si l'histoire ou les conditions changent.
const {embed}=require('./qgPanels');
const config=require('../config/qg');

const HISTORY={
 meaning:'QG signifie **Qualité & Grandeur**.',
 opening:'7 novembre 2026 à 20 h',
 founders:'Aven et EMS',
 supervisors:'Key et Meg',
 creator:'Aven'
};
const VALUES=['Activité','Impartialité','Ouverture d’esprit','Inclusivité','Respect','Équité','Convivialité','Esprit collectif','Dynamisme'];

function payload(guild,state=require('../utils/qgAdmin').state()){
 const ch=key=>state.schoolChannels?.[key]?`<#${state.schoolChannels[key]}>`:null;
 const where=(key,label)=>ch(key)?`${ch(key)} — ${label}`:null;
 const intro=embed('📚 Aide et FAQ · Bienvenue au QG',
  `${HISTORY.meaning}\n\nLe QG est une **famille de School RP** sur Roblox, avec son propre serveur Discord. On y joue ensemble, on se retrouve en vocal et on fait vivre une famille soudée, active et respectueuse.\n\nCe salon répond aux questions qu’on se pose en arrivant : d’où vient le QG, qui le dirige, comment se repérer… et comment nous rejoindre.`);
 const history=embed('🕰️ Notre histoire',
  `**Ouverture officielle :** ${HISTORY.opening} (heure de Paris).\n\n**Fondateurs :** ${HISTORY.founders}.\n**Superviseurs :** ${HISTORY.supervisors}.\n\nLe serveur Discord et le bot du QG ont été créés par **${HISTORY.creator}**, cofondateur de la famille.`);
 const inspiration=embed('🎨 Notre inspiration',
  'Le QG est né sur **School RP** et en reprend l’esprit : du roleplay, des rencontres et une vie de groupe.\n\nSon identité visuelle s’inspire d’une **esthétique ancienne et éditoriale** : pages de livres anciens, papier vieilli, gravures, billets d’époque et typographies classiques. C’est pour ça que nos cartes ressemblent à un journal : *Le Journal du QG*.');
 const values=embed('💎 Nos valeurs',VALUES.map(v=>`• ${v}`).join('\n'));
 const guide=[where('rules','le règlement à accepter pour accéder au serveur'),where('tickets','une question personnelle ? ouvre un ticket'),where('communityCommands','les commandes du bot'),where('levelsInfo','les niveaux et l’XP'),where('giveawaysInfo','les giveaways'),where('communitySuggestions','tes idées pour le serveur')].filter(Boolean);
 const map=embed('🧭 Se repérer',`${guide.join('\n')||'Les salons principaux sont listés dans la catégorie Accueil.'}\n\nCommandes utiles : \`/profil\` (ta carte de membre), \`/classement\`, \`=niveau\`.`);
 const conditions=require('../config/qgFamily').conditions;
 const join=embed('✦ Rejoindre la famille',
  `${conditions}\n\n**Comment faire ?**\n1. Accepte le règlement et termine ta vérification.\n2. Dépose ta candidature dans ${ch('familyApplications')||'le salon des candidatures famille'} (questionnaire en MP).\n3. Si elle est retenue, tu passes un entretien vocal avec un recruteur.\n4. Accepté(e) ? Tu deviens **Membre Test** et tu rejoins la [communauté Roblox du QG](${config.robloxGroupUrl}).\n\nOn a hâte de te compter parmi nous !`);
 return{embeds:[intro,history,inspiration,values,map,join],allowedMentions:{parse:[]}};
}
module.exports={payload,HISTORY};
