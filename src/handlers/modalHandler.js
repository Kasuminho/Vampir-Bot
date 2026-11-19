const crypto = require('crypto');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  PermissionFlagsBits
} = require('discord.js');

const {
  getServerConfig,
  getGuilds,
  saveGuilds,
  findGuildById,
  addApplication
} = require('../data_manager');
const { handleValidationDecision } = require('../attendance_manager');
const { updateSingleGuildCard } = require('../recruitment_panel');
const { renderOrUpdateGuildPanel } = require('../guild_panel');
const { renderOrUpdateTransferPanel } = require('../transfer_panel');
const { refreshServerStats } = require('../services/statsService');
const banRepo = require('../database/ban_repo');

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
 * Roteia e trata todas as submissões de formulário modal (interaction.isModalSubmit())
 */
async function handleModal(interaction) {
  const config = getServerConfig();
  const guild = interaction.guild;
  const { customId } = interaction;

  // --- MODAL DE REJEIÇÃO DE PRESENÇA ---
  if (customId.startsWith('modal_reject_att_')) {
    const submissionId = customId.replace('modal_reject_att_', '');
    const reason = interaction.fields.getTextInputValue('motivo_rejeicao');
    await handleValidationDecision(interaction, submissionId, 'rejected', reason);
    return;
  }

  // --- SUBMISSÃO DE CANDIDATURA PARA GUILD (modal_apply_...) ---
  if (customId.startsWith('modal_apply_')) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    const guildId = customId.replace('modal_apply_', '');
    const targetGuild = findGuildById(guildId);

    if (!targetGuild) {
      return interaction.editReply({ content: '❌ Erro: Guild não identificada no sistema.' }).catch(() => {});
    }

    // Trava: se já possui cargo de outra guild, bloqueia e instrui transferência
    const member = interaction.member;
    const allGuilds = getGuilds();
    const existingGuild = allGuilds.find(g => member.roles.cache.has(g.roleId));

    if (existingGuild && existingGuild.id !== targetGuild.id) {
      return interaction.editReply({
        content:
          `⛔ **Inscrição Não Permitida!**\n\n` +
          `Você já é membro registrado da guild **[${existingGuild.tag}] ${existingGuild.name}**.\n` +
          `Para trocar de legião dentro da Coalizão, utilize o fluxo oficial de **Transferência de Guild** no canal comunitário de transferências ou alinhe previamente com sua liderança.`
      }).catch(() => {});
    }

    const nick = interaction.fields.getTextInputValue('nick');
    const classe = interaction.fields.getTextInputValue('classe');
    const horarios = interaction.fields.getTextInputValue('horarios');
    const sobre = interaction.fields.getTextInputValue('sobre') || 'Nenhuma observação informada.';

    const appId = `app_${Date.now()}`;
    const appData = {
      id: appId,
      guildId: targetGuild.id,
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      nick,
      classe,
      horarios,
      sobre,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    addApplication(appData);

    // Envia a ficha para o canal privado de aprovações da Guild
    try {
      const chAprovacoes = await guild.channels.fetch(targetGuild.approvalsChannelId);
      if (chAprovacoes) {
        const appEmbed = new EmbedBuilder()
          .setTitle(`📜 Nova Candidatura — [${targetGuild.tag}]`)
          .setDescription(`Um novo jogador solicitou entrada na legião **${targetGuild.name}**!`)
          .setColor(Colors.Gold)
          .addFields(
            { name: '👤 Discord', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
            { name: '🎮 Nick in-game', value: `\`${nick}\``, inline: true },
            { name: '⚔️ Classe / Build', value: `\`${classe}\``, inline: true },
            { name: '⏰ Horários / Level', value: horarios },
            { name: '📝 Experiência & Apresentação', value: sobre }
          )
          .setFooter({ text: `ID da Ficha: ${appId}` })
          .setTimestamp();

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_app_${appId}`)
            .setLabel('✅ Aprovar Membro')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`reject_app_${appId}`)
            .setLabel('❌ Recusar Membro')
            .setStyle(ButtonStyle.Danger)
        );

        // Notifica o líder e oficiais no canal
        await chAprovacoes.send({
          content: `🚨 <@${targetGuild.leaderId}> — Uma nova aplicação de membro aguarda sua análise!`,
          embeds: [appEmbed],
          components: [actionRow]
        });
      }
    } catch (err) {
      console.error('[ERRO] Falha ao enviar para canal de aprovação:', err);
    }

    // Log geral de auditoria
    if (config?.channels?.logs) {
      try {
        const chLogs = await guild.channels.fetch(config.channels.logs);
        if (chLogs) {
          await chLogs.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('📝 Nova Ficha Submetida')
                .setDescription(
                  `• **Usuário:** <@${interaction.user.id}>\n` +
                  `• **Guild:** [${targetGuild.tag}] ${targetGuild.name}\n` +
                  `• **Nick:** \`${nick}\``
                )
                .setColor(Colors.Blue)
                .setTimestamp()
            ]
          });
        }
      } catch {}
    }

    return interaction.editReply({
      content:
        `✅ **Sua candidatura para a guild [${targetGuild.tag}] ${targetGuild.name} foi enviada com sucesso!**\n\n` +
        `A liderança da legião foi notificada e analisará sua ficha. Assim que sua inscrição for aprovada, ` +
        `você receberá uma notificação na sua DM e todos os canais da comunidade serão desbloqueados!`
    }).catch(err => console.warn('[MODAL] Falha ao enviar editReply:', err.message));
  }

  // --- SUBMISSÃO DE TRANSFERÊNCIA DE GUILD (modal_transfer:targetId:oldId) ---
  if (customId.startsWith('modal_transfer:') || customId.startsWith('modal_transfer_')) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    let targetGuildId = null;
    let oldGuildId = null;

    if (customId.includes(':')) {
      const parts = customId.split(':');
      targetGuildId = parts[1];
      oldGuildId = parts[2];
    } else {
      // Suporte de compatibilidade para modal_transfer_guild_..._guild_...
      const raw = customId.replace('modal_transfer_', '');
      const parts = raw.split('_guild_');
      if (parts.length === 2) {
        targetGuildId = parts[0].startsWith('guild_') ? parts[0] : `guild_${parts[0]}`;
        oldGuildId = `guild_${parts[1]}`;
      } else {
        const p = raw.split('_');
        targetGuildId = p[0];
        oldGuildId = p[1];
      }
    }

    const targetGuild = findGuildById(targetGuildId);
    const oldGuild = oldGuildId ? findGuildById(oldGuildId) : null;

    if (!targetGuild) {
      return interaction.editReply({ content: '❌ Erro: Guild de destino não identificada.' }).catch(() => {});
    }

    const nickClasse = interaction.fields.getTextInputValue('nick_classe');
    const motivo = interaction.fields.getTextInputValue('motivo');

    const appId = `trans_${Date.now()}`;
    const appData = {
      id: appId,
      type: 'transfer',
      guildId: targetGuild.id,
      oldGuildId: oldGuild?.id || null,
      oldGuildTag: oldGuild?.tag || 'Sem Tag',
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      nick: nickClasse,
      motivo,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    addApplication(appData);

    // 1. Enviar para o canal privado de APROVAÇÃO da guild de destino!
    try {
      const chAprovacoesDestino = await guild.channels.fetch(targetGuild.approvalsChannelId);
      if (chAprovacoesDestino) {
        const transferEmbed = new EmbedBuilder()
          .setTitle(`🔄 Pedido de Transferência — [${targetGuild.tag}]`)
          .setDescription(`O jogador <@${interaction.user.id}> está solicitando transferência para a legião **[${targetGuild.tag}] ${targetGuild.name}**!`)
          .setColor(Colors.Blue)
          .addFields(
            { name: '👤 Jogador', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
            { name: '🎮 Nick in-game & Classe', value: `\`${nickClasse}\``, inline: true },
            { name: '🏰 Guilda de Origem', value: oldGuild ? `**[${oldGuild.tag}] ${oldGuild.name}**` : '*Sem guilda anterior*', inline: true },
            { name: '⚔️ Guilda de Destino', value: `**[${targetGuild.tag}] ${targetGuild.name}**`, inline: true },
            { name: '📝 Motivo & Alinhamento Prévio', value: motivo }
          )
          .setFooter({ text: `ID da Transferência: ${appId} • Ao aprovar, o cargo anterior será removido e o novo entregue.` })
          .setTimestamp();

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_trans_${appId}`)
            .setLabel('✅ Aprovar Transferência')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`reject_trans_${appId}`)
            .setLabel('❌ Recusar Transferência')
            .setStyle(ButtonStyle.Danger)
        );

        await chAprovacoesDestino.send({
          content: `🚨 <@${targetGuild.leaderId}> — Novo pedido de transferência de membro para sua guild!`,
          embeds: [transferEmbed],
          components: [actionRow]
        });
      }
    } catch (err) {
      console.error('[ERRO] Falha ao enviar para canal de aprovação da guild de destino:', err);
    }

    // 2. Notificar a liderança da guilda de origem em seu próprio canal de aprovações
    if (oldGuild && oldGuild.approvalsChannelId) {
      try {
        const chAprovacoesOrigem = await guild.channels.fetch(oldGuild.approvalsChannelId).catch(() => null);
        if (chAprovacoesOrigem) {
          await chAprovacoesOrigem.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('ℹ️ Notificação de Transferência de Membro')
                .setDescription(
                  `O membro <@${interaction.user.id}> (\`${nickClasse}\`) solicitou transferência para a guild **[${targetGuild.tag}] ${targetGuild.name}**.\n\n` +
                  `A liderança da **[${targetGuild.tag}]** já recebeu a ficha de aprovação no canal de comando deles.`
                )
                .setColor(Colors.Orange)
                .setTimestamp()
            ]
          }).catch(() => {});
        }
      } catch {}
    }

    // 3. Notificar o canal comunitário de transferências
    const chTransferenciaId = config?.channels?.transferencia || '1566519973684187199';
    try {
      const chTransferencia = await guild.channels.fetch(chTransferenciaId).catch(() => null);
      if (chTransferencia) {
        await chTransferencia.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('🔄 Solicitação de Transferência Registrada')
              .setDescription(
                `• **Jogador:** <@${interaction.user.id}> (\`${nickClasse}\`)\n` +
                `• **Origem:** ${oldGuild ? `[${oldGuild.tag}] ${oldGuild.name}` : '*Nenhuma*'}\n` +
                `• **Destino:** [${targetGuild.tag}] ${targetGuild.name}\n` +
                `• **Status:** ⏳ *Em análise pela liderança da [${targetGuild.tag}]*`
              )
              .setColor(0x3498DB)
              .setTimestamp()
          ]
        }).catch(() => {});
      }
    } catch {}

    // 4. Log geral
    if (config?.channels?.logs) {
      try {
        const chLogs = await guild.channels.fetch(config.channels.logs);
        if (chLogs) {
          await chLogs.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('🔄 Pedido de Transferência Aberto')
                .setDescription(
                  `• **Usuário:** <@${interaction.user.id}>\n` +
                  `• **De:** [${oldGuild?.tag || '?'}] ${oldGuild?.name || '?'}\n` +
                  `• **Para:** [${targetGuild.tag}] ${targetGuild.name}\n` +
                  `• **Nick:** \`${nickClasse}\``
                )
                .setColor(Colors.Blue)
                .setTimestamp()
            ]
          }).catch(() => {});
        }
      } catch {}
    }

    return interaction.editReply({
      content:
        `✅ **Sua solicitação de transferência para [${targetGuild.tag}] ${targetGuild.name} foi enviada com sucesso!**\n\n` +
        `A ficha foi encaminhada diretamente para o canal privado de aprovação da liderança da **[${targetGuild.tag}]**.\n` +
        `Assim que eles analisarem e derem o aval, seu cargo da guilda anterior será removido e o novo cargo será liberado automaticamente!`
    }).catch(err => console.warn('[MODAL] Falha ao enviar editReply:', err.message));
  }

  // =========================================================================
  // --- PAINEL DE GESTÃO DA GUILDA: MODAL EDITAR INFORMAÇÕES ---
  // =========================================================================
  if (customId.startsWith('modal_gp_edit_info_')) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const guildId = customId.replace('modal_gp_edit_info_', '');
    const allGuilds = getGuilds();
    const targetGuild = allGuilds.find(g => g.id === guildId);

    if (!targetGuild) {
      return interaction.editReply({ content: '❌ Guild não encontrada no sistema.' });
    }

    const isMasterAdmin = interaction.user.id === '273600843251712020' ||
      interaction.user.id === guild.ownerId ||
      interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = isMasterAdmin || (config?.roles?.staff && interaction.member.roles.cache.has(config.roles.staff));
    const isLeader = interaction.user.id === targetGuild.leaderId;
    const isOfficer = Array.isArray(targetGuild.officerIds) && targetGuild.officerIds.includes(interaction.user.id);

    if (!isStaff && !isLeader && !isOfficer) {
      return interaction.editReply({ content: `❌ Você não tem permissão para editar **[${targetGuild.tag}] ${targetGuild.name}**.` });
    }

    const nomeInput = interaction.fields.getTextInputValue('nome')?.trim();
    const tagInput = interaction.fields.getTextInputValue('tag')?.trim().toUpperCase();
    const descricaoInput = interaction.fields.getTextInputValue('descricao')?.trim();
    const corInput = interaction.fields.getTextInputValue('cor')?.trim();
    const iconeInput = interaction.fields.getTextInputValue('icone')?.trim();

    if (!nomeInput || !tagInput) {
      return interaction.editReply({ content: '⚠️ Nome e Tag são campos obrigatórios!' });
    }

    // Verifica se a nova TAG já é usada por outra guild
    const tagExists = allGuilds.some(g => g.id !== targetGuild.id && g.tag.toUpperCase() === tagInput);
    if (tagExists) {
      return interaction.editReply({ content: `❌ A tag **${tagInput}** já está em uso por outra guilda da Coalizão.` });
    }

    const oldTag = targetGuild.tag;
    const oldName = targetGuild.name;
    const tagChanged = oldTag !== tagInput;
    const nameChanged = oldName !== nomeInput;

    targetGuild.name = nomeInput;
    targetGuild.tag = tagInput;
    targetGuild.description = descricaoInput || '';

    // Trata e atualiza cor
    if (corInput) {
      let formattedColor = corInput;
      if (!formattedColor.startsWith('#')) formattedColor = `#${formattedColor}`;
      if (/^#[0-9A-Fa-f]{6}$/.test(formattedColor)) {
        targetGuild.color = formattedColor;
        if (targetGuild.roleId) {
          try {
            const role = await guild.roles.fetch(targetGuild.roleId);
            if (role) await role.setColor(parseHexColor(formattedColor), 'Alteração de cor via Painel de Gestão');
          } catch (err) {
            console.warn('[MODAL-EDIT-INFO] Erro ao atualizar cor do cargo:', err.message);
          }
        }
      }
    }

    // Atualiza ícone
    if (iconeInput && (iconeInput.startsWith('http://') || iconeInput.startsWith('https://'))) {
      targetGuild.iconUrl = iconeInput;
    } else if (!iconeInput) {
      targetGuild.iconUrl = null;
    }

    // Se mudou TAG ou Nome, atualiza cargo e categoria no Discord
    if (tagChanged || nameChanged) {
      try {
        if (targetGuild.roleId) {
          const role = await guild.roles.fetch(targetGuild.roleId);
          if (role) await role.setName(`🏰 [${tagInput}] ${nomeInput}`, 'Alteração via Painel de Gestão');
        }
      } catch (err) {
        console.warn('[MODAL-EDIT-INFO] Falha ao renomear cargo:', err.message);
      }

      try {
        if (targetGuild.categoryId) {
          const cat = await guild.channels.fetch(targetGuild.categoryId);
          if (cat) await cat.setName(`🏰 │ [${tagInput}] ${nomeInput}`, 'Alteração via Painel de Gestão');
        }
      } catch (err) {
        console.warn('[MODAL-EDIT-INFO] Falha ao renomear categoria:', err.message);
      }
    }

    // Salva no banco de dados
    saveGuilds(allGuilds);

    // Atualiza o próprio painel de gestão da guild
    await renderOrUpdateGuildPanel(guild, targetGuild);

    // Atualiza o painel de recrutamento público
    if (config?.channels?.recrutamento) {
      try {
        const chRec = await guild.channels.fetch(config.channels.recrutamento);
        if (chRec) await updateSingleGuildCard(guild, chRec, targetGuild);
      } catch {}
    }

    // Atualiza a central de transferências caso a tag tenha mudado
    if (tagChanged && config?.channels?.transferencia) {
      try {
        const chTrans = await guild.channels.fetch(config.channels.transferencia);
        if (chTrans) await renderOrUpdateTransferPanel(guild, chTrans);
      } catch {}
    }

    return interaction.editReply({
      content: `✅ **Dados de [${targetGuild.tag}] atualizados com sucesso!**\n` +
        `• **Nome:** \`${targetGuild.name}\`\n` +
        `• **Tag:** \`[${targetGuild.tag}]\`\n` +
        `• **Cor:** \`${targetGuild.color}\`\n` +
        `• **Descrição:** *${targetGuild.description || 'Nenhuma'}*`
    });
  }

  // =========================================================================
  // --- PAINEL DE GESTÃO DA GUILDA: MODAL GERENCIAR VAGAS & RECRUTAMENTO ---
  // =========================================================================
  if (customId.startsWith('modal_gp_edit_vagas_')) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const guildId = customId.replace('modal_gp_edit_vagas_', '');
    const allGuilds = getGuilds();
    const targetGuild = allGuilds.find(g => g.id === guildId);

    if (!targetGuild) {
      return interaction.editReply({ content: '❌ Guild não encontrada no sistema.' });
    }

    const isMasterAdmin = interaction.user.id === '273600843251712020' ||
      interaction.user.id === guild.ownerId ||
      interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = isMasterAdmin || (config?.roles?.staff && interaction.member.roles.cache.has(config.roles.staff));
    const isLeader = interaction.user.id === targetGuild.leaderId;
    const isOfficer = Array.isArray(targetGuild.officerIds) && targetGuild.officerIds.includes(interaction.user.id);

    if (!isStaff && !isLeader && !isOfficer) {
      return interaction.editReply({ content: `❌ Você não tem permissão para gerenciar vagas de **[${targetGuild.tag}] ${targetGuild.name}**.` });
    }

    const statusInput = interaction.fields.getTextInputValue('status')?.trim().toLowerCase() || 'aberto';
    const vagasInput = interaction.fields.getTextInputValue('vagas')?.trim() || '0';
    const requisitosInput = interaction.fields.getTextInputValue('requisitos')?.trim() || '';

    const isClosed = statusInput.includes('fech') || statusInput.includes('clos') || statusInput.includes('bloq') || vagasInput === '0';

    targetGuild.recruitmentStatus = isClosed ? 'closed' : 'open';
    targetGuild.vacancies = vagasInput;
    targetGuild.recruitmentNotes = requisitosInput;

    // Salva no banco de dados
    saveGuilds(allGuilds);

    // Atualiza o painel de gestão da guild
    await renderOrUpdateGuildPanel(guild, targetGuild);

    // Atualiza o card da guild no canal público de recrutamento
    if (config?.channels?.recrutamento) {
      try {
        const chRec = await guild.channels.fetch(config.channels.recrutamento);
        if (chRec) await updateSingleGuildCard(guild, chRec, targetGuild);
      } catch {}
    }

    const statusLabel = isClosed ? '🔴 **FECHADO (Lotado / Pausado)**' : '🟢 **ABERTO PARA APLICAÇÕES**';
    return interaction.editReply({
      content:
        `✅ **Status de Recrutamento & Vagas de [${targetGuild.tag}] atualizados!**\n\n` +
        `• **Status:** ${statusLabel}\n` +
        `• **Vagas:** \`${vagasInput} vagas\`\n` +
        `• **Requisitos / Notas:** ${requisitosInput ? `*${requisitosInput}*` : '*Nenhum*'}\n\n` +
        `💡 *O card público no canal de recrutamento foi sincronizado em tempo real!*`
    });
  }

  // =========================================================================
  // --- PAINEL DE GESTÃO DA GUILDA: MODAL REMOVER MEMBRO ---
  // =========================================================================
  if (customId.startsWith('modal_gp_kick_')) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const guildId = customId.replace('modal_gp_kick_', '');
    const allGuilds = getGuilds();
    const targetGuild = allGuilds.find(g => g.id === guildId);

    if (!targetGuild) {
      return interaction.editReply({ content: '❌ Guild não encontrada no sistema.' });
    }

    const isMasterAdmin = interaction.user.id === '273600843251712020' ||
      interaction.user.id === guild.ownerId ||
      interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = isMasterAdmin || (config?.roles?.staff && interaction.member.roles.cache.has(config.roles.staff));
    const isLeader = interaction.user.id === targetGuild.leaderId;
    const isOfficer = Array.isArray(targetGuild.officerIds) && targetGuild.officerIds.includes(interaction.user.id);

    if (!isStaff && !isLeader && !isOfficer) {
      return interaction.editReply({ content: `❌ Você não tem permissão para remover membros de **[${targetGuild.tag}] ${targetGuild.name}**.` });
    }

    const usuarioInput = interaction.fields.getTextInputValue('usuario');
    const motivo = interaction.fields.getTextInputValue('motivo')?.trim() || 'Desligamento solicitado pela liderança';

    const cleanUserId = usuarioInput.replace(/[<@!>]/g, '').trim();
    if (!cleanUserId || !/^\d{17,20}$/.test(cleanUserId)) {
      return interaction.editReply({ content: '❌ ID de usuário ou menção inválida. Informe um ID numérico válido ou mencione o membro (@jogador).' });
    }

    if (cleanUserId === interaction.user.id) {
      return interaction.editReply({ content: '❌ Você não pode remover a si mesmo da guild pelo painel.' });
    }

    if (cleanUserId === targetGuild.leaderId) {
      return interaction.editReply({ content: '❌ Não é possível remover o Líder Principal da guilda.' });
    }

    const targetMember = await guild.members.fetch(cleanUserId).catch(() => null);
    if (!targetMember) {
      return interaction.editReply({ content: '❌ Jogador não encontrado no servidor do Discord.' });
    }

    const hasGuildRole = targetGuild.roleId && targetMember.roles.cache.has(targetGuild.roleId);
    if (!hasGuildRole) {
      return interaction.editReply({ content: `❌ O jogador <@${cleanUserId}> não possui o cargo da guild **[${targetGuild.tag}] ${targetGuild.name}**.` });
    }

    // 1. Remove cargo da guild
    try {
      await targetMember.roles.remove(targetGuild.roleId, `Removido da guild por ${interaction.user.tag}: ${motivo}`);
    } catch (err) {
      return interaction.editReply({ content: `❌ Falha ao remover cargo da guild: ${err.message}` });
    }

    // 2. Remove de oficial se for o caso
    if (Array.isArray(targetGuild.officerIds) && targetGuild.officerIds.includes(cleanUserId)) {
      targetGuild.officerIds = targetGuild.officerIds.filter(id => id !== cleanUserId);
      const isOfficerElsewhere = allGuilds.some(g => g.id !== targetGuild.id && g.officerIds?.includes(cleanUserId));
      if (!isOfficerElsewhere) {
        if (config?.roles?.oficial && targetMember.roles.cache.has(config.roles.oficial)) {
          await targetMember.roles.remove(config.roles.oficial).catch(() => {});
        }
        if (config?.roles?.oficialRust1 && targetMember.roles.cache.has(config.roles.oficialRust1)) {
          await targetMember.roles.remove(config.roles.oficialRust1).catch(() => {});
        }
      }
    }

    // 3. Remove de caller se for o caso
    if (Array.isArray(targetGuild.callerIds) && targetGuild.callerIds.includes(cleanUserId)) {
      targetGuild.callerIds = targetGuild.callerIds.filter(id => id !== cleanUserId);
      const isCallerElsewhere = allGuilds.some(g => g.id !== targetGuild.id && g.callerIds?.includes(cleanUserId));
      if (!isCallerElsewhere && config?.roles?.caller && targetMember.roles.cache.has(config.roles.caller)) {
        await targetMember.roles.remove(config.roles.caller).catch(() => {});
      }
    }

    // 4. Se não pertencer a nenhuma outra guild, remove Player Validado
    const otherGuildRoles = allGuilds.filter(g => g.id !== targetGuild.id).map(g => g.roleId);
    const hasOtherGuild = targetMember.roles.cache.some(r => otherGuildRoles.includes(r.id));
    let validadoRemoved = false;
    if (!hasOtherGuild && config?.roles?.validado && targetMember.roles.cache.has(config.roles.validado)) {
      await targetMember.roles.remove(config.roles.validado, 'Remoção de guild sem vínculo com outra').catch(() => {});
      validadoRemoved = true;
    }

    // Salva mudanças no banco
    saveGuilds(allGuilds);

    // Atualiza painel de gestão da guild
    await renderOrUpdateGuildPanel(guild, targetGuild);

    // Atualiza card de recrutamento
    if (config?.channels?.recrutamento) {
      try {
        const chRec = await guild.channels.fetch(config.channels.recrutamento);
        if (chRec) await updateSingleGuildCard(guild, chRec, targetGuild);
      } catch {}
    }

    // Atualiza estatísticas do servidor
    if (typeof refreshServerStats === 'function') {
      refreshServerStats(interaction.client).catch(() => {});
    }

    // Notificação / Log no canal de aprovações da guild
    if (targetGuild.approvalsChannelId) {
      try {
        const chAprov = await guild.channels.fetch(targetGuild.approvalsChannelId);
        if (chAprov) {
          await chAprov.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('👢 Membro Desligado da Guild')
                .setDescription(
                  `• **Jogador:** <@${cleanUserId}> (\`${targetMember.user.tag}\`)\n` +
                  `• **Guild:** [${targetGuild.tag}] ${targetGuild.name}\n` +
                  `• **Removido por:** <@${interaction.user.id}>\n` +
                  `• **Motivo:** \`${motivo}\`\n` +
                  (validadoRemoved ? '• **Player Validado:** Revogado *(sem outras guilds)*' : '')
                )
                .setColor(Colors.Orange)
                .setTimestamp()
            ]
          }).catch(() => {});
        }
      } catch {}
    }

    // Log geral da coalizão
    if (config?.channels?.logs) {
      try {
        const chLogs = await guild.channels.fetch(config.channels.logs);
        if (chLogs) {
          await chLogs.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('👢 Desligamento de Guild')
                .setDescription(
                  `• **Jogador:** <@${cleanUserId}> (\`${targetMember.user.tag}\`)\n` +
                  `• **Guild:** [${targetGuild.tag}] ${targetGuild.name}\n` +
                  `• **Removido por:** <@${interaction.user.id}>\n` +
                  `• **Motivo:** \`${motivo}\``
                )
                .setColor(Colors.Orange)
                .setTimestamp()
            ]
          }).catch(() => {});
        }
      } catch {}
    }

    return interaction.editReply({
      content: `✅ O jogador <@${cleanUserId}> foi removido com sucesso de **[${targetGuild.tag}] ${targetGuild.name}**!\n` +
        `• Cargo da guild revogado.\n` +
        (validadoRemoved ? `• Cargo de **Player Validado** revogado com sucesso.\n` : '') +
        `• Painel de gestão e estatísticas atualizados!`
    });
  }

  // =========================================================================
  // --- PAINEL DE GESTÃO DA GUILDA: MODAL SOLICITAR BAN ---
  // =========================================================================
  if (customId.startsWith('modal_gp_ban_')) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const guildId = customId.replace('modal_gp_ban_', '');
    const allGuilds = getGuilds();
    const targetGuild = allGuilds.find(g => g.id === guildId);

    if (!targetGuild) {
      return interaction.editReply({ content: '❌ Guild não encontrada no sistema.' });
    }

    const isMasterAdmin = interaction.user.id === '273600843251712020' ||
      interaction.user.id === guild.ownerId ||
      interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const isStaff = isMasterAdmin || (config?.roles?.staff && interaction.member.roles.cache.has(config.roles.staff));
    const isLeader = interaction.user.id === targetGuild.leaderId;
    const isOfficer = Array.isArray(targetGuild.officerIds) && targetGuild.officerIds.includes(interaction.user.id);

    if (!isStaff && !isLeader && !isOfficer) {
      return interaction.editReply({ content: '❌ Apenas Líderes, Oficiais e Staff podem abrir processos de banimento.' });
    }

    const usuarioInput = interaction.fields.getTextInputValue('usuario');
    const motivo = interaction.fields.getTextInputValue('motivo')?.trim();
    const evidencias = interaction.fields.getTextInputValue('evidencias')?.trim();

    const cleanUserId = usuarioInput.replace(/[<@!>]/g, '').trim();
    if (!cleanUserId || !/^\d{17,20}$/.test(cleanUserId)) {
      return interaction.editReply({ content: '❌ ID de usuário ou menção inválida. Informe um ID numérico válido ou mencione o membro (@infrator).' });
    }

    if (cleanUserId === interaction.user.id) {
      return interaction.editReply({ content: '❌ Você não pode solicitar o banimento de si mesmo.' });
    }

    if (cleanUserId === interaction.client.user.id) {
      return interaction.editReply({ content: '❌ Você não pode solicitar o banimento do bot.' });
    }

    if (cleanUserId === '273600843251712020' || cleanUserId === guild.ownerId) {
      return interaction.editReply({ content: '❌ Você não pode solicitar o banimento do Administrador Geral da Coalizão.' });
    }

    const targetUser = await interaction.client.users.fetch(cleanUserId).catch(() => null);
    if (!targetUser) {
      return interaction.editReply({ content: '❌ Usuário não encontrado no Discord.' });
    }

    const chatLideresChannelId = config?.channels?.chatLideres || '1565129743748309002';
    const chLideres = await guild.channels.fetch(chatLideresChannelId).catch(() => null);

    if (!chLideres) {
      return interaction.editReply({ content: `❌ Canal de liderança não encontrado no servidor (\`${chatLideresChannelId}\`). Contate o Administrador.` });
    }

    const requestId = crypto.randomUUID();

    // Registra a solicitação no banco
    await banRepo.createBanRequest({
      id: requestId,
      targetUserId: targetUser.id,
      targetUserTag: targetUser.tag || targetUser.username,
      requestedById: interaction.user.id,
      requestedByTag: interaction.user.tag || interaction.user.username,
      reason: motivo,
      evidence: evidencias,
      status: 'pending',
      channelId: chLideres.id
    });

    const banEmbed = new EmbedBuilder()
      .setTitle('⚖️ SOLICITAÇÃO DE BANIMENTO & EXPURGO DA COALIZÃO')
      .setDescription(
        `Uma nova solicitação de banimento foi aberta para deliberação das Lideranças e Staff da Coalizão Vampir.\n` +
        `Para efetivação da punição máxima, é necessária a validação da liderança.`
      )
      .addFields(
        { name: '👤 Alvo / Infrator', value: `<@${targetUser.id}> (\`${targetUser.tag || targetUser.username}\` | \`${targetUser.id}\`)`, inline: false },
        { name: '🛡️ Solicitado por', value: `<@${interaction.user.id}> ([${targetGuild.tag}] ${targetGuild.name})`, inline: true },
        { name: '⏳ Status', value: '`🟡 AGUARDANDO DELIBERAÇÃO`', inline: true },
        { name: '📝 Motivo Declarado', value: `\`\`\`${motivo}\`\`\``, inline: false }
      )
      .setColor(Colors.DarkRed)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }) || null)
      .setFooter({ text: `ID: ${requestId} • Decisão Soberana da Liderança` })
      .setTimestamp();

    if (evidencias && evidencias.length > 0) {
      banEmbed.addFields({
        name: '🔗 Evidências / Observações',
        value: evidencias.length > 1000 ? evidencias.slice(0, 997) + '...' : evidencias,
        inline: false
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_confirm_ban_${requestId}`)
        .setLabel('Confirmar Banimento')
        .setEmoji('🔨')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`btn_cancel_ban_${requestId}`)
        .setLabel('Recusar / Cancelar')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Secondary)
    );

    const sentMessage = await chLideres.send({
      content: `📢 **CONVOCAÇÃO DE LIDERANÇAS:** Solicitação de banimento aberta por <@${interaction.user.id}> ([${targetGuild.tag}]).`,
      embeds: [banEmbed],
      components: [row]
    });

    await banRepo.updateBanRequest(requestId, {
      messageId: sentMessage.id
    });

    return interaction.editReply({
      content: `✅ Solicitação de banimento contra <@${targetUser.id}> foi aberta e encaminhada com sucesso para o canal de lideranças (<#${chLideres.id}>)!`
    });
  }
}

module.exports = {
  handleModal
};
