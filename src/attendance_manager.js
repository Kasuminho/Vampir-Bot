const fs = require('fs');
const path = require('path');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  Colors,
  PermissionFlagsBits
} = require('discord.js');
const { getServerConfig, getGuilds, saveGuilds } = require('./data_manager');
const { isConnected } = require('./database/db');
const attendanceRepo = require('./database/attendance_repo');

const ATTENDANCE_FILE = path.join(__dirname, '..', 'data', 'presencas.json');
const CONFIG_FILE = path.join(__dirname, '..', 'data', 'server_config.json');

const GEENA_SCHEDULE = [
  { key: 'geena_15', name: 'Geena 15:00', hour: 15 },
  { key: 'geena_19', name: 'Geena 19:00', hour: 19 },
  { key: 'geena_23', name: 'Geena 23:00', hour: 23 }
];

let cachedAttendanceData = null;

async function initAttendanceManager() {
  if (isConnected()) {
    try {
      const dbState = await attendanceRepo.loadAttendanceState();
      if (dbState && (Object.keys(dbState.submissions).length > 0 || Object.keys(dbState.users).length > 0)) {
        cachedAttendanceData = dbState;
        fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(cachedAttendanceData, null, 2), 'utf-8');
        console.log(`[ATTENDANCE] PostgreSQL sincronizado: ${Object.keys(dbState.submissions).length} submissões, ${Object.keys(dbState.users).length} usuários.`);
      }
    } catch (err) {
      console.error('[ATTENDANCE] Erro ao carregar do PostgreSQL:', err.message);
    }
  }
}

/**
 * Lê o arquivo de presenças
 */
function getAttendanceData() {
  if (cachedAttendanceData) return cachedAttendanceData;
  if (fs.existsSync(ATTENDANCE_FILE)) {
    try {
      cachedAttendanceData = JSON.parse(fs.readFileSync(ATTENDANCE_FILE, 'utf-8'));
      return cachedAttendanceData;
    } catch {}
  }
  return {
    submissions: {},
    users: {},
    panelMessageId: null,
    checkinBannerMessageId: null
  };
}

/**
 * Salva o arquivo de presenças
 */
