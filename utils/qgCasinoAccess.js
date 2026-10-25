const a=require('./qgAdmin'),config=require('../config/qg');
function memberAllowed(member){return !!member&&!member.user.bot&&!member.pending&&member.guild.id===config.guildId&&(a.isDirection(member)||a.has(member,['community','verified','test','confirmed','expert','prestigious','senior','casinoLead','casinoOperator']));}
async function allowed(i){if(i.guildId!==config.guildId)return false;require('./qgDurability').assertDurable();return memberAllowed(await i.guild.members.fetch({user:i.user.id,force:true}));}
function staff(member){return a.isDirection(member)||a.has(member,['casinoLead','casinoOperator']);}
function manager(member){return a.isDirection(member)||a.has(member,['casinoLead']);}
module.exports={allowed,memberAllowed,staff,manager};
