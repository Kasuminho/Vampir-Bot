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

// Histórico de eventos de boss já disparados/concluídos para NUNCA reativar no mesmo horário
const handledEvents = new Set();

// Inicialização: Marca eventos de horários já passados no dia atual como tratados
(function initHandledEvents() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentHour = now.getHours();
  for (const h of GEENA_HOURS) {
    if (currentHour >= h) {
      handledEvents.add(`${dateStr}_geena_${h}`);
    }
  }
})();

/**
 * Conta quantos membros estão conectados em calls de combate/comunidade (excluindo AFK e canais de status)
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
  const nowMs = now.getTime();
  let targetDate = null;
  let targetHour = null;

  for (const h of GEENA_HOURS) {
    const candidate = new Date(now);
    candidate.setHours(h, 0, 0, 0);
    // Considera este horário de boss enquanto estiver entre 15 min antes e 60 min após o spawn
    if (candidate.getTime() > nowMs - (60 * 60 * 1000)) {
      targetDate = candidate;
      targetHour = h;
      break;
    }
  }

  // Se passou de todos os horários do dia, o próximo é 15:00 de amanhã
  if (!targetDate) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 1);
    targetDate.setHours(GEENA_HOURS[0], 0, 0, 0);
    targetHour = GEENA_HOURS[0];
  }

  const diffMs = targetDate.getTime() - nowMs;
  const minutesUntilSpawn = Math.round(diffMs / 60000);

  const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
  const key = `${dateStr}_geena_${targetHour}`;

  return {
    key,
    hour: targetHour,
    name: `Geena ${targetHour}:00`,
    spawnDate: targetDate,
    minutesUntilSpawn
  };
}

/**
 * Ativa o modo de Lockdown / Combate
 */
