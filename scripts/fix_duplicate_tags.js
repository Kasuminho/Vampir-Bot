const { Client, GatewayIntentBits } = require('discord.js');
const { getGuilds } = require('../src/data_manager');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const REMOVALS = [
  {
    userId: '348987594241212428',
    userTag: 'luuhzera',
    removeRoleId: '1565401048364093500', // OLP
    removeRoleName: '[OLP] OLIMPO',
    keepGuild: '[CHP] CHAPA1 (Líder)'
  },
  {
    userId: '280224538527268867',
    userTag: '3xwxll',
    removeRoleId: '1565401048364093500', // OLP
    removeRoleName: '[OLP] OLIMPO',
    keepGuild: '[CHP] CHAPA1'
  },
  {
    userId: '480215156270301195',
    userTag: 'kai_wrld',
    removeRoleId: '1565401048364093500', // OLP
    removeRoleName: '[OLP] OLIMPO',
    keepGuild: '[CHP] CHAPA1'
  },
  {
    userId: '846193922942566422',
    userTag: 'xxamx',
    removeRoleId: '1565431387480133652', // NOM
    removeRoleName: '[NOM] No Mercy',
    keepGuild: '[OLP] OLIMPO'
  },
  {
    userId: '1567234713318330548',
    userTag: 'tork1991',
    removeRoleId: '1566240909857652849', // CHP
    removeRoleName: '[CHP] CHAPA1',
    keepGuild: '[DIN] Dinastia'
  }
];

client.once('clientReady', async () => {
  console.log('[CLEANUP] Conectado como ' + client.user.tag);
  const discordGuild = await client.guilds.fetch(process.env.GUILD_ID);

  for (const item of REMOVALS) {
    try {
      const member = await discordGuild.members.fetch(item.userId).catch(() => null);
      if (!member) {
        console.log(`[AVISO] Membro ${item.userTag} (${item.userId}) não encontrado no servidor.`);
        continue;
      }

      if (member.roles.cache.has(item.removeRoleId)) {
        await member.roles.remove(item.removeRoleId, 'Remoção de tag duplicada/antiga da Coalizão');
        console.log(`[SUCESSO] Removida tag ${item.removeRoleName} de ${member.user.tag} (Mantida: ${item.keepGuild})`);
      } else {
        console.log(`[INFO] Membro ${member.user.tag} já não possuía a tag ${item.removeRoleName}`);
      }
    } catch (err) {
      console.error(`[ERRO] Falha ao processar ${item.userTag}:`, err.message);
    }
  }

  // Verifica novamente todos os membros para confirmar que não resta nenhum com tag dupla
  const allMembers = await discordGuild.members.fetch();
  const allGuilds = getGuilds();
  const guildRoleMap = new Map();
  allGuilds.forEach(gd => guildRoleMap.set(gd.roleId, gd));

  let remainingDuplicates = 0;
  allMembers.forEach(m => {
    const matched = [];
    m.roles.cache.forEach(r => {
      if (guildRoleMap.has(r.id)) matched.push(guildRoleMap.get(r.id));
    });
    if (matched.length > 1) {
      remainingDuplicates++;
      console.log(`[ALERTA] Ainda duplicado: ${m.user.tag} (${matched.map(x => x.tag).join(', ')})`);
    }
  });

  if (remainingDuplicates === 0) {
    console.log('[PERFEITO] Nenhum membro com tag dupla restante no servidor!');
  } else {
    console.log(`[ATENÇÃO] Restam ${remainingDuplicates} membros com tag dupla.`);
  }

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
