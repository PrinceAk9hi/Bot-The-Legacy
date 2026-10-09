// Installation REST seule : aucun autre système du bot n'est démarré.
const path=require('path');
require('dotenv').config({path:path.join(__dirname,'..','.env'),quiet:true});
const {Client,ClientUser,Routes}=require('discord.js');
const config=require('../config/qg');
(async()=>{
 if(!process.env.TOKEN)throw Error('TOKEN absent.');
 const client=new Client({intents:[]});client.rest.setToken(process.env.TOKEN);
 const identity=await client.rest.get(Routes.user('@me'));
 if(identity.id!=='1550234646711631884')throw Error('Le token local ne correspond pas au bot autorisé. Aucune modification effectuée.');
 client.user=new ClientUser(client,identity);
 const guild=await client.guilds.fetch(config.guildId);
 console.log('Installation ciblée : '+guild.name+' ('+guild.id+')');
 const result=await require('../systems/qgServer').setup(client,guild);
 console.log(JSON.stringify(result,null,2));
 console.log('Installation terminée. Les fonctions permanentes seront actives après le déploiement Railway.');
 await client.destroy();
})().catch(error=>{console.error('Installation QG :',error.code||error.message);process.exitCode=1;});
