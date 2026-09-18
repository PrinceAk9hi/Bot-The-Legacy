const { ROLES, IDENTITY, CHANNELS } = require('../config/soulSociety');
const { MAIN_RANKS } = require('../config/ranks');
const ranks = Object.values(MAIN_RANKS).map(r => r.roleId);
function grade(member) { return [...ranks].reverse().find(id => member.roles.cache.has(id)) || null; }
function eligible(member) { return member?.guild?.id === IDENTITY.guildId && !member.user.bot && (member.roles.cache.has(ROLES.member) || ranks.some(id => member.roles.cache.has(id))); }
function inOffice(i) { return i.guildId === IDENTITY.guildId && CHANNELS.interviewRooms.includes(i.member?.voice?.channelId || i.member?.voice?.channel?.id); }
function duration(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)} h ${Math.floor(s % 3600 / 60)} min ${s % 60} s`; }
const OFFICE_MESSAGE = '❌ Rejoins un des cinq bureaux d’entretien pour utiliser ce panel.';
module.exports = { grade, eligible, inOffice, duration, OFFICE_MESSAGE };
