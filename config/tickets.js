const {CHANNELS}=require('./soulSociety');
const accessRoles=['1473356789453029376','1469803353964810250','1522357970778718249','1471546243653304392','1504782476319526932','1527996778727870496','1471557970079912047','1550252288365436998','1554925010664300634'];
const pingRoles=['1471557970079912047','1550252288365436998'];
const categoryId='1468698948616323155';
const type=(label,emoji,description,channelPrefix)=>({label,emoji,description,channelPrefix,categoryId,responsibleRoles:[],gestionRoles:accessRoles,pingRoles});
const types={
 questions:type('Support Général','✉️','Pour toute question ou besoin d’assistance.','support'),
 report:type("Report d’un joueur de la famille",'⚒️','Signaler un joueur de la famille et transmettre des preuves.','signalement'),
 event:type("Demande d’évènement / animation",'🎉','Proposer un évènement ou une animation.','evenement'),
 partnership:type('Demande de partenariat','🤝','Présenter une demande de partenariat.','partenariat')
};
module.exports={accessRoles,pingRoles,categoryId,types,panelChannel:CHANNELS.ticketPanel,logsChannel:'1471556441218224209'};
