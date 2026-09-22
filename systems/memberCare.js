const {Events,EmbedBuilder,MessageFlags}=require('discord.js');const {IDENTITY,ROLES}=require('../config/soulSociety');const {read,update}=require('../utils/recruitmentData');
function register(client){const busy=new Set();
client.on(Events.GuildMemberUpdate,(oldMember,member)=>{if(member.guild.id!==IDENTITY.guildId||member.user.bot)return;const was=oldMember.roles.cache.has(ROLES.test),now=member.roles.cache.has(ROLES.test);if(was===now)return;update('memberTests',all=>{if(now)all[member.id]={startedAt:Date.now(),guildId:member.guild.id,source:'Attribution observée du rôle Membre Test'};else if(all[member.id])all[member.id].endedAt=Date.now();});});
require("./convocationFollowup")(client);
}module.exports=register;
