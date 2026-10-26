const OpenAI=require('openai');
const store=require('./qgAiStore');
function configured(){return Boolean(process.env.QG_AI_API_KEY||process.env.OPENAI_API_KEY);}
function model(){return process.env.QG_AI_MODEL||process.env.TICKET_AI_MODEL||'gpt-5.6-luna';}
async function complete(payload){
 const day=new Date().toISOString().slice(0,10),limit=Math.max(1,Number(process.env.QG_AI_DAILY_REQUEST_LIMIT)||500);
 store.transact(s=>{s.providerBudget||={};const b=s.providerBudget;if(b.day!==day){b.day=day;b.requests=0;}if(b.requests>=limit)throw Error('Budget quotidien IA atteint.');b.requests++;});
 const baseURL=process.env.QG_AI_BASE_URL;if(baseURL&&new URL(baseURL).protocol!=='https:')throw Error('Le fournisseur IA doit utiliser HTTPS.');
 return new OpenAI({apiKey:process.env.QG_AI_API_KEY||process.env.OPENAI_API_KEY,...(baseURL?{baseURL}:{}),maxRetries:0,timeout:20000}).chat.completions.create(payload);
}
module.exports={complete,configured,model};
