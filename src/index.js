require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

const { commands } = require('./commands');
const { getServerConfig } = require('./data_manager');
const { renderRecruitmentPanel } = require('./recruitment_panel');
const {
  renderOrUpdateBossPanel,
  checkAndSendBossAlerts
} = require('./boss_manager');
const { renderOrUpdateVoicePanel } = require('./voice_panel');
const {
  setupAttendanceChannels,
  renderOrUpdateCheckinBanner,
  renderOrUpdatePresencePanel
} = require('./attendance_manager');
const { handleCommand } = require('./handlers/commandHandler');
const { handleButton } = require('./handlers/buttonHandler');
const { handleModal } = require('./handlers/modalHandler');
const { handleSelectMenu } = require('./handlers/selectMenuHandler');
const { handleAutoTranslation } = require('./handlers/chatTranslationHandler');
const { refreshServerStats } = require('./services/statsService');
const { startHeartbeatService } = require('./services/heartbeatService');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Inicialização do Bot
client.once('ready', async () => {
  console.log(`[VAMPIR-BOT] Online como ${client.user.tag}`);

  // Registra os Slash Commands na Guild
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('[COMANDOS] Sincronizando Slash Commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('[COMANDOS] Slash Commands sincronizados com sucesso!');
  } catch (err) {
    console.error('[ERRO] Falha ao sincronizar comandos:', err);
  }

  // Renderizar o painel inicial de recrutamento caso o canal exista
  const config = getServerConfig();
  if (config?.channels?.recrutamento) {
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const chRecrutamento = await guild.channels.fetch(config.channels.recrutamento);
      if (chRecrutamento) {
        await renderRecruitmentPanel(guild, chRecrutamento);
        console.log('[PAINEL] Painel de recrutamento verificado e atualizado!');
      }
    } catch (err) {
      console.warn('[AVISO] Não foi possível atualizar painel no startup:', err.message);
    }
  }

  // Renderizar o painel de Boss Timers caso o canal exista
  if (config?.channels?.boss) {
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      const chBoss = await guild.channels.fetch(config.channels.boss);
      if (chBoss) {
        await renderOrUpdateBossPanel(guild, chBoss);
        console.log('[BOSS] Painel de Boss Timers verificado e atualizado!');
      }
    } catch (err) {
      console.warn('[AVISO] Não foi possível atualizar painel de boss no startup:', err.message);
    }
  }

  // Renderizar o painel de Monitoramento de Calls
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await renderOrUpdateVoicePanel(guild);
    console.log('[VOICE] Painel de monitoramento de calls inicializado!');
  } catch (err) {
    console.warn('[AVISO] Não foi possível atualizar painel de calls no startup:', err.message);
  }

  // Configurar canais e painéis de Presença em Bosses de Geena
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const { chCheckin, chPainel } = await setupAttendanceChannels(guild);
    if (chCheckin) {
      await renderOrUpdateCheckinBanner(guild, chCheckin);
      console.log('[PRESENÇA] Banner de check-in verificado e atualizado!');
    }
    if (chPainel) {
      await renderOrUpdatePresencePanel(guild, chPainel);
      console.log('[PRESENÇA] Painel de ranking de presenças inicializado!');
    }
  } catch (err) {
    console.warn('[AVISO] Falha ao inicializar canais de presença:', err.message);
  }

  // Sincronizar canais de estatísticas imediatamente no startup
  await refreshServerStats(client);

  // Rotina de Atualização de Estatísticas (Stats a cada 10 min)
  setInterval(() => {
    refreshServerStats(client);
  }, 10 * 60 * 1000);

  // Rotina de Atualização do Painel de Calls (a cada 60 segundos)
  setInterval(async () => {
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      await renderOrUpdateVoicePanel(guild);
    } catch (err) {
      console.warn('[VOICE] Erro no ciclo de atualização do painel de calls:', err.message);
    }
  }, 60 * 1000);

  // Rotina de Atualização do Painel de Presenças (a cada 2 minutos)
  setInterval(async () => {
    try {
      const guild = await client.guilds.fetch(process.env.GUILD_ID);
      await renderOrUpdatePresencePanel(guild);
    } catch (err) {
      console.warn('[PRESENÇA] Erro no ciclo de atualização do painel de presenças:', err.message);
    }
  }, 2 * 60 * 1000);

  // Rotina de Checagem de Alertas de Bosses (a cada 30 segundos)
  setInterval(() => {
    checkAndSendBossAlerts(client).catch(() => {});
  }, 30 * 1000);

  // Monitoramento de Uptime com Healthchecks.io / Nuvem (Heartbeat Push a cada 60s)
  startHeartbeatService(process.env.HEALTHCHECKS_PING_URL || process.env.BETTERSTACK_HEARTBEAT_URL, 60);
});

// Roteador Central de Interações (Slash Commands, Botões, Modals)
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction, refreshServerStats);
    } else if (interaction.isButton()) {
      await handleButton(interaction, refreshServerStats);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    }
  } catch (err) {
    console.error('[INTERACTION] Erro não tratado durante interação:', err);
    if (interaction.isRepliable()) {
      const replyFn = (interaction.deferred || interaction.replied) ? 'editReply' : 'reply';
      await interaction[replyFn]({
        content: '❌ Ocorreu um erro interno ao processar sua ação.',
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// Listener de Mensagens para Auto-Tradução Bilíngue (PT <> EN)
client.on('messageCreate', async (message) => {
  try {
    await handleAutoTranslation(message);
  } catch (err) {
    console.warn('[TRANSLATION-LISTENER] Erro:', err.message);
  }
});

// Tratamento de Erros Globais para Evitar Quedas do Bot
process.on('unhandledRejection', (reason) => {
  console.warn('[ERRO GLOBAL - REJECTION]', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('[ERRO GLOBAL - EXCEPTION]', err);
});

client.on('error', (err) => {
  console.error('[ERRO DISCORD CLIENT]', err.message);
});

client.login(process.env.DISCORD_TOKEN);
