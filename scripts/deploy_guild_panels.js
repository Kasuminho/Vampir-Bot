require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { initDataManager } = require('../src/data_manager');
const { renderAllGuildPanels } = require('../src/guild_panel');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

client.once('ready', async () => {
  console.log(`[DEPLOY] Bot conectado como ${client.user.tag}`);

  try {
    await initDataManager();
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    console.log(`[DEPLOY] Conectado ao servidor ${guild.name} (${guild.id})`);

    console.log('[DEPLOY] Iniciando deploy dos Painéis de Gestão para todas as guildas...');
    await renderAllGuildPanels(guild);
    console.log('[DEPLOY] Deploy concluído com sucesso!');
  } catch (err) {
    console.error('[ERRO] Falha no deploy dos painéis de guilda:', err);
  } finally {
    setTimeout(() => {
      client.destroy();
      process.exit(0);
    }, 2000);
  }
});

client.login(process.env.DISCORD_TOKEN);
