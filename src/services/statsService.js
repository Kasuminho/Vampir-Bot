const { getServerConfig, getGuilds } = require('../data_manager');

let lastStatsUpdate = 0;

/**
 * Atualiza os contadores dos canais de voz/stats do servidor
 * Protegido contra rate-limits do Discord (debounce de 3 minutos)
 */
async function refreshServerStats(discordClient, force = false) {
  const now = Date.now();
  if (!force && (now - lastStatsUpdate < 3 * 60 * 1000)) {
    return;
  }
  lastStatsUpdate = now;

  try {
    const currentConfig = getServerConfig();
    if (!currentConfig || !currentConfig.stats) return;
    const guild = await discordClient.guilds.fetch(process.env.GUILD_ID);
    if (!guild) return;
    const guildsList = getGuilds();
    let validadosCount = 0;
    try {
      await guild.members.fetch().catch(() => {});
      const roleVal = await guild.roles.fetch(currentConfig.roles.validado);
      if (roleVal) validadosCount = roleVal.members.size;
    } catch {}

    const chMembros = await guild.channels.fetch(currentConfig.stats.membrosChannelId).catch(() => null);
    const chGuilds = await guild.channels.fetch(currentConfig.stats.guildsChannelId).catch(() => null);
    const chValidados = await guild.channels.fetch(currentConfig.stats.validadosChannelId).catch(() => null);
    const chBot = currentConfig.stats.botStatusChannelId
      ? await guild.channels.fetch(currentConfig.stats.botStatusChannelId).catch(() => null)
      : null;

    const targetMembros = `👥・Membros: ${guild.memberCount}`;
    const targetGuilds = `🏰・Guilds: ${guildsList.length}`;
    const targetValidados = `⚔️・Validados: ${validadosCount}`;
    const targetBot = `🟢・Bot: Online`;

    if (chMembros && chMembros.name !== targetMembros) {
      await chMembros.setName(targetMembros).catch(() => {});
    }
    if (chGuilds && chGuilds.name !== targetGuilds) {
      await chGuilds.setName(targetGuilds).catch(() => {});
    }
    if (chValidados && chValidados.name !== targetValidados) {
      await chValidados.setName(targetValidados).catch(() => {});
    }
    if (chBot && chBot.name !== targetBot) {
      await chBot.setName(targetBot).catch(() => {});
    }
    console.log(`[STATS] Status sincronizado: Membros=${guild.memberCount}, Guilds=${guildsList.length}, Validados=${validadosCount}`);
  } catch (err) {
    console.warn('[STATS] Falha ao atualizar canais de stats:', err.message);
  }
}

module.exports = {
  refreshServerStats
};
