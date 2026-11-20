// Guide d'entretien oral du QG (bouton « Questions » du panel recruteur).
const part1 = [
  'Pourquoi devrions-nous te faire confiance et te donner une place au sein du QG ?',
  'Qu’est-ce que signifie, pour toi, le respect des membres et du RP ?',
  'Mise en situation : en plein vocal, devant d’autres membres, un membre du QG te provoque et te manque de respect. Que fais-tu sur le moment, et à qui en parles-tu ensuite ?',
  'Est-ce que tu préfères avancer seul ou en communauté ? Pourquoi ?'
];
// Dernière question, posée après les mises en situation.
const finalQuestion = 'Si tu es accepté, es-tu prêt à respecter les règles, à représenter correctement la famille et à accepter les décisions du staff ?';
const situations = [
  ['Provocation', 'Un membre d’une autre famille vient sur le serveur et commence à provoquer les membres de la Famille. Plusieurs personnes te demandent de répondre et de le remettre à sa place.', 'Que fais-tu dans cette situation et pourquoi ?'],
  ['Conflit interne', 'Deux membres du QG se disputent violemment dans un salon vocal communautaire. D’autres membres commencent à prendre parti et la situation dégénère.', 'Comment réagis-tu pour calmer la situation ?'],
  ['Un ami enfreint les règles', 'Ton meilleur ami, membre du QG, insulte un membre et enfreint le règlement. Il te demande de ne rien dire au staff parce que vous êtes proches.', 'Que fais-tu ? Est-ce que ton amitié doit passer avant les règles ?'],
  ['Manque d’activité', 'Tu as été accepté dans le QG, mais tu n’es plus très actif depuis plusieurs jours. Un responsable vient te demander des explications.', 'Comment lui réponds-tu et comment comptes-tu gérer ton activité à l’avenir ?'],
  ['Information confidentielle', 'Tu apprends une information privée concernant l’organisation de la Famille. Un ami extérieur te demande de lui transmettre cette information.', 'Que fais-tu ?']
];
const sections = helpChannel => [
  ['Partie 1 — Questions', part1.map((q, n) => `**${n + 1}.** ${q}`).join('\n\n')],
  ['Partie 2 — Les 5 mises en situation', situations.map(([title, text, q], n) => `**Situation ${n + 1} — ${title}**\n> ${text}\n**Question :** ${q}`).join('\n\n') + `\n\n**Dernière question**\n${finalQuestion}`],
  ['Fin d’entretien', [
    '🏷️ **Le tag du serveur est obligatoire.** Explique-lui qu’il doit porter le tag QG en permanence.',
    '📈 **Une forte activité est obligatoire pour rankup** : principalement sur Discord (messages, vocal), mais aussi en jeu.',
    `⛩️ **Présente-lui le help QG** : montre-lui rapidement en stream le salon ${helpChannel ? `<#${helpChannel}>` : 'help-qg'} et ses embeds (salons de la famille, grades, communauté Roblox).`
  ].join('\n\n')]
];
module.exports = { part1, situations, finalQuestion, sections };
