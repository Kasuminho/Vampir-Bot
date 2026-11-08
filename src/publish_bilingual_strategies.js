require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const STRATEGY_CHANNEL_ID = '1565129737100337204';

const COLOR_MAP = {
    'Red': 0xE74C3C,
    'Blue': 0x3498DB,
    'Gold': 0xF1C40F,
    'DarkGreen': 0x1F8B4C,
    'Purple': 0x9B59B6,
    'DarkPurple': 0x71368A,
    'DarkRed': 0x992D22,
    'Orange': 0xE67E22,
    'DarkBlue': 0x206694,
    'Green': 0x2ECC71
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

client.once('clientReady', async (c) => {
    console.log(`[Publisher] Autenticado como ${c.user.tag}`);

    try {
        const channel = await client.channels.fetch(STRATEGY_CHANNEL_ID);
        if (!channel) {
            console.error('[Publisher] Canal de estratégias não encontrado!');
            process.exit(1);
        }

        console.log(`[Publisher] Limpando mensagens antigas no canal #${channel.name}...`);
        let fetched;
        do {
            fetched = await channel.messages.fetch({ limit: 50 });
            if (fetched.size > 0) {
                console.log(`[Publisher] Deletando lote de ${fetched.size} mensagens antigas...`);
                for (const msg of fetched.values()) {
                    await msg.delete().catch(() => {});
                    await sleep(300);
                }
            }
        } while (fetched.size >= 50);

        // Carrega os 16 cards dos 4 arquivos
        const dataDir = path.join(__dirname, 'data');
        const b1 = JSON.parse(fs.readFileSync(path.join(dataDir, 'bilingual_cards_batch1.json'), 'utf8'));
        const b2 = JSON.parse(fs.readFileSync(path.join(dataDir, 'bilingual_cards_batch2.json'), 'utf8'));
        const b3 = JSON.parse(fs.readFileSync(path.join(dataDir, 'bilingual_cards_batch3.json'), 'utf8'));
        const b4 = JSON.parse(fs.readFileSync(path.join(dataDir, 'bilingual_cards_batch4.json'), 'utf8'));
        const allCards = [...b1, ...b2, ...b3, ...b4];

        console.log(`[Publisher] Total de ${allCards.length} cards carregados com sucesso!`);

        // Posta o Banner Introdutório / Índice Geral
        const introEmbedPt = new EmbedBuilder()
            .setTitle('📖 GUIA SUPREMO DE BUILDS, MECÂNICAS & GUERRA (VAMPIR)')
            .setColor(0xE74C3C)
            .setDescription(
                `Bem-vindo ao repositório militar e tático oficial do clã para **VAMPIR MMORPG**!\n\n` +
                `Aqui você encontra a enciclopédia definitiva de mecânicas ocultas, cortes matemáticos de precisão, rotinas de progressão e doutrina militar de GvG.\n\n` +
                `📌 **COMO USAR ESTE CANAL:**\n` +
                `• Cada assunto crucial está isolado em um **Card Modular Bilíngue** próprio.\n` +
                `• Você pode **clicar com botão direito > Copiar Link da Mensagem** em qualquer card para enviar direto a novos membros ou membros da sua party!\n` +
                `• Cada card possui versão em **Português (🇧🇷)** e versão técnica em **Inglês (🇺🇸)** para comunicação com aliados globais.`
            );

        const introEmbedEn = new EmbedBuilder()
            .setTitle('📖 SUPREME COMBAT, MECHANICS & WARFARE CODEX (VAMPIR)')
            .setColor(0x206694)
            .setDescription(
                `Welcome to the official military repository and tactical playbook for **VAMPIR MMORPG**!\n\n` +
                `Herein lies the complete tactical breakdown of hidden math formulas, hit accuracy thresholds, daily progression routines, and GvG territorial doctrine.\n\n` +
                `📌 **HOW TO NAVIGATE THIS CHANNEL:**\n` +
                `• Every key combat topic is structured into its own **Dedicated Modular Bilingual Card**.\n` +
                `• **Right-click > Copy Message Link** on any card to instantly dispatch strategic instructions to squadmates or new recruits!\n` +
                `• Every card features dual tactical sections: **Portuguese (🇧🇷)** and **English (🇺🇸)** for seamless alliance coordination.`
            )
            .setFooter({ text: 'Vampir Bot • Central de Estratégias & Builds • 16 Cards Disponíveis' });

        await channel.send({ embeds: [introEmbedPt, introEmbedEn] });
        console.log('[Publisher] Banner introdutório postado.');
        await sleep(1500);

        // Posta cada um dos 16 cards sequencialmente
        for (let i = 0; i < allCards.length; i++) {
            const card = allCards[i];
            const color = COLOR_MAP[card.color] || 0xE74C3C;
            const cardIndex = String(i + 1).padStart(2, '0');

            const embedPt = new EmbedBuilder()
                .setTitle(`🇧🇷 [CARD ${cardIndex}/16] ${card.title}\n🔹 ${card.pt_title}`)
                .setColor(color)
                .setDescription(card.pt_content)
                .setFooter({ text: `Vampir Bot ┃ Doutrina Tática & Builds ┃ Card [${cardIndex}/16]` });

            const embedEn = new EmbedBuilder()
                .setTitle(`🇺🇸 [CARD ${cardIndex}/16] ${card.title}\n🔹 ${card.en_title}`)
                .setColor(color)
                .setDescription(card.en_content)
                .setFooter({ text: `Vampir Bot ┃ Tactical Doctrine & Builds ┃ Card [${cardIndex}/16]` });

            await channel.send({ embeds: [embedPt, embedEn] });
            console.log(`[Publisher] Card ${cardIndex}/16 (${card.id}) postado com sucesso.`);
            await sleep(1200); // Evita rate limit do Discord
        }

        console.log('[Publisher] Todos os 16 cards foram publicados com sucesso!');
        client.destroy();
        process.exit(0);
    } catch (err) {
        console.error('[Publisher] Erro durante a publicação:', err);
        client.destroy();
        process.exit(1);
    }
});

client.login(process.env.DISCORD_TOKEN);
