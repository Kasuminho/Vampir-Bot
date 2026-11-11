const { EmbedBuilder, Colors, PermissionFlagsBits } = require('discord.js');
const { getServerConfig } = require('../data_manager');

// IDs dos canais e categorias comunitárias que convidados (sem tag de guild) conseguem ver normalmente
const RESTRICTED_CHANNELS = [
  '1565129739159478332', // #chat-geral
  '1565781677018452112', // #chat-geral-en
  '1566849577590587463', // #comércio-e-mercado
  '1569012901522440302', // #painel-presenças
  '1567716583810400297', // #painel-de-calls
  '1565129741025935411', // 🔊・Lobby Geral (voz)
  '1565139448235032766'  // 🔊・Call 1 (voz)
];

const COMMUNITY_CATEGORY_ID = '1565129733208014879'; // 🌐 │ COMUNIDADE GERAL
const AFK_CHANNEL_ID = '1565139452773277716';

// Horários dos Bosses principais de Geena (15:00, 19:00, 23:00)
const GEENA_HOURS = [15, 19, 23];

// Estado em memória do Lockdown
let lockdownState = {
  isActive: false,
  startedAt: null,
  eventKey: null,
  bossSpawnTime: null,
  peakVoiceCount: 0,
  peakRecordedAt: null,
  triggeredBy: 'automatic' // 'automatic' | 'manual'
};

/**
 * Conta quantos membros estão conectados em calls de combate/comunidade (excluindo AFK)
 */
function getCoalitionVoiceCount(guild) {
  let count = 0;
  for (const [, ch] of guild.channels.cache) {
    if (ch.isVoiceBased() && ch.id !== AFK_CHANNEL_ID) {
      // Ignora contadores da categoria de status (onde canais de voz funcionam como contadores)
      if (ch.parentId === '1565139422671020104') continue;
      count += ch.members.filter(m => !m.user.bot).size;
    }
  }
  return count;
}

/**
 * Retorna o próximo boss de Geena e quantos minutos faltam
 */
function getNextGeenaEvent(now = new Date()) {
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const nowMs = now.getTime();

  let targetDate = null;
  let targetHour = null;

  for (const h of GEENA_HOURS) {
    const candidate = new Date(now);
    candidate.setHours(h, 0, 0, 0);
    if (candidate.getTime() > nowMs - (10 * 60 * 1000)) { // Considera até 10 min após o spawn como o evento atual
      targetDate = candidate;
      targetHour = h;
      break;
    }
  }

  // Se passou das 23:10, o próximo é 15:00 de amanhã
  if (!targetDate) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 1);
    targetDate.setHours(GEENA_HOURS[0], 0, 0, 0);
    targetHour = GEENA_HOURS[0];
  }

  const diffMs = targetDate.getTime() - nowMs;
  const minutesUntilSpawn = Math.round(diffMs / 60000);

  return {
    key: `geena_${targetHour}`,
    name: `Geena ${targetHour}:00`,
    spawnDate: targetDate,
    minutesUntilSpawn
  };
}

/**
 * Ativa o modo de Lockdown / Combate
 */
