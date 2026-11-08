const { translateText } = require('../services/translatorService');
const { getServerConfig } = require('../data_manager');

// Cache de Webhooks para envio rápido sem recriar
const webhookCache = new Map(); // channelId -> Webhook

async function getOrCreateWebhook(channel) {
  if (webhookCache.has(channel.id)) {
    return webhookCache.get(channel.id);
  }
  try {
    const webhooks = await channel.fetchWebhooks();
    let wh = webhooks.find(w => w.name === 'Vampir Translator');
    if (!wh) {
      wh = await channel.createWebhook({
        name: 'Vampir Translator',
        reason: 'Auto-tradução de canais bilíngues PT <> EN'
      });
    }
    webhookCache.set(channel.id, wh);
    return wh;
  } catch (err) {
    console.warn(`[TRANSLATOR] Não foi possível criar webhook em #${channel.name}:`, err.message);
    return null;
  }
}

/**
 * Lida com o espelhamento traduzido de mensagens entre canais irmãos
 */
async function handleAutoTranslation(message) {
  // Ignora mensagens de bots (incluindo o próprio bot e webhooks) para evitar loop infinito
  if (message.author.bot || message.webhookId) return;

  const content = message.content?.trim();
  if (!content) return; // Se for só anexo/imagem sem texto, deixa quieto

  const config = getServerConfig();
  if (!config?.channels) return;

  const chGeralPt = config.channels.geral || '1565129739159478332';
  const chGeralEn = config.channels.geralEn || '1565781677018452112';
  const chLideresPt = config.channels.chatLideres || '1565129743748309002';
  const chLideresEn = config.channels.chatLideresEn || '1565781679207874600';

  let targetChannelId = null;
  let targetLang = 'en';

  if (message.channelId === chGeralPt) {
    targetChannelId = chGeralEn;
    targetLang = 'en';
  } else if (message.channelId === chGeralEn) {
    targetChannelId = chGeralPt;
    targetLang = 'pt';
  } else if (message.channelId === chLideresPt) {
    targetChannelId = chLideresEn;
    targetLang = 'en';
  } else if (message.channelId === chLideresEn) {
    targetChannelId = chLideresPt;
    targetLang = 'pt';
  } else {
    return; // Não é um canal mapeado para auto-tradução
  }

  const targetChannel = await message.guild.channels.fetch(targetChannelId).catch(() => null);
  if (!targetChannel) return;

  // Traduz o conteúdo
  const translation = await translateText(content, targetLang, 'auto');
  if (!translation || !translation.text) return;

  // Se o idioma for o mesmo (ex: o cara já digitou em inglês no canal em inglês), não precisa espelhar
  if (translation.isSameLang && translation.text.toLowerCase() === content.toLowerCase()) {
    return;
  }

  const webhook = await getOrCreateWebhook(targetChannel);
  const avatarUrl = message.author.displayAvatarURL({ dynamic: true });
  const senderName = message.member?.displayName || message.author.username;
  const langFlag = targetLang === 'en' ? '🇺🇸' : '🇧🇷';

  const payload = {
    content: `${translation.text}\n\n*↳ ${langFlag} [Auto-Translate • Original por ${senderName}]*`,
    username: senderName,
    avatarURL: avatarUrl
  };

  if (webhook) {
    try {
      await webhook.send(payload);
    } catch {
      await targetChannel.send(`**${senderName}**: ${payload.content}`).catch(() => {});
    }
  } else {
    await targetChannel.send(`**${senderName}**: ${payload.content}`).catch(() => {});
  }
}

module.exports = { handleAutoTranslation };
