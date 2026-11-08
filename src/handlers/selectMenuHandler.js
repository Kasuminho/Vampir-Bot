const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const {
  getGuilds,
  findGuildById
} = require('../data_manager');
const { renderOrUpdatePresencePanel } = require('../attendance_manager');

/**
 * Roteia e trata todas as interações de Select Menu (interaction.isStringSelectMenu())
 */
async function handleSelectMenu(interaction) {
  const { customId, values } = interaction;

  // --- FILTRO DE GUILD NO PAINEL DE PRESENÇA ---
  if (customId === 'select_attendance_guild_filter') {
    const selectedGuildId = values[0];
    await interaction.deferUpdate();
    await renderOrUpdatePresencePanel(interaction.guild, interaction.channel, selectedGuildId);
    return;
  }

  // --- SELEÇÃO DE GUILD DE DESTINO PARA TRANSFERÊNCIA ---
  if (customId === 'select_transfer_destination_guild') {
    const selectedGuildId = values[0];
    const targetGuild = findGuildById(selectedGuildId);

    if (!targetGuild) {
      return interaction.reply({
        content: '❌ Guild não encontrada no sistema. Avise um administrador.',
        ephemeral: true
      });
    }

    const member = interaction.member;
    const allGuilds = getGuilds();

    // 1. Identificar se o usuário já possui a guild selecionada
    if (targetGuild.roleId && member.roles.cache.has(targetGuild.roleId)) {
      return interaction.reply({
        content: `⚠️ Você já é integrante da guild **[${targetGuild.tag}] ${targetGuild.name}**! Selecione uma guilda diferente para solicitar transferência.`,
        ephemeral: true
      });
    }

    // 2. Identificar qual a guilda atual do membro
    const currentGuild = allGuilds.find(g => g.roleId && member.roles.cache.has(g.roleId));
    if (!currentGuild) {
      return interaction.reply({
        content: `⚠️ Você ainda não faz parte de nenhuma guild parceira!\nPara ingressar na sua primeira guilda, envie sua candidatura através do canal <#1565129731970695188> (\`#🏰・recrutamento-guilds\`).`,
        ephemeral: true
      });
    }

    // 3. Montar Modal com dados já amarrados e seguros
    const modal = new ModalBuilder()
      .setCustomId(`modal_transfer:${targetGuild.id}:${currentGuild.id}`)
      .setTitle(`Transferência: [${targetGuild.tag}] ${targetGuild.name}`.slice(0, 45));

    const inputNickClasse = new TextInputBuilder()
      .setCustomId('nick_classe')
      .setLabel('Seu Nick exato in-game e Classe/Level:')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: BloodSlayer - Bloodstained Lv 68')
      .setRequired(true)
      .setMaxLength(60);

    const inputMotivo = new TextInputBuilder()
      .setCustomId('motivo')
      .setLabel(`Motivo & Já avisou a liderança da [${currentGuild.tag}]?`)
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(`Explique o motivo da migração para [${targetGuild.tag}] e confirme se a liderança da [${currentGuild.tag}] já está ciente.`)
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder().addComponents(inputNickClasse),
      new ActionRowBuilder().addComponents(inputMotivo)
    );

    return interaction.showModal(modal);
  }
}

module.exports = { handleSelectMenu };
