const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  PermissionFlagsBits
} = require('discord.js');
const { getGuilds, saveGuilds, getServerConfig } = require('./data_manager');

function parseHexColor(colorStr) {
  if (!colorStr) return Colors.Purple;
  try {
    const cleanHex = colorStr.replace('#', '').trim();
    const parsed = parseInt(cleanHex, 16);
    return isNaN(parsed) ? Colors.Purple : parsed;
  } catch {
    return Colors.Purple;
  }
}

/**
 * Constrói o Embed e as Linhas de Ação para o Painel de Gestão da Guilda
 */
async function buildGuildManagementEmbed(discordGuild, g) {
  let memberCount = 0;
  try {
    await discordGuild.members.fetch().catch(() => {});
    const role = await discordGuild.roles.fetch(g.roleId);
    if (role) memberCount = role.members.size;
  } catch {
    memberCount = 0;
  }

  const officers = (g.officerIds && g.officerIds.length > 0)
    ? g.officerIds.map(id => `<@${id}>`).join(' • ')
    : '*Nenhum oficial cadastrado*';

  const callers = (g.callerIds && g.callerIds.length > 0)
    ? g.callerIds.map(id => `<@${id}>`).join(' • ')
    : '*Nenhum shout caller cadastrado*';

  const isClosed = g.recruitmentStatus === 'closed';
  const statusRecrutamento = isClosed
    ? '🔴 **FECHADO (Lotado / Pausado)**'
    : '🟢 **ABERTO PARA APLICAÇÕES**';

  const vagasStr = (g.vacancies !== undefined && g.vacancies !== null && String(g.vacancies).trim() !== '')
    ? `\`${g.vacancies} vagas disponíveis\``
    : '`Vagas Abertas / Ilimitadas`';

  const embed = new EmbedBuilder()
    .setTitle(`🛡️ PAINEL DE GESTÃO DA GUILDA ┃ [${g.tag}] ${g.name}`)
    .setDescription(
      `Central de controle e comando exclusivo para a **Liderança & Oficiais** da **[${g.tag}] ${g.name}**.\n` +
      `Utilize os botões interativos abaixo para atualizar dados, gerenciar vagas ou aplicar sanções sem precisar digitar comandos longos!`
    )
    .setColor(parseHexColor(g.color))
    .addFields(
      { name: '👑 Líder Principal', value: `<@${g.leaderId}>`, inline: true },
      { name: '👥 Integrantes Ativos', value: `\`${memberCount} membros\``, inline: true },
      { name: '🏷️ Tag / Sigla', value: `\`[${g.tag}]\``, inline: true },
      { name: '🎖️ Oficiais / Staff da Guild', value: officers, inline: false },
      { name: '🗣️ Shout Callers (Raid/Boss)', value: callers, inline: false },
      { name: '🚪 Status do Recrutamento', value: statusRecrutamento, inline: true },
      { name: '📊 Vagas Disponíveis', value: vagasStr, inline: true },
      { name: '🎨 Cor do Clã', value: `\`${g.color || '#9B59B6'}\``, inline: true },
      { name: '📝 Apresentação Pública (Recrutamento)', value: g.description ? `*${g.description}*` : '*Nenhuma descrição cadastrada.*', inline: false }
    );

  if (g.recruitmentNotes && g.recruitmentNotes.trim().length > 0) {
    embed.addFields({
      name: '💬 Requisitos & Observações de Entrada',
      value: `*${g.recruitmentNotes}*`,
      inline: false
    });
  }

  embed.addFields({
    name: '⚡ Ações Rápidas da Liderança',
    value:
      '• **✏️ Editar Dados:** Altere nome, tag, descrição, cor e ícone da guild.\n' +
      '• **👥 Gerenciar Vagas:** Abra/feche o recrutamento e defina vagas disponíveis em tempo real.\n' +
      '• **👢 Remover Membro:** Remove jogador da guild e revoga cargos no Discord com segurança.\n' +
      '• **🔨 Solicitar Ban:** Envia solicitação oficial de banimento para deliberação na Cúpula da Coalizão.\n' +
      '• **📖 Comandos Úteis:** Exibe o catálogo completo de slash commands de liderança.',
    inline: false
  });

  if (g.iconUrl && typeof g.iconUrl === 'string' && g.iconUrl.startsWith('http')) {
    try {
      embed.setThumbnail(g.iconUrl);
    } catch {}
  }

  embed
    .setFooter({ text: `Guild ID: ${g.id} • Servidor: ${g.server || 'Rust 2'} • Painel de Gestão` })
    .setTimestamp();

  // Botões Linha 1: Gestão Básica
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_gp_edit_info_${g.id}`)
      .setLabel('✏️ Editar Dados')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`btn_gp_edit_vagas_${g.id}`)
      .setLabel('👥 Gerenciar Vagas')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`btn_gp_refresh_${g.id}`)
      .setLabel('🔄 Atualizar Painel')
      .setStyle(ButtonStyle.Secondary)
  );

  // Botões Linha 2: Membros & Moderação
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_gp_kick_${g.id}`)
      .setLabel('👢 Remover Membro')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`btn_gp_ban_${g.id}`)
      .setLabel('🔨 Solicitar Ban')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`btn_gp_help_${g.id}`)
      .setLabel('📖 Comandos Úteis')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, rows: [row1, row2] };
}

