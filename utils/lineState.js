const {read,update}=require('./recruitmentData');
const OWNER_ID='547192186547077130';
function isOff(){return read('lineState').off===true;}
function setOff(off){update('lineState',d=>{d.off=off;d.updatedAt=Date.now();d.by=OWNER_ID;});}
module.exports={OWNER_ID,isOff,setOff};
