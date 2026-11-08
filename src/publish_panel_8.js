require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder
} = require('discord.js');
const { getServerConfig } = require('./data_manager');

async function publishPanel8() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  await client.login(process.env.DISCORD_TOKEN);

  try {
    const config = getServerConfig();
    const channelId = config?.channels?.estrategias || '1565129737100337204';
    const channel = await client.channels.fetch(channelId);

    if (!channel) {
      console.error('[ERRO] Canal de estratégias não encontrado:', channelId);
      process.exit(1);
    }

    console.log(`[DICAS] Publicando Painel 8 em #${channel.name}...`);

    const embedPanel8 = new EmbedBuilder()
      .setTitle('🛡️ PAINEL 8: OTIMIZAÇÃO AVANÇADA, FARM DE ALTS & SEGREDOS DE COMBATE')
      .setDescription(
        'Estratégias de alto rendimento, mecânicas ocultas de sobrevivência e otimização de recursos para dominar o servidor:'
      )
      .setColor(0x8B0000)
      .addFields(
        {
          name: '1. ⚖️ O Limiar dos 100% de Peso (Morte Silenciosa do Farm AFK)',
          value:
            '• **Regra dos 100%:** Ao atingir **100.0% de peso**, o jogo **desliga 100% da Regeneração Natural de HP e MP**. Como no VAMPIR não existem poções de mana, ultrapassar 100% faz sua mana secar rapidamente e mata sua rotação de dano!\n' +
            '• **Regra dos 120%:** Ao atingir **120% de peso**, o personagem **para totalmente de coletar qualquer item ou loot do chão**.\n' +
            '• **Margem Segura:** Saia para farmar AFK ocupando no máximo **70% a 75% da capacidade** em poções de HP, garantindo 6 a 8 horas de farm contínuo com espaço para drops.',
          inline: false
        },
        {
          name: '2. 💎 Reciclagem de Acessórios: 5x Mais Trinity que Armaduras',
          value:
            '• **Armadura Rara (Azul):** Rende míseros **4 Fragmentos de Trindade (Trinity)** ao desmontar.\n' +
            '• **Acessório Raro (Anéis, Colares, Brincos):** Rende **20 Fragmentos de Trinity (5x mais!)**.\n' +
            '• **Multiplicador Abençoado:** Desmontar peças abençoadas (*Blessed*) concede um multiplicador de **quase 10x em Trinity bruto**. Se a guilda ou você precisarem de Trinity para forjas e Cripta, recicle os acessórios e alimente o Códice com peças secundárias de armadura.',
          inline: false
        },
        {
          name: '3. 🖼️ Loja de Clã: Prioridade Máxima no Restaurador de Retrato',
          value:
            '• **A Meta das Moedas de Clã:** Não queime suas Moedas de Clã (*Clan Coins*) em pergaminhos de refino que falham. No **Nível 3 de Clã**, a prioridade absoluta da loja semanal é a compra do **Restaurador de Retrato do Grande Soberano**.\n' +
            '• **Por que é o melhor investimento:** O aprimoramento de Retratos no Códice tem **100% de taxa de sucesso (NÃO FALHA E NÃO QUEBRA)**, convertendo suas moedas de clã diretamente em bônus permanentes e garantidos de **Precisão (명중), HP e Ataque** para toda a conta!',
          inline: false
        },
        {
          name: '4. 🚜 A Rotina de 3 Alts com Carnage (6M a 8.4M de Gold/Dia)',
          value:
            '• **O Esquema dos Veteranos (부캐작):** Nivele 3 personagens secundários até o Lv 50-60 e rode diariamente em cada um:\n' +
            '  - 1 Hora na Masmorra *Legado Desbotado (Faded Legacy)* (Chuva de Ouro bruto);\n' +
            '  - 1 Hora no *Abismo da Criação (Abyss of Creation)* (Materiais de forja e restauradores);\n' +
            '  - 10 Missões de Comissão diárias.\n' +
            '• **Por que Carnage é a rainha dos Alts:** Possui **8.5 metros de alcance** (gira no centro da sala limpando os monstros sem se mover) e opera com **custo de mana quase zero**. Enquanto a Viper seca a mana em 2 minutos sem códices caros, o Carnage rende **6M a 8.4M de Gold e 45 a 75 pergaminhos de refino por dia** para bancar seu char principal!',
          inline: false
        },
        {
          name: '5. ⚡ A Tática do "Double-Dip" de Cura Emergencial',
          value:
            '• **Cooldowns Independentes:** Poções Grandes de Gold (Grupo 1) e Elixires de Sangue Alquímicos Instantâneos (Grupo 3) **não compartilham tempo de recarga**!\n' +
            '• **Salvação em PvP e Enrage:** Em situações críticas de dano em área ou emboscadas, acione uma **Poção Grande + um Elixir Instantâneo no mesmíssimo segundo**, dobrando sua cura instantânea.\n' +
            '• **Sinergia do Soro de Defesa:** Mantenha o *Soro de Defesa* ativo no auto-consumo: ele concede **+20% de HP Recovery Boost**, fazendo cada Poção Grande curar **430+ por tick** (em vez de 360).',
          inline: false
        },
        {
          name: '6. 💥 Quebra de Postura (Stagger) e o Estado de "Groggy"',
          value:
            '• **Barra de Postura:** Embaixo do HP de World Bosses e Chefes de Gehenna existe uma barra de postura oculta. Habilidades com efeito de impacto pesado (como *Shield Bash* do Bloodstained e *Hunt* da Carnage) esgotam essa barra velozmente.\n' +
            '• **O Estado de Groggy (3 a 5s):** Quando a barra quebra, o chefe fica totalmente atordoado no chão. Durante essa janela:\n' +
            '  - A chance de Acerto Crítico de toda a guilda se torna **100% garantida**;\n' +
            '  - Ataques pelas costas (*Back Attacks*) recebem bônus de até **+50% de dano amplificado**.\n' +
            '• **Doutrina:** Guarde todas as Ultimates e Despertares para disparar EXATAMENTE no Groggy!',
          inline: false
        },
        {
          name: '7. 🩸 Clima Dinâmico: A Janela de Caça Impune (Zero Karma)',
          value:
            '• **Chuva de Sangue e Eclipse Solar:** Quando esses eventos climáticos tomam conta dos mapas de Poenari, Kicel e Bezdan, as regras morais de mundo são suspensas.\n' +
            '• **Sem Penalidade de Karma (Karma Loss: 0):** Abates em PK durante esses climas não deixam o nome vermelho (não acumulam penalidade de assassino).\n' +
            '• **Proteção de Equipamento Equipado:** Ninguém corre risco de derrubar itens equipados ao morrer nessas janelas.\n' +
            '• **Tática de Guilda:** É o momento exato para mobilizar a tropa e varrer os membros de guildas rivais que estiverem farmando nos melhores spots!',
          inline: false
        }
      )
      .setFooter({
        text: 'Vampir Bot • Servidor Rust 2 • Painel de Dicas Estratégicas'
      })
      .setTimestamp();

    await channel.send({ embeds: [embedPanel8] });
    console.log('[SUCESSO] Painel 8 publicado com sucesso!');
  } catch (err) {
    console.error('[ERRO] Falha ao publicar Painel 8:', err);
  } finally {
    await client.destroy();
  }
}

publishPanel8();
