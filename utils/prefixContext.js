const {AsyncLocalStorage}=require('node:async_hooks');
const replies=new AsyncLocalStorage();
function ownerLineReply(channelId,fn){return replies.run({channelId},fn);}
function permitted(options){const context=replies.getStore();return Boolean(context&&['POST','PATCH'].includes(options.method)&&new RegExp('^/channels/'+context.channelId+'/messages(?:/[^/]+)?$').test(options.fullRoute||''));}
module.exports={ownerLineReply,permitted};
