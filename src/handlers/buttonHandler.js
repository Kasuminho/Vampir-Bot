const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Colors,
  PermissionFlagsBits
} = require('discord.js');

const {
  getServerConfig,
  getGuilds,
  findGuildById,
  findApplicationById,
  updateApplicationStatus
} = require('../data_manager');
const { updateSingleGuildCard } = require('../recruitment_panel');
const { renderOrUpdateBossPanel } = require('../boss_manager');
const { renderOrUpdateVoicePanel } = require('../voice_panel');
const {
  renderOrUpdatePresencePanel,
  handleValidationDecision,
  getUserAttendanceSummary,
  getMemberGuild
} = require('../attendance_manager');
const { createAuthResponse } = require('../services/overlayService');

/**
 * Roteia e trata todas as interações de botão (interaction.isButton())
 */
async function handleButton(interaction, refreshServerStats) {
  const config = getServerConfig();
  const guild = interaction.guild;
  const { customId } = interaction;

  // --- ATUALIZAR PAINEL DE BOSS TIMERS ---
  if (customId === 'btn_refresh_boss_panel') {
    await interaction.deferUpdate();
    await renderOrUpdateBossPanel(guild, interaction.channel);
    return;
  }

  // --- ATUALIZAR PAINEL DE MONITORAMENTO DE VOZ ---
  if (customId === 'btn_refresh_voice_panel') {
    await interaction.deferUpdate();
    await renderOrUpdateVoicePanel(guild, interaction.channel);
    return;
  }

  // --- BOTÃO DE ACESSO AO OVERLAY TÁTICO ---
  if (customId === 'btn_get_overlay') {
    const res = createAuthResponse(interaction.member);
    if (!res.success) {
      return interaction.reply({ content: res.message, ephemeral: true });
    }
    return interaction.reply({ embeds: res.embeds, components: res.components, flags: MessageFlags.Ephemeral });
  }

  // --- BOTÃO INICIAR CHECK-IN DE GEENA ---
  if (customId === 'btn_start_checkin') {
    const guildsList = getGuilds();
    const userGuild = getMemberGuild(guildsList, interaction.member);

    if (!userGuild) {
      return interaction.reply({
        content: '❌ **Acesso Negado:** Apenas membros com cargo de uma das 7 guilds da Coalizão podem marcar presença!',
        ephemeral: true
      });
    }

    const embedGuide = new EmbedBuilder()
      .setTitle('📸 Como Marcar Presença em Geena')
      .setDescription(
        `Olá <@${interaction.user.id}>! Sua guild identificada: **[${userGuild.tag}] ${userGuild.name}**\n\n` +
        `Para registrar sua presença com print, use o comando abaixo:\n\n` +
        `### ⌨️ Comando:\n` +
        `\`\`\`\n/presenca print:[anexe seu print]\n\`\`\`\n` +
        `• **Basta anexar o print!** Por padrão, sua presença é computada automaticamente como **Titular** (seu próprio boneco).\n` +
        `• **Caso seja Piloto:** Preencha o campo opcional \`dono:\` marcando o Discord do Dono do Personagem!\n\n` +
        `💡 *Se o Discord exibir "Comando desatualizado", basta dar **Ctrl + R** no Discord para recarregar o cache de comandos!*\n\n` +
        `*Após enviar, sua liderança receberá o comprovante no canal interno de validação.*`
      )
      .setColor(Colors.Green)
      .setFooter({ text: 'Coalizão Vampir • Check-in de Geena' });

    return interaction.reply({ embeds: [embedGuide], ephemeral: true });
  }

  // --- BOTÃO CONSULTAR MINHAS PRESENÇAS ---
  if (customId === 'btn_my_attendance') {
    const summary = getUserAttendanceSummary(interaction.user.id);
    const recentLines = summary.recentEvents.length > 0
      ? summary.recentEvents.map(e => `• **${e.eventName}** (<t:${Math.floor(new Date(e.validatedAt || e.createdAt).getTime() / 1000)}:d>) ${e.isPilot ? '*(🎮 Piloto)*' : '*(🛡️ Titular)*'}`).join('\n')
      : '*Nenhum evento registrado ainda.*';

    const embedMyAtt = new EmbedBuilder()
      .setTitle(`📊 Minhas Presenças ┃ ${interaction.user.username}`)
      .setDescription(
        `Resumo pessoal das suas presenças validadas nos Bosses de Geena:\n\n` +
        `🔥 **Total de Presenças Confirmadas:** \`${summary.total}\`\n` +
        `🛡️ **Como Titular:** \`${summary.asTitular}\`\n` +
        `🎯 **Recebidas via Piloto:** \`${summary.asPilot}\`\n` +
        `🎮 **Vezes que você pilotou:** \`${summary.timesPiloting}\`\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `### 🕒 Últimos Bosses Validados:\n${recentLines}`
      )
      .setColor(Colors.DarkGold)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: 'Atualizado em tempo real' })
      .setTimestamp();

    return interaction.reply({ embeds: [embedMyAtt], ephemeral: true });
  }

  // --- ATUALIZAR PAINEL DE PRESENÇAS ---
  if (customId === 'btn_refresh_attendance_panel') {
    await interaction.deferUpdate();
    await renderOrUpdatePresencePanel(guild, interaction.channel);
    return;
  }

  // --- APROVAÇÃO DE PRESENÇA PELA LIDERANÇA ---
  if (customId.startsWith('btn_appr_att_')) {
    const submissionId = customId.replace('btn_appr_att_', '');
    await handleValidationDecision(interaction, submissionId, 'approved');
    return;
  }

  // --- REJEIÇÃO DE PRESENÇA (ABRE MODAL) ---
  if (customId.startsWith('btn_rejt_att_')) {
    const submissionId = customId.replace('btn_rejt_att_', '');
    const modal = new ModalBuilder()
      .setCustomId(`modal_reject_att_${submissionId}`)
      .setTitle('Rejeitar Presença');

    const inputMotivo = new TextInputBuilder()
      .setCustomId('motivo_rejeicao')
      .setLabel('Motivo da Rejeição:')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ex: Print fora de hora, jogador ausente na luta, print sem nick...')
      .setRequired(true)
      .setMaxLength(300);

    modal.addComponents(new ActionRowBuilder().addComponents(inputMotivo));
    await interaction.showModal(modal);
    return;
  }

  // --- ABRIR MODAL DE TRANSFERÊNCIA DE GUILD (btn_open_transfer_modal) ---
  if (customId === 'btn_open_transfer_modal') {
    const modal = new ModalBuilder()
      .setCustomId('modal_guild_transfer')
      .setTitle('Transferência de Guild');

    const inputNick = new TextInputBuilder()
      .setCustomId('nick_classe')
      .setLabel('Seu Nick in-game e Classe/Nível:')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: BloodLord - Bloodstained Lv 65')
      .setRequired(true)
      .setMaxLength(60);

    const inputGuildAtual = new TextInputBuilder()
      .setCustomId('guild_atual')
      .setLabel('Sua Guilda Atual:')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: No Mercy [NOM]')
      .setRequired(true)
      .setMaxLength(50);

    const inputGuildDestino = new TextInputBuilder()
      .setCustomId('guild_destino')
      .setLabel('Guilda Pretendida (Destino):')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: AlcatraZ [ALC]')
      .setRequired(true)
      .setMaxLength(50);

    const inputMotivo = new TextInputBuilder()
      .setCustomId('motivo')
      .setLabel('Motivo / Já alinhou com o Líder atual?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ex: Amigos jogando na ALC. Já conversei com o oficial da NOM e está alinhado.')
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder().addComponents(inputNick),
      new ActionRowBuilder().addComponents(inputGuildAtual),
      new ActionRowBuilder().addComponents(inputGuildDestino),
      new ActionRowBuilder().addComponents(inputMotivo)
    );

    return interaction.showModal(modal);
  }

  // --- ABRIR MODAL DE APLICAÇÃO (apply_guild_...) ---
  if (customId.startsWith('apply_guild_')) {
    const targetGuildId = customId.replace('apply_guild_', '');
    const targetGuild = findGuildById(targetGuildId);

    if (!targetGuild) {
      if (interaction.message && interaction.message.deletable) {
        await interaction.message.delete().catch(() => {});
      }
      return interaction.reply({
        content: '⚠️ Este card de guilda estava desatualizado e foi removido. Por favor, clique no card oficial atualizado logo abaixo!',
        ephemeral: true
      });
    }

    // Checar se já possui cargo de alguma guild da Coalizão
    const member = interaction.member;
    const allGuilds = getGuilds();
    const existingGuild = allGuilds.find(g => member.roles.cache.has(g.roleId));

    if (existingGuild) {
      if (existingGuild.id === targetGuild.id) {
        return interaction.reply({
          content: `⚠️ Você já é integrante da guild **[${targetGuild.tag}] ${targetGuild.name}**!`,
          ephemeral: true
        });
      }

      // Já possui tag de outra guild: BLOQUEIA E INDICA O FLUXO DE TRANSFERÊNCIA
      const rowTransfer = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_open_transfer_modal')
          .setLabel('🔄 Solicitar Transferência de Guild')
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({
        content:
          `⛔ **Inscrição Não Permitida!**\n\n` +
          `Você já é membro registrado da guild **[${existingGuild.tag}] ${existingGuild.name}**.\n` +
          `Na Coalizão Vampir, **não é permitido aplicar diretamente para outra guild** enquanto você já possui tag de uma legião aliada.\n\n` +
          `📌 **Para trocar de guild**, você deve utilizar o fluxo oficial de **Transferência de Guild**, onde a liderança da **[${targetGuild.tag}]** e a sua liderança atual alinham a mudança sem atritos.\n\n` +
          `Clique no botão abaixo para abrir seu pedido de transferência:`,
        components: [rowTransfer],
        ephemeral: true
      });
    }

    // Criação do Modal de Aplicação
    const modal = new ModalBuilder()
      .setCustomId(`modal_apply_${targetGuild.id}`)
      .setTitle(`Ficha: [${targetGuild.tag}] ${targetGuild.name}`.slice(0, 45));

    const inputNick = new TextInputBuilder()
      .setCustomId('nick')
      .setLabel('Seu Nick exato in-game no Vampir:')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: VampirSlayer_BR')
      .setRequired(true)
      .setMaxLength(50);

    const inputClasse = new TextInputBuilder()
      .setCustomId('classe')
      .setLabel('Classe / Build pretendida:')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: Bloodstained / Melee Sustain')
      .setRequired(true)
      .setMaxLength(60);

    const inputHorario = new TextInputBuilder()
      .setCustomId('horarios')
      .setLabel('Level atual e horários que você joga:')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Ex: Level 45, disponível todos os dias das 19h às 23h.')
      .setRequired(true)
      .setMaxLength(300);

    const inputSobre = new TextInputBuilder()
      .setCustomId('sobre')
      .setLabel('Experiência prévia / Por que essa guild?')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Fale um pouco sobre seu histórico em MMOs/RPGs.')
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder().addComponents(inputNick),
      new ActionRowBuilder().addComponents(inputClasse),
      new ActionRowBuilder().addComponents(inputHorario),
      new ActionRowBuilder().addComponents(inputSobre)
    );

    return interaction.showModal(modal);
  }

  // --- APROVAÇÃO DE CANDIDATURA (approve_app_...) ---
  if (customId.startsWith('approve_app_')) {
    const appId = customId.replace('approve_app_', '');
    const app = findApplicationById(appId);

    if (!app) {
      return interaction.reply({ content: '❌ Ficha de candidatura não encontrada.', ephemeral: true });
    }

    if (app.status !== 'pending') {
      return interaction.reply({ content: `⚠️ Esta candidatura já foi finalizada como **${app.status}**.`, ephemeral: true });
    }

    const targetGuild = findGuildById(app.guildId);
    const isLeader = interaction.user.id === targetGuild?.leaderId || (targetGuild?.officerIds && targetGuild.officerIds.includes(interaction.user.id));
    const isStaff = config?.roles?.staff && interaction.member.roles.cache.has(config.roles.staff);

    if (!isLeader && !isStaff) {
      return interaction.reply({
        content: '❌ Apenas o líder desta guild, seus oficiais ou a Staff podem aprovar candidaturas.',
        ephemeral: true
      });
    }

    await interaction.deferUpdate();

    // Atualiza banco
    updateApplicationStatus(appId, 'approved', interaction.user.id);

    // Adiciona cargos ao candidato
    try {
      const candidateMember = await guild.members.fetch(app.userId);
      if (candidateMember) {
        if (targetGuild && targetGuild.roleId) {
          // Remove automaticamente qualquer outro cargo de guilda da Coalizão para evitar tag dupla
          const allGuilds = getGuilds();
          for (const g of allGuilds) {
            if (g.id !== targetGuild.id && candidateMember.roles.cache.has(g.roleId)) {
              await candidateMember.roles.remove(g.roleId, 'Remoção de guild anterior na aprovação').catch(() => {});
            }
          }
          await candidateMember.roles.add(targetGuild.roleId);
        }
        if (config && config.roles && config.roles.validado) {
          await candidateMember.roles.add(config.roles.validado);
        }

        // Notificar via DM
        try {
          await candidateMember.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('🎉 PARABÉNS! SUA APLICAÇÃO FOI APROVADA!')
                .setDescription(
                  `Você foi aceito na guild **[${targetGuild?.tag}] ${targetGuild?.name}**!\n\n` +
                  `✅ Seus cargos foram liberados.\n` +
                  `🌐 O acesso a todos os canais do servidor **${guild.name}** agora está aberto para você.\n\n` +
                  `*Seja bem-vindo e bom jogo!*`
                )
                .setColor(Colors.Green)
                .setTimestamp()
            ]
          });
        } catch {
          console.log(`[DM] Não foi possível enviar DM para o usuário ${app.userId}`);
        }
      }
    } catch (err) {
      console.error('[ERRO] Falha ao dar cargo ao candidato:', err);
    }

    // Edita mensagem de aprovação desativando botões
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(Colors.Green)
      .addFields({
        name: '📌 Decisão da Liderança',
        value: `✅ **APROVADO** por <@${interaction.user.id}> em <t:${Math.floor(Date.now() / 1000)}:f>`
      });

    await interaction.message.edit({
      embeds: [updatedEmbed],
      components: [] // remove os botões
    });

    // Log no canal de logs
    if (config?.channels?.logs) {
      try {
        const chLogs = await guild.channels.fetch(config.channels.logs);
        if (chLogs) {
          await chLogs.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('✅ Candidatura Aprovada')
                .setDescription(
                  `• **Jogador:** <@${app.userId}> (\`${app.nick}\`)\n` +
                  `• **Guild:** [${targetGuild?.tag}] ${targetGuild?.name}\n` +
                  `• **Aprovado por:** <@${interaction.user.id}>`
                )
                .setColor(Colors.Green)
                .setTimestamp()
            ]
          });
        }
      } catch {}
    }

    // Atualiza o contador de membros no painel público e stats do topo
    if (typeof refreshServerStats === 'function') {
      refreshServerStats(interaction.client).catch(() => {});
    }
    if (config?.channels?.recrutamento && targetGuild) {
      guild.channels.fetch(config.channels.recrutamento)
        .then(chRec => { if (chRec) updateSingleGuildCard(guild, chRec, targetGuild); })
        .catch(() => {});
    }
  }

  // --- RECUSA DE CANDIDATURA (reject_app_...) ---
  if (customId.startsWith('reject_app_')) {
    const appId = customId.replace('reject_app_', '');
    const app = findApplicationById(appId);

    if (!app) {
      return interaction.reply({ content: '❌ Ficha de candidatura não encontrada.', ephemeral: true });
    }

    if (app.status !== 'pending') {
      return interaction.reply({ content: `⚠️ Esta candidatura já foi finalizada como **${app.status}**.`, ephemeral: true });
    }

    const targetGuild = findGuildById(app.guildId);
    const isLeader = interaction.user.id === targetGuild?.leaderId || (targetGuild?.officerIds && targetGuild.officerIds.includes(interaction.user.id));
    const isStaff = config?.roles?.staff && interaction.member.roles.cache.has(config.roles.staff);

    if (!isLeader && !isStaff) {
      return interaction.reply({
        content: '❌ Apenas o líder desta guild, seus oficiais ou a Staff podem recusar candidaturas.',
        ephemeral: true
      });
    }

    await interaction.deferUpdate();

    updateApplicationStatus(appId, 'rejected', interaction.user.id);

    // Notificar via DM com respeito
    try {
      const candidateUser = await interaction.client.users.fetch(app.userId);
      if (candidateUser) {
        await candidateUser.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('Candidatura Não Aprovada')
              .setDescription(
                `Olá! Informamos que sua candidatura para a guild **[${targetGuild?.tag}] ${targetGuild?.name}** não foi aceita no momento.\n\n` +
                `Você é livre para tentar se candidatar a outra legião parceira no canal de recrutamento.`
              )
              .setColor(Colors.Red)
              .setTimestamp()
          ]
        });
      }
    } catch {}

    // Atualiza o embed
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(Colors.Red)
      .addFields({
        name: '📌 Decisão da Liderança',
        value: `❌ **RECUSADO** por <@${interaction.user.id}> em <t:${Math.floor(Date.now() / 1000)}:f>`
      });

    await interaction.message.edit({
      embeds: [updatedEmbed],
      components: []
    });

    // Log
    if (config?.channels?.logs) {
      try {
        const chLogs = await guild.channels.fetch(config.channels.logs);
        if (chLogs) {
          await chLogs.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ Candidatura Recusada')
                .setDescription(
                  `• **Jogador:** <@${app.userId}> (\`${app.nick}\`)\n` +
                  `• **Guild:** [${targetGuild?.tag}] ${targetGuild?.name}\n` +
                  `• **Recusado por:** <@${interaction.user.id}>`
                )
                .setColor(Colors.Red)
                .setTimestamp()
            ]
          });
        }
      } catch {}
    }
    return;
  }

  // --- APROVAÇÃO DE TRANSFERÊNCIA (approve_trans_...) ---
  if (customId.startsWith('approve_trans_')) {
    const appId = customId.replace('approve_trans_', '');
    const app = findApplicationById(appId);

    if (!app) {
      return interaction.reply({ content: '❌ Ficha de transferência não encontrada.', ephemeral: true });
    }

    if (app.status !== 'pending') {
      return interaction.reply({ content: `⚠️ Esta transferência já foi finalizada como **${app.status}**.`, ephemeral: true });
    }

    const allGuilds = getGuilds();
    const targetGuild = findGuildById(app.guildId);
    const oldGuild = app.oldGuildId ? findGuildById(app.oldGuildId) : null;

    const isLeader = interaction.user.id === targetGuild?.leaderId || (targetGuild?.officerIds && targetGuild.officerIds.includes(interaction.user.id));
    const isStaff = config?.roles?.staff && interaction.member.roles.cache.has(config.roles.staff);

    if (!isLeader && !isStaff) {
      return interaction.reply({
        content: `❌ Apenas o Líder ou Oficiais de **[${targetGuild?.tag}]** (ou Staff) podem aprovar esta transferência.`,
        ephemeral: true
      });
    }

    await interaction.deferUpdate();

    // 1. Atualizar banco de dados
    updateApplicationStatus(appId, 'approved', interaction.user.id);

    // 2. Troca de Cargos: REMOVE DA GUILDA ANTERIOR E ADICIONA NA NOVA
    try {
      const candidateMember = await guild.members.fetch(app.userId).catch(() => null);
      if (candidateMember) {
        // Remove cargos de qualquer guilda anterior
        for (const g of allGuilds) {
          if (g.id !== targetGuild?.id && g.roleId && candidateMember.roles.cache.has(g.roleId)) {
            await candidateMember.roles.remove(g.roleId).catch(() => {});
          }
        }

        // Adiciona cargo da nova guild
        if (targetGuild && targetGuild.roleId) {
          await candidateMember.roles.add(targetGuild.roleId).catch(() => {});
        }
        if (config?.roles?.validado) {
          await candidateMember.roles.add(config.roles.validado).catch(() => {});
        }

        // Notificar via DM
        try {
          await candidateMember.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('🎉 PARABÉNS! SUA TRANSFERÊNCIA FOI APROVADA!')
                .setDescription(
                  `Sua transferência para a legião **[${targetGuild?.tag}] ${targetGuild?.name}** foi aprovada!\n\n` +
                  `✅ **Cargo Anterior:** Removido do seu perfil.\n` +
                  `🏰 **Novo Cargo:** <@&${targetGuild?.roleId}> liberado!\n\n` +
                  `*Alinhe com a nova liderança a entrada in-game assim que o cooldown de 24h expirar.*`
                )
                .setColor(Colors.Green)
                .setTimestamp()
            ]
          });
        } catch {}
      }
    } catch (err) {
      console.warn('[TRANSFER] Falha ao atualizar cargos do membro:', err.message);
    }

    // Atualiza o vínculo de presenças do jogador transferido para acompanhar a nova guilda
    try {
      const { transferUserAttendance, renderOrUpdatePresencePanel } = require('../attendance_manager');
      await transferUserAttendance(candidateMember.id, targetGuild);
      if (config?.channels?.painelPresencas) {
        guild.channels.fetch(config.channels.painelPresencas).then(ch => {
          if (ch) renderOrUpdatePresencePanel(guild, ch);
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('[TRANSFER] Aviso ao transferir presenças:', err.message);
    }

    // 3. Atualiza a mensagem no canal de aprovações
    const currentEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(currentEmbed)
      .setColor(Colors.Green)
      .addFields({
        name: '📌 Decisão da Liderança',
        value: `✅ **TRANSFERÊNCIA APROVADA** por <@${interaction.user.id}> em <t:${Math.floor(Date.now() / 1000)}:f>\n*(Cargo da guilda anterior removido e novo cargo entregue com sucesso)*`
      });

    await interaction.message.edit({
      embeds: [updatedEmbed],
      components: []
    });

    // 4. Anunciar no canal de transferências
    const chTransferenciaId = config?.channels?.transferencia || '1566519973684187199';
    try {
      const chTransferencia = await guild.channels.fetch(chTransferenciaId).catch(() => null);
      if (chTransferencia) {
        await chTransferencia.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ Transferência de Guild Concluída!')
              .setDescription(
                `• **Jogador:** <@${app.userId}> (\`${app.nick}\`)\n` +
                `• **Origem:** ${oldGuild ? `[${oldGuild.tag}] ${oldGuild.name}` : '*Sem guilda anterior*'}\n` +
                `• **Novo Clã:** **[${targetGuild?.tag}] ${targetGuild?.name}**\n` +
                `• **Aprovado por:** <@${interaction.user.id}>`
              )
              .setColor(Colors.Green)
              .setTimestamp()
          ]
        }).catch(() => {});
      }
    } catch {}

    // 5. Log
    if (config?.channels?.logs) {
      try {
        const chLogs = await guild.channels.fetch(config.channels.logs);
        if (chLogs) {
          await chLogs.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('🔄 Transferência Concluída')
                .setDescription(
                  `• **Jogador:** <@${app.userId}>\n` +
                  `• **De:** [${oldGuild?.tag || '?'}] ${oldGuild?.name || '?'}\n` +
                  `• **Para:** [${targetGuild?.tag}] ${targetGuild?.name}\n` +
                  `• **Aprovado por:** <@${interaction.user.id}>`
                )
                .setColor(Colors.Green)
                .setTimestamp()
            ]
          });
        }
      } catch {}
    }

    if (refreshServerStats) refreshServerStats(guild);
    return;
  }

  // --- RECUSA DE TRANSFERÊNCIA (reject_trans_...) ---
  if (customId.startsWith('reject_trans_')) {
    const appId = customId.replace('reject_trans_', '');
    const app = findApplicationById(appId);

    if (!app) {
      return interaction.reply({ content: '❌ Ficha de transferência não encontrada.', ephemeral: true });
    }

    if (app.status !== 'pending') {
      return interaction.reply({ content: `⚠️ Esta transferência já foi finalizada como **${app.status}**.`, ephemeral: true });
    }

    const targetGuild = findGuildById(app.guildId);
    const isLeader = interaction.user.id === targetGuild?.leaderId || (targetGuild?.officerIds && targetGuild.officerIds.includes(interaction.user.id));
    const isStaff = config?.roles?.staff && interaction.member.roles.cache.has(config.roles.staff);

    if (!isLeader && !isStaff) {
      return interaction.reply({
        content: `❌ Apenas o Líder ou Oficiais de **[${targetGuild?.tag}]** (ou Staff) podem recusar esta transferência.`,
        ephemeral: true
      });
    }

    await interaction.deferUpdate();

    updateApplicationStatus(appId, 'rejected', interaction.user.id);

    const currentEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(currentEmbed)
      .setColor(Colors.Red)
      .addFields({
        name: '📌 Decisão da Liderança',
        value: `❌ **TRANSFERÊNCIA RECUSADA** por <@${interaction.user.id}> em <t:${Math.floor(Date.now() / 1000)}:f>`
      });

    await interaction.message.edit({
      embeds: [updatedEmbed],
      components: []
    });

    // Notificar via DM
    try {
      const candidateMember = await guild.members.fetch(app.userId).catch(() => null);
      if (candidateMember) {
        await candidateMember.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ SOLICITAÇÃO DE TRANSFERÊNCIA RECUSADA')
              .setDescription(
                `Sua solicitação de transferência para **[${targetGuild?.tag}] ${targetGuild?.name}** não foi aceita no momento.\n` +
                `Você permanece com seus acessos e cargo na sua guilda atual normalmente.`
              )
              .setColor(Colors.Red)
              .setTimestamp()
          ]
        });
      }
    } catch {}

    return;
  }
}

module.exports = {
  handleButton
};
