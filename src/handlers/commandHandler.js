const { Colors, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const {
  getServerConfig,
  getGuilds,
  addGuild,
  findGuildById,
  findGuildsByLeaderId,
  addGuildOfficer,
  removeGuildOfficer,
  setGuildLeader,
  updateGuild,
  addGuildCaller,
  removeGuildCaller,
  findGuildsByCallerId
} = require('../data_manager');
const { renderRecruitmentPanel, updateSingleGuildCard } = require('../recruitment_panel');
const {
  getBossData,
  saveBossData,
  parseTimeInput,
  renderOrUpdateBossPanel,
  getFixedScheduleStatus
} = require('../boss_manager');
const {
  recordAttendance,
  getUserDkp,
  getDkpRanking
} = require('../dkp_manager');
const {
  submitAttendance,
  renderOrUpdatePresencePanel,
  getUserAttendanceSummary,
  extendGeenaWindow,
  renderOrUpdateCheckinBanner
} = require('../attendance_manager');
const { createAuthResponse, renderOverlayPanel } = require('../services/overlayService');

function parseHexColor(input) {
  if (!input) return '#9B59B6';
  let str = input.trim();
  if (str.startsWith('#')) str = str.slice(1);
  if (/^[0-9A-Fa-f]{6}$/.test(str)) {
    return '#' + str.toUpperCase();
  }
  return '#9B59B6';
}

async function handleCommand(interaction, refreshServerStats) {
  const config = getServerConfig();
  const guild = interaction.guild;
  const member = interaction.member;
  const { commandName } = interaction;

  // --- /ajuda ---
  if (commandName === 'ajuda') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('🩸 VAMPIR BOT — CENTRAL DE AJUDA & COMANDOS')
      .setDescription(
        'Este bot gerencia a arquitetura de acesso **Zero-Trust**, recrutamento e rastreamento de Bosses de **Vampir**.\n\n' +
        '### 👑 Comandos da Staff & Lideranças:\n' +
        '• `/mover-auditorio [ignorar_afk] [destino]` — Puxa todos em voz para o Auditório.\n' +
        '• `/criar-guild [nome] [tag] [lider] [descricao] [cor] [icone]`\n' +
        '• `/painel-recrutamento` • `/listar-guilds` • `/criar-palco [nome]`\n\n' +
        '### 🏰 Comandos das Lideranças de Guild:\n' +
        '• `/editar-guild [tag] [cor] [descricao] [icone_url]`\n' +
        '• `/guild-staff [acao] [usuario] [tag]`\n' +
        '• `/guild-callers [acao] [usuario] [tag]` — Nomeia até 2 Shout Callers da guild.\n' +
        '• `/guild-remover [usuario] [motivo] [tag]` — Remove/desliga um jogador da sua guild.\n\n' +
        '### 🐉 Cronograma de Bosses (Geena & Mapa):\n' +
        '• `/boss-respawn [boss] [horario]` — Agenda respawn (ex: `18:30` ou `45m`).\n' +
        '• `/boss-morto [boss] [respawn]` — Marca como derrotado.\n' +
        '• `/boss-vivo [boss]` — Marca como vivo no mapa.\n' +
        '• `/boss-painel` — Sincroniza o painel de timers.\n\n' +
        '### 💎 Sistema de DKP & Presença:\n' +
        '• `/presenca [evento] [dkp_manual] [motivo]` — Computa DKP de todos no Auditório (Líderes/Staff).\n' +
        '• `/dkp [usuario]` — Consulta o saldo pessoal ou de outro membro.\n' +
        '• `/dkp-ranking` — Exibe os Top membros com maior pontuação de DKP.\n\n' +
        '### 🛡️ Níveis de Segurança:\n' +
        '1. **Visitante:** Só enxerga canal de boas-vindas e recrutamento.\n' +
        '2. **Player Validado:** Aprovado pela liderança de um clã, desbloqueia canais da comunidade.\n' +
        '3. **Líder de Guild:** Acesso à Cúpula de Líderes e gestão das aplicações da sua própria legião.'
      )
      .setColor(Colors.DarkRed)
      .setFooter({ text: 'Vampir Bot • Segurança e Gestão de Comunidades' });

    return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
  }

  // --- /editar-guild ---
  if (commandName === 'editar-guild') {
    await interaction.deferReply({ ephemeral: true });

    const tagInput = interaction.options.getString('tag');
    const novaTagInput = interaction.options.getString('nova_tag');
    const corInput = interaction.options.getString('cor');
    const descricaoInput = interaction.options.getString('descricao');
    const iconeUrlInput = interaction.options.getString('icone_url');

    if (!novaTagInput && !corInput && !descricaoInput && !iconeUrlInput) {
      return interaction.editReply('⚠️ Você precisa informar ao menos uma opção para alterar: `nova_tag`, `cor`, `descricao` ou `icone_url`.');
    }

    const allGuilds = getGuilds();
    let targetGuild = null;

    if (tagInput) {
      targetGuild = allGuilds.find(g => g.tag.toUpperCase() === tagInput.toUpperCase().trim());
      if (!targetGuild) {
        return interaction.editReply(`❌ Nenhuma guild encontrada com a tag **[${tagInput.toUpperCase()}]**.`);
      }
    } else {
      const userGuilds = findGuildsByLeaderId(interaction.user.id);
      if (userGuilds.length === 0) {
        return interaction.editReply('❌ Você não é líder ou oficial de nenhuma guild registrada. Se você for da Staff Geral, forneça a opção `tag` para especificar a guild.');
      }
      if (userGuilds.length > 1) {
        const tagsList = userGuilds.map(g => `\`${g.tag}\``).join(', ');
        return interaction.editReply(`⚠️ Você faz parte da liderança de mais de uma guild (${tagsList}). Por favor, especifique o parâmetro \`tag\` da guild desejada.`);
      }
      targetGuild = userGuilds[0];
    }

    const isMainLeader = interaction.user.id === targetGuild.leaderId;
    const isOfficer = targetGuild.officerIds && targetGuild.officerIds.includes(interaction.user.id);
    const isStaffGeneral = config?.roles?.staff && interaction.member.roles.cache.has(config.roles.staff);

    // Se estiver tentando alterar a TAG, exige Líder Principal ou Staff Geral
    if (novaTagInput && !isMainLeader && !isStaffGeneral) {
      return interaction.editReply(`❌ Permissão negada. Apenas o Líder Principal de **[${targetGuild.tag}]** (<@${targetGuild.leaderId}>) ou a Staff Geral pode alterar a TAG da guild.`);
    }

    // Para as demais alterações, qualquer Líder, Oficial da guild ou Staff Geral pode
    if (!isMainLeader && !isOfficer && !isStaffGeneral) {
      return interaction.editReply(`❌ Permissão negada. Você não pertence à liderança da guild **[${targetGuild.tag}] ${targetGuild.name}**.`);
    }

    const updates = {};
    const changesList = [];

    if (novaTagInput) {
      const cleanNewTag = novaTagInput.trim().toUpperCase();
      if (cleanNewTag.length < 2 || cleanNewTag.length > 6) {
        return interaction.editReply('⚠️ A nova TAG deve conter entre 2 e 6 caracteres (ex: ALC, OLP, NOM).');
      }

      const tagInUse = allGuilds.find(g => g.id !== targetGuild.id && g.tag.toUpperCase() === cleanNewTag);
      if (tagInUse) {
        return interaction.editReply(`❌ A TAG **[${cleanNewTag}]** já está em uso pela guild **${tagInUse.name}**! Escolha outra.`);
      }

      const oldTag = targetGuild.tag;
      updates.tag = cleanNewTag;
      changesList.push(`• **TAG:** Alterada de \`[${oldTag}]\` para \`[${cleanNewTag}]\``);

      // Atualiza o nome do Cargo no Discord
      try {
        const role = await guild.roles.fetch(targetGuild.roleId);
        if (role) {
          const newRoleName = `[🏰] [${cleanNewTag}] ${targetGuild.name}`;
          await role.setName(newRoleName, `Alteração de TAG solicitada por ${interaction.user.tag}`);
        }
      } catch (err) {
        console.warn('[EDITAR-GUILD] Falha ao renomear cargo:', err.message);
      }

      // Atualiza o nome da Categoria no Discord
      try {
        if (targetGuild.categoryId) {
          const cat = await guild.channels.fetch(targetGuild.categoryId);
          if (cat) {
            await cat.setName(`🏰 │ [${cleanNewTag}] ${targetGuild.name}`, `Alteração de TAG`);
          }
        }
      } catch (err) {
        console.warn('[EDITAR-GUILD] Falha ao renomear categoria:', err.message);
      }
    }

    if (corInput) {
      const newColorHex = parseHexColor(corInput);
      updates.color = newColorHex;
      changesList.push(`• **Cor:** Atualizada para \`${newColorHex}\``);

      try {
        const role = await guild.roles.fetch(targetGuild.roleId);
        if (role) await role.setColor(newColorHex, `Alteração solicitada por ${interaction.user.tag}`);
      } catch (err) {
        console.warn('[EDITAR-GUILD] Não foi possível atualizar cor do cargo:', err.message);
      }
    }

    if (descricaoInput) {
      updates.description = descricaoInput.trim();
      changesList.push(`• **Descrição:** \`${descricaoInput.trim()}\``);
    }

    if (iconeUrlInput) {
      updates.iconUrl = iconeUrlInput.trim();
      changesList.push(`• **Ícone/Brasão:** [Visualizar Imagem](${iconeUrlInput.trim()})`);
    }

    updateGuild(targetGuild.id, updates);

    // Mescla updates no objeto targetGuild para os cards refletirem a nova TAG imediatamente
    Object.assign(targetGuild, updates);

    const replyEmbed = new EmbedBuilder()
      .setTitle(`✅ Guild [${targetGuild.tag}] ${targetGuild.name} Atualizada!`)
      .setDescription(
        `As seguintes alterações foram aplicadas com sucesso:\n\n` +
        changesList.join('\n') +
        `\n\n*O cargo, a categoria e o card no catálogo de recrutamento foram atualizados instantaneamente.*`
      )
      .setColor(Colors.Green)
      .setTimestamp();

    await interaction.editReply({ embeds: [replyEmbed] });

    if (config?.channels?.recrutamento) {
      guild.channels.fetch(config.channels.recrutamento)
        .then(ch => { if (ch) updateSingleGuildCard(guild, ch, targetGuild); })
        .catch(() => {});
    }

    if (config?.channels?.logs) {
      guild.channels.fetch(config.channels.logs)
        .then(ch => {
          if (ch) {
            const logEmbed = new EmbedBuilder()
              .setTitle('🎨 Guild Atualizada')
              .setDescription(
                `A legião **[${targetGuild.tag}] ${targetGuild.name}** teve configurações alteradas por <@${interaction.user.id}>:\n\n` +
                changesList.join('\n')
              )
              .setColor(updates.color ? parseInt(updates.color.replace('#', ''), 16) : Colors.Blue)
              .setTimestamp();
            ch.send({ embeds: [logEmbed] }).catch(() => {});
          }
        })
        .catch(() => {});
    }
    return;
  }

  // --- /guild-staff ---
  if (commandName === 'guild-staff') {
    await interaction.deferReply({ ephemeral: true });

    const acao = interaction.options.getString('acao');
    const targetUser = interaction.options.getUser('usuario');
    const tagInput = interaction.options.getString('tag');

    const allGuilds = getGuilds();
    let targetGuild = null;

    if (tagInput) {
      targetGuild = allGuilds.find(g => g.tag.toUpperCase() === tagInput.toUpperCase().trim());
      if (!targetGuild) {
        return interaction.editReply(`❌ Nenhuma guild encontrada com a tag **[${tagInput.toUpperCase()}]**.`);
      }
    } else {
      const userGuilds = findGuildsByLeaderId(interaction.user.id);
      if (userGuilds.length === 0) {
        return interaction.editReply('❌ Você não é líder ou oficial de nenhuma guild registrada. Se você for da Staff Geral, forneça a opção `tag` para especificar a guild.');
      }
      if (userGuilds.length > 1) {
        const tagsList = userGuilds.map(g => `\`${g.tag}\``).join(', ');
        return interaction.editReply(`⚠️ Você faz parte da liderança de mais de uma guild (${tagsList}). Por favor, especifique o parâmetro \`tag\` da guild desejada.`);
      }
      targetGuild = userGuilds[0];
    }

    const isMainLeader = interaction.user.id === targetGuild.leaderId;
    const isStaffGeneral = config?.roles?.staff && interaction.member.roles.cache.has(config.roles.staff);

    if (acao === 'listar') {
      const officersList = targetGuild.officerIds && targetGuild.officerIds.length > 0
        ? targetGuild.officerIds.map(id => `• <@${id}>`).join('\n')
        : '*Nenhum oficial ou vice-líder cadastrado.*';

      const listEmbed = new EmbedBuilder()
        .setTitle(`🛡️ Staff & Liderança — [${targetGuild.tag}] ${targetGuild.name}`)
        .setColor(targetGuild.color ? parseInt(targetGuild.color.replace('#', ''), 16) : Colors.Purple)
        .addFields(
          { name: '👑 Líder Principal', value: `<@${targetGuild.leaderId}>`, inline: false },
          { name: '🎖️ Oficiais / Vice-Líderes', value: officersList, inline: false }
        )
        .setFooter({ text: 'Oficiais têm acesso ao canal de aprovações e podem aceitar/recusar membros' })
        .setTimestamp();

      return interaction.editReply({ embeds: [listEmbed] });
    }

    if (!targetUser) {
      return interaction.editReply('⚠️ Você precisa selecionar um usuário para executar esta ação.');
    }

    if (!isMainLeader && !isStaffGeneral) {
      return interaction.editReply(`❌ Permissão negada. Apenas o Líder Principal de **[${targetGuild.tag}]** (<@${targetGuild.leaderId}>) ou a Staff Geral pode alterar a liderança do clã.`);
    }

    if (acao === 'adicionar') {
      if (targetUser.id === targetGuild.leaderId) return interaction.editReply('⚠️ Este jogador já é o Líder Principal desta guild!');
      if (targetGuild.officerIds && targetGuild.officerIds.includes(targetUser.id)) return interaction.editReply('⚠️ Este jogador já está cadastrado como Oficial desta guild!');

      addGuildOfficer(targetGuild.id, targetUser.id);

      try {
        const chAprovacoes = await guild.channels.fetch(targetGuild.approvalsChannelId);
        if (chAprovacoes) {
          await chAprovacoes.permissionOverwrites.edit(targetUser.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          });
        }
      } catch (err) {
        console.warn('[STAFF] Falha ao dar permissão em canal:', err.message);
      }

      try {
        const officerMember = await guild.members.fetch(targetUser.id);
        if (officerMember) {
          if (targetGuild.roleId) await officerMember.roles.add(targetGuild.roleId);
          if (config?.roles?.oficial) await officerMember.roles.add(config.roles.oficial);
          if (config?.roles?.validado) await officerMember.roles.add(config.roles.validado);
        }
      } catch (err) {
        console.warn('[STAFF] Falha ao dar cargo a oficial:', err.message);
      }

      await interaction.editReply(`✅ <@${targetUser.id}> foi promovido a **Oficial / Vice-Líder** de **[${targetGuild.tag}] ${targetGuild.name}**!\nEle agora possui acesso ao canal secreto de aprovações e à Cúpula de Líderes.`);

      if (config?.channels?.recrutamento) {
        guild.channels.fetch(config.channels.recrutamento)
          .then(ch => { if (ch) updateSingleGuildCard(guild, ch, targetGuild); }).catch(() => {});
      }

      if (config?.channels?.logs) {
        guild.channels.fetch(config.channels.logs)
          .then(ch => {
            if (ch) {
              ch.send({
                embeds: [
                  new EmbedBuilder()
                    .setTitle('🎖️ Novo Oficial de Guild Nomeado')
                    .setDescription(`• **Guild:** [${targetGuild.tag}] ${targetGuild.name}\n• **Oficial:** <@${targetUser.id}>\n• **Nomeado por:** <@${interaction.user.id}>`)
                    .setColor(Colors.Gold)
                    .setTimestamp()
                ]
              }).catch(() => {});
            }
          }).catch(() => {});
      }
      return;
    }

    if (acao === 'remover') {
      if (!targetGuild.officerIds || !targetGuild.officerIds.includes(targetUser.id)) {
        return interaction.editReply('⚠️ Este jogador não é um oficial cadastrado desta guild.');
      }

      removeGuildOfficer(targetGuild.id, targetUser.id);

      try {
        const chAprovacoes = await guild.channels.fetch(targetGuild.approvalsChannelId);
        if (chAprovacoes) await chAprovacoes.permissionOverwrites.delete(targetUser.id).catch(() => {});
      } catch {}

      try {
        const targetMember = await guild.members.fetch(targetUser.id);
        if (targetMember && config?.roles?.oficial) {
          await targetMember.roles.remove(config.roles.oficial).catch(() => {});
        }
      } catch {}

      await interaction.editReply(`✅ <@${targetUser.id}> foi removido da Staff de **[${targetGuild.tag}] ${targetGuild.name}**.`);

      if (config?.channels?.recrutamento) {
        guild.channels.fetch(config.channels.recrutamento)
          .then(ch => { if (ch) updateSingleGuildCard(guild, ch, targetGuild); }).catch(() => {});
      }

      if (config?.channels?.logs) {
        guild.channels.fetch(config.channels.logs)
          .then(ch => {
            if (ch) {
              ch.send({
                embeds: [
                  new EmbedBuilder()
                    .setTitle('🔻 Oficial de Guild Removido')
                    .setDescription(`• **Guild:** [${targetGuild.tag}] ${targetGuild.name}\n• **Ex-Oficial:** <@${targetUser.id}>\n• **Removido por:** <@${interaction.user.id}>`)
                    .setColor(Colors.Orange)
                    .setTimestamp()
                ]
              }).catch(() => {});
            }
          }).catch(() => {});
      }
      return;
    }

    if (acao === 'transferir') {
      if (targetUser.id === targetGuild.leaderId) return interaction.editReply('⚠️ Este usuário já é o Líder Principal!');

      const oldLeaderId = targetGuild.leaderId;
      setGuildLeader(targetGuild.id, targetUser.id);

      try {
        const chAprovacoes = await guild.channels.fetch(targetGuild.approvalsChannelId);
        if (chAprovacoes) {
          await chAprovacoes.permissionOverwrites.edit(targetUser.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          });
        }
      } catch {}

      try {
        const newLeaderMember = await guild.members.fetch(targetUser.id);
        if (newLeaderMember) {
          if (targetGuild.roleId) await newLeaderMember.roles.add(targetGuild.roleId);
          if (config?.roles?.lider) await newLeaderMember.roles.add(config.roles.lider);
          if (config?.roles?.oficial) await newLeaderMember.roles.remove(config.roles.oficial).catch(() => {});
          if (config?.roles?.validado) await newLeaderMember.roles.add(config.roles.validado);
        }

        const oldLeaderMember = await guild.members.fetch(oldLeaderId);
        if (oldLeaderMember) {
          const otherLeaderGuilds = findGuildsByLeaderId(oldLeaderId);
          if (otherLeaderGuilds.length === 0 && config?.roles?.lider) {
            await oldLeaderMember.roles.remove(config.roles.lider).catch(() => {});
          }
          if (config?.roles?.oficial) {
            await oldLeaderMember.roles.add(config.roles.oficial).catch(() => {});
          }
        }
      } catch {}

      await interaction.editReply(`👑 **Liderança transferida com sucesso!**\n<@${targetUser.id}> é agora o Líder Principal da guild **[${targetGuild.tag}] ${targetGuild.name}**.\n🎖️ <@${oldLeaderId}> foi mantido como **Oficial / Vice-Líder** com plenos poderes de aprovação de membros.`);

      if (config?.channels?.recrutamento) {
        guild.channels.fetch(config.channels.recrutamento)
          .then(ch => { if (ch) updateSingleGuildCard(guild, ch, targetGuild); }).catch(() => {});
      }

      if (config?.channels?.logs) {
        guild.channels.fetch(config.channels.logs)
          .then(ch => {
            if (ch) {
              ch.send({
                embeds: [
                  new EmbedBuilder()
                    .setTitle('👑 Liderança de Guild Transferida')
                    .setDescription(`• **Guild:** [${targetGuild.tag}] ${targetGuild.name}\n• **Novo Líder Principal:** <@${targetUser.id}>\n• **Oficial Mantido:** <@${oldLeaderId}>\n• **Autorizado por:** <@${interaction.user.id}>`)
                    .setColor(Colors.Gold)
                    .setTimestamp()
                ]
              }).catch(() => {});
            }
          }).catch(() => {});
      }
      return;
    }
  }

  // --- /guild-callers ---
  if (commandName === 'guild-callers') {
    await interaction.deferReply({ ephemeral: false });

    const acao = interaction.options.getString('acao');
    const targetUser = interaction.options.getUser('usuario');
    const tagInput = interaction.options.getString('tag');

    // 1. Identificar a guild alvo
    let targetGuild = null;
    const allGuilds = getGuilds();

    if (tagInput) {
      targetGuild = allGuilds.find(g => g.tag.toLowerCase() === tagInput.trim().toLowerCase());
      if (!targetGuild) {
        return interaction.editReply(`❌ Nenhuma guild encontrada com a tag **[${tagInput}]**.`);
      }
    } else {
      // Se não passou tag, busca guild onde o usuário é Líder Principal
      const userLeadingGuilds = allGuilds.filter(g => g.leaderId === interaction.user.id);
      if (userLeadingGuilds.length === 1) {
        targetGuild = userLeadingGuilds[0];
      } else if (userLeadingGuilds.length > 1) {
        const tagsList = userLeadingGuilds.map(g => `\`${g.tag}\``).join(', ');
        return interaction.editReply(`⚠️ Você lidera mais de uma guild (${tagsList}). Por favor, especifique o parâmetro \`tag\` da guild desejada.`);
      }
    }

    const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
      (config?.roles?.staff && interaction.member.roles.cache.has(config.roles.staff));

    // Se ainda não encontrou guild e for Staff
    if (!targetGuild && isStaff) {
      return interaction.editReply('⚠️ Como Staff, por favor informe a `tag` da guild que deseja gerenciar os Shout Callers.');
    }

    if (!targetGuild) {
      return interaction.editReply('❌ Você não é Líder Principal de nenhuma guild cadastrada.');
    }

    // 2. Validação estrita de Líder (Apenas o Líder Principal ou Staff podem gerenciar callers)
    const isLeader = interaction.user.id === targetGuild.leaderId;
    if (!isLeader && !isStaff) {
      return interaction.editReply(`❌ Permissão negada. Apenas o **Líder Principal** de **[${targetGuild.tag}] ${targetGuild.name}** (<@${targetGuild.leaderId}>) tem autorização para nomear os Shout Callers.`);
    }

    targetGuild.callerIds = targetGuild.callerIds || [];

    // --- AÇÃO: LISTAR ---
    if (acao === 'listar') {
      const slot1 = targetGuild.callerIds[0] ? `<@${targetGuild.callerIds[0]}>` : '*Vazio (Disponível)*';
      const slot2 = targetGuild.callerIds[1] ? `<@${targetGuild.callerIds[1]}>` : '*Vazio (Disponível)*';

      const embedList = new EmbedBuilder()
        .setTitle(`📢 Shout Callers Oficiais — [${targetGuild.tag}] ${targetGuild.name}`)
        .setDescription(
          `Estes jogadores possuem autorização especial para puxar a call no Auditório e raids, **independente do cargo base**!\n\n` +
          `• **Vaga 1 (Slot 1):** ${slot1}\n` +
          `• **Vaga 2 (Slot 2):** ${slot2}\n\n` +
          `*Limite máximo de 2 Shout Callers por guild.*`
        )
        .setColor(0x00D2D3)
        .setFooter({ text: 'Vampir Bot • Gestão de Raid Callers' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embedList] });
    }

    // Para adicionar ou remover, usuário é obrigatório
    if (!targetUser) {
      return interaction.editReply(`⚠️ Você precisa selecionar o parâmetro \`usuario\` para a ação **${acao}**.`);
    }

    if (targetUser.bot) {
      return interaction.editReply('❌ Bots não podem ser nomeados como Shout Callers.');
    }

    // --- AÇÃO: ADICIONAR ---
    if (acao === 'adicionar') {
      if (targetGuild.callerIds.includes(targetUser.id)) {
        return interaction.editReply(`⚠️ O jogador <@${targetUser.id}> já é um dos Shout Callers cadastrados de **[${targetGuild.tag}]**!`);
      }

      if (targetGuild.callerIds.length >= 2) {
        const callersList = targetGuild.callerIds.map((id, idx) => `  • **Vaga ${idx+1}:** <@${id}>`).join('\n');
        return interaction.editReply(
          `⚠️ **Limite de 2 Shout Callers atingido para [${targetGuild.tag}]!**\n\n` +
          `A sua guild já preencheu todas as vagas de caller disponíveis:\n${callersList}\n\n` +
          `*Para cadastrar <@${targetUser.id}>, utilize antes \`/guild-callers acao:Remover\` para liberar uma das vagas.*`
        );
      }

      const res = addGuildCaller(targetGuild.id, targetUser.id);
      if (!res.success) {
        return interaction.editReply('❌ Erro ao registrar caller no banco de dados.');
      }

      // Conceder Cargo de Shout Caller e permissões
      try {
        const callerMember = await guild.members.fetch(targetUser.id);
        if (callerMember) {
          if (config?.roles?.caller) {
            await callerMember.roles.add(config.roles.caller);
          }
          // Garante permissão explícita no Auditório
          const chAuditorio = await guild.channels.fetch('1565408234867662931').catch(() => null);
          if (chAuditorio) {
            await chAuditorio.permissionOverwrites.edit(callerMember, {
              ViewChannel: true,
              Connect: true,
              Speak: true,
              PrioritySpeaker: true
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[CALLER] Falha ao dar cargo/permissão a caller:', err.message);
      }

      const updatedSlots = res.guild.callerIds.map((id, idx) => `• **Vaga ${idx+1}:** <@${id}>`).join('\n');

      const embedAdd = new EmbedBuilder()
        .setTitle('📢 Novo Shout Caller Nomeado!')
        .setDescription(
          `O jogador <@${targetUser.id}> foi nomeado **Shout Caller Oficial** de **[${targetGuild.tag}] ${targetGuild.name}**!\n\n` +
          `🎙️ **Permissões Concedidas:**\n` +
          `• Aval total para falar e usar *Priority Speaker* no Auditório e nas calls de Boss/Raid.\n` +
          `• Independente do cargo atual, a voz dele não é silenciada durante as batalhas!\n\n` +
          `📋 **Ocupação das Vagas (${res.guild.callerIds.length}/2):**\n${updatedSlots}`
        )
        .setColor(0x00D2D3)
        .setFooter({ text: `Autorizado pelo Líder: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embedAdd] });

      // Log no canal de auditoria
      if (config?.channels?.logs) {
        guild.channels.fetch(config.channels.logs)
          .then(ch => {
            if (ch) {
              ch.send({
                embeds: [
                  new EmbedBuilder()
                    .setTitle('📢 Shout Caller Nomeado')
                    .setDescription(`• **Guild:** [${targetGuild.tag}] ${targetGuild.name}\n• **Caller:** <@${targetUser.id}>\n• **Nomeado por:** <@${interaction.user.id}>`)
                    .setColor(0x00D2D3)
                    .setTimestamp()
                ]
              }).catch(() => {});
            }
          }).catch(() => {});
      }
      return;
    }

    // --- AÇÃO: REMOVER ---
    if (acao === 'remover') {
      if (!targetGuild.callerIds.includes(targetUser.id)) {
        return interaction.editReply(`⚠️ O jogador <@${targetUser.id}> não está cadastrado como Shout Caller de **[${targetGuild.tag}]**.`);
      }

      const res = removeGuildCaller(targetGuild.id, targetUser.id);
      if (!res.success) {
        return interaction.editReply('❌ Erro ao remover caller do banco de dados.');
      }

      // Remove permissão explícita no Auditório e cargo se não for caller de outra guilda
      try {
        const otherCallerGuilds = findGuildsByCallerId(targetUser.id);
        const callerMember = await guild.members.fetch(targetUser.id);
        if (callerMember) {
          if (otherCallerGuilds.length === 0 && config?.roles?.caller) {
            await callerMember.roles.remove(config.roles.caller).catch(() => {});
          }
          const chAuditorio = await guild.channels.fetch('1565408234867662931').catch(() => null);
          if (chAuditorio && otherCallerGuilds.length === 0) {
            await chAuditorio.permissionOverwrites.delete(callerMember).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[CALLER] Falha ao remover cargo/permissão de caller:', err.message);
      }

      const remainingSlots = res.guild.callerIds.length > 0
        ? res.guild.callerIds.map((id, idx) => `• **Vaga ${idx+1}:** <@${id}>`).join('\n')
        : '*Nenhum caller ativo no momento.*';

      const embedRemove = new EmbedBuilder()
        .setTitle('🔇 Shout Caller Desligado')
        .setDescription(
          `O jogador <@${targetUser.id}> não é mais Shout Caller de **[${targetGuild.tag}] ${targetGuild.name}**.\n\n` +
          `📋 **Vagas Atuais (${res.guild.callerIds.length}/2):**\n${remainingSlots}`
        )
        .setColor(Colors.DarkRed)
        .setFooter({ text: `Revogado pelo Líder: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embedRemove] });

      if (config?.channels?.logs) {
        guild.channels.fetch(config.channels.logs)
          .then(ch => {
            if (ch) {
              ch.send({
                embeds: [
                  new EmbedBuilder()
                    .setTitle('🔇 Shout Caller Revogado')
                    .setDescription(`• **Guild:** [${targetGuild.tag}] ${targetGuild.name}\n• **Caller Revogado:** <@${targetUser.id}>\n• **Revogado por:** <@${interaction.user.id}>`)
                    .setColor(Colors.DarkRed)
                    .setTimestamp()
                ]
              }).catch(() => {});
            }
          }).catch(() => {});
      }
      return;
    }
  }

  // --- /guild-remover ---
  if (commandName === 'guild-remover') {
    await interaction.deferReply({ ephemeral: false });

    const targetUser = interaction.options.getUser('usuario');
    const motivo = interaction.options.getString('motivo') || 'Não especificado';
    const tagInput = interaction.options.getString('tag');

    // 1. Identificar a guild alvo
    let targetGuild = null;
    const allGuilds = getGuilds();

    if (tagInput) {
      targetGuild = allGuilds.find(g => g.tag.toLowerCase() === tagInput.trim().toLowerCase());
      if (!targetGuild) {
        return interaction.editReply(`❌ Nenhuma guild encontrada com a tag **[${tagInput}]**.`);
      }
    } else {
      // Busca guild onde o executor é Líder Principal ou Oficial
      const userLeadingGuilds = allGuilds.filter(g => 
        g.leaderId === interaction.user.id || (g.officerIds && g.officerIds.includes(interaction.user.id))
      );
      if (userLeadingGuilds.length === 1) {
        targetGuild = userLeadingGuilds[0];
      } else if (userLeadingGuilds.length > 1) {
        const tags = userLeadingGuilds.map(g => `\`${g.tag}\``).join(', ');
        return interaction.editReply(`⚠️ Você faz parte da liderança de mais de uma guild (${tags}). Especifique a tag no parâmetro \`tag\`.`);
      }
    }

    // 2. Verificação de permissões: Deve ser Líder ou Oficial daquela guild, ou Staff/Admin
    const isStaff = member.roles.cache.has(config.roles.staff) || member.permissions.has(PermissionFlagsBits.Administrator);
    const isLider = targetGuild && targetGuild.leaderId === interaction.user.id;
    const isOficial = targetGuild && targetGuild.officerIds && targetGuild.officerIds.includes(interaction.user.id);

    if (!targetGuild) {
      if (isStaff) {
        return interaction.editReply('⚠️ Como Staff, por favor informe a tag da guild no parâmetro `tag` (ex: `/guild-remover usuario:@user tag:OLP`).');
      }
      return interaction.editReply('❌ Você não é Líder nem Oficial de nenhuma guild cadastrada.');
    }

    if (!isStaff && !isLider && !isOficial) {
      return interaction.editReply(`❌ Você não tem permissão para remover membros de **[${targetGuild.tag}] ${targetGuild.name}**.`);
    }

    // 3. Validações do jogador alvo
    if (targetUser.id === interaction.user.id) {
      return interaction.editReply('❌ Você não pode remover a si mesmo da sua própria guild.');
    }

    if (targetUser.id === targetGuild.leaderId) {
      return interaction.editReply('❌ Não é possível remover o Líder Principal da guild.');
    }

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.editReply('❌ Jogador não encontrado no servidor do Discord.');
    }

    const hasGuildRole = targetGuild.roleId && targetMember.roles.cache.has(targetGuild.roleId);
    if (!hasGuildRole) {
      return interaction.editReply(`❌ O jogador <@${targetUser.id}> não possui o cargo da guild **[${targetGuild.tag}] ${targetGuild.name}**.`);
    }

    // 4. Efetuar a remoção de cargos
    let rolesRemoved = [];
    try {
      // Remove o cargo da guild
      await targetMember.roles.remove(targetGuild.roleId);
      rolesRemoved.push(targetGuild.roleId);

      // Se for Oficial da guild, remove da lista de oficiais
      if (targetGuild.officerIds && targetGuild.officerIds.includes(targetUser.id)) {
        targetGuild.officerIds = targetGuild.officerIds.filter(id => id !== targetUser.id);
        saveGuilds(allGuilds);

        // Se não for oficial em nenhuma outra guild, remove cargo de Oficial
        const isOfficerElsewhere = allGuilds.some(g => g.id !== targetGuild.id && g.officerIds?.includes(targetUser.id));
        if (!isOfficerElsewhere && config?.roles?.oficial && targetMember.roles.cache.has(config.roles.oficial)) {
          await targetMember.roles.remove(config.roles.oficial).catch(() => {});
          rolesRemoved.push(config.roles.oficial);
        }

        // Remove permissões no canal de aprovações
        if (targetGuild.approvalsChannelId) {
          try {
            const chAprov = await guild.channels.fetch(targetGuild.approvalsChannelId);
            if (chAprov) await chAprov.permissionOverwrites.delete(targetUser.id).catch(() => {});
          } catch {}
        }
      }

      // Se for Shout Caller da guild, remove
      if (targetGuild.callerIds && targetGuild.callerIds.includes(targetUser.id)) {
        targetGuild.callerIds = targetGuild.callerIds.filter(id => id !== targetUser.id);
        saveGuilds(allGuilds);

        const isCallerElsewhere = allGuilds.some(g => g.id !== targetGuild.id && g.callerIds?.includes(targetUser.id));
        if (!isCallerElsewhere && config?.roles?.caller && targetMember.roles.cache.has(config.roles.caller)) {
          await targetMember.roles.remove(config.roles.caller).catch(() => {});
          rolesRemoved.push(config.roles.caller);
        }
      }

      // Se não pertencer a NENHUMA outra guild da Coalizão, remove Player Validado (revertendo a visitante)
      const otherGuildRoles = allGuilds.filter(g => g.id !== targetGuild.id).map(g => g.roleId);
      const hasOtherGuild = targetMember.roles.cache.some(r => otherGuildRoles.includes(r.id));
      if (!hasOtherGuild && config?.roles?.validado && targetMember.roles.cache.has(config.roles.validado)) {
        await targetMember.roles.remove(config.roles.validado).catch(() => {});
        rolesRemoved.push(config.roles.validado);
      }
    } catch (err) {
      console.error('[ERRO] Falha ao remover cargos do membro:', err);
      return interaction.editReply(`❌ Erro ao remover cargos do membro: ${err.message}`);
    }

    // 5. Atualizar cards e estatísticas
    if (config?.channels?.recrutamento) {
      guild.channels.fetch(config.channels.recrutamento).then(ch => {
        if (ch) updateSingleGuildCard(guild, ch, targetGuild);
      }).catch(() => {});
    }
    refreshServerStats(interaction.client).catch(() => {});

    // 6. Mensagem de confirmação
    const embedKick = new EmbedBuilder()
      .setTitle('🚪 Membro Desligado da Guild')
      .setDescription(
        `O jogador <@${targetUser.id}> foi removido de **[${targetGuild.tag}] ${targetGuild.name}**.\n\n` +
        `• **Jogador:** <@${targetUser.id}> (\`${targetUser.id}\`)\n` +
        `• **Guild:** \`[${targetGuild.tag}] ${targetGuild.name}\`\n` +
        `• **Motivo:** ${motivo}\n` +
        `• **Removido por:** <@${interaction.user.id}>\n\n` +
        `ℹ️ *O cargo de legião foi revogado e o contador do painel de recrutamento foi atualizado.*`
      )
      .setColor(Colors.Orange)
      .setTimestamp();

    await interaction.editReply({ embeds: [embedKick] });

    // Notificar o membro na DM com mensagem educada
    try {
      await targetUser.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`🚪 Desligamento de Legião — [${targetGuild.tag}] ${targetGuild.name}`)
            .setDescription(
              `Olá! Você foi desvinculado da legião **[${targetGuild.tag}] ${targetGuild.name}** no servidor **Vampir - Rust 2**.\n\n` +
              `• **Motivo informado:** ${motivo}\n` +
              `• **Liderança responsável:** <@${interaction.user.id}>\n\n` +
              `Caso queira ingressar em outra legião parceira, você pode se candidatar novamente através do canal <#${config.channels.recrutamento}>.`
            )
            .setColor(Colors.DarkRed)
            .setTimestamp()
        ]
      }).catch(() => {});
    } catch {}

    // Enviar log
    if (config?.channels?.logs) {
      guild.channels.fetch(config.channels.logs).then(ch => {
        if (ch) ch.send({ embeds: [embedKick] }).catch(() => {});
      }).catch(() => {});
    }

    return;
  }

  // --- /criar-palco ---
  if (commandName === 'criar-palco') {
    await interaction.deferReply({ ephemeral: true });

    const nomeInput = interaction.options.getString('nome') || 'Boss Geena';
    const isCommunity = guild.features.includes('COMMUNITY');

    if (!isCommunity) {
      return interaction.editReply(
        '⚠️ **Recurso de Comunidade Necessário no Servidor!**\n\n' +
        'No Discord, canais de palco oficiais (*Stage Channels*) exigem que o servidor tenha a função de **Comunidade** ativada.\n\n' +
        '**Como ativar em 30 segundos:**\n' +
        '1. Clique no nome do servidor (seta no topo) ➔ **Configurações do Servidor**\n' +
        '2. No menu lateral, clique em **Ativar Comunidade** ➔ Começar\n' +
        '3. Em Canal de Regras, marque `#📌・regras-e-diretrizes` e no de Notificações marque `#📊・logs-do-bot` ➔ Concluir!\n\n' +
        '*Obs: O canal de voz <#1565408234867662931> (`🎙️・Auditório ┃ Boss Geena`) já está configurado no modo palestra!*'
      );
    }

    try {
      const catComunidadeId = config?.categories?.comunidade;
      const stageChannel = await guild.channels.create({
        name: `🎭・Palco ┃ ${nomeInput}`,
        type: ChannelType.GuildStageVoice,
        parent: catComunidadeId,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: config.roles.validado, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect], deny: [PermissionFlagsBits.RequestToSpeak] },
          { id: config.roles.lider, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.RequestToSpeak] },
          { id: config.roles.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.MoveMembers] }
        ]
      });

      return interaction.editReply(`✅ **Canal de Palco criado com sucesso:** <#${stageChannel.id}>!`);
    } catch (err) {
      return interaction.editReply(`❌ Erro ao criar canal de palco: ${err.message}`);
    }
  }

  // --- /mover-auditorio ---
  if (commandName === 'mover-auditorio') {
    await interaction.deferReply({ ephemeral: false });

    const isStaffOrLeader = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
      interaction.member.permissions.has(PermissionFlagsBits.MoveMembers) ||
      (config?.roles?.staff && interaction.member.roles.cache.has(config.roles.staff)) ||
      (config?.roles?.lider && interaction.member.roles.cache.has(config.roles.lider)) ||
      (config?.roles?.oficial && interaction.member.roles.cache.has(config.roles.oficial));

    if (!isStaffOrLeader) {
      return interaction.editReply('❌ Você não tem permissão para mover membros.');
    }

    const ignorarAfk = interaction.options.getBoolean('ignorar_afk') ?? true;
    const destinoOption = interaction.options.getChannel('destino');

    let targetChannel = destinoOption;

    if (!targetChannel) {
      const channels = await guild.channels.fetch();
      targetChannel = channels.get('1565408234867662931') ||
        channels.find(c => c && (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) && c.name.toLowerCase().includes('auditório')) ||
        channels.find(c => c && (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) && c.name.toLowerCase().includes('auditorio'));
    }

    if (!targetChannel || (targetChannel.type !== ChannelType.GuildVoice && targetChannel.type !== ChannelType.GuildStageVoice)) {
      return interaction.editReply('❌ Canal de destino (Auditório) não encontrado ou não é um canal de voz/palco.');
    }

    try {
      await guild.members.fetch();
    } catch {}

    const afkChannelId = config?.channels?.vozAfk || '1565139452773277716';
    const membersToMove = [];
    let alreadyInChannel = 0;
    let afkCount = 0;

    for (const [_, member] of guild.members.cache) {
      const voiceChannel = member.voice?.channel;
      if (!voiceChannel) continue;

      if (voiceChannel.id === targetChannel.id) {
        alreadyInChannel++;
        continue;
      }

      const isAfkChannel = voiceChannel.id === afkChannelId ||
        voiceChannel.name.toLowerCase().includes('afk') ||
        voiceChannel.name.toLowerCase().includes('ausente');

      if (ignorarAfk && isAfkChannel) {
        afkCount++;
        continue;
      }

      membersToMove.push(member);
    }

    if (membersToMove.length === 0) {
      return interaction.editReply(
        `🎙️ **Nenhum membro precisava ser movido!**\n` +
        `• Já presentes em <#${targetChannel.id}>: **${alreadyInChannel}**\n` +
        (afkCount > 0 ? `• Sala AFK (ignorados): **${afkCount}**` : '')
      );
    }

    await interaction.editReply(`🎙️ Movendo **${membersToMove.length}** membros para <#${targetChannel.id}>...`);

    let movedCount = 0;
    let failCount = 0;

    for (const member of membersToMove) {
      try {
        await member.voice.setChannel(targetChannel.id);
        movedCount++;
        await new Promise(r => setTimeout(r, 150));
      } catch (err) {
        failCount++;
      }
    }

    const embedResult = new EmbedBuilder()
      .setTitle('🎙️ Convocação Geral para o Auditório')
      .setDescription(
        `Membros em canais de voz foram transferidos para o canal oficial de comando da raid!\n\n` +
        `• 📍 **Canal de Destino:** <#${targetChannel.id}>\n` +
        `• 👥 **Membros Movidos:** **${movedCount}**\n` +
        (alreadyInChannel > 0 ? `• 🟢 **Já estavam presentes:** **${alreadyInChannel}**\n` : '') +
        (ignorarAfk && afkCount > 0 ? `• 💤 **Mantidos na sala AFK:** **${afkCount}**\n` : '') +
        (failCount > 0 ? `• ⚠️ **Falhas/Impedidos:** **${failCount}**\n` : '') +
        `• 👑 **Comando acionado por:** <@${interaction.user.id}>`
      )
      .setColor(Colors.Green)
      .setTimestamp();

    return interaction.editReply({ content: null, embeds: [embedResult] });
  }

  // --- /boss-respawn ---
  if (commandName === 'boss-respawn') {
    await interaction.deferReply({ ephemeral: true });

    const bossId = interaction.options.getString('boss');
    const horarioStr = interaction.options.getString('horario');

    const targetDate = parseTimeInput(horarioStr);
    if (!targetDate) {
      return interaction.editReply('❌ Formato de horário inválido! Utilize formato exato como `18:30`, `21:46` ou relativo como `45m`, `1h 30m`.');
    }

    const bossData = getBossData();
    const boss = bossData.mapBosses.find(b => b.id === bossId);
    if (!boss) return interaction.editReply('❌ Boss não encontrado.');

    boss.status = 'dead';
    boss.spawnedAt = null;
    boss.nextSpawn = targetDate.toISOString();
    boss.alertsSent = {};
    saveBossData(bossData);

    const ts = Math.floor(targetDate.getTime() / 1000);

    if (config?.channels?.boss) {
      guild.channels.fetch(config.channels.boss).then(ch => {
        if (ch) renderOrUpdateBossPanel(guild, ch);
      }).catch(() => {});
    }

    if (config?.channels?.logs) {
      guild.channels.fetch(config.channels.logs).then(ch => {
        if (ch) {
          ch.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('⏳ Respawn de Boss Agendado')
                .setDescription(`O jogador <@${interaction.user.id}> registrou o respawn de **[Nv. ${boss.level}] ${boss.name}** para <t:${ts}:t> (<t:${ts}:R>).`)
                .setColor(Colors.Gold)
                .setTimestamp()
            ]
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    const embedRespawn = new EmbedBuilder()
      .setTitle('⏳ Respawn de Boss Registrado!')
      .setDescription(
        `• **Boss:** [Nv. ${boss.level}] **${boss.name}**\n` +
        `• **Local:** \`${boss.territory} — ${boss.location}\`\n` +
        `• **Próximo Respawn:** <t:${ts}:t> (<t:${ts}:R>)\n\n` +
        `*O painel em <#${config.channels.boss}> foi atualizado. Alertas automáticos serão enviados em <#${config.channels.alertasBoss || config.channels.anuncios}> faltando 30m, 5m e no spawn!*`
      )
      .setColor(Colors.Green)
      .setTimestamp();

    return interaction.editReply({ embeds: [embedRespawn] });
  }

  // --- /boss-morto ---
  if (commandName === 'boss-morto') {
    await interaction.deferReply({ ephemeral: true });

    const bossId = interaction.options.getString('boss');
    const respawnStr = interaction.options.getString('respawn');

    const bossData = getBossData();
    const boss = bossData.mapBosses.find(b => b.id === bossId);
    if (!boss) return interaction.editReply('❌ Boss não encontrado.');

    boss.status = 'dead';
    boss.spawnedAt = null;
    boss.alertsSent = {};

    let ts = null;
    if (boss.schedule && boss.schedule.length > 0) {
      const sched = getFixedScheduleStatus(boss.schedule);
      boss.nextSpawn = sched.nextSpawn.toISOString();
      ts = Math.floor(sched.nextSpawn.getTime() / 1000);
    } else if (respawnStr) {
      const targetDate = parseTimeInput(respawnStr);
      if (targetDate) {
        boss.nextSpawn = targetDate.toISOString();
        ts = Math.floor(targetDate.getTime() / 1000);
      }
    } else {
      boss.nextSpawn = null;
    }
    saveBossData(bossData);

    if (config?.channels?.boss) {
      guild.channels.fetch(config.channels.boss).then(ch => {
        if (ch) renderOrUpdateBossPanel(guild, ch);
      }).catch(() => {});
    }

    const desc = ts
      ? `• **Boss:** [Nv. ${boss.level}] **${boss.name}**\n• **Status:** 🔴 MORTO\n• **Respawn previsto:** <t:${ts}:t> (<t:${ts}:R>)` + (boss.schedule ? ` *(Fixo diário: ${boss.schedule.join(' • ')})*` : '')
      : `• **Boss:** [Nv. ${boss.level}] **${boss.name}**\n• **Status:** 🔴 MORTO\n• *(Utilize \`/boss-respawn\` assim que tiver o horário do mapa)*`;

    const embedMorto = new EmbedBuilder()
      .setTitle('☠️ Boss Marcado como Derrotado')
      .setDescription(desc)
      .setColor(Colors.DarkRed)
      .setTimestamp();

    return interaction.editReply({ embeds: [embedMorto] });
  }

  // --- /boss-vivo ---
  if (commandName === 'boss-vivo') {
    await interaction.deferReply({ ephemeral: true });

    const bossId = interaction.options.getString('boss');
    const bossData = getBossData();
    const boss = bossData.mapBosses.find(b => b.id === bossId);
    if (!boss) return interaction.editReply('❌ Boss não encontrado.');

    boss.status = 'alive';
    boss.spawnedAt = new Date().toISOString();
    boss.nextSpawn = null;
    boss.alertsSent = {};
    saveBossData(bossData);

    if (config?.channels?.boss) {
      guild.channels.fetch(config.channels.boss).then(ch => {
        if (ch) renderOrUpdateBossPanel(guild, ch);
      }).catch(() => {});
    }

    const embedVivo = new EmbedBuilder()
      .setTitle('🟢 Boss Marcado como VIVO / SPAWNADO')
      .setDescription(
        `• **Boss:** [Nv. ${boss.level}] **${boss.name}**\n` +
        `• **Local:** \`${boss.territory} — ${boss.location}\`\n` +
        `• **Status:** 🟢 **VIVO NO MAPA**\n\n` +
        `⏱️ *O status permanecerá como VIVO durante a janela de 10 minutos e voltará automaticamente para MORTO.*`
      )
      .setColor(Colors.Green)
      .setTimestamp();

    return interaction.editReply({ embeds: [embedVivo] });
  }

  // --- /boss-painel ---
  if (commandName === 'boss-painel') {
    await interaction.deferReply({ ephemeral: true });

    if (config?.channels?.boss) {
      const chBoss = await guild.channels.fetch(config.channels.boss).catch(() => null);
      if (chBoss) {
        await renderOrUpdateBossPanel(guild, chBoss);
        return interaction.editReply('✅ Painel de Boss Timers atualizado com sucesso em <#' + chBoss.id + '>!');
      }
    }
    return interaction.editReply('❌ Canal de boss timers não configurado.');
  }

  // --- /listar-guilds ---
  if (commandName === 'listar-guilds') {
    const guildsList = getGuilds();
    if (guildsList.length === 0) {
      return interaction.reply({ content: 'Nenhuma guild cadastrada ainda no sistema.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🏰 Guilds Parceiras Cadastradas')
      .setColor(Colors.DarkBlue)
      .setDescription(
        guildsList.map(g => `• **[${g.tag}] ${g.name}** — Líder: <@${g.leaderId}> (Cargo: <@&${g.roleId}>)`).join('\n\n')
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // --- /painel-recrutamento ---
  if (commandName === 'painel-recrutamento') {
    await interaction.deferReply({ ephemeral: true });
    if (!config || !config.channels || !config.channels.recrutamento) {
      return interaction.editReply('Erro: Canal de recrutamento não encontrado nas configurações.');
    }

    const chRecrutamento = await guild.channels.fetch(config.channels.recrutamento);
    await renderRecruitmentPanel(guild, chRecrutamento);

    return interaction.editReply('✅ Painel de recrutamento atualizado com sucesso!');
  }

  // --- /criar-guild ---
  if (commandName === 'criar-guild') {
    await interaction.deferReply({ ephemeral: true });

    const nome = interaction.options.getString('nome').trim();
    const tag = interaction.options.getString('tag').toUpperCase().trim();
    const liderUser = interaction.options.getUser('lider');
    const descricao = interaction.options.getString('descricao') || 'Legião oficial da comunidade Vampir.';
    const corInput = interaction.options.getString('cor') || '#9B59B6';
    const iconeUrl = interaction.options.getString('icone_url') || null;
    const validColor = parseHexColor(corInput);

    const guildSlug = `guild_${Date.now()}`;

    try {
      const roleGuild = await guild.roles.create({
        name: `[🏰] [${tag}] ${nome}`,
        color: validColor,
        hoist: true,
        reason: `Cargo da Guild ${nome}`
      });

      const liderMember = await guild.members.fetch(liderUser.id);
      if (liderMember) {
        await liderMember.roles.add(roleGuild);
        if (config?.roles?.lider) await liderMember.roles.add(config.roles.lider);
        if (config?.roles?.validado) await liderMember.roles.add(config.roles.validado);
      }

      const everyoneRole = guild.roles.everyone;
      const staffRoleId = config?.roles?.staff;
      const validadoRoleId = config?.roles?.validado;

      const categoryGuild = await guild.channels.create({
        name: `🏰 │ [${tag}] ${nome}`,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
          ...(validadoRoleId ? [{ id: validadoRoleId, deny: [PermissionFlagsBits.ViewChannel] }] : []),
          ...(staffRoleId ? [{ id: staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
          {
            id: roleGuild.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak
            ]
          }
        ]
      });

      const chAprovacoes = await guild.channels.create({
        name: '📋・aprovações',
        type: ChannelType.GuildText,
        parent: categoryGuild.id,
        permissionOverwrites: [
          { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: roleGuild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: liderUser.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          ...(staffRoleId ? [{ id: staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : [])
        ]
      });

      const chChatInterno = await guild.channels.create({
        name: '💬・chat-interno',
        type: ChannelType.GuildText,
        parent: categoryGuild.id
      });

      const chAvisos = await guild.channels.create({
        name: '📢・avisos-internos',
        type: ChannelType.GuildText,
        parent: categoryGuild.id
      });

      const chValidacaoGeena = await guild.channels.create({
        name: '✅・validação-geena',
        type: ChannelType.GuildText,
        parent: categoryGuild.id,
        permissionOverwrites: [
          { id: everyoneRole.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: roleGuild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: liderUser.id, type: 1, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          ...(staffRoleId ? [{ id: staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }] : []),
          { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageMessages] }
        ]
      });

      const chVozSquad = await guild.channels.create({
        name: '🔊・Squad 1',
        type: ChannelType.GuildVoice,
        parent: categoryGuild.id,
        userLimit: 0
      });

      // Configura permissões nos canais da Coalizão para a nova guild
      try {
        const comCatId = config?.categories?.comunidade || '1565129733208014879';
        const catCom = await guild.channels.fetch(comCatId).catch(() => null);
        if (catCom) await catCom.permissionOverwrites.edit(roleGuild.id, { ViewChannel: true }).catch(() => {});

        const auditorioId = '1565408234867662931';
        const chAud = await guild.channels.fetch(auditorioId).catch(() => null);
        if (chAud) await chAud.permissionOverwrites.edit(roleGuild.id, { ViewChannel: true, Connect: true }).catch(() => {});

        if (config?.channels?.checkinGeena) {
          const chCheck = await guild.channels.fetch(config.channels.checkinGeena).catch(() => null);
          if (chCheck) await chCheck.permissionOverwrites.edit(roleGuild.id, { ViewChannel: true, SendMessages: true, AttachFiles: true, ReadMessageHistory: true }).catch(() => {});
        }

        if (config?.channels?.painelPresencas) {
          const chP = await guild.channels.fetch(config.channels.painelPresencas).catch(() => null);
          if (chP) await chP.permissionOverwrites.edit(roleGuild.id, { ViewChannel: true, ReadMessageHistory: true, SendMessages: false }).catch(() => {});
        }
      } catch (err) {
        console.warn('[CRIAR-GUILD] Aviso ao ajustar permissões de coalizão:', err.message);
      }

      const newGuildData = {
        id: guildSlug,
        name: nome,
        tag,
        leaderId: liderUser.id,
        roleId: roleGuild.id,
        categoryId: categoryGuild.id,
        approvalsChannelId: chAprovacoes.id,
        chatChannelId: chChatInterno.id,
        attendanceValidationChannelId: chValidacaoGeena.id,
        description: descricao,
        color: corInput,
        iconUrl: iconeUrl,
        createdAt: new Date().toISOString()
      };

      addGuild(newGuildData);
      refreshServerStats(interaction.client).catch(() => {});

      await interaction.editReply(
        `✅ **Guild [${tag}] ${nome} cadastrada com sucesso!**\n` +
        `• Cargo criado: <@&${roleGuild.id}>\n` +
        `• Categoria criada: <#${categoryGuild.id}>\n` +
        `• Canal de aprovações privado do líder: <#${chAprovacoes.id}>\n` +
        `• Painel de recrutamento público atualizado!`
      );

      if (config?.channels?.recrutamento) {
        guild.channels.fetch(config.channels.recrutamento).then(ch => {
          if (ch) renderRecruitmentPanel(guild, ch);
        }).catch(() => {});
      }

      if (config?.channels?.logs) {
        guild.channels.fetch(config.channels.logs).then(ch => {
          if (ch) {
            ch.send({
              embeds: [
                new EmbedBuilder()
                  .setTitle('🛡️ Nova Guild Homologada')
                  .setDescription(`A guild **[${tag}] ${nome}** foi criada com sucesso no servidor!\n• **Líder:** <@${liderUser.id}>\n• **Cargo:** <@&${roleGuild.id}>\n• **Canal de Aplicações:** <#${chAprovacoes.id}>`)
                  .setColor(Colors.Green)
                  .setTimestamp()
              ]
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[ERRO] Falha ao criar guild:', err);
      return interaction.editReply(`❌ Ocorreu um erro ao criar a guild: ${err.message}`);
    }
  }

  // --- /presenca (Submissão Individual com Print) ---
  if (commandName === 'presenca') {
    const printAttachment = interaction.options.getAttachment('print');
    const rawTipo = interaction.options.getString('tipo');
    const dono = interaction.options.getUser('dono');
    const evento = interaction.options.getString('evento');
    const observacao = interaction.options.getString('observacao');

    if (!printAttachment) {
      return interaction.reply({
        content: '❌ É obrigatório anexar o print da tela do jogo comprovando sua presença!',
        ephemeral: true
      });
    }

    const contentType = printAttachment.contentType || '';
    if (!contentType.startsWith('image/') && !printAttachment.name.match(/\.(png|jpg|jpeg|webp)$/i)) {
      return interaction.reply({
        content: '❌ O arquivo anexado deve ser uma imagem válida (PNG, JPG, WEBP)!',
        ephemeral: true
      });
    }

    // Se marcou piloto explicitamente mas não passou o dono
    if (rawTipo === 'piloto' && !dono) {
      return interaction.reply({
        content: '❌ Como você selecionou **Piloto**, é obrigatório marcar o **Dono do Personagem** no campo `dono`!',
        ephemeral: true
      });
    }

    // Identifica se é piloto: ou marcou piloto com dono, ou indicou um dono diferente de si mesmo
    const isPilot = rawTipo === 'piloto' || (dono && dono.id !== member.id);
    const ownerUser = isPilot ? dono : null;

    await interaction.deferReply({ ephemeral: true });

    const result = await submitAttendance({
      discordGuild: guild,
      submitterMember: member,
      isPilot,
      ownerUser,
      printUrl: printAttachment.url,
      eventKey: evento,
      note: observacao
    });

    if (!result.success) {
      return interaction.editReply(result.error);
    }

    const embedSuccess = new EmbedBuilder()
      .setTitle('📸 Comprovante de Presença Enviado com Sucesso!')
      .setDescription(
        `Sua presença no evento **${result.submission.eventName}** foi submetida!\n\n` +
        `👤 **Tipo de Presença:** ${result.submission.isPilot ? '🎮 Piloto' : '🛡️ Titular'}\n` +
        `👑 **Beneficiário (Dono da Conta):** <@${result.submission.ownerUserId}>\n` +
        `🏰 **Guild Responsável:** \`[${result.targetGuild.tag}] ${result.targetGuild.name}\`\n\n` +
        `⏳ *O print foi encaminhado para o canal interno da liderança da sua guild. Assim que for validado, você receberá a confirmação!*`
      )
      .setColor(Colors.Green)
      .setThumbnail(printAttachment.url)
      .setFooter({ text: `ID da Submissão: ${result.submission.id}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embedSuccess] });
  }

  // --- /estender-presenca (Staff e Líderes) ---
  if (commandName === 'estender-presenca') {
    const isStaff = member.permissions.has(PermissionFlagsBits.Administrator) ||
                    (config?.roles?.staff && member.roles.cache.has(config.roles.staff));
    const isLider = config?.roles?.lider && member.roles.cache.has(config.roles.lider);
    const isOficial = config?.roles?.oficial && member.roles.cache.has(config.roles.oficial);

    if (!isStaff && !isLider && !isOficial) {
      return interaction.reply({
        content: '❌ **Permissão negada:** Apenas a Staff, Líderes de Guild e Oficiais podem estender o tempo do check-in.',
        ephemeral: true
      });
    }

    const minutos = interaction.options.getInteger('minutos') || 30;
    const motivo = interaction.options.getString('motivo') || '';

    await interaction.deferReply({ ephemeral: false });

    const result = extendGeenaWindow({
      minutes: minutos,
      executorUser: interaction.user,
      reason: motivo
    });

    // Atualiza o banner do canal de check-in imediatamente
    if (config?.channels?.checkinGeena) {
      const chCheckin = await guild.channels.fetch(config.channels.checkinGeena).catch(() => null);
      if (chCheckin) await renderOrUpdateCheckinBanner(guild, chCheckin).catch(() => {});
    }

    const embedExt = new EmbedBuilder()
      .setTitle('⏳ JANELA DE CHECK-IN ESTENDIDA COM SUCESSO!')
      .setDescription(
        `A janela de marcação de presença para **${result.name}** foi prorrogada!\n\n` +
        `⏱️ **Tempo Adicionado:** \`+${minutos} minutos\`\n` +
        `🔒 **Novo Horário de Fechamento:** às **${result.closesAt}** (Restam ~**${result.minutesTotalLeft} minutos**)\n` +
        `🛡️ **Autorizado por:** <@${interaction.user.id}>\n` +
        (motivo ? `📝 **Motivo:** *${motivo}*\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*O banner em <#${config?.channels?.checkinGeena}> já foi atualizado com o novo tempo.*`
      )
      .setColor(Colors.Green)
      .setTimestamp();

    return interaction.editReply({ embeds: [embedExt] });
  }

  // --- /presenca-painel (Staff/Admin) ---
  if (commandName === 'presenca-painel') {
    if (!member.permissions.has(PermissionFlagsBits.Administrator) && !member.roles.cache.has(config.roles.staff)) {
      return interaction.reply({ content: '❌ Apenas a Staff pode forçar a atualização do painel.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    await renderOrUpdatePresencePanel(guild);
    return interaction.editReply('✅ Painel de presenças de Geena atualizado com sucesso!');
  }

  // --- /presenca-dkp-auditorio ---
  if (commandName === 'presenca-dkp-auditorio') {
    // Verificação de permissões: Staff, Líder ou Oficial
    const isStaff = member.roles.cache.has(config.roles.staff) || member.permissions.has(PermissionFlagsBits.Administrator);
    const isLider = member.roles.cache.has(config.roles.lider);
    const isOficial = member.roles.cache.has(config.roles.oficial);

    if (!isStaff && !isLider && !isOficial) {
      return interaction.reply({
        content: '❌ **Permissão negada:** Apenas Líderes de Guild, Oficiais ou Staff podem registrar presença.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: false });

    // Localizar canal do Auditório
    const auditorioChannelId = '1565408234867662931';
    let chAuditorio = guild.channels.cache.get(auditorioChannelId);
    if (!chAuditorio) {
      chAuditorio = await guild.channels.fetch(auditorioChannelId).catch(() => null);
    }

    if (!chAuditorio || !chAuditorio.isVoiceBased()) {
      return interaction.editReply('❌ Canal de voz do Auditório (`1565408234867662931`) não foi encontrado.');
    }

    const eventChoice = interaction.options.getString('evento');
    const customDkp = interaction.options.getInteger('dkp_manual');
    const motivo = interaction.options.getString('motivo');

    const result = await recordAttendance({
      voiceChannel: chAuditorio,
      eventChoice,
      customDkp,
      executorUser: interaction.user,
      note: motivo
    });

    if (!result.success) {
      return interaction.editReply(`❌ ${result.error}`);
    }

    // Montar lista de participantes com formatação limpa
    let membersDesc = result.members.map(m => `• <@${m.id}> ➔ \`${m.newTotal} DKP\` (+${result.dkpAwarded})`).join('\n');
    if (membersDesc.length > 3000) {
      membersDesc = membersDesc.slice(0, 3000) + `\n... e mais ${result.totalCount - 40} jogadores.`;
    }

    const embedPresenca = new EmbedBuilder()
      .setTitle('👑 REGISTRO DE PRESENÇA ┃ DKP COALIZÃO')
      .setDescription(
        `Presença computada com sucesso para todos os integrantes no Auditório!\n\n` +
        `⚔️ **Evento:** \`${result.eventName}\`\n` +
        `💎 **Pontuação Creditada:** \`+${result.dkpAwarded} DKP\` para cada jogador\n` +
        `👥 **Total de Presentes:** \`${result.totalCount} membros\`\n` +
        `🛡️ **Registrado por:** <@${interaction.user.id}>\n` +
        (motivo ? `📝 **Observação:** ${motivo}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `### 📋 Integrantes Presentes:\n${membersDesc}`
      )
      .setColor(Colors.Gold)
      .setFooter({ text: 'Vampir DKP System • Auditório Boss Geena' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embedPresenca] });

    if (config?.channels?.logs) {
      guild.channels.fetch(config.channels.logs).then(ch => {
        if (ch) ch.send({ embeds: [embedPresenca] }).catch(() => {});
      }).catch(() => {});
    }
    return;
  }

  // --- /dkp ---
  if (commandName === 'dkp') {
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const data = getUserDkp(targetUser.id);

    const embedDkp = new EmbedBuilder()
      .setTitle(`💎 Extrato de DKP ┃ ${targetUser.username}`)
      .setColor(Colors.Purple)
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp();

    if (!data || data.totalDkp === 0) {
      embedDkp.setDescription(
        `O jogador <@${targetUser.id}> ainda não possui pontos de DKP registrados.\n\n` +
        `• **Saldo Atual:** \`0 DKP\`\n` +
        `• **Eventos Participados:** \`0\`\n\n` +
        `*Participe das invasões de Geena no Auditório para pontuar!*`
      );
    } else {
      const lastDateTs = data.lastDate ? Math.floor(new Date(data.lastDate).getTime() / 1000) : null;
      embedDkp.setDescription(
        `Extrato de pontuação da Coalizão Vampir:\n\n` +
        `💰 **Saldo Total de DKP:** \`${data.totalDkp} DKP\`\n` +
        `⚔️ **Presenças Registradas:** \`${data.eventsAttended} raids\`\n` +
        `🎯 **Último Evento:** \`${data.lastEvent || 'N/A'}\` ${lastDateTs ? `(<t:${lastDateTs}:R>)` : ''}\n\n` +
        `*Os pontos de DKP são computados automaticamente nas calls do Auditório.*`
      );
    }

    return interaction.reply({ embeds: [embedDkp] });
  }

  // --- /dkp-ranking ---
  if (commandName === 'dkp-ranking') {
    const ranking = getDkpRanking(15);

    const embedRanking = new EmbedBuilder()
      .setTitle('🏆 RANKING GERAL DE DKP ┃ COALIZÃO VAMPIR')
      .setColor(Colors.DarkGold)
      .setFooter({ text: 'Atualizado em tempo real • Vampir Boss Tracker' })
      .setTimestamp();

    if (ranking.length === 0) {
      embedRanking.setDescription('Nenhum registro de DKP foi realizado ainda.');
      return interaction.reply({ embeds: [embedRanking] });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = ranking.map((entry, index) => {
      const rankBadge = index < 3 ? medals[index] : `**#${index + 1}**`;
      return `${rankBadge} <@${entry.userId}> ➔ **\`${entry.totalDkp} DKP\`** *(${entry.eventsAttended || 1} presenças)*`;
    });

    embedRanking.setDescription(
      'Abaixo estão os membros com maior participação nos Bosses e Raids da Coalizão:\n\n' +
      lines.join('\n')
    );

    return interaction.reply({ embeds: [embedRanking] });
  }

  // --- /overlay ---
  if (commandName === 'overlay') {
    const res = createAuthResponse(member);
    if (!res.success) {
      return interaction.reply({ content: res.message, ephemeral: true });
    }
    return interaction.reply({ embeds: res.embeds, components: res.components, ephemeral: true });
  }

  // --- /painel-overlay ---
  if (commandName === 'painel-overlay') {
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Apenas Administradores podem usar este comando.', ephemeral: true });
    }
    await renderOverlayPanel(interaction.channel);
    return interaction.reply({ content: '✅ Painel do Overlay Tático enviado com sucesso neste canal!', ephemeral: true });
  }
}

module.exports = { handleCommand };
