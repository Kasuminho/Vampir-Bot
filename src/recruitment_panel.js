const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  Colors 
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getGuilds, saveGuilds, getServerConfig, getApplications, saveApplications } = require('./data_manager');

function buildGuildEmbedAndRow(discordGuild, g, memberCount) {
  let embedColor = Colors.Purple;
  if (g.color) {
    try {
      const cleanHex = g.color.replace('#', '');
      const parsed = parseInt(cleanHex, 16);
      if (!isNaN(parsed)) embedColor = parsed;
    } catch {}
  }

  const guildEmbed = new EmbedBuilder()
    .setTitle(`[${g.tag}] ${g.name}`)
    .setDescription(g.description || 'Legião parceira oficial da comunidade Vampir.')
    .setColor(embedColor)
    .addFields(
      { name: '👑 Liderança', value: `<@${g.leaderId}>`, inline: true },
      { name: '👥 Integrantes', value: `\`${memberCount} membros\``, inline: true },
      { name: '🏷️ Tag', value: `\`[${g.tag}]\``, inline: true }
    );

  if (g.officerIds && g.officerIds.length > 0) {
    guildEmbed.addFields({
      name: '🎖️ Staff / Oficiais',
      value: g.officerIds.map(id => `<@${id}>`).join(' • '),
      inline: false
    });
  }

  guildEmbed
    .setFooter({ text: `ID do Clã: ${g.id} • Clique abaixo para ingressar` })
    .setTimestamp();

  if (g.iconUrl && typeof g.iconUrl === 'string' && g.iconUrl.startsWith('http')) {
    try {
      guildEmbed.setThumbnail(g.iconUrl);
    } catch {}
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`apply_guild_${g.id}`)
      .setLabel(`✉️ Aplicar para ${g.tag}`)
      .setStyle(ButtonStyle.Primary)
  );

  return { embed: guildEmbed, row };
}

async function renderRecruitmentPanel(discordGuild, targetChannel) {
  const registeredGuilds = getGuilds();
  const config = getServerConfig();

  // 1. Manter Header Fixo (apenas edita se já existir)
  const badgeUrl = 'https://img.shields.io/endpoint.png?url=https%3A%2F%2Fhealthchecks.io%2Fb%2F2%2F2add8f15-a9ce-4fcc-8bd2-98fd09186060.shields&style=for-the-badge';

  const headerEmbed = new EmbedBuilder()
    .setTitle('🩸 ─── COALIZÃO OFICIAL RUST 2 ┃ RECRUTAMENTO DE GUILDS ─── 🩸')
    .setDescription(
      'Bem-vindo ao centro oficial de recrutamento da **Coalizão Vampir**!\n\n' +
      '### 🏰 Legiões da Coalizão Oficial:\n' +
      '• ⚔️ **Servidor Rust 2:** `OLIMPO` • `No Mercy` • `NightFall` • `Kontrabandz` • `Aftermath` • `Fusion`\n' +
      '• 🛡️ **Servidor Rust 1 (Aliada Oficial):** `CHAPA1`\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '### 📋 Como Funciona a Candidatura:\n' +
      '1. Escolha a legião desejada no catálogo abaixo e clique em **`✉️ Aplicar para [TAG]`**.\n' +
      '2. Preencha seus dados de jogo (*Nick, Classe e Experiência*).\n' +
      '3. Sua ficha é enviada diretamente e em tempo real para o canal privado da **Liderança da Guild**.\n' +
      '4. O **Líder e os Oficiais** daquela legião específica são os únicos responsáveis por avaliar, entrevistar e aprovar sua entrada!\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '### ⏳ Regra da Fila de Espera (4 Horas):\n' +
      '• Caso a guild para a qual você aplicou **não responda em até 4 horas**, sua candidatura será transferida automaticamente para a **Fila de Espera Compartilhada da Coalizão**.\n' +
      '• A partir desse momento, a liderança de **todas as outras guilds parceiras** terá acesso à sua ficha e poderá entrar em contato direto com você para convidá-lo!\n\n' +
      '⚠️ *Apenas membros com tag de guild da Coalizão têm acesso ao Auditório de Bosses, Builds e salas táticas.*'
    )
    .setImage(badgeUrl)
    .setColor(Colors.DarkRed)
    .setFooter({ text: 'Monitoramento de Uptime ativo • Selecione sua guild abaixo para aplicar' })
    .setTimestamp();

  let headerMsg = null;
  if (config?.channels?.headerMessageId) {
    headerMsg = await targetChannel.messages.fetch(config.channels.headerMessageId).catch(() => null);
  }

  if (headerMsg) {
    await headerMsg.edit({ embeds: [headerEmbed] }).catch(() => {});
  } else {
    headerMsg = await targetChannel.send({ embeds: [headerEmbed] }).catch(() => null);
    if (headerMsg && config?.channels) {
      config.channels.headerMessageId = headerMsg.id;
      const configPath = path.join(__dirname, '..', 'data', 'server_config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
  }

  // 2. Renderizar ou Editar cada card de guild individualmente
  let guildsChanged = false;
  await discordGuild.members.fetch().catch(() => {});

  for (const g of registeredGuilds) {
    let memberCount = 0;
    try {
      const role = await discordGuild.roles.fetch(g.roleId);
      if (role) memberCount = role.members.size;
    } catch {
      memberCount = 0;
    }

    const { embed, row } = buildGuildEmbedAndRow(discordGuild, g, memberCount);

    let cardMsg = null;
    if (g.recruitmentMessageId) {
      cardMsg = await targetChannel.messages.fetch(g.recruitmentMessageId).catch(() => null);
    }

    if (cardMsg) {
      // APENAS EDITA A MENSAGEM EXISTENTE (IN-PLACE)!
      await cardMsg.edit({ embeds: [embed], components: [row] }).catch(() => {});
    } else {
      // Se não existe a mensagem, envia uma vez e salva o ID
      cardMsg = await targetChannel.send({ embeds: [embed], components: [row] }).catch(() => null);
      if (cardMsg) {
        g.recruitmentMessageId = cardMsg.id;
        guildsChanged = true;
      }
    }
  }

  if (guildsChanged) {
    saveGuilds(registeredGuilds);
  }
}

async function updateSingleGuildCard(discordGuild, targetChannel, guildData) {
  let memberCount = 0;
  try {
    await discordGuild.members.fetch().catch(() => {});
    const role = await discordGuild.roles.fetch(guildData.roleId);
    if (role) memberCount = role.members.size;
  } catch {}

  const { embed, row } = buildGuildEmbedAndRow(discordGuild, guildData, memberCount);

  if (guildData.recruitmentMessageId) {
    try {
      const msg = await targetChannel.messages.fetch(guildData.recruitmentMessageId);
      if (msg) {
        await msg.edit({ embeds: [embed], components: [row] });
        return;
      }
    } catch {}
  }

  // Se a mensagem específica não foi encontrada, faz sincronização geral
  await renderRecruitmentPanel(discordGuild, targetChannel);
}

module.exports = { renderRecruitmentPanel, updateSingleGuildCard };