async function activateLockdown(guild, reason = '15 minutos antes do Boss de Geena', triggeredBy = 'automatic') {
  if (lockdownState.isActive) return false;

  console.log(`[LOCKDOWN] Ativando Modo Combate / OpSec (${reason})...`);
  const everyoneRole = guild.roles.everyone;

  // 1. Oculta os canais comunitários para @everyone
  for (const channelId of RESTRICTED_CHANNELS) {
    try {
      const ch = await guild.channels.fetch(channelId).catch(() => null);
      if (ch) {
        await ch.permissionOverwrites.edit(everyoneRole.id, {
          ViewChannel: false
        }, { reason: `[OPSEC] Lockdown de Combate: ${reason}` });
      }
    } catch (err) {
      console.warn(`[LOCKDOWN] Falha ao ocultar canal ${channelId}:`, err.message);
    }
  }

  // 2. Trava a categoria Comunidade Geral
  try {
    const cat = await guild.channels.fetch(COMMUNITY_CATEGORY_ID).catch(() => null);
    if (cat) {
      await cat.permissionOverwrites.edit(everyoneRole.id, {
        ViewChannel: false
      }, { reason: `[OPSEC] Lockdown de Combate: ${reason}` });
    }
  } catch (err) {}

  // 3. Inicializa estado de monitoramento de voz
  const currentVoice = getCoalitionVoiceCount(guild);
  const now = new Date();
  const nextEvent = getNextGeenaEvent(now);

  lockdownState = {
    isActive: true,
    startedAt: now.toISOString(),
    eventKey: nextEvent.name,
    bossSpawnTime: nextEvent.spawnDate.toISOString(),
    peakVoiceCount: currentVoice,
    peakRecordedAt: now.toISOString(),
    triggeredBy
  };

  // 4. Envia alerta para logs e chat de liderança
  const config = getServerConfig();
  const embedAlert = new EmbedBuilder()
    .setTitle('🔒 ─── MODO COMBATE ATIVADO ┃ OPSEC ─── 🔒')
    .setDescription(
      `🛡️ **Todos os canais comunitários foram OCULTADOS para membros sem tag de guilda!**\n\n` +
      `• **Motivo:** \`${reason}\`\n` +
      `• **Aba Liberada:** Apenas \`🚪 │ RECEPÇÃO & ENTRADA\` (Recrutamento & Regras) permanece visível para visitantes.\n` +
      `• **Membros da Coalizão:** Usuários com cargo de Legião continuam acessando 100% dos canais e calls normalmente.\n\n` +
      `📡 **Monitoramento:** As salas de voz estão sendo monitoradas. Quando a batalha terminar e ocorrer a **saída em massa da call**, o bot reabrirá os canais automaticamente!`
    )
    .addFields(
      { name: '👥 Conectados em Call Inicial', value: `\`${currentVoice} membros\``, inline: true },
      { name: '⚔️ Evento Alvo', value: `\`${nextEvent.name}\``, inline: true },
      { name: '🕹️ Tipo', value: `\`${triggeredBy === 'manual' ? 'Manual' : 'Automático'}\``, inline: true }
    )
    .setColor(Colors.DarkRed)
    .setTimestamp();

  if (config?.channels?.logs) {
    guild.channels.fetch(config.channels.logs)
      .then(ch => ch && ch.send({ embeds: [embedAlert] }))
      .catch(() => {});
  }

  if (config?.channels?.chatLideres) {
    guild.channels.fetch(config.channels.chatLideres)
      .then(ch => ch && ch.send({ embeds: [embedAlert] }))
      .catch(() => {});
  }

  return true;
}

/**
 * Desativa o modo de Lockdown e restaura os canais comunitários para visitantes
 */
async function deactivateLockdown(guild, reason = 'Saída em massa das calls detectada') {
  if (!lockdownState.isActive) return false;

  console.log(`[LOCKDOWN] Desativando Modo Combate (${reason})...`);
  const everyoneRole = guild.roles.everyone;

  // 1. Restaura visibilidade para @everyone
  for (const channelId of RESTRICTED_CHANNELS) {
    try {
      const ch = await guild.channels.fetch(channelId).catch(() => null);
      if (ch) {
        await ch.permissionOverwrites.edit(everyoneRole.id, {
          ViewChannel: true
        }, { reason: `[OPSEC] Fim do Lockdown: ${reason}` });
      }
    } catch (err) {
      console.warn(`[LOCKDOWN] Falha ao reabrir canal ${channelId}:`, err.message);
    }
  }

  const prevPeak = lockdownState.peakVoiceCount;
  const startedAt = lockdownState.startedAt;

  lockdownState = {
    isActive: false,
    startedAt: null,
    eventKey: null,
    bossSpawnTime: null,
    peakVoiceCount: 0,
    peakRecordedAt: null,
    triggeredBy: 'automatic'
  };

  // 2. Notifica o encerramento do lockdown
  const config = getServerConfig();
  const embedUnlock = new EmbedBuilder()
    .setTitle('🔓 ─── MODO COMBATE FINALIZADO ┃ CANAIS LIBERADOS ─── 🔓')
    .setDescription(
      `🌐 **A Coalizão Vampir retornou ao estado aberto da comunidade!**\n\n` +
      `• **Motivo da Liberação:** \`${reason}\`\n` +
      `• **Pico de Membros em Call:** \`${prevPeak} jogadores\`\n` +
      '• **Canais Comunitários:** O `#chat-geral`, comércio e canais públicos já estão visíveis novamente para todos.'
    )
    .setColor(Colors.Green)
    .setTimestamp();

  if (config?.channels?.logs) {
    guild.channels.fetch(config.channels.logs)
      .then(ch => ch && ch.send({ embeds: [embedUnlock] }))
      .catch(() => {});
  }

  if (config?.channels?.chatLideres) {
    guild.channels.fetch(config.channels.chatLideres)
      .then(ch => ch && ch.send({ embeds: [embedUnlock] }))
      .catch(() => {});
  }

  return true;
}

