const SOUL_SOCIETY_ID='1080943923691782154';
async function leaveSoulSociety(client){const guild=client.guilds.cache.get(SOUL_SOCIETY_ID);if(!guild)return false;await guild.leave();return true;}
module.exports={SOUL_SOCIETY_ID,leaveSoulSociety};