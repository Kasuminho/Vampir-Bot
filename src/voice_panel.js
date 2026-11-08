const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { getServerConfig, getGuilds } = require('./data_manager');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'server_config.json');

/**
 * Monta o embed e os botões do painel de monitoramento de voz
 */
function buildVoicePanelEmbed(guild, voiceChannels, guildsList) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const timestampUnix = Math.floor(now.getTime() / 1000);

  let totalConnected = 0;
  const config = getServerConfig();
  const statsCatId = config?.stats?.categoryId;

  // Filtra apenas canais de voz reais (excluindo os contadores de stats na categoria de status)
  const realVoiceChannels = voiceChannels.filter(c => c && c.isVoiceBased() && c.parentId !== statsCatId);

  // Mapeia canais com membros
  const channelData = [];
  for (const [, ch] of realVoiceChannels) {
    const activeMembers = ch.members.filter(m => !m.user.bot);
    const count = activeMembers.size;
    totalConnected += count;
    channelData.push({
      channel: ch,
      count,
      members: activeMembers.map(m => m.displayName || m.user.username)
    });
  }

  // 1. Canais Gerais / Comunidade
  const comCatId = config?.categories?.comunidade || '1565129733208014879';
  const generalChannels = channelData.filter(d => d.channel.parentId === comCatId);

  // 2. Cúpula de Líderes
  const lidCatId = config?.categories?.lideres || '1565129742309527603';
  const leaderChannels = channelData.filter(d => d.channel.parentId === lidCatId);

  // 3. Guilds
  const guildChannels = [];
  for (const g of guildsList) {
    const gChan = channelData.find(d => d.channel.parentId === g.categoryId);
    guildChannels.push({
      guild: g,
      data: gChan || null
    });
  }

  // Formata linhas dos canais
  function formatLine(chData) {
    const ch = chData.channel;
    const count = chData.count;
    if (count === 0) {
      return `⚪ <#${ch.id}>: *Vazio*`;
    }
    let membersPreview = '';
    if (count <= 4) {
      membersPreview = ` \`(${chData.members.join(', ')})\``;
    } else {
      const top3 = chData.members.slice(0, 3).join(', ');
      membersPreview = ` \`(${top3} +${count - 3})\``;
    }
    return `🟢 <#${ch.id}>: **${count} ${count === 1 ? 'player' : 'players'}**${membersPreview}`;
  }

  const generalLines = generalChannels.length > 0
    ? generalChannels.map(formatLine).join('\n')
    : '*Nenhum canal configurado.*';

  const leaderLines = leaderChannels.length > 0
    ? leaderChannels.map(formatLine).join('\n')
    : '*Nenhum canal configurado.*';

  const guildLines = guildChannels.map(({ guild: g, data }) => {
    if (!data) {
      return `⚪ **[${g.tag}] ${g.name}**: *Sem canal*`;
    }
    const count = data.count;
    if (count === 0) {
      return `⚪ **[${g.tag}] ${g.name}** (<#${data.channel.id}>): *Vazio*`;
    }
    let preview = '';
    if (count <= 3) {
      preview = ` \`(${data.members.join(', ')})\``;
    } else {
      preview = ` \`(${data.members.slice(0, 2).join(', ')} +${count - 2})\``;
    }
    return `🟢 **[${g.tag}] ${g.name}** (<#${data.channel.id}>): **${count} ${count === 1 ? 'player' : 'players'}**${preview}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📡 ─── MONITORAMENTO DE VOZ & CALLS ATIVAS ─── 📡')
    .setDescription(
      `Radar em tempo real de ocupação das salas de voz da **Coalizão Vampir**.\n\n` +
      `🎧 **Total em Call Agora:** \`${totalConnected}\` jogadores conectados\n` +
      `⏱️ **Última Atualização:** <t:${timestampUnix}:T> (<t:${timestampUnix}:R>)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .setColor(totalConnected > 0 ? Colors.Green : Colors.DarkGrey)
    .addFields(
      {
        name: '🌐 Comunidade Geral & Eventos',
        value: generalLines,
        inline: false
      },
      {
        name: '👑 Cúpula de Líderes',
        value: leaderLines,
        inline: false
      },
      {
        name: '🏰 Squads das Guilds da Coalizão',
        value: guildLines || '*Nenhuma guild registrada.*',
        inline: false
      }
    )
    .setFooter({ text: 'Atualização automática a cada 60s • Clique abaixo para atualizar agora' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_refresh_voice_panel')
      .setLabel('🔄 Atualizar Radar Agora')
      .setStyle(ButtonStyle.Primary)
  );

  return { embed, row, totalConnected };
}

/**
 * Garante que o canal de texto do painel exista
 */
async function ensureVoicePanelChannel(discordGuild) {
  const config = getServerConfig();
  const comCatId = config?.categories?.comunidade || '1565129733208014879';

  // Se já temos configurado, tenta buscar
  if (config?.channels?.painelCalls) {
    const existing = await discordGuild.channels.fetch(config.channels.painelCalls).catch(() => null);
    if (existing) return existing;
  }

  // Procura por nome
  const channels = await discordGuild.channels.fetch();
  let found = channels.find(c => c && c.name === '🎙️・painel-de-calls');
  if (found) {
    config.channels = config.channels || {};
    config.channels.painelCalls = found.id;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    return found;
  }

  // Cria o canal na categoria Comunidade Geral
  console.log('[VOICE-PANEL] Criando canal #🎙️・painel-de-calls...');
  const newChan = await discordGuild.channels.create({
    name: '🎙️・painel-de-calls',
    type: 0, // GuildText
    parent: comCatId,
    topic: '📡 Radar de ocupação das salas de voz da Coalizão Vampir (Atualizado a cada 60s)',
    permissionOverwrites: [
      {
        id: discordGuild.roles.everyone.id,
        deny: ['SendMessages', 'AddReactions']
      },
      {
        id: config.roles.validado,
        allow: ['ViewChannel', 'ReadMessageHistory'],
        deny: ['SendMessages', 'AddReactions']
      },
      {
        id: config.roles.staff,
        allow: ['ViewChannel', 'SendMessages', 'ManageMessages', 'EmbedLinks']
      },
      {
        id: discordGuild.client.user.id,
        allow: ['ViewChannel', 'SendMessages', 'ManageMessages', 'EmbedLinks']
      }
    ]
  });

  // Tenta posicionar logo após boss-timers se possível
  try {
    const bossChan = config?.channels?.boss ? await discordGuild.channels.fetch(config.channels.boss).catch(() => null) : null;
    if (bossChan) {
      await newChan.setPosition(bossChan.position + 1).catch(() => {});
    }
  } catch {}

  config.channels = config.channels || {};
  config.channels.painelCalls = newChan.id;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  return newChan;
}

/**
 * Renderiza ou atualiza o painel de monitoramento de voz
 */
async function renderOrUpdateVoicePanel(discordGuild, targetChannel = null) {
  try {
    const config = getServerConfig();
    const channel = targetChannel || (await ensureVoicePanelChannel(discordGuild));
    if (!channel) return;

    // Busca todos os canais para pegar dados de voz atualizados
    const allChannels = await discordGuild.channels.fetch();
    const guildsList = getGuilds();

    const { embed, row } = buildVoicePanelEmbed(discordGuild, allChannels, guildsList);

    let panelMsg = null;
    if (config?.channels?.voicePanelMessageId) {
      panelMsg = await channel.messages.fetch(config.channels.voicePanelMessageId).catch(() => null);
    }

    if (panelMsg) {
      await panelMsg.edit({ embeds: [embed], components: [row] }).catch(() => {});
    } else {
      panelMsg = await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
      if (panelMsg) {
        config.channels.voicePanelMessageId = panelMsg.id;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      }
    }
  } catch (err) {
    console.error('[VOICE-PANEL] Erro ao renderizar/atualizar painel de calls:', err.message);
  }
}

module.exports = {
  buildVoicePanelEmbed,
  ensureVoicePanelChannel,
  renderOrUpdateVoicePanel
};
