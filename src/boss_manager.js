const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { getServerConfig } = require('./data_manager');
const { isConnected } = require('./database/db');
const bossRepo = require('./database/boss_repo');

let cachedBossData = { geena: [], mapBosses: [], panelMessageId: null };

async function initBossManager() {
  if (isConnected()) {
    try {
      const dbData = await bossRepo.loadBossData();
      if (dbData) {
        cachedBossData = dbData;
        console.log('[BOSS] Dados de bosses carregados 100% do PostgreSQL!');
      }
    } catch (err) {
      console.error('[BOSS] Erro ao carregar bosses do PostgreSQL:', err.message);
    }
  }
}

function getBossData() {
  return cachedBossData;
}

function saveBossData(data) {
  cachedBossData = data;
  if (isConnected()) {
    bossRepo.saveBossData(data).catch(err => {
      console.error('[DB] Erro ao salvar boss_data no PostgreSQL:', err.message);
    });
  }
}

// Retorna a próxima data de spawn para horários fixos diários (ex: ["15:00", "19:00", "23:00"])
function getFixedScheduleStatus(scheduleArray, now = new Date()) {
  if (!scheduleArray || scheduleArray.length === 0) return null;

  const candidates = [];
  const baseDates = [-1, 0, 1]; // ontem, hoje, amanhã

  for (const dayOffset of baseDates) {
    for (const timeStr of scheduleArray) {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(h, m, 0, 0);
      candidates.push(d);
    }
  }

  candidates.sort((a, b) => a.getTime() - b.getTime());

  const pastOrNow = candidates.filter(c => c.getTime() <= now.getTime());
  const lastSpawn = pastOrNow.length > 0 ? pastOrNow[pastOrNow.length - 1] : null;

  const future = candidates.filter(c => c.getTime() > now.getTime());
  const nextSpawn = future.length > 0 ? future[0] : null;

  const tenMinutesMs = 10 * 60 * 1000;
  if (lastSpawn && (now.getTime() - lastSpawn.getTime() < tenMinutesMs)) {
    return {
      isAlive: true,
      currentSpawn: lastSpawn,
      nextSpawn: nextSpawn,
      minutesSinceSpawn: Math.floor((now.getTime() - lastSpawn.getTime()) / 60000)
    };
  }

  return {
    isAlive: false,
    currentSpawn: lastSpawn,
    nextSpawn: nextSpawn,
    minutesSinceSpawn: lastSpawn ? Math.floor((now.getTime() - lastSpawn.getTime()) / 60000) : null
  };
}

function getNextGeenaSpawn(scheduleArray) {
  const status = getFixedScheduleStatus(scheduleArray);
  return status ? status.nextSpawn : null;
}

// Converte entrada do usuário em um Date válido (suporta "18:30" ou "45m" ou "1h 30m")
function parseTimeInput(inputStr) {
  if (!inputStr) return null;
  const raw = inputStr.trim().toLowerCase();
  const now = new Date();

  // Caso A: Formato de horário "HH:MM" (ex: 18:30, 05:46, 21:46)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  const matchTime = raw.match(timeRegex);
  if (matchTime) {
    const hours = parseInt(matchTime[1], 10);
    const minutes = parseInt(matchTime[2], 10);

    const targetDate = new Date(now);
    targetDate.setHours(hours, minutes, 0, 0);

    // Se o horário for menor que agora menos 2 minutos, assume que é para amanhã
    if (targetDate.getTime() < now.getTime() - 2 * 60 * 1000) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    return targetDate;
  }

  // Caso B: Formato de tempo relativo (ex: "45m", "1h 30m", "2h", "15")
  let totalMinutes = 0;
  const hoursMatch = raw.match(/(\d+)\s*h/);
  const minsMatch = raw.match(/(\d+)\s*m/);

  if (hoursMatch) totalMinutes += parseInt(hoursMatch[1], 10) * 60;
  if (minsMatch) totalMinutes += parseInt(minsMatch[1], 10);

  if (!hoursMatch && !minsMatch) {
    // Número puro considerado como minutos
    const pureNum = parseInt(raw, 10);
    if (!isNaN(pureNum)) totalMinutes = pureNum;
  }

  if (totalMinutes > 0) {
    return new Date(now.getTime() + totalMinutes * 60 * 1000);
  }

  return null;
}