function saveAttendanceData(data) {
  cachedAttendanceData = data;
  try {
    fs.writeFileSync(ATTENDANCE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}

  if (isConnected()) {
    if (data.panelMessageId !== undefined) {
      attendanceRepo.saveAttendanceConfig('panelMessageId', data.panelMessageId).catch(() => {});
    }
    if (data.checkinBannerMessageId !== undefined) {
      attendanceRepo.saveAttendanceConfig('checkinBannerMessageId', data.checkinBannerMessageId).catch(() => {});
    }
    if (data.activeWindowOverride !== undefined) {
      attendanceRepo.saveAttendanceConfig('activeWindowOverride', data.activeWindowOverride).catch(() => {});
    }
  }
}

/**
 * Retorna o status da janela de check-in (30 minutos padrão ou tempo estendido por liderança)
 */
function getGeenaWindowStatus(now = new Date()) {
  const data = getAttendanceData();

  // 1. Verifica se há uma extensão ativa manual (ex: estendida por comando)
  if (data.activeWindowOverride) {
    const expiresAt = new Date(data.activeWindowOverride.expiresAt);
    if (now.getTime() < expiresAt.getTime()) {
      const diffMs = expiresAt.getTime() - now.getTime();
      const minutesLeft = Math.ceil(diffMs / 60000);
      const closesAt = expiresAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return {
        isOpen: true,
        key: data.activeWindowOverride.key || 'geena_15',
        name: data.activeWindowOverride.name || 'Geena 15:00',
        minutesLeft,
        closesAt,
        isExtended: true,
        extendedBy: data.activeWindowOverride.extendedBy
      };
    } else {
      // Expirou, remove o override
      delete data.activeWindowOverride;
      saveAttendanceData(data);
    }
  }

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const spawnHours = [15, 19, 23];

  for (const h of spawnHours) {
    if (currentHour === h && currentMinute < 30) {
      const minutesLeft = 30 - currentMinute;
      return {
        isOpen: true,
        key: `geena_${h}`,
        name: `Geena ${h}:00`,
        spawnHour: h,
        minutesLeft,
        closesAt: `${String(h).padStart(2, '0')}:30`,
        isExtended: false
      };
    }
  }

  // Se fora da janela, calcula o próximo horário
  let nextHour = 15;
  if (currentHour < 15) nextHour = 15;
  else if (currentHour < 19) nextHour = 19;
  else if (currentHour < 23) nextHour = 23;
  else nextHour = 15;

  return {
    isOpen: false,
    key: null,
    name: null,
    nextSpawn: `${String(nextHour).padStart(2, '0')}:00`,
    message: `A janela de presença abre às ${String(nextHour).padStart(2, '0')}:00 e fica aberta por 30 minutos.`
  };
}

/**
 * Estende a janela de presença em N minutos
 */
function extendGeenaWindow({ minutes = 30, executorUser = null, reason = '' }) {
  const data = getAttendanceData();
  const now = new Date();

  let baseTime = now.getTime();
  let currentKey = 'geena_15';
  let currentName = 'Geena 15:00';

  if (data.activeWindowOverride && new Date(data.activeWindowOverride.expiresAt).getTime() > now.getTime()) {
    baseTime = new Date(data.activeWindowOverride.expiresAt).getTime();
    currentKey = data.activeWindowOverride.key || currentKey;
    currentName = data.activeWindowOverride.name || currentName;
  } else {
    const curr = detectCurrentGeenaEvent(now);
    currentKey = curr.key;
    currentName = curr.name;
    const h = now.getHours();
    if ([15, 19, 23].includes(h) && now.getMinutes() < 30) {
      const defaultClose = new Date(now);
      defaultClose.setMinutes(30, 0, 0);
      baseTime = defaultClose.getTime();
    }
  }

  const newExpiresTime = baseTime + (minutes * 60 * 1000);
  const newExpiresDate = new Date(newExpiresTime);

  data.activeWindowOverride = {
    key: currentKey,
    name: currentName,
    expiresAt: newExpiresDate.toISOString(),
    extendedBy: executorUser ? (executorUser.tag || executorUser.username) : 'Staff',
    extendedMinutes: minutes,
    reason: reason || ''
  };

  saveAttendanceData(data);

  return {
    success: true,
    key: currentKey,
    name: currentName,
    expiresAt: newExpiresDate,
    closesAt: newExpiresDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    minutesTotalLeft: Math.ceil((newExpiresTime - now.getTime()) / 60000)
  };
}

/**
 * Detecta o evento de Geena atual ou mais próximo
 */
function detectCurrentGeenaEvent(now = new Date()) {
  const windowStatus = getGeenaWindowStatus(now);
  if (windowStatus.isOpen) {
    return { key: windowStatus.key, name: windowStatus.name };
  }

  const currentHour = now.getHours();
  if (currentHour >= 13 && currentHour < 18) {
    return { key: 'geena_15', name: 'Geena 15:00' };
  }
  if (currentHour >= 18 && currentHour < 22) {
    return { key: 'geena_19', name: 'Geena 19:00' };
  }
  return { key: 'geena_23', name: 'Geena 23:00' };
}

/**
 * Identifica a qual das 7 guilds da coalizão um membro pertence
 */
function getMemberGuild(guildsList, member) {
  if (!member || !member.roles) return null;
  for (const g of guildsList) {
    if (member.roles.cache.has(g.roleId)) {
      return g;
    }
  }
  return null;
}

/**
 * Garante que os canais de check-in, painel e validação de cada guild existam
 */
async function setupAttendanceChannels(discordGuild) {
  await discordGuild.members.fetch().catch(() => {});
  const config = getServerConfig();
  const guildsList = getGuilds();
  const comCatId = config?.categories?.comunidade || '1565129733208014879';

  let configChanged = false;
  let guildsChanged = false;

  // 1. Canal Central de Check-in (#📸・checkin-geena)
  let chCheckin = null;
  if (config?.channels?.checkinGeena) {
    chCheckin = await discordGuild.channels.fetch(config.channels.checkinGeena).catch(() => null);
  }
  if (!chCheckin) {
    const existing = discordGuild.channels.cache.find(c => c && c.name.includes('checkin-geena'));
    if (existing) {
      chCheckin = existing;
    } else {
      console.log('[PRESENÇA] Criando canal #📸・checkin-geena...');
      const overwrites = [
        {
          id: discordGuild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: config.roles.staff,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        },
        {
          id: discordGuild.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ManageMessages
          ]
        }
      ];

      // Permite visualização e envio para todas as 7 guilds
      for (const g of guildsList) {
        overwrites.push({
          id: g.roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory
          ]
        });
      }

      chCheckin = await discordGuild.channels.create({
        name: '📸・checkin-geena',
        type: 0,
        parent: comCatId,
        topic: '📸 Canal oficial de Check-in para os Chefes de Geena (15:00, 19:00 e 23:00)',
        permissionOverwrites: overwrites
      });
    }
    config.channels = config.channels || {};
    config.channels.checkinGeena = chCheckin.id;
    configChanged = true;
  }

  // 2. Canal Central do Painel de Presenças (#📊・painel-presenças)
  let chPainel = null;
  if (config?.channels?.painelPresencas) {
    chPainel = await discordGuild.channels.fetch(config.channels.painelPresencas).catch(() => null);
  }
  if (!chPainel) {
    const existing = discordGuild.channels.cache.find(c => c && c.name.includes('painel-presen'));
    if (existing) {
      chPainel = existing;
    } else {
      console.log('[PRESENÇA] Criando canal #📊・painel-presenças...');
      const overwrites = [
        {
          id: discordGuild.roles.everyone.id,
          deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
        },
        {
          id: config.roles.validado,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
        },
        {
          id: config.roles.staff,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        },
        {
          id: discordGuild.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageMessages
          ]
        }
      ];

      for (const g of guildsList) {
        overwrites.push({
          id: g.roleId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
        });
      }

      chPainel = await discordGuild.channels.create({
        name: '📊・painel-presenças',
        type: 0,
        parent: comCatId,
        topic: '📊 Painel fluido de presenças em Bosses de Geena da Coalizão Vampir',
        permissionOverwrites: overwrites
      });
    }
    config.channels = config.channels || {};
    config.channels.painelPresencas = chPainel.id;
    configChanged = true;
  }

  // 3. Canais de Validação Privada de cada Guild (#✅・validação-geena)
  for (const g of guildsList) {
    if (!g.categoryId) continue;

    let chVal = null;
    if (g.attendanceValidationChannelId) {
      chVal = await discordGuild.channels.fetch(g.attendanceValidationChannelId).catch(() => null);
    }

    if (!chVal) {
      const existing = discordGuild.channels.cache.find(c => c && c.parentId === g.categoryId && c.name.includes('valida'));
      if (existing) {
        chVal = existing;
      } else {
        console.log(`[PRESENÇA] Criando canal de validação para guild ${g.name} (${g.tag})...`);
        const overwrites = [
          {
            id: discordGuild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: g.roleId,
            deny: [PermissionFlagsBits.ViewChannel] // Membros comuns da guild NÃO veem
          },
          {
            id: config.roles.staff,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
          },
          {
            id: discordGuild.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ManageMessages
            ]
          }
        ];

        // Líder da guild
        if (g.leaderId) {
          overwrites.push({
            id: g.leaderId,
            type: 1, // Member
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          });
        }

        // Oficiais da guild
        if (Array.isArray(g.officerIds)) {
          for (const offId of g.officerIds) {
            overwrites.push({
              id: offId,
              type: 1, // Member
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            });
          }
        }

        chVal = await discordGuild.channels.create({
          name: '✅・validação-geena',
          type: 0,
          parent: g.categoryId,
          topic: `Canal privado para Liderança da ${g.name} validar presenças dos membros em Bosses`,
          permissionOverwrites: overwrites
        });
      }

      g.attendanceValidationChannelId = chVal.id;
      guildsChanged = true;
    }
  }

  if (configChanged) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  }
  if (guildsChanged) {
    saveGuilds(guildsList);
  }

  return { chCheckin, chPainel };
}