async function activateLockdown(guild, reason = '15 minutos antes do Boss de Geena', triggeredBy = 'automatic', customKey = null) {
  if (lockdownState.isActive) return false;

  console.log(`[LOCKDOWN] Ativando Modo Combate / OpSec (${reason} | Tipo: ${triggeredBy})...`);
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
  const eventKey = customKey || (triggeredBy === 'manual' ? 'manual' : nextEvent.key);

  lockdownState = {
    isActive: true,
    startedAt: now.toISOString(),
    eventKey,
    bossSpawnTime: nextEvent.spawnDate.toISOString(),
    peakVoiceCount: currentVoice,
    peakRecordedAt: now.toISOString(),
    triggeredBy
  };

  // Se foi acionado automaticamente, registra na lista de eventos para nunca reativar no mesmo horário
  if (triggeredBy === 'automatic') {
    handledEvents.add(eventKey);
  }

  // 4. Envia alerta para logs e chat de liderança
  const config = getServerConfig();
  const isManual = triggeredBy === 'manual';

  const embedAlert = new EmbedBuilder()
    .setTitle('🔒 ─── MODO COMBATE ATIVADO ┃ OPSEC ─── 🔒')
    .setDescription(
      `🛡️ **Todos os canais comunitários foram OCULTADOS para membros sem tag de guilda!**\n\n` +
      `• **Motivo:** \`${reason}\`\n` +
      `• **Aba Liberada:** Apenas \`🚪 │ RECEPÇÃO & ENTRADA\` (Recrutamento & Regras) permanece visível para visitantes.\n` +
      `• **Membros da Coalizão:** Usuários com cargo de Legião continuam acessando 100% dos canais e calls normalmente.\n\n` +
      (isManual
        ? `⚠️ **Ativação Manual:** Este modo foi ativado manualmente pela liderança e **NÃO desativará automaticamente**. Só será desativado quando a Staff executar \`/lockdown acao:desativar\`.`
        : `📡 **Monitoramento Automático:** As salas de voz estão sendo monitoradas. Quando a batalha terminar e ocorrer a **saída em massa da call**, o bot reabrirá os canais automaticamente e **não ativará novamente** até o próximo horário!`)
    )
    .addFields(
      { name: '👥 Conectados em Call Inicial', value: `\`${currentVoice} membros\``, inline: true },
      { name: '⚔️ Evento Alvo', value: `\`${isManual ? 'Operação Manual' : nextEvent.name}\``, inline: true },
      { name: '🕹️ Tipo', value: `\`${isManual ? 'Manual (Desativação Manual)' : 'Automático (Saída em Massa)'}\``, inline: true }
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

  // 2. Restaura categoria Comunidade Geral
  try {
    const cat = await guild.channels.fetch(COMMUNITY_CATEGORY_ID).catch(() => null);
    if (cat) {
      await cat.permissionOverwrites.edit(everyoneRole.id, {
        ViewChannel: true
      }, { reason: `[OPSEC] Fim do Lockdown: ${reason}` });
    }
  } catch (err) {}

  const prevPeak = lockdownState.peakVoiceCount;
  const currentEventKey = lockdownState.eventKey;

  // Se pertencia a um evento de boss, assegura que fique marcado no histórico para nunca reativar
  if (currentEventKey && currentEventKey !== 'manual') {
    handledEvents.add(currentEventKey);
  }

  lockdownState = {
    isActive: false,
    startedAt: null,
    eventKey: null,
    bossSpawnTime: null,
    peakVoiceCount: 0,
    peakRecordedAt: null,
    triggeredBy: 'automatic'
  };

  // 3. Notifica o encerramento do lockdown
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

    // =========================================================================
    // CASO 1: LOCKDOWN JÁ ESTÁ ATIVO
    // =========================================================================
    if (lockdownState.isActive) {
      // REGRA 2: Se foi ativado manualmente, NUNCA sai por rotina automática!
      // Apenas a Staff/Liderança pode desativar pelo comando manual (/lockdown acao:desativar).
      if (lockdownState.triggeredBy === 'manual') {
        return;
      }

      const currentVoice = getCoalitionVoiceCount(guild);

      // Atualiza o pico se a call estiver crescendo
      if (currentVoice > lockdownState.peakVoiceCount) {
        lockdownState.peakVoiceCount = currentVoice;
        lockdownState.peakRecordedAt = now.toISOString();
      }

      const spawnDiffMinutes = Math.floor((now.getTime() - new Date(lockdownState.bossSpawnTime).getTime()) / 60000);

      // Trava de segurança: Nunca desativa antes do boss nascer e de ter pelo menos 3 minutos de combate
      if (spawnDiffMinutes < 3) {
        return;
      }

      // REGRA 1: Desativação automática por SAÍDA EM MASSA das calls
      // Cenário A: Batalha com presença representativa (pico >= 8 pessoas)
      // Desativa quando houver queda de pelo menos 60% em relação ao pico ou sobrarem <= 4 membros
      if (lockdownState.peakVoiceCount >= 8 && (currentVoice <= Math.ceil(lockdownState.peakVoiceCount * 0.40) || currentVoice <= 4)) {
        await deactivateLockdown(
          guild,
          `Saída em massa detectada (Ocupação caiu de ${lockdownState.peakVoiceCount} para ${currentVoice} membros)`
        );
        return;
      }

      // Cenário B: Batalha menor (pico entre 4 e 7 pessoas)
      // Desativa se após 10 minutos pós-spawn a call esvaziar para <= 2 membros
      if (lockdownState.peakVoiceCount >= 4 && currentVoice <= 2 && spawnDiffMinutes >= 10) {
        await deactivateLockdown(
          guild,
          `Calls de combate esvaziadas (Ocupação caiu de ${lockdownState.peakVoiceCount} para ${currentVoice} membros)`
        );
        return;
      }

      // Cenário C: Timeout máximo de segurança pós-spawn (50 minutos após spawn)
      if (spawnDiffMinutes >= 50) {
        await deactivateLockdown(
          guild,
          `Tempo limite máximo de combate atingido pós-spawn (${spawnDiffMinutes} minutos)`
        );
        return;
      }

      return;
    }

    // =========================================================================
    // CASO 2: LOCKDOWN NÃO ESTÁ ATIVO
    // =========================================================================
    if (!lockdownState.isActive) {
      // REGRA 1: "não ativa de novo até o próximo horário"
      // Se este horário de boss já foi executado hoje, NÃO ATIVA DE NOVO!
      if (handledEvents.has(nextEvent.key)) {
        return;
      }

      // Ativação automática: faltando entre 0 e 15 minutos para o spawn do Boss
      if (nextEvent.minutesUntilSpawn <= 15 && nextEvent.minutesUntilSpawn >= 0) {
        handledEvents.add(nextEvent.key);
        await activateLockdown(
          guild,
          `Faltam ${nextEvent.minutesUntilSpawn} minutos para o respawn de ${nextEvent.name}`,
          'automatic',
          nextEvent.key
        );
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