// Constrói o Embed estilizado do Painel de Timers
function buildBossPanelEmbed(bossData) {
  const embed = new EmbedBuilder()
    .setTitle('🐉 ─── CRONOGRAMA & STATUS DOS BOSSES ─── 🐉')
    .setDescription(
      'Acompanhe abaixo o status dos **Chefes de Mapa** e os horários das invasões de **Geena**.\n' +
      'Notificações são enviadas no canal de anúncios faltando **30m**, **5m** e no **Spawn**!\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .setColor(Colors.DarkGold)
    .setFooter({ text: 'Atualização automática e comandos • Vampir Boss Tracker' })
    .setTimestamp();

  // Seção 1: Geena
  let geenaText = '';
  for (const g of bossData.geena) {
    const nextSpawn = getNextGeenaSpawn(g.schedule);
    const ts = Math.floor(nextSpawn.getTime() / 1000);
    const scheduleStr = g.schedule.map(s => `\`${s}\``).join(' • ');

    geenaText += `⚔️ **${g.name}**\n` +
      `• Horários fixos diários: ${scheduleStr}\n` +
      `• 🎯 Próximo Spawn: <t:${ts}:t> (<t:${ts}:R>)\n\n`;
  }

  embed.addFields({
    name: '👑 BOSSES DE GEENA (INVASÕES DIÁRIAS)',
    value: geenaText.trim(),
    inline: false
  });

  // Seção 2: Bosses de Mapa
  let mapBossesText = '';
  for (const b of bossData.mapBosses) {
    const locStr = `📍 \`${b.territory} — ${b.location}\``;

    // Caso 1: Boss com horário fixo diário (Larva, Clamamus, Brachium)
    if (b.schedule && b.schedule.length > 0) {
      const sched = getFixedScheduleStatus(b.schedule);
      const scheduleStr = b.schedule.map(s => `\`${s}\``).join(' • ');

      if (sched.isAlive) {
        const nextTs = Math.floor(sched.nextSpawn.getTime() / 1000);
        mapBossesText += `🟢 **[Nv. ${b.level}] ${b.name}** ➔ **VIVO NO MAPA** *(Spawnou há ${sched.minutesSinceSpawn} min)*\n` +
          `${locStr}\n` +
          `• ⏰ Próximo ciclo previsto: <t:${nextTs}:t> (<t:${nextTs}:R>) *(Fixo diário: ${scheduleStr})*\n\n`;
      } else {
        const ts = Math.floor(sched.nextSpawn.getTime() / 1000);
        mapBossesText += `⏳ **[Nv. ${b.level}] ${b.name}** ➔ **MORTO**\n` +
          `${locStr}\n` +
          `• ⏰ Respawn previsto: <t:${ts}:t> (<t:${ts}:R>) *(Fixo diário: ${scheduleStr})*\n\n`;
      }
    } else {
      // Caso 2: Boss manual (Deserti, Exesa, Usurpator)
      if (b.status === 'alive') {
        const timeInfo = b.spawnedAt ? ` *(Spawnou há ${Math.floor((Date.now() - new Date(b.spawnedAt).getTime()) / 60000)} min)*` : '';
        mapBossesText += `🟢 **[Nv. ${b.level}] ${b.name}** ➔ **VIVO NO MAPA**${timeInfo}\n` +
          `${locStr}\n\n`;
      } else if (b.nextSpawn) {
        const ts = Math.floor(new Date(b.nextSpawn).getTime() / 1000);
        mapBossesText += `⏳ **[Nv. ${b.level}] ${b.name}** ➔ **MORTO**\n` +
          `${locStr}\n` +
          `• ⏰ Respawn previsto: <t:${ts}:t> (<t:${ts}:R>)\n\n`;
      } else {
        mapBossesText += `🔴 **[Nv. ${b.level}] ${b.name}** ➔ **MORTO**\n` +
          `${locStr}\n` +
          `• *(Aguardando registro de horário no comando /boss-respawn)*\n\n`;
      }
    }
  }

  embed.addFields({
    name: '🗺️ WORLD BOSSES DE MAPA',
    value: mapBossesText.trim(),
    inline: false
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_refresh_boss_panel')
      .setLabel('🔄 Atualizar Timers')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, row };
}

// Renderiza ou edita a mensagem fixa do painel no canal de boss timers
async function renderOrUpdateBossPanel(discordGuild, targetChannel) {
  const bossData = getBossData();
  const { embed, row } = buildBossPanelEmbed(bossData);

  let msg = null;
  if (bossData.panelMessageId) {
    msg = await targetChannel.messages.fetch(bossData.panelMessageId).catch(() => null);
  }

  if (msg) {
    await msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
  } else {
    msg = await targetChannel.send({ embeds: [embed], components: [row] }).catch(() => null);
    if (msg) {
      bossData.panelMessageId = msg.id;
      saveBossData(bossData);
    }
  }
}

// Rotina periódica de verificação de alertas (30m / 5m / Nasceu)
async function checkAndSendBossAlerts(discordClient) {
  const config = getServerConfig();
  const alertChannelId = config?.channels?.alertasBoss || config?.channels?.anuncios;
  if (!config || !config.channels || !alertChannelId) return;

  const guild = await discordClient.guilds.fetch(process.env.GUILD_ID).catch(() => null);
  if (!guild) return;

  const chAnuncios = await guild.channels.fetch(alertChannelId).catch(() => null);
  if (!chAnuncios) return;

  const bossData = getBossData();
  const now = new Date();
  let changed = false;
  let panelNeedsUpdate = false;

  // 1. Alertas de Geena
  for (const g of bossData.geena) {
    const nextSpawn = getNextGeenaSpawn(g.schedule);
    const diffMs = nextSpawn.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const ts = Math.floor(nextSpawn.getTime() / 1000);
    const eventKey = nextSpawn.toISOString().slice(0, 16);

    g.alertsSent = g.alertsSent || {};
    g.alertsSent[eventKey] = g.alertsSent[eventKey] || [];

    // Alerta de 30 minutos
    if (diffMinutes <= 30 && diffMinutes > 5 && !g.alertsSent[eventKey].includes('30m')) {
      g.alertsSent[eventKey].push('30m');
      changed = true;
      const embed30 = new EmbedBuilder()
        .setTitle('⏰ ALERTA DE BOSS (30 MINUTOS) ┃ BOSS ALERT (30 MINUTES)')
        .setDescription(
          `🇧🇷 O chefe **${g.name}** nascerá em **30 minutos** às <t:${ts}:t> (<t:${ts}:R>)!\n` +
          `📍 **Local:** \`${g.location}\`\n` +
          `⚔️ *Preparem os grupos e organizem os esquadrões!*\n\n` +
          `🇺🇸 Boss **${g.name}** will spawn in **30 minutes** at <t:${ts}:t> (<t:${ts}:R>)!\n` +
          `📍 **Location:** \`${g.location}\`\n` +
          `⚔️ *Get your parties ready and gather squads!*`
        )
        .setColor(Colors.Gold)
        .setTimestamp();
      await chAnuncios.send({ embeds: [embed30] }).catch(() => {});
    }

    // Alerta de 5 minutos
    if (diffMinutes <= 5 && diffMinutes >= 0 && !g.alertsSent[eventKey].includes('5m')) {
      g.alertsSent[eventKey].push('5m');
      changed = true;
      const embed5 = new EmbedBuilder()
        .setTitle('🚨 ALERTA IMINENTE (5 MINUTOS) ┃ IMMINENT ALERT (5 MINUTES)')
        .setDescription(
          `🇧🇷 O chefe **${g.name}** nascerá em apenas **5 minutos** (<t:${ts}:t>)!\n` +
          `📍 **Local:** \`${g.location}\`\n` +
          `🔊 *Todos para o canal de voz do auditório agora!*\n\n` +
          `🇺🇸 Boss **${g.name}** will spawn in just **5 minutes** (<t:${ts}:t>)!\n` +
          `📍 **Location:** \`${g.location}\`\n` +
          `🔊 *Everyone join the auditorium voice channel now!*`
        )
        .setColor(Colors.Orange)
        .setTimestamp();
      await chAnuncios.send({ embeds: [embed5] }).catch(() => {});
    }

    // Alerta de Spawn (0 minutos / Nasceu)
    if (diffMinutes <= 0 && diffMinutes >= -2 && !g.alertsSent[eventKey].includes('spawn')) {
      g.alertsSent[eventKey].push('spawn');
      changed = true;
      panelNeedsUpdate = true;
      const embedSpawn = new EmbedBuilder()
        .setTitle('⚔️ O BOSS NASCEU! ┃ BOSS HAS SPAWNED!')
        .setDescription(
          `🇧🇷 O chefe **${g.name}** acaba de spawnar no **${g.location}**!\n` +
          `🩸 *Reunam suas legiões e partam para a batalha!*\n\n` +
          `🇺🇸 Boss **${g.name}** has just spawned at **${g.location}**!\n` +
          `🩸 *Rally your legions and charge into battle!*`
        )
        .setColor(Colors.Red)
        .setTimestamp();
      await chAnuncios.send({ embeds: [embedSpawn] }).catch(() => {});
    }
  }

  // 2. Alertas de Bosses de Mapa
  for (const b of bossData.mapBosses) {
    // Caso A: Boss com horário fixo diário (Larva, Clamamus, Brachium)
    if (b.schedule && b.schedule.length > 0) {
      const sched = getFixedScheduleStatus(b.schedule, now);
      b.alertsSent = b.alertsSent || {};

      // Alertas de 30m e 5m para o próximo spawn
      const diffMs = sched.nextSpawn.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      const tsNext = Math.floor(sched.nextSpawn.getTime() / 1000);
      const nextKey = sched.nextSpawn.toISOString().slice(0, 16);
      b.alertsSent[nextKey] = b.alertsSent[nextKey] || [];

      if (diffMinutes <= 30 && diffMinutes > 5 && !b.alertsSent[nextKey].includes('30m')) {
        b.alertsSent[nextKey].push('30m');
        changed = true;
        const embed30 = new EmbedBuilder()
          .setTitle('⏰ WORLD BOSS (30 MINUTOS) ┃ WORLD BOSS (30 MINUTES)')
          .setDescription(
            `🇧🇷 O chefe **[Nv. ${b.level}] ${b.name}** nascerá em **30 minutos** às <t:${tsNext}:t> (<t:${tsNext}:R>)!\n` +
            `📍 **Local:** \`${b.territory} — ${b.location}\`\n\n` +
            `🇺🇸 Boss **[Lv. ${b.level}] ${b.name}** will spawn in **30 minutes** at <t:${tsNext}:t> (<t:${tsNext}:R>)!\n` +
            `📍 **Location:** \`${b.territory} — ${b.location}\``
          )
          .setColor(Colors.Gold)
          .setTimestamp();
        await chAnuncios.send({ embeds: [embed30] }).catch(() => {});
      }

      if (diffMinutes <= 5 && diffMinutes >= 0 && !b.alertsSent[nextKey].includes('5m')) {
        b.alertsSent[nextKey].push('5m');
        changed = true;
        const embed5 = new EmbedBuilder()
          .setTitle('🚨 WORLD BOSS (5 MINUTOS) ┃ WORLD BOSS (5 MINUTES)')
          .setDescription(
            `🇧🇷 O chefe **[Nv. ${b.level}] ${b.name}** nascerá em **5 minutos** (<t:${tsNext}:t>)!\n` +
            `📍 **Local:** \`${b.territory} — ${b.location}\`\n` +
            `⚔️ *Concentração imediata no local!*\n\n` +
            `🇺🇸 Boss **[Lv. ${b.level}] ${b.name}** will spawn in **5 minutes** (<t:${tsNext}:t>)!\n` +
            `📍 **Location:** \`${b.territory} — ${b.location}\`\n` +
            `⚔️ *Immediate rally at the location!*`
          )
          .setColor(Colors.Orange)
          .setTimestamp();
        await chAnuncios.send({ embeds: [embed5] }).catch(() => {});
      }

      // Alerta de Spawn e controle de status (10 minutos vivo)
      if (sched.isAlive) {
        if (b.status !== 'alive') {
          b.status = 'alive';
          changed = true;
          panelNeedsUpdate = true;
        }

        const spawnKey = sched.currentSpawn.toISOString().slice(0, 16);
        b.alertsSent[spawnKey] = b.alertsSent[spawnKey] || [];
        if (!b.alertsSent[spawnKey].includes('spawn')) {
          b.alertsSent[spawnKey].push('spawn');
          changed = true;
          panelNeedsUpdate = true;

          const embedSpawn = new EmbedBuilder()
            .setTitle('⚔️ WORLD BOSS APARECEU NO MAPA! ┃ WORLD BOSS SPAWNED!')
            .setDescription(
              `🇧🇷 O chefe **[Nv. ${b.level}] ${b.name}** acabou de nascer!\n` +
              `📍 **Local:** \`${b.territory} — ${b.location}\`\n` +
              `🩸 *A caçada começou!*\n\n` +
              `🇺🇸 Boss **[Lv. ${b.level}] ${b.name}** has just spawned!\n` +
              `📍 **Location:** \`${b.territory} — ${b.location}\`\n` +
              `🩸 *The hunt has begun!*`
            )
            .setColor(Colors.Green)
            .setTimestamp();
          await chAnuncios.send({ embeds: [embedSpawn] }).catch(() => {});
        }
      } else {
        // Passou da janela de 10 minutos (ou ainda não chegou)
        if (b.status !== 'dead') {
          b.status = 'dead';
          changed = true;
          panelNeedsUpdate = true;
        }
      }
      b.nextSpawn = sched.nextSpawn.toISOString();
    } else {
      // Caso B: Boss manual (Deserti, Exesa, Usurpator)
      if (b.status === 'dead' && b.nextSpawn) {
        const spawnDate = new Date(b.nextSpawn);
        const diffMs = spawnDate.getTime() - now.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        const ts = Math.floor(spawnDate.getTime() / 1000);
        const eventKey = spawnDate.toISOString().slice(0, 16);

        b.alertsSent = b.alertsSent || {};
        b.alertsSent[eventKey] = b.alertsSent[eventKey] || [];

        // Alerta de 30m
        if (diffMinutes <= 30 && diffMinutes > 5 && !b.alertsSent[eventKey].includes('30m')) {
          b.alertsSent[eventKey].push('30m');
          changed = true;
          const embed30 = new EmbedBuilder()
            .setTitle('⏰ WORLD BOSS (30 MINUTOS) ┃ WORLD BOSS (30 MINUTES)')
            .setDescription(
              `🇧🇷 O chefe **[Nv. ${b.level}] ${b.name}** nascerá em **30 minutos** às <t:${ts}:t> (<t:${ts}:R>)!\n` +
              `📍 **Local:** \`${b.territory} — ${b.location}\`\n\n` +
              `🇺🇸 Boss **[Lv. ${b.level}] ${b.name}** will spawn in **30 minutes** at <t:${ts}:t> (<t:${ts}:R>)!\n` +
              `📍 **Location:** \`${b.territory} — ${b.location}\``
            )
            .setColor(Colors.Gold)
            .setTimestamp();
          await chAnuncios.send({ embeds: [embed30] }).catch(() => {});
        }

        // Alerta de 5m
        if (diffMinutes <= 5 && diffMinutes >= 0 && !b.alertsSent[eventKey].includes('5m')) {
          b.alertsSent[eventKey].push('5m');
          changed = true;
          const embed5 = new EmbedBuilder()
            .setTitle('🚨 WORLD BOSS (5 MINUTOS) ┃ WORLD BOSS (5 MINUTES)')
            .setDescription(
              `🇧🇷 O chefe **[Nv. ${b.level}] ${b.name}** nascerá em **5 minutos** (<t:${ts}:t>)!\n` +
              `📍 **Local:** \`${b.territory} — ${b.location}\`\n` +
              `⚔️ *Concentração imediata no local!*\n\n` +
              `🇺🇸 Boss **[Lv. ${b.level}] ${b.name}** will spawn in **5 minutes** (<t:${ts}:t>)!\n` +
              `📍 **Location:** \`${b.territory} — ${b.location}\`\n` +
              `⚔️ *Immediate rally at the location!*`
            )
            .setColor(Colors.Orange)
            .setTimestamp();
          await chAnuncios.send({ embeds: [embed5] }).catch(() => {});
        }

        // Alerta de Spawn (Nasceu)
        if (diffMinutes <= 0) {
          b.status = 'alive';
          b.spawnedAt = now.toISOString();
          b.nextSpawn = null;
          b.alertsSent = {};
          changed = true;
          panelNeedsUpdate = true;

          const embedSpawn = new EmbedBuilder()
            .setTitle('⚔️ WORLD BOSS APARECEU NO MAPA! ┃ WORLD BOSS SPAWNED!')
            .setDescription(
              `🇧🇷 O chefe **[Nv. ${b.level}] ${b.name}** acabou de nascer!\n` +
              `📍 **Local:** \`${b.territory} — ${b.location}\`\n` +
              `🩸 *A caçada começou!*\n\n` +
              `🇺🇸 Boss **[Lv. ${b.level}] ${b.name}** has just spawned!\n` +
              `📍 **Location:** \`${b.territory} — ${b.location}\`\n` +
              `🩸 *The hunt has begun!*`
            )
            .setColor(Colors.Green)
            .setTimestamp();
          await chAnuncios.send({ embeds: [embedSpawn] }).catch(() => {});
        }
      } else if (b.status === 'alive') {
        // Boss manual: expirar após 10 minutos para a staff lembrar de cadastrar o próximo
        const spawnedTime = b.spawnedAt ? new Date(b.spawnedAt).getTime() : 0;
        const elapsedMs = now.getTime() - spawnedTime;
        if (!b.spawnedAt || elapsedMs >= 10 * 60 * 1000) {
          b.status = 'dead';
          b.spawnedAt = null;
          b.nextSpawn = null;
          changed = true;
          panelNeedsUpdate = true;
        }
      }
    }
  }

  if (changed) {
    saveBossData(bossData);
  }

  if (panelNeedsUpdate && config?.channels?.boss) {
    const chBoss = await guild.channels.fetch(config.channels.boss).catch(() => null);
    if (chBoss) await renderOrUpdateBossPanel(guild, chBoss);
  }
}

module.exports = {
  initBossManager,
  getBossData,
  saveBossData,
  getNextGeenaSpawn,
  getFixedScheduleStatus,
  parseTimeInput,
  buildBossPanelEmbed,
  renderOrUpdateBossPanel,
  checkAndSendBossAlerts
};
