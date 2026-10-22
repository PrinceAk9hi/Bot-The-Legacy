// Une vérification ne vaut que pour le séjour pendant lequel elle a été faite.
function current(profile,member){
 if(!profile)return false;
 if(profile.departed)return false;
 const joined=member.joinedTimestamp;
 if(!joined)return true;
 if(profile.joinedAt)return profile.joinedAt===joined;
 const recorded=profile.acceptedAt||profile.createdAt||(profile.expires?profile.expires-1800000:0);
 return recorded>=joined;
}
function invalidate(member,{read,update},departed=false){
 const profile=read('qgServer').schoolEntryVerification?.[member.id];
 if(!profile)return;
 update('qgServer',s=>{
  if(profile.acceptedAt){
   s.schoolVerificationHistory||={};
   const key=member.id+':'+profile.acceptedAt;
   s.schoolVerificationHistory[key]||={userId:member.id,...profile};
  }
  s.schoolEntryVerification[member.id]={
   stage:'profile',joinedAt:member.joinedTimestamp||0,departed,
   robloxId:profile.robloxId,robloxName:profile.robloxName,
   displayName:profile.displayName,discordName:profile.discordName,
   resetAt:Date.now()
  };
 });
}
module.exports={current,invalidate};
