const { randomUUID } = require('node:crypto');
const { SlashCommandBuilder, ChannelType, PermissionFlagsBits: P, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/qg');
const pending = new Map();
const required = [P.ManageChannels, P.ManageRoles];
const snapshot = channel => [...channel.permissionOverwrites.cache.values()].map(o => ({ id: o.id, type: o.type, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString() })).sort((a,b) => a.id.localeCompare(b.id));
const signature = channel => JSON.stringify(snapshot(channel));
const frame = (title, description) => new EmbedBuilder().setColor(0xffffff).setTitle(title).setDescription(description).setFooter({ text: 'Fondateur - QG' });
async function plan(guild, direction, categoryId, channelId) {
  await guild.roles.fetch();
  const all = await guild.channels.fetch();
  const category = all.get(categoryId);
  if (!category || category.type !== ChannelType.GuildCategory) throw Error('La catégorie n’existe plus.');
  const children = [...all.values()].filter(c => c && c.parentId === category.id && !c.isThread());
  const source = direction === 'categorie-vers-salons' ? category : all.get(channelId);
  if (!source?.permissionOverwrites || (direction === 'salon-vers-categorie' && source.parentId !== category.id)) throw Error('Le salon source doit appartenir à cette catégorie.');
  const affected = direction === 'categorie-vers-salons' ? children : [category, ...children.filter(c => c.permissionsLocked)];
  const sourceSnapshot=snapshot(source).filter(o=>o.type!==0||guild.roles.cache.has(o.id));
  return { category, source, affected, sourceSnapshot, sourceSignature: signature(source), targetSignatures: new Map(affected.map(c=>[c.id,signature(c)])), fingerprint: JSON.stringify({ source: signature(source), validSource:sourceSnapshot, children: children.map(c=>[c.id,signature(c)]).sort((a,b)=>a[0].localeCompare(b[0])), category:signature(category) }) };
}
async function authorize(i, p) {
  if (i.guildId !== config.guildId) throw Error('Cette commande est réservée au QG.');
  const [member, bot] = await Promise.all([i.guild.members.fetch({user:i.user.id,force:true}), i.guild.members.fetchMe()]);
  for (const channel of new Map([p.category,p.source,...p.affected].map(c=>[c.id,c])).values()) {
    if (!channel.permissionsFor(member)?.has([P.ViewChannel,...required])) throw Error(`Tu dois pouvoir voir et gérer les salons et permissions de « ${channel.name} ».`);
    if (!channel.permissionsFor(bot)?.has([P.ViewChannel,...required])) throw Error(`Le bot ne peut pas gérer les permissions de « ${channel.name} ».`);
  }
}
module.exports = {
  data: new SlashCommandBuilder().setName('sync').setDescription('Copier les permissions entre une catégorie et ses salons')
    .setDMPermission(false).setDefaultMemberPermissions(P.ManageChannels | P.ManageRoles)
    .addSubcommand(s=>s.setName('separateurs').setDescription('Migrer les accès communs vers les rôles séparateurs'))
    .addSubcommand(s=>s.setName('categorie-vers-salons').setDescription('Appliquer les permissions de la catégorie à tous ses salons')
      .addChannelOption(o=>o.setName('categorie').setDescription('Catégorie source').addChannelTypes(ChannelType.GuildCategory).setRequired(true)))
    .addSubcommand(s=>s.setName('salon-vers-categorie').setDescription('Copier les permissions d’un salon vers sa catégorie')
      .addChannelOption(o=>o.setName('salon').setDescription('Salon source dans la catégorie à modifier').addChannelTypes(ChannelType.GuildText,ChannelType.GuildVoice,ChannelType.GuildAnnouncement,ChannelType.GuildStageVoice,ChannelType.GuildForum,ChannelType.GuildMedia).setRequired(true))),
  async execute(i) {
    if(i.options.getSubcommand()==='separateurs')return require('../systems/qgSeparatorPermissions').execute(i);
    await i.deferReply({flags:MessageFlags.Ephemeral});
    try {
      if(i.guildId!==config.guildId)throw Error('Cette commande est réservée au QG.');
      const direction=i.options.getSubcommand();
      const selected=i.options.getChannel(direction==='categorie-vers-salons'?'categorie':'salon',true);
      const categoryId=direction==='categorie-vers-salons'?selected.id:selected.parentId;
      if(!categoryId)throw Error('Ce salon ne fait partie d’aucune catégorie.');
      const p=await plan(i.guild,direction,categoryId,selected.id);await authorize(i,p);
      if(!p.affected.length)return i.editReply({embeds:[frame('Aucun salon à synchroniser','Cette catégorie est vide.')],allowedMentions:{parse:[]}});
      const token=randomUUID();pending.set(token,{userId:i.user.id,guildId:i.guildId,direction,categoryId,channelId:selected.id,fingerprint:p.fingerprint,expiresAt:Date.now()+120000});
      setTimeout(()=>pending.delete(token),120000).unref();
      const names=p.affected.slice(0,30).map(c=>`• ${c.name.slice(0,40)} (${c.id})`).join('\n');
      await i.editReply({embeds:[frame('Confirmer la synchronisation',`**Source :** ${p.source.name}\n**Éléments concernés : ${p.affected.length}**\n${names}${p.affected.length>30?`\n… et ${p.affected.length-30} autres.`:''}\n\n${direction==='salon-vers-categorie'?'La catégorie et ses salons déjà synchronisés recevront ces permissions. Les salons non synchronisés conserveront leurs permissions.':'Les permissions particulières de chaque salon seront remplacées par celles de la catégorie, y compris pour les tickets et espaces privés.'}\n\n**Cela peut ouvrir ou retirer l’accès à des membres.** Les fils héritent des permissions de leur salon parent. Aucun salon ne sera déplacé ou supprimé.\n\nConfirmation valable deux minutes.`)],components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`sync:confirm:${token}`).setLabel('Appliquer les permissions').setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId(`sync:cancel:${token}`).setLabel('Annuler').setStyle(ButtonStyle.Secondary))],allowedMentions:{parse:[]}});
    } catch(e) {await i.editReply({content:e.code?`Impossible de préparer la synchronisation (code ${e.code}).`:e.message,embeds:[],components:[],allowedMentions:{parse:[]}});}
  },
  async handleComponent(i) {
    if(i.customId.startsWith('sync:separators:'))return require('../systems/qgSeparatorPermissions').confirm(i);
    const [,action,token]=i.customId.split(':'),rec=pending.get(token);
    if(!rec||rec.expiresAt<Date.now())return i.reply({content:'Confirmation expirée ou déjà utilisée. Relance /sync.',flags:MessageFlags.Ephemeral});
    if(i.guildId!==rec.guildId||i.user.id!==rec.userId)return i.reply({content:'Seule la personne ayant préparé cette synchronisation peut la confirmer.',flags:MessageFlags.Ephemeral});
    if(!['confirm','cancel'].includes(action))return;
    pending.delete(token);await i.deferUpdate();
    if(action==='cancel')return i.editReply({content:'Synchronisation annulée.',embeds:[],components:[]});
    try {
      const p=await plan(i.guild,rec.direction,rec.categoryId,rec.channelId);await authorize(i,p);
      if(p.fingerprint!==rec.fingerprint)throw Error('Les salons ou leurs permissions ont changé depuis la prévisualisation. Relance /sync pour les examiner à nouveau.');
      const reason=`/sync par ${i.user.id}`,failures=[];let done=0;
      if(rec.direction==='salon-vers-categorie') {
        await p.category.permissionOverwrites.set(p.sourceSnapshot.map(o=>({...o,allow:BigInt(o.allow),deny:BigInt(o.deny)})),reason);
        done=1;
      } else for(const channel of p.affected) {
        try {
          const fresh=await i.guild.channels.fetch({channel:channel.id,force:true});
          const category=await i.guild.channels.fetch({channel:p.category.id,force:true});
          if(!fresh||!category||fresh.parentId!==p.category.id||signature(category)!==p.sourceSignature||signature(fresh)!==p.targetSignatures.get(channel.id))throw Error('modified');
          await fresh.permissionOverwrites.set(p.sourceSnapshot.map(o=>({...o,allow:BigInt(o.allow),deny:BigInt(o.deny)})),reason);done++;
        }catch(e){
          const details=[];
          function fields(obj,path=''){if(!obj||typeof obj!=='object')return;for(const [key,value] of Object.entries(obj)){if(key==='_errors'&&Array.isArray(value))details.push(`${path}: ${value.map(x=>x.message).join(', ')}`);else fields(value,path?`${path}.${key}`:key);}}
          fields(e.rawError?.errors||e.errors);
          failures.push(`${channel.name} (${e.code||'permissions ou état modifiés'})${details.length?' — '+details.join('; ').slice(0,180):''}`);
        }
      }
      await i.editReply({embeds:[frame(failures.length?'Synchronisation partielle':'Synchronisation appliquée',rec.direction==='salon-vers-categorie'?`Permissions copiées vers **${p.category.name}**. Discord les répercute sur les ${p.affected.length-1} salon(s) déjà synchronisé(s).`:`**${done}/${p.affected.length} salon(s)** synchronisé(s).${failures.length?'\nÉchecs :\n'+failures.slice(0,20).map(v=>'• '+v).join('\n'):''}`)],components:[],allowedMentions:{parse:[]}});
    }catch(e){await i.editReply({content:e.code?`Synchronisation interrompue (code ${e.code}). Vérifie les permissions actuelles avant de réessayer.`:e.message,embeds:[],components:[],allowedMentions:{parse:[]}});}
  }
};