/**
 * Cria ou atualiza o Banner fixo no canal #📸・checkin-geena
 */
async function renderOrUpdateCheckinBanner(discordGuild, targetChannel) {
  const data = getAttendanceData();
  const windowStatus = getGeenaWindowStatus();

  let title = '🐉 ─── CHECK-IN DE PRESENÇA ┃ BOSSES DE GEENA ─── 🐉';
  let desc = '';
  let color = Colors.DarkRed;

  if (windowStatus.isOpen) {
    title = `🟢 ─── CHECK-IN ABERTO ┃ ${windowStatus.name.toUpperCase()} ─── 🟢`;
    color = Colors.Green;
    desc =
      `🔥 **O BOSS DE ${windowStatus.name.toUpperCase()} ESTÁ ACONTECENDO AGORA!**\n\n` +
      `⏱️ **Janela de Envio:** Aberta até as **${windowStatus.closesAt}** (Restam **${windowStatus.minutesLeft} minutos**)\n` +
      `📸 **O que fazer:** Tire o print da tela no boss e use o comando \`/presenca\` ou clique abaixo!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `### 📋 Regras de Envio:\n` +
      `• **Titular:** Marque como titular se estiver jogando no seu boneco.\n` +
      `• **Piloto:** Marque como piloto e indique o dono da conta (a presença vai para ele!).\n` +
      `• **Trava de Tempo:** A janela fecha pontualmente às **${windowStatus.closesAt}**!`;
  } else {
    title = '🔴 ─── CHECK-IN FECHADO ┃ AGUARDANDO PRÓXIMO BOSS ─── 🔴';
    color = Colors.DarkGrey;
    desc =
      `No momento nenhuma janela de presença está aberta.\n\n` +
      `🕒 **Horários dos Bosses:** \`15:00\` • \`19:00\` • \`23:00\` *(Horário de Brasília)*\n` +
      `⏳ **Próxima Abertura:** às **${windowStatus.nextSpawn}** *(Fica aberto por 30 minutos)*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `### 📋 Como Funciona:\n` +
      `1. No nascimento do Boss, o canal libera o envio de prints por **30 minutos**.\n` +
      `2. O envio é feito via comando **/presenca** ou pelo botão abaixo.\n` +
      `3. O comprovante é enviado direto para o canal interno da **Liderança da sua Guild** validar!`;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setFooter({ text: `Coalizão Vampir • ${windowStatus.isOpen ? 'Janela Ativa de 30 minutos' : 'Janela Fechada'}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_start_checkin')
      .setLabel(windowStatus.isOpen ? '📍 Marcar Presença Agora' : '📍 Marcar Presença (Fechado)')
      .setStyle(windowStatus.isOpen ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji(windowStatus.isOpen ? '📸' : '🔒'),
    new ButtonBuilder()
      .setCustomId('btn_my_attendance')
      .setLabel('🔍 Minhas Presenças')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📊')
  );

  let msg = null;
  if (data.checkinBannerMessageId) {
    msg = await targetChannel.messages.fetch(data.checkinBannerMessageId).catch(() => null);
  }

  if (msg) {
    await msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
  } else {
    msg = await targetChannel.send({ embeds: [embed], components: [row] }).catch(() => null);
    if (msg) {
      data.checkinBannerMessageId = msg.id;
      saveAttendanceData(data);
    }
  }
}

/**
 * Monta o card de validação para a liderança da guild
 */
function buildValidationCard(submission) {
  const isPilot = submission.isPilot;
  const statusColor = submission.status === 'approved'
    ? Colors.Green
    : submission.status === 'rejected'
      ? Colors.Red
      : Colors.Gold;

  const statusText = submission.status === 'approved'
    ? `✅ **APROVADO** por <@${submission.validatedBy}> em <t:${Math.floor(new Date(submission.validatedAt).getTime() / 1000)}:R>`
    : submission.status === 'rejected'
      ? `❌ **REJEITADO** por <@${submission.validatedBy}>:\n> *${submission.rejectionReason || 'Sem motivo especificado'}*`
      : '⏳ **Aguardando Validação da Liderança**';

  const embed = new EmbedBuilder()
    .setTitle(`🛡️ Validação de Presença ┃ [${submission.guildTag}] ${submission.eventName}`)
    .setColor(statusColor)
    .setDescription(
      `**Status:** ${statusText}\n\n` +
      `👤 **Enviado por:** <@${submission.submitterId}> \`(${submission.submitterTag})\`\n` +
      `🎭 **Tipo:** ${isPilot ? '🎮 **PILOTO**' : '🛡️ **TITULAR**'}\n` +
      `👑 **Pontuado (Dono do Boneco):** <@${submission.ownerUserId}> \`(${submission.ownerUserTag})\`\n` +
      `🏰 **Guild:** \`[${submission.guildTag}] ${submission.guildName}\`\n` +
      `⏱️ **Submetido em:** <t:${Math.floor(new Date(submission.createdAt).getTime() / 1000)}:f>\n` +
      (submission.note ? `📝 **Obs:** *${submission.note}*\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .setImage(submission.printUrl)
    .setFooter({ text: `ID: ${submission.id} • Apenas Líder e Oficiais de [${submission.guildTag}] podem validar` })
    .setTimestamp(new Date(submission.createdAt));

  const row = new ActionRowBuilder();
  if (submission.status === 'pending') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_appr_att_${submission.id}`)
        .setLabel('Confirmar Presença')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`btn_rejt_att_${submission.id}`)
        .setLabel('Rejeitar')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_status_done_${submission.id}`)
        .setLabel(submission.status === 'approved' ? 'Presença Confirmada' : 'Presença Rejeitada')
        .setStyle(submission.status === 'approved' ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(true)
    );
  }

  return { embed, row };
}

/**
 * Cria ou atualiza o Painel Fluido de Presenças (#📊・painel-presenças)
 */
async function renderOrUpdatePresencePanel(discordGuild, targetChannel = null, selectedGuildId = 'all') {
  const data = getAttendanceData();
  const guildsList = getGuilds();
  const config = getServerConfig();

  let channel = targetChannel;
  if (!channel && config?.channels?.painelPresencas) {
    channel = await discordGuild.channels.fetch(config.channels.painelPresencas).catch(() => null);
  }
  if (!channel) return;

  const usersArray = Object.values(data.users || {});
  const totalApproved = Object.values(data.submissions || {}).filter(s => s.status === 'approved').length;

  // Filtra por guild se solicitado
  let filteredUsers = usersArray;
  let filterTitle = 'Coalizão Geral (Todas as Guilds)';
  if (selectedGuildId && selectedGuildId !== 'all') {
    const targetG = guildsList.find(g => g.id === selectedGuildId || g.tag === selectedGuildId);
    if (targetG) {
      filteredUsers = usersArray.filter(u => u.guildId === targetG.id || u.guildTag === targetG.tag);
      filterTitle = `[${targetG.tag}] ${targetG.name}`;
    }
  }

  // Ordena por maior número de presenças
  filteredUsers.sort((a, b) => (b.totalPresencas || 0) - (a.totalPresencas || 0));

  // Top 10 ou Top lista
  let rankText = '';
  if (filteredUsers.length === 0) {
    rankText = '*Nenhuma presença confirmada ainda nesta categoria.*';
  } else {
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    rankText = filteredUsers.slice(0, 10).map((u, i) => {
      const medal = medals[i] || `\`#${i + 1}\``;
      const pilotInfo = u.asPilot > 0 ? ` *(🎯 ${u.asPilot} via Piloto)*` : '';
      return `${medal} <@${u.userId}> — **${u.totalPresencas} presenças** \`[${u.guildTag || 'N/A'}]\`${pilotInfo}`;
    }).join('\n');
  }

  // Resumo por Guilds
  const guildStatsLines = guildsList.map(g => {
    const guildSubmissions = Object.values(data.submissions || {}).filter(
      s => (s.guildId === g.id || s.guildTag === g.tag) && s.status === 'approved'
    ).length;
    return `• **[${g.tag}] ${g.name}:** \`${guildSubmissions}\` presenças confirmadas`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📊 ─── PAINEL DE PRESENÇA ┃ BOSSES DE GEENA ─── 📊')
    .setDescription(
      `Acompanhamento dinâmico de presenças confirmadas nos Chefes de Geena.\n\n` +
      `🔥 **Total de Presenças Validadas:** \`${totalApproved}\`\n` +
      `🎯 **Visualização Atual:** **${filterTitle}**\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      {
        name: `🏆 Ranking de Presenças — ${filterTitle}`,
        value: rankText,
        inline: false
      },
      {
        name: '🏰 Presenças Totais por Guild',
        value: guildStatsLines || '*Nenhuma guild registrada.*',
        inline: false
      }
    )
    .setColor(Colors.DarkGold)
    .setFooter({ text: 'Atualizado em tempo real • Selecione uma guild abaixo para filtrar' })
    .setTimestamp();

  // Menu Dropdown para filtrar por guild
  const selectOptions = [
    {
      label: '🌐 Coalizão Geral (Todas as Guilds)',
      value: 'all',
      description: 'Exibir ranking geral de todos os membros da Coalizão',
      default: selectedGuildId === 'all'
    }
  ];

  for (const g of guildsList) {
    selectOptions.push({
      label: `[${g.tag}] ${g.name}`,
      value: g.id,
      description: `Ver ranking individual de presenças da ${g.name}`,
      default: selectedGuildId === g.id
    });
  }

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_attendance_guild_filter')
      .setPlaceholder('Filtrar ranking por Guild...')
      .addOptions(selectOptions)
  );

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_my_attendance')
      .setLabel('🔍 Minhas Presenças')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('👤'),
    new ButtonBuilder()
      .setCustomId('btn_refresh_attendance_panel')
      .setLabel('🔄 Atualizar Ranking')
      .setStyle(ButtonStyle.Secondary)
  );

  let msg = null;
  if (data.panelMessageId) {
    msg = await channel.messages.fetch(data.panelMessageId).catch(() => null);
  }

  if (msg) {
    await msg.edit({ embeds: [embed], components: [selectRow, buttonRow] }).catch(() => {});
  } else {
    msg = await channel.send({ embeds: [embed], components: [selectRow, buttonRow] }).catch(() => null);
    if (msg) {
      data.panelMessageId = msg.id;
      saveAttendanceData(data);
    }
  }
}

/**
 * Submete uma nova presença
 */
async function submitAttendance({
  discordGuild,
  submitterMember,
  isPilot,
  ownerUser,
  printUrl,
  eventKey,
  note = ''
}) {
  const guildsList = getGuilds();
  const submitterGuild = getMemberGuild(guildsList, submitterMember);

  if (!submitterGuild) {
    return {
      success: false,
      error: '❌ Você não possui o cargo de nenhuma das 8 guilds da Coalizão! Apenas membros de guild podem marcar presença.'
    };
  }

  // Validação da Janela de 30 minutos (15:00-15:30, 19:00-19:30, 23:00-23:30)
  const isStaff = submitterMember.permissions.has(PermissionFlagsBits.Administrator) ||
                  (submitterMember.roles && submitterMember.roles.cache.has(getServerConfig()?.roles?.staff));

  const windowStatus = getGeenaWindowStatus();
  if (!windowStatus.isOpen && !isStaff) {
    return {
      success: false,
      error: `⛔ **Janela de Check-in Encerrada!**\nAs presenças de Geena só podem ser marcadas durante os **30 minutos** seguintes ao nascimento de cada Boss (\`15:00 às 15:30\`, \`19:00 às 19:30\` e \`23:00 às 23:30\`).\n\n⏳ **Próxima Abertura:** às **${windowStatus.nextSpawn}**.`
    };
  }

  let targetUser = submitterMember.user;
  let targetGuild = submitterGuild;

  if (isPilot) {
    if (!ownerUser) {
      return {
        success: false,
        error: '❌ Como você selecionou **Piloto**, é obrigatório indicar o Dono da Conta!'
      };
    }
    targetUser = ownerUser;
    const ownerMember = await discordGuild.members.fetch(ownerUser.id).catch(() => null);
    if (ownerMember) {
      const ownerG = getMemberGuild(guildsList, ownerMember);
      if (ownerG) targetGuild = ownerG;
    }
  }

  // Verifica o canal de validação da guild correspondente
  if (!targetGuild.attendanceValidationChannelId) {
    await setupAttendanceChannels(discordGuild);
  }

  const validationChan = targetGuild.attendanceValidationChannelId
    ? await discordGuild.channels.fetch(targetGuild.attendanceValidationChannelId).catch(() => null)
    : null;

  if (!validationChan) {
    return {
      success: false,
      error: `❌ O canal de validação da guild **${targetGuild.name}** não foi encontrado. Contate a Staff.`
    };
  }

  const eventInfo = GEENA_SCHEDULE.find(e => e.key === eventKey) || detectCurrentGeenaEvent();
  const submissionId = `att_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const submission = {
    id: submissionId,
    eventId: `${eventInfo.key}_${new Date().toISOString().slice(0, 10)}`,
    eventName: eventInfo.name,
    submitterId: submitterMember.id,
    submitterTag: submitterMember.user.tag || submitterMember.displayName,
    isPilot: !!isPilot,
    pilotUserId: isPilot ? submitterMember.id : null,
    ownerUserId: targetUser.id,
    ownerUserTag: targetUser.tag || targetUser.username,
    guildId: targetGuild.id,
    guildTag: targetGuild.tag,
    guildName: targetGuild.name,
    printUrl: printUrl,
    note: note || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    validatedBy: null,
    validatedAt: null,
    rejectionReason: null
  };

  const { embed, row } = buildValidationCard(submission);
  const sentMsg = await validationChan.send({
    content: `📢 **Nova Presença Submetida:** <@${submission.ownerUserId}> (${submission.eventName})`,
    embeds: [embed],
    components: [row]
  }).catch(err => {
    console.error('[PRESENÇA] Erro ao enviar card para canal de validação:', err);
    return null;
  });

  if (!sentMsg) {
    return {
      success: false,
      error: '❌ Não foi possível enviar a ficha de presença para a liderança. Tente novamente.'
    };
  }

  submission.validationMessageId = sentMsg.id;
  submission.validationChannelId = validationChan.id;

  const data = getAttendanceData();
  data.submissions[submissionId] = submission;
  saveAttendanceData(data);
  if (isConnected()) {
    attendanceRepo.upsertSubmission(submission).catch(err => {
      console.error('[DB] Erro ao salvar submissão no PostgreSQL:', err.message);
    });
  }

  return {
    success: true,
    submission,
    targetGuild
  };
}

/**
 * Trata aprovação ou rejeição de presença pela liderança
 */
async function handleValidationDecision(interaction, submissionId, decision, rejectionReason = '') {
  const data = getAttendanceData();
  const submission = data.submissions[submissionId];

  if (!submission) {
    return interaction.reply({
      content: '❌ Registro de presença não encontrado ou já expirado.',
      ephemeral: true
    });
  }

  if (submission.status !== 'pending') {
    return interaction.reply({
      content: `⚠️ Esta presença já foi avaliada anteriormente (${submission.status === 'approved' ? 'Aprovada' : 'Rejeitada'}).`,
      ephemeral: true
    });
  }

  // Validação estrita de liderança: Apenas Líder ou Oficial da guild correspondente!
  const guildsList = getGuilds();
  const guild = guildsList.find(g => g.id === submission.guildId || g.tag === submission.guildTag);

  if (!guild) {
    return interaction.reply({ content: '❌ Guild não encontrada no sistema.', ephemeral: true });
  }

  const userId = interaction.user.id;
  const isLeader = guild.leaderId === userId;
  const isOfficer = Array.isArray(guild.officerIds) && guild.officerIds.includes(userId);
  const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

  if (!isLeader && !isOfficer && !isStaff) {
    return interaction.reply({
      content: `⛔ **Acesso Negado!** Apenas o Líder ou Oficiais da guild **[${guild.tag}] ${guild.name}** podem aprovar ou rejeitar esta presença!`,
      ephemeral: true
    });
  }

  submission.status = decision;
  submission.validatedBy = userId;
  submission.validatedAt = new Date().toISOString();
  if (decision === 'rejected') {
    submission.rejectionReason = rejectionReason || 'Comprovante não condizente com o evento.';
  }

  // Se aprovado, credita no saldo do dono do boneco
  if (decision === 'approved') {
    const ownerId = submission.ownerUserId;
    if (!data.users[ownerId]) {
      data.users[ownerId] = {
        userId: ownerId,
        userTag: submission.ownerUserTag,
        guildId: submission.guildId,
        guildTag: submission.guildTag,
        totalPresencas: 0,
        asTitular: 0,
        asPilot: 0,
        timesPiloting: 0,
        lastEvent: submission.eventName,
        lastDate: submission.validatedAt
      };
    }

    const u = data.users[ownerId];
    u.totalPresencas = (u.totalPresencas || 0) + 1;
    if (submission.isPilot) {
      u.asPilot = (u.asPilot || 0) + 1;
      // Registra também quem pilotou
      if (!data.users[submission.submitterId]) {
        data.users[submission.submitterId] = {
          userId: submission.submitterId,
          userTag: submission.submitterTag,
          guildId: submission.guildId,
          guildTag: submission.guildTag,
          totalPresencas: 0,
          asTitular: 0,
          asPilot: 0,
          timesPiloting: 0,
          lastEvent: null,
          lastDate: null
        };
      }
      data.users[submission.submitterId].timesPiloting = (data.users[submission.submitterId].timesPiloting || 0) + 1;
    } else {
      u.asTitular = (u.asTitular || 0) + 1;
    }
    u.lastEvent = submission.eventName;
    u.lastDate = submission.validatedAt;
  }

  saveAttendanceData(data);

  if (isConnected()) {
    attendanceRepo.upsertSubmission(submission).catch(err => {
      console.error('[DB] Erro ao atualizar decisão de submissão no PostgreSQL:', err.message);
    });
    if (decision === 'approved') {
      const ownerUser = data.users[submission.ownerUserId];
      if (ownerUser) attendanceRepo.upsertAttendanceUser(ownerUser).catch(() => {});
      if (submission.isPilot && submission.submitterId && data.users[submission.submitterId]) {
        attendanceRepo.upsertAttendanceUser(data.users[submission.submitterId]).catch(() => {});
      }
    }
  }

  // Atualiza o card de validação no canal privado da guild
  const { embed, row } = buildValidationCard(submission);
  try {
    if (interaction.isButton && interaction.isButton()) {
      await interaction.update({ embeds: [embed], components: [row] });
    } else if (interaction.message) {
      await interaction.message.edit({ embeds: [embed], components: [row] });
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferUpdate().catch(() => {});
      }
    }
  } catch (err) {
    if (interaction.message) {
      await interaction.message.edit({ embeds: [embed], components: [row] }).catch(() => {});
    }
  }

  // Notifica o player no PV se possível
  try {
    const userToNotify = await interaction.client.users.fetch(submission.ownerUserId).catch(() => null);
    if (userToNotify) {
      const dmEmbed = new EmbedBuilder()
        .setTitle(decision === 'approved' ? '✅ Presença Confirmada!' : '❌ Presença Rejeitada')
        .setColor(decision === 'approved' ? Colors.Green : Colors.Red)
        .setDescription(
          decision === 'approved'
            ? `Sua presença no evento **${submission.eventName}** foi **APROVADA** pela liderança da guild **[${submission.guildTag}]**!`
            : `Sua presença no evento **${submission.eventName}** foi **REJEITADA** pela liderança da guild **[${submission.guildTag}]**.\n**Motivo:** ${submission.rejectionReason}`
        )
        .setTimestamp();
      await userToNotify.send({ embeds: [dmEmbed] }).catch(() => {});
    }
  } catch {}

  // Atualiza o painel central de presenças
  await renderOrUpdatePresencePanel(interaction.guild).catch(() => {});
}

/**
 * Consulta o resumo pessoal de presenças de um membro
 */
function getUserAttendanceSummary(userId) {
  const data = getAttendanceData();
  const u = data.users[userId];
  const userSubmissions = Object.values(data.submissions || {}).filter(
    s => s.ownerUserId === userId && s.status === 'approved'
  );

  return {
    user: u || null,
    total: u ? u.totalPresencas : 0,
    asTitular: u ? u.asTitular : 0,
    asPilot: u ? u.asPilot : 0,
    timesPiloting: u ? (u.timesPiloting || 0) : 0,
    recentEvents: userSubmissions.slice(-5).reverse()
  };
}

module.exports = {
  initAttendanceManager,
  GEENA_SCHEDULE,
  getAttendanceData,
  saveAttendanceData,
  getGeenaWindowStatus,
  extendGeenaWindow,
  detectCurrentGeenaEvent,
  getMemberGuild,
  setupAttendanceChannels,
  renderOrUpdateCheckinBanner,
  renderOrUpdatePresencePanel,
  buildValidationCard,
  submitAttendance,
  handleValidationDecision,
  getUserAttendanceSummary
};
