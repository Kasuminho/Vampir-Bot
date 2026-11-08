require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder
} = require('discord.js');
const { getServerConfig } = require('./data_manager');

async function publishAdvancedTips() {
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

    console.log(`[DICAS] Publicando novos painéis avançados em #${channel.name}...`);

    // PAINEL 6: SEGREDOS VITAIS DE APRIMORAMENTO, LIDERANÇA E ECONOMIA
    const embedVitalSecrets = new EmbedBuilder()
      .setTitle('💎 OS 7 SEGREDOS VITAIS: APRIMORAMENTO, LIDERANÇA & ECONOMIA')
      .setDescription(
        'Regras ocultas e táticas de veteranos coreanos para evitar a destruição de equipamentos e proteger sua conta e guilda:'
      )
      .addFields(
        {
          name: '1. ⚠️ Roleta Russa do Aprimoramento & O "Pulo do Blessed"',
          value:
            '• **Pontos Seguros:** Armas até **+6**; Armaduras até **+4**; Acessórios são perigo máximo com ponto seguro de **+0 ou +1**!\n' +
            '• **Destruição Permanente:** Passar do ponto seguro com pergaminho normal arrisca quebrar a peça em pó!\n' +
            '• **O Pulo da Trap:** Deixe a arma no **+6 seguro** e use o **Pergaminho Abençoado (*Blessed Scroll*)**, que sobe de +1 a +3 de uma vez. Ela pula direto para **+8 ou +9** sem jamais passar pelo risco do +7!\n' +
            '• **Pergaminho Amaldiçoado (*Cursed*):** Usado para rebaixar peças (ex: do +5 de volta pro +4 seguro) para tentar outro pulo triplo!',
          inline: false
        },
        {
          name: '2. 🚨 Regra dos 5 Dias: Perda Automática de Liderança',
          value:
            'Se o **Clan Master (Líder da Guild)** ficar **5 dias seguidos sem logar**, o sistema da Netmarble **remove a liderança dele automaticamente** e passa o cargo para o Vice Master mais antigo e ativo. Nunca fique ausente sem transferir o comando!',
          inline: false
        },
        {
          name: '3. 👥 A "Rotina de Alts" (Personagens Secundários / 부캐작)',
          value:
            'Códice de Itens, Montarias, Familiares e coleções são **100% compartilhados entre todos os personagens da conta**. Crie 2 a 3 personagens secundários para rodar masmorras diárias de ouro e farmar **Trinity** bruto para alimentar seu char principal.',
          inline: false
        },
        {
          name: '4. ☠️ Nome Vermelho (PK Caótico) & Perda de Equipamentos',
          value:
            'Matar jogadores neutros em mapas comuns deixa o nome vermelho. Se morrer nesse estado, você tem chance real de **derrubar peças de equipamentos ou itens raros no chão**, que qualquer rival pode pegar. Além disso, sentinelas de vilarejos atacam você à vista!',
          inline: false
        },
        {
          name: '5. 🩸 O Fenômeno da "Lua de Sangue" (Blood Moon)',
          value:
            'Quando o céu fica vermelho escarlate, o servidor entra em evento climático:\n' +
            '• Drops de materiais raros sobem em **+50% a +100%**.\n' +
            '• As penalidades de karma de PK são suspensas em zonas abertas.\n' +
            '• O Medidor de Frenesi enche 2x mais rápido, garantindo buffs brutais de penetração enquanto mantiver o abate.',
          inline: false
        },
        {
          name: '6. 🔄 Troca de Classe (Class Change) no Nível 60+',
          value:
            'Janelas sazonais abrem no Lv 60 por 2.000 a 4.000 Diamantes. Permite converter até **3 armas equipadas** (mantendo refino e bênçãos de Trinity) e transfere todos os *Skill Cards* para a nova classe.',
          inline: false
        },
        {
          name: '7. 🎁 Puxadas Gratuitas (x11) na Loja de Gehenna',
          value:
            'Mesmo que a sua guild perca confrontos em Gehenna, participar acumula **Gehenna Points**. A loja permite trocar pontos por pacotes de **Invocação x11 gratuitos** de Montarias e Formas toda semana sem gastar Diamantes!',
          inline: false
        }
      )
      .setColor(0xF1C40F);

    // PAINEL 7: MECÂNICAS AVANÇADAS DE GRAVURA, CRIPTA & CÓDICE
    const embedAdvancedSystems = new EmbedBuilder()
      .setTitle('🧠 MECÂNICAS AVANÇADAS: GRAVURA, CRIPTA DE RP & CÓDICE')
      .setDescription(
        'Sistemas secundários que separam jogadores médios de jogadores de alta patente militar:'
      )
      .addFields(
        {
          name: '1. 🔒 A Armadilha da Trava de Gravura (Engraving Lock Trap)',
          value:
            'Ao girar atributos nos Selos de Sangue, você pode "travar" slots com atributos perfeitos (ex: MAX Precisão ou MAX Ataque).\n' +
            '⚠️ **Atenção:** Cada slot travado **multiplica exponencialmente o custo de Trinity e Diamantes** para rolar os restantes! Só trave rolagens de raridade máxima; se travar atributos medianos no começo, o custo para fechar o selo se tornará inviável.',
          inline: false
        },
        {
          name: '2. 🏛️ A Cripta do Clã: "Vaga por RP, Não por Amizade!"',
          value:
            'A Cripta do Clã converte os bônus passivos para a guilda inteira com base no **Ranking Points (RP) de Temporada** do membro alocado.\n' +
            'Colocar membros inativos ou com RP baixo desperdiça o potencial da guild. As vagas da Cripta devem ser ocupadas estritamente pelos **jogadores com maior pontuação de RP de combate** da temporada!',
          inline: false
        },
        {
          name: '3. 📦 Triagem do Códice de Itens: Registrar vs. Vender',
          value:
            'Registrar um item no Códice **destrói o item permanentemente**.\n' +
            '• **Regra:** Itens azuis raros com alta demanda no Marketplace devem ser **vendidos primeiro por Diamantes** para financiar o personagem. Só registre no Códice quando os preços de mercado caírem e estabilizarem.',
          inline: false
        },
        {
          name: '4. 🩸 Seguidores Vampíricos na Base (Followers / Progeny)',
          value:
            'Na vila, você possui seguidores com estoque de sangue próprio (ex: 60.000 HP). Faça a drenagem diária neles para coletar os **Elixires de Sangue Sagrado**, poções exclusivas que dão 10 minutos de bônus direto de ATK, Defesa e ganho de EXP/Ouro.',
          inline: false
        },
        {
          name: '5. 🛡️ Bênção de Olga (Olga\'s Grace / 올가의 은총)',
          value:
            'O passe de conveniência da profetisa Olga concede **10 recuperações gratuitas de EXP por dia** (ao invés de 5) e desbloqueia o **Comércio Pessoal Direto (P2P)** entre jogadores por Nick, permitindo transferir itens entre amigos sem passar pelo leilão aberto.',
          inline: false
        },
        {
          name: '6. 🌟 Pity de Síntese de Montarias e Formas (Care Points)',
          value:
            'Toda fusão duplicada que falha acumula **Pontos de Piedade (*Care Points*)**. Ao atingir 100% da barra, a próxima síntese tem **100% de garantia** de ascender para grau Heroico ou Lendário. Nunca jogue fusões fora de forma avulsa sem gerenciar a barra de pity!',
          inline: false
        }
      )
      .setColor(0x1ABC9C)
      .setFooter({ text: 'Rust 2 • Conhecimento Avançado de Combate e Sobrevivência' })
      .setTimestamp();

    await channel.send({ embeds: [embedVitalSecrets] });
    await channel.send({ embeds: [embedAdvancedSystems] });

    console.log('[DICAS] Painéis 6 e 7 publicados com sucesso!');
  } catch (err) {
    console.error('[ERRO] Falha ao publicar dicas avançadas:', err);
  } finally {
    client.destroy();
    process.exit(0);
  }
}

publishAdvancedTips();