/**
 * Rotina automática executada a cada 30 segundos
 */
async function checkLockdownRoutine(client) {
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
    if (!guild) return;

    const now = new Date();
    const nextEvent = getNextGeenaEvent(now);

    // 1. Checagem de Ativação Automática: Faltando 15 minutos ou menos para o Boss
    if (!lockdownState.isActive) {
      // Se faltam entre 0 e 15 minutos para o spawn de Geena
      if (nextEvent.minutesUntilSpawn <= 15 && nextEvent.minutesUntilSpawn >= -5) {
        await activateLockdown(
          guild,
          `Faltam ${nextEvent.minutesUntilSpawn} minutos para o respawn de ${nextEvent.name}`,
          'automatic'
        );
      }
      return;
    }

    // 2. Checagem de Desativação Automática (quando o lockdown está ativo)
    if (lockdownState.isActive) {
      const currentVoice = getCoalitionVoiceCount(guild);

      // Atualiza o pico se a call estiver crescendo
      if (currentVoice > lockdownState.peakVoiceCount) {
        lockdownState.peakVoiceCount = currentVoice;
        lockdownState.peakRecordedAt = now.toISOString();
      }

      const elapsedMs = now.getTime() - new Date(lockdownState.startedAt).getTime();
      const elapsedMinutes = Math.floor(elapsedMs / 60000);

      // Trava de segurança: Nunca reabre antes de 15 minutos de lockdown (garante que passa pelo horário do spawn)
      if (elapsedMinutes < 15) {
        return;
      }

      // Critério A: Saída em massa das calls (pico foi pelo menos 5 pessoas e agora caiu mais de 50%)
      if (lockdownState.peakVoiceCount >= 5 && currentVoice <= Math.ceil(lockdownState.peakVoiceCount * 0.45)) {
        await deactivateLockdown(
          guild,
          `Saída em massa detectada (Ocupação caiu de ${lockdownState.peakVoiceCount} para ${currentVoice} membros)`
        );
        return;
      }

      // Critério B: Esvaziamento total da call de combate (3 ou menos membros após pelo menos 20 min)
      if (elapsedMinutes >= 20 && currentVoice <= 3 && lockdownState.peakVoiceCount >= 3) {
        await deactivateLockdown(
          guild,
          `Calls de combate esvaziadas (${currentVoice} membros restantes)`
        );
        return;
      }

      // Critério C: Timeout Máximo de Segurança (50 minutos de lockdown - combate já encerrou)
      if (elapsedMinutes >= 50) {
        await deactivateLockdown(
          guild,
          `Tempo limite máximo de combate atingido (50 minutos)`
        );
        return;
      }
    }
  } catch (err) {
    console.error('[LOCKDOWN ROUTINE] Erro:', err.message);
  }
}

/**
 * Retorna o status atual do Lockdown para consulta em comando
 */
function getLockdownStatus(guild) {
  const currentVoice = guild ? getCoalitionVoiceCount(guild) : 0;
  return {
    ...lockdownState,
    currentVoiceCount: currentVoice
  };
}

module.exports = {
  activateLockdown,
  deactivateLockdown,
  checkLockdownRoutine,
  getLockdownStatus,
  getNextGeenaEvent
};
