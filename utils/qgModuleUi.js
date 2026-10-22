const {randomUUID}=require('node:crypto');
const d=require('discord.js'),a=require('./qgAdmin');
const row=(...x)=>new d.ActionRowBuilder().addComponents(...x);
const button=(id,label,style=d.ButtonStyle.Secondary)=>new d.ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const menu=(id,options,placeholder='Choisir')=>new d.StringSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder).addOptions(options);
const form=(id,title,fields)=>{const token=id.split(':')[2];if(a.state().moduleSessions?.[token])patch(token,s=>{s.expectedForm=id;});return new d.ModalBuilder().setCustomId(id).setTitle(title).addComponents(...fields.map(([key,label,value='',required=true,long=false])=>row(new d.TextInputBuilder().setCustomId(key).setLabel(label).setValue(String(value)).setRequired(required).setStyle(long?d.TextInputStyle.Paragraph:d.TextInputStyle.Short))));};
const embed=require('../systems/qgPanels').embed;
const payload=(title,description,components=[])=>({content:null,embeds:[embed(title,description||'Aucune donnée enregistrée.')],components,allowedMentions:{parse:[]}});
function session(i,kind,value={}){const id=randomUUID();a.save(s=>{s.moduleSessions||={};for(const [key,v] of Object.entries(s.moduleSessions))if(v.expires<Date.now())delete s.moduleSessions[key];s.moduleSessions[id]={...value,kind,actorId:i.user.id,guildId:i.guildId,expires:Date.now()+15*60000};});return id;}
function get(i,id,kind){const s=a.state().moduleSessions?.[id];if(!s||s.kind!==kind||s.actorId!==i.user.id||s.guildId!==i.guildId||s.expires<Date.now()||s.consumed)throw Error('Interaction expirée ou réservée à son auteur. Rouvre la commande.');return s;}
function patch(id,fn){a.save(s=>{if(!s.moduleSessions?.[id])throw Error('Session expirée.');s.moduleSessions[id].expires=Date.now()+15*60000;fn(s.moduleSessions[id]);});}
function chunks(text,max=3900){const out=[];let rest=String(text);while(rest.length){let end=Math.min(max,rest.length);if(end<rest.length&&/[\uD800-\uDBFF]/.test(rest[end-1]))end--;out.push(rest.slice(0,end));rest=rest.slice(end);}return out.length?out:[''];}
function markdownChunks(text){
 // Prefer paragraph/line boundaries and reopen fenced code blocks on the next
 // embed. The original text remains stored unchanged in the publication record.
 const raw=[];let rest=String(text);
 while(rest.length){let end=Math.min(3750,rest.length);if(end<rest.length){const boundary=rest.lastIndexOf('\n',end-1);if(boundary>1800)end=boundary+1;if(/[\uD800-\uDBFF]/.test(rest[end-1]))end--;}raw.push(rest.slice(0,end));rest=rest.slice(end);}
 let fence=null;return(raw.length?raw:['']).map(part=>{const prefix=fence===null?'':'```'+fence+'\n';for(const match of part.matchAll(/```([^\n`]*)/g)){if(fence===null)fence=match[1].trim().slice(0,50);else fence=null;}return prefix+part+(fence===null?'':'\n```');});
}
function claimForm(token,customId){patch(token,s=>{if(s.expectedForm!==customId)throw Error('Formulaire déjà envoyé ou remplacé. Rouvre-le.');delete s.expectedForm;});}
const time=n=>n?'<t:'+Math.floor(n/1000)+':f>':'Inconnu';
const date=value=>{const at=require('./convocationTime').parseParis(value);if(!Number.isFinite(at))throw Error('Date invalide : JJ/MM/AAAA HH:mm, heure de Paris.');return at;};
const up='<a:statusonline:1562837067782950924>',down='<a:statusoffline:1562836899226324992>';
module.exports={...d,a,row,button,menu,form,payload,session,get,patch,claimForm,chunks,markdownChunks,time,date,up,down};
