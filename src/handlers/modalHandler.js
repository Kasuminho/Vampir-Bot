const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors
} = require('discord.js');

const {
  getServerConfig,
  getGuilds,
  findGuildById,
  addApplication
} = require('../data_manager');
const { handleValidationDecision } = require('../attendance_manager');

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
}

module.exports = {
  handleModal
};
