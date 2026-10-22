const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const {fullBody,trustedImage}=require('../utils/qgRobloxAvatar');
const {render,cropBounds}=require('../utils/qgArrivalCard');
const c=createCanvas(420,420),ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(100,20,200,380);const png=c.toBuffer('image/png');
const json=value=>new Response(JSON.stringify(value));
const completed={data:[{targetId:42,state:'Completed',imageUrl:'https://tr.rbxcdn.com/example.png'}]};
test('ID exact, endpoint avatar entier et PNG conservé',async()=>{
 const calls=[];const result=await fullBody('42',{fetcher:async url=>{calls.push(url);return calls.length===1?json(completed):new Response(png);}});
 assert.deepEqual(result,png);assert.match(calls[0],/\/users\/avatar\?userIds=42&size=420x420&format=Png&isCircular=false$/);
});
test('Pending puis Completed, nombre de tentatives borné',async()=>{
 let calls=0;const result=await fullBody('42',{sleep:async()=>{},fetcher:async()=>{calls++;return calls===1?json({data:[{targetId:42,state:'Pending'}]}):calls===2?json(completed):new Response(png);}});assert.deepEqual(result,png);assert.equal(calls,3);
 calls=0;assert.equal(await fullBody('42',{sleep:async()=>{},fetcher:async()=>{calls++;return json({data:[{targetId:42,state:'Pending'}]});}}),null);assert.equal(calls,3);
});
test('ID absent, modéré, mauvais utilisateur et CDN non fiable',async()=>{
 assert.equal(await fullBody(null,{fetcher:()=>{throw Error('ne doit pas appeler');}}),null);
 for(const item of [{targetId:42,state:'Blocked'},{targetId:43,state:'Completed',imageUrl:completed.data[0].imageUrl},{targetId:42,state:'Completed',imageUrl:'https://example.com/a.png'}])assert.equal(await fullBody('42',{fetcher:async()=>json({data:[item]})}),null);
 assert.equal(trustedImage('https://rbxcdn.com.evil.test/a'),false);assert.equal(trustedImage('http://tr.rbxcdn.com/a'),false);
});
test('Erreur réseau, limitation, téléchargement trop gros ou corrompu : secours',async()=>{
 assert.equal(await fullBody('42',{fetcher:async()=>{throw Error('réseau');}}),null);
 let calls=0;assert.equal(await fullBody('42',{sleep:async()=>{},fetcher:async()=>{calls++;return new Response('',{status:429});}}),null);assert.equal(calls,3);
 for(const response of [new Response('not png'),new Response('x',{headers:{'content-length':'99999999'}})]){
  let n=0;assert.equal(await fullBody('42',{fetcher:async()=>++n===1?json(completed):response}),null);
 }
});
test('Rendu transparent, dimensions et secours sans réseau',async()=>{
 const member={id:'test',displayName:'Nom très long '.repeat(12),user:{username:'Test',displayAvatarURL:()=> 'https://cdn.discordapp.com/example.png'}};
 assert.deepEqual(cropBounds(await loadImage(png)),{x:100,y:20,width:200,height:380});
 const image=await loadImage(await render(member,{robloxId:'42',fetchAvatar:async()=>png,fetcher:async()=>{throw Error('Discord inutile');}}));assert.equal(image.width,1100);assert.equal(image.height,400);
 const fallback=await loadImage(await render(member,{robloxId:'42',fetchAvatar:async()=>null,fetcher:async()=>{throw Error('Discord indisponible');}}));assert.equal(fallback.width,1100);
 const opaque=createCanvas(10,10),o=opaque.getContext('2d');o.fillRect(0,0,10,10);assert.equal(cropBounds(opaque),null);
});