/**
 * Renderiza ou atualiza o Painel de Gestão no canal de aprovações da guilda
 */
async function renderOrUpdateGuildPanel(discordGuild, targetGuild) {
  if (!targetGuild?.approvalsChannelId) {
    console.warn(`[GUILD-PANEL] Guild [${targetGuild?.tag}] não possui approvalsChannelId configurado.`);
    return null;
  }

  let channel = null;
  try {
    channel = await discordGuild.channels.fetch(targetGuild.approvalsChannelId);
  } catch (err) {
    console.warn(`[GUILD-PANEL] Não foi possível carregar o canal de aprovações de [${targetGuild.tag}]:`, err.message);
    return null;
  }

  if (!channel) return null;

  const { embed, rows } = await buildGuildManagementEmbed(discordGuild, targetGuild);

  let panelMessage = null;
  if (targetGuild.managementPanelMessageId) {
    panelMessage = await channel.messages.fetch(targetGuild.managementPanelMessageId).catch(() => null);
  }

  // Se não tem ID salvo, busca nas mensagens fixadas para evitar duplicatas
  if (!panelMessage) {
    try {
      const pinnedMessages = await channel.messages.fetchPinned().catch(() => null);
      if (pinnedMessages) {
        panelMessage = pinnedMessages.find(m =>
          m.author.id === discordGuild.client.user.id &&
          m.embeds.some(e => e.title?.includes('PAINEL DE GESTÃO DA GUILDA'))
        );
      }
    } catch {}
  }

  if (panelMessage) {
    await panelMessage.edit({ embeds: [embed], components: rows }).catch(err => {
      console.warn(`[GUILD-PANEL] Falha ao editar painel existente de [${targetGuild.tag}]:`, err.message);
    });
    if (targetGuild.managementPanelMessageId !== panelMessage.id) {
      targetGuild.managementPanelMessageId = panelMessage.id;
      const allGuilds = getGuilds();
      const idx = allGuilds.findIndex(g => g.id === targetGuild.id);
      if (idx !== -1) {
        allGuilds[idx] = targetGuild;
        saveGuilds(allGuilds);
      }
    }
    return panelMessage;
  }

  // Cria nova mensagem e fixa no topo
  panelMessage = await channel.send({ embeds: [embed], components: rows }).catch(err => {
    console.error(`[GUILD-PANEL] Erro ao enviar painel de [${targetGuild.tag}]:`, err);
    return null;
  });

  if (panelMessage) {
    await panelMessage.pin().catch(() => {});
    targetGuild.managementPanelMessageId = panelMessage.id;
    const allGuilds = getGuilds();
    const idx = allGuilds.findIndex(g => g.id === targetGuild.id);
    if (idx !== -1) {
      allGuilds[idx] = targetGuild;
      saveGuilds(allGuilds);
    }
  }

  return panelMessage;
}

/**
 * Atualiza os painéis de gestão de todas as guildas cadastradas
 */
async function renderAllGuildPanels(discordGuild) {
  const allGuilds = getGuilds();
  console.log(`[GUILD-PANEL] Sincronizando painéis de gestão para ${allGuilds.length} guildas...`);
  for (const g of allGuilds) {
    try {
      await renderOrUpdateGuildPanel(discordGuild, g);
    } catch (err) {
      console.warn(`[GUILD-PANEL] Erro ao sincronizar painel da guild [${g.tag}]:`, err.message);
    }
  }
  console.log('[GUILD-PANEL] Todos os painéis de gestão foram sincronizados!');
}

module.exports = {
  buildGuildManagementEmbed,
  renderOrUpdateGuildPanel,
  renderAllGuildPanels
};
