const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  Colors
} = require('discord.js');
const { getGuilds, getServerConfig, saveServerConfig } = require('./data_manager');

/**
 * Monta o embed e o select menu oficial da Central de Transferências
 */
function buildTransferPanel(registeredGuilds) {
  const embed = new EmbedBuilder()
    .setTitle('🔄 CENTRAL OFICIAL DE TRANSFERÊNCIA DE GUILDA')
    .setDescription(
      'Bem-vindo à central oficial de transferências da comunidade **VAMPIR**!\n\n' +
      'Se você já faz parte de uma das nossas legiões e deseja migrar para outra guilda parceira da nossa aliança, utilize o **menu suspenso abaixo** para selecionar seu destino com 100% de precisão (sem risco de digitar errado!).\n\n' +
      '### 📌 FLUXO DE TRANSFERÊNCIA:\n' +
      '1. **Selecione a Guilda de Destino** no menu abaixo.\n' +
      '2. **Preencha a Ficha:** Informe seu Nick in-game, Classe e o motivo/alinhamento prévio com a liderança atual.\n' +
      '3. **Envio Direto:** A sua solicitação vai direto para o canal secreto de **📋・aprovações** da nova guilda e notifica a sua liderança atual!\n' +
      '4. **Troca Automática de Cargos:** Assim que o líder/oficial da nova guilda aprovar, o bot **remove automaticamente seu cargo da guilda anterior** e entrega o cargo da nova guilda!\n' +
      '5. **Notificação DM:** Você recebe a confirmação na sua DM na hora.\n\n' +
      '### 🏰 Legiões Oficiais Ativas para Transferência:\n' +
      registeredGuilds.map(g => `• **[${g.tag}] ${g.name}** — Líder: <@${g.leaderId}>`).join('\n')
    )
    .addFields(
      {
        name: '⏳ Regra de Carência In-Game (24 Horas)',
        value: 'Lembre-se que o próprio jogo impõe uma penalidade de 24h ao sair de um clã. Converse com os líderes antes para sincronizar os horários!',
        inline: false
      }
    )
    .setColor(Colors.DarkBlue)
    .setFooter({ text: 'Coalizão Vampir • Central de Transferências Segura' })
    .setTimestamp();

  // Opções do Select Menu com apenas as guilds ATIVAS do sistema
  const options = registeredGuilds.map(g => ({
    label: `[${g.tag}] ${g.name}`.slice(0, 100),
    value: g.id,
    description: `Legião oficial da Coalizão Vampir | Tag: [${g.tag}]`.slice(0, 100),
    emoji: '🏰'
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('select_transfer_destination_guild')
    .setPlaceholder('Selecione a guilda de destino para solicitar transferência...')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  return { embed, row };
}

/**
 * Renderiza ou atualiza o painel de transferência no canal específico
 */
async function renderOrUpdateTransferPanel(discordGuild, targetChannel) {
  const registeredGuilds = getGuilds();
  const config = getServerConfig();

  if (!registeredGuilds || registeredGuilds.length === 0) {
    console.warn('[TRANSFER-PANEL] Nenhuma guilda ativa encontrada para gerar o painel.');
    return;
  }

  const { embed, row } = buildTransferPanel(registeredGuilds);

  let targetMsg = null;

  // 1. Tenta buscar pelo ID salvo na config
  if (config?.channels?.transferPanelMessageId) {
    targetMsg = await targetChannel.messages.fetch(config.channels.transferPanelMessageId).catch(() => null);
  }

  // 2. Se não encontrou, busca nas mensagens recentes do canal por mensagem do bot com o select menu
  if (!targetMsg) {
    const recentMessages = await targetChannel.messages.fetch({ limit: 15 }).catch(() => null);
    if (recentMessages) {
      for (const [, msg] of recentMessages) {
        if (msg.author.id === discordGuild.client.user.id) {
          const hasMenu = msg.components.some(r =>
            r.components.some(c => c.customId === 'select_transfer_destination_guild')
          );
          if (hasMenu) {
            targetMsg = msg;
            break;
          }
        }
      }
    }
  }

  if (targetMsg) {
    // Atualiza a mensagem existente (In-Place)
    await targetMsg.edit({ embeds: [embed], components: [row] }).catch(err => {
      console.warn('[TRANSFER-PANEL] Erro ao editar mensagem existente:', err.message);
    });
    console.log(`[TRANSFER-PANEL] Painel atualizado na mensagem ${targetMsg.id}!`);
  } else {
    // Se não existia, envia nova
    targetMsg = await targetChannel.send({ embeds: [embed], components: [row] }).catch(err => {
      console.error('[TRANSFER-PANEL] Erro ao enviar mensagem no canal:', err.message);
      return null;
    });
    console.log(`[TRANSFER-PANEL] Novo painel publicado na mensagem ${targetMsg?.id}!`);
  }

  // 3. Salva o ID da mensagem na configuração do servidor
  if (targetMsg && config?.channels && config.channels.transferPanelMessageId !== targetMsg.id) {
    config.channels.transferPanelMessageId = targetMsg.id;
    saveServerConfig(config);
  }

  // 4. Limpeza de mensagens duplicadas do bot que tenham o select menu no mesmo canal
  try {
    const recent = await targetChannel.messages.fetch({ limit: 15 }).catch(() => null);
    if (recent && targetMsg) {
      for (const [id, msg] of recent) {
        if (id !== targetMsg.id && msg.author.id === discordGuild.client.user.id) {
          const hasMenu = msg.components.some(r =>
            r.components.some(c => c.customId === 'select_transfer_destination_guild')
          );
          if (hasMenu) {
            console.log(`[TRANSFER-PANEL] Removendo mensagem duplicada antiga: ${id}`);
            await msg.delete().catch(() => {});
          }
        }
      }
    }
  } catch {}
}

module.exports = {
  renderOrUpdateTransferPanel,
  buildTransferPanel
};
