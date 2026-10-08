const {ROLES,SECURITY}=require('../config/soulSociety');
const {read,update}=require('./recruitmentData');
const defaults={event:{title:'Début d’événement',text:'Un événement va commencer ! Les membres souhaitant participer sont invités à consulter le salon des annonces et à rejoindre les organisateurs. Bon événement à toutes et à tous.'},gather:{title:'Rassemblement',text:'Un rassemblement de la famille est demandé. Merci de vous tenir disponibles et de consulter les dernières consignes de la fondation.'},meeting:{title:'Rappel de réunion',text:'La réunion de la famille approche. Merci de consulter l’annonce pour vérifier l’heure, puis de rejoindre le salon conférence à l’horaire prévu.'}};
function allowed(subject){const member=subject.member||subject,id=subject.user?.id||member.user?.id||member.id;if(SECURITY.deniedBypassUserIds?.includes(id))return false;return SECURITY.bypassUserIds.includes(id)||[ROLES.founderMalach,ROLES.founderMrLarbi,ROLES.rightHand].some(id=>member.roles?.cache?.has(id));}
const get=id=>read('radioDrafts')[id];
function save(id,fn){update('radioDrafts',s=>{if(!s[id])throw Error('Panel expiré : relance =radio.');fn(s[id]);s[id].updatedAt=Date.now();});return get(id);}
function templates(){return {...defaults,...read('radioTemplates')};}
module.exports={allowed,get,save,templates,defaults};
