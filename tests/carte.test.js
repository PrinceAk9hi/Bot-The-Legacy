const test=require('node:test');
const assert=require('node:assert/strict');
const carte=require('../commandes/carte');
const {ROLES}=require('../config/soulSociety');
const {canUseCommand}=require('../utils/security');
const {createCanvas}=require('@napi-rs/canvas');

test('=carte est accessible aux membres ayant le rôle Membre',()=>{
 const member={roles:{cache:new Map([[ROLES.member,{}]])}};
 assert.equal(canUseCommand({guildId:require('../config/soulSociety').IDENTITY.guildId,user:{id:'test-user'},member},'carte'),true);
 assert.equal(carte.canUseCard(member),true);
});
test('=carte reste refusée aux membres sans rôle Membre ni bypass',()=>{
 const member={id:'not-authorized',roles:{cache:new Map()}};
 assert.equal(carte.canUseCard(member),false);
});
test('la carte change de thème à deux utilisations consécutives du même membre',()=>{
 const first=carte.randomTheme('card-test-user');
 const second=carte.randomTheme('card-test-user');
 assert.notEqual(first.name,second.name);
});
test('le rendu produit bien une carte verticale de collection',()=>{
 const avatar=createCanvas(120,120);const ctx=avatar.getContext('2d');ctx.fillStyle='#7651a8';ctx.fillRect(0,0,120,120);
 const png=carte.makeCard({member:{id:'123456789012345678',displayName:'Membre Soul',user:{username:'membre'},roles:{cache:new Map()}},profile:{displayName:'Joueur Roblox',username:'joueur_roblox',avatar},rank:'Membre',theme:carte.randomTheme('render-test')});
 assert.equal(png.readUInt32BE(16),780);
 assert.equal(png.readUInt32BE(20),1080);
});
