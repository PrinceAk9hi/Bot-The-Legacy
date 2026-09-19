const { IDENTITY, ROLES } = require('../config/soulSociety');
const { hasBypass } = require('./security');
const { MAIN_RANKS } = require('../config/ranks');
function personal(member) { return hasBypass(member) || Boolean(member?.roles?.cache && [ROLES.member,ROLES.confirmed,...Object.values(MAIN_RANKS).map(r=>r.roleId)].some(id=>member.roles.cache.has(id))); }
function recruiter(member) { return hasBypass(member) || Boolean(member?.roles?.cache?.has(ROLES.recruitmentManagement)); }
function allowed(i, staff=false) { return i.guildId===IDENTITY.guildId && (staff?recruiter(i.member):personal(i.member)); }
function date(value) { const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value||'');if(!m)return null;const [,d,mo,y]=m.map(Number);const t=Date.UTC(y,mo-1,d);const a=new Date(t);return a.getUTCFullYear()===y&&a.getUTCMonth()===mo-1&&a.getUTCDate()===d?t:null; }
module.exports={personal,recruiter,allowed,date};
