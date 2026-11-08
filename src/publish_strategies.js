require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Colors
} = require('discord.js');
const { getServerConfig } = require('./data_manager');

async function publishBuildsAndStrategies() {
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

    console.log(`[ESTRATÉGIAS] Limpando e publicando no canal: #${channel.name}...`);

    // 1. EMBED BANNER / INTRODUÇÃO
    const embedIntro = new EmbedBuilder()
      .setTitle('🩸 VAMPIR — GUIA SUPREMO DE BUILDS, ACERTO & COMBATE')
      .setDescription(
        'Seja bem-vindo ao centro de inteligência e estratégia de combate do servidor **Rust 2**!\n\n' +
        'O MMORPG **VAMPIR** rompe com as convenções dos MMOs clássicos: **NÃO EXISTE CLASSE DE CURA DEDICADA (SEM HEALERS)** e **NÃO EXISTEM POÇÕES DE MANA (MP)**.\n\n' +
        'Aqui você encontra as diretrizes matemáticas oficiais para evitar o temido **MISS**, maximizar sua regeneração e dominar o metagame de chefes de território e guerras em Gehenna.'
      )
      .setColor(0x8B0000) // Dark Red
      .setImage('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop')
      .setFooter({ text: 'Vampir Bot • Base de Inteligência Militar Rust 2' })
      .setTimestamp();

    // 2. EMBED: CORTE DE ACERTO (ACCURACY CUT)
    const embedAccuracy = new EmbedBuilder()
      .setTitle('🎯 O CORTE DE ACERTO (ACCURACY CUT / 명중 컷)')
      .setDescription(
        'Nos servidores da Netmarble, a taxa de acerto é rigorosamente binária: se a sua **Precisão (명중)** estiver abaixo do limiar exigido pelo monstro ou chefe, quase **100% dos seus ataques resultarão em MISS (빗나감 / Erro)**.\n\n' +
        '### 💀 Consequências Fatais do "MISS":\n' +
        '• **Dano Zero:** Você não pontua no Top 70% de contribuição e perde os baús negociáveis do chefe.\n' +
        '• **Corte de Roubo de Sangue (Sem Cura):** A sustentação do seu personagem vem exclusivamente do dano causado (*Life Steal*). **Ataque que erra não drena sangue**, levando à sua morte imediata.\n' +
        '• **Imunidade a Debuffs:** Maldições, quebra de defesa e atordoamentos são cancelados se o golpe der Miss.'
      )
      .addFields(
        {
          name: '📍 Território de Poenari (Nível 40 a 75)',
          value:
            '• **Larva (Nv. 47):** Corte de **~200 Precisão** *(Abaixo de 180 já começam os primeiros Miss)*\n' +
            '• **Brachium (Nv. 63):** Corte de **~440 Precisão** *(Exige armas Raras aprimoradas no +6)*\n' +
            '• **Clamamus (Nv. 70):** Corte de **~690 Precisão** ⚠️ *(Crítico! Desbloqueia slot de Insígnias)*',
          inline: false
        },
        {
          name: '🏜️ Território de Kicel (Nível 75 a 110)',
          value:
            '• **Deserti (Nv. 83):** Corte de **~780 a 820 Precisão** *(Monstros de Kicel têm alta esquiva)*\n' +
            '• **Exesa (Nv. 95):** Corte de **~850 a 870 Precisão** *(Aura corrosiva; exige esquiva de poças)*\n' +
            '• **Usurpator (Nv. 107):** Corte de **~880 a 950 Precisão** *(Se errar, ele drena almas e se cura)*',
          inline: false
        },
        {
          name: '🌌 Gehenna (Geena) & Território de Bezdan (Endgame)',
          value:
            '• **Geena 1⭐ (Nv. 55~70+):** Corte de **~550 a 650 Precisão** *(15:00 / 19:00 / 23:00)*\n' +
            '• **Geena 2⭐ (Nv. 100~110+):** Corte de **~850 a 1.050 Precisão** *(15:00 / 23:00)*\n' +
            '• **Enoch 3⭐ (Nv. 110+):** Corte de **~1.100+ Precisão** *(Rei Esquecido de Gehenna Zona 2)*\n' +
            '• **Orseca (Nv. 115):** Corte de **~1.395+ Precisão** *(Subterrâneo gélido de Bezdan)*\n' +
            '• **Mashumid 3⭐ & Infernus (Nv. 126~130):** Corte de **1.500 a 1.600+ Precisão** *(Ápice absoluto)*',
          inline: false
        },
        {
          name: '🔍 As 4 Categorias de Precisão',
          value:
            '1. **Precisão Geral (Hit):** Base universal de acerto.\n' +
            '2. **Precisão Melee (근거리 명중):** Mandatória para **Bloodstained** e **Akasha**.\n' +
            '3. **Precisão Ranged (원거리 명중):** Mandatória para **Carnage** (evita Miss a 8.5m).\n' +
            '4. **Precisão Mágica (마법 명중):** Mandatória para **Viper** (garante entrada do DoT de veneno).\n' +
            '5. **Precisão de Habilidade (Skill Hit):** Determina se Stun, Silêncio e Fear aplicam no alvo.',
          inline: false
        }
      )
      .setColor(0xE74C3C);

    // 3. EMBED: GESTÃO DE MP & REGENERAÇÃO
    const embedMpManagement = new EmbedBuilder()
      .setTitle('⚡ O SEGREDO DO FARM AFK: GESTÃO DE MANA (MP)')
      .setDescription(
        '⚠️ **ATENÇÃO: NÃO EXISTEM POÇÕES DE MP EM VAMPIR!**\n\n' +
        'Diferente de MMOs onde se compra milhares de poções azuis, a mana do seu personagem depende 100% da sua **Regeneração Natural de MP por Ciclo ("엠틱" / MP-tic)** e da configuração cirúrgica do tempo de reuso das habilidades.'
      )
      .addFields(
        {
          name: '1. O Perigo do "Spam" Automático',
          value:
            'Se você colocar todas as 8 ou 10 habilidades ativas em rotação automática contínua, seu MP zerará em menos de 1 minuto, derrubando seu DPS para ataques básicos lentos.',
          inline: false
        },
        {
          name: '2. Configuração de Intervalo / Delay (사용 주기 설정)',
          value:
            'No menu de habilidades ativas (ícone de engrenagem ao lado de cada skill), ajuste o tempo de reuso forçado:\n' +
            '• **Habilidades de alto dano / caras:** Configure para disparar a cada **30 a 45 segundos** (e não no segundo em que saem do cooldown).\n' +
            '• **No Auto-Spam Contínuo:** Deixe apenas 1 buff primário de velocidade/crítico e 1 ou 2 habilidades de baixíssimo custo de mana.',
          inline: false
        },
        {
          name: '3. Acessório Sagrado: "Testamento da Noite" (밤의 유언)',
          value:
            'O sub-equipamento mais importante de progressão do jogo. No refino básico **+0** já concede **+6 de Regeneração Natural de MP**, escalando conforme o aprimoramento.',
          inline: true
        },
        {
          name: '4. Soro de Ataque (공격 혈청)',
          value:
            'Item comprado nas vilas por Ouro diário. Dura 10 minutos e concede aumento de ATK, dano adicional e **+6 de Regeneração de MP**. Mantenha no auto-uso!',
          inline: true
        },
        {
          name: '5. Breakpoint de Mana Recomendado',
          value:
            'Busque atingir **60 a 120+ de MP Regen** através do Códice de Coleção, montarias e da passiva de clã *"Aumento de Regeneração de MP"*.',
          inline: false
        }
      )
      .setColor(0x3498DB);

    // 4. EMBED: GUIA DAS 5 CLASSES NO METAGAME
    const embedClasses = new EmbedBuilder()
      .setTitle('⚔️ GUIA DAS 5 CLASSES & COMPOSIÇÃO DE RAID')
      .setDescription(
        'Em *VAMPIR*, todas as 5 classes são **All-DPS**. Cada uma cumpre um papel tático indispensável nas formações de raid e cerco:'
      )
      .addFields(
        {
          name: '🛡️ Bloodstained (Bruiser / Sustentação / Frontline)',
          value:
            '• **Armas:** Espadão de Duas Mãos & Espada/Escudo.\n' +
            '• **Papel:** Segura aggro do boss, vira as costas dele para a raid e usa **Colisão Física (Body Blocking)** para trancar portas e pontes.\n' +
            '• **Sustentação:** Lifesteal escalado por acerto crítico e escudos de sangue temporários (*Blood Shields*).\n' +
            '• **Tier PvP:** S+ (Monólito de duelo e controle territorial).',
          inline: false
        },
        {
          name: '🎯 Carnage (Ranged DPS / Atirador de Precisão)',
          value:
            '• **Armas:** Fuzil de Sangue & Pistolas Duplas (8.5m de alcance).\n' +
            '• **Papel:** O rei do farm AFK solo e do DPS contínuo à distância.\n' +
            '• **Mecânica Central:** Entra em modo **Adrenalina** ao drenar sangue à distância, ganhando picos brutais de Taxa e Dano Crítico.\n' +
            '• **Prioridade de Status:** Precisão à Distância (*Ranged Accuracy*) e Dano Crítico.',
          inline: false
        },
        {
          name: '🥊 Akasha (Brawler / Caçadora de Alvos / Duelista)',
          value:
            '• **Armas:** Tonfas Laminadas Duplas (*Bladed Tonfas*).\n' +
            '• **Papel:** Especializada em caçar alvos frágeis na retaguarda inimiga.\n' +
            '• **Habilidades Chave:** Teleporte nas costas do alvo (*Hunt the Prey*), 3 cargas de dash (*Blood Rush*), roubo de % de ATK do inimigo (*Touch of Absorption*) e **Liberação Absoluta** (quebra atordoamentos mesmo enquanto atordoada!).',
          inline: false
        },
        {
          name: '🔮 Viper (Maga de Maldições / Zoner / Anti-Heal)',
          value:
            '• **Armas:** Orbe Mágico (9 metros de alcance).\n' +
            '• **Papel:** Controle supremo de terreno com poças de veneno contínuo (*Swamp of Pain*) e invocação do *The Piercer* para absorver aggro.\n' +
            '• **Trunfo em PvP:** Aplica **Anti-Heal (Supressão de Cura)**, anulando o vampirismo e as poções dos tanques adversários.',
          inline: false
        },
        {
          name: '☠️ Grim Reaper (Assassino Furtivo / Burst Finisher)',
          value:
            '• **Armas:** Foice Gigante de Duas Mãos & Foices Gêmeas.\n' +
            '• **Papel:** Eliminação surpresa e execução instantânea.\n' +
            '• **Mecânicas Chave:** Furtividade (*Shadow Blend*) com primeiro golpe 100% crítico pelas costas, debuff de **Terror (Fear)** e multiplicador letal em alvos com **menos de 30% de HP**.',
          inline: false
        }
      )
      .setColor(0x9B59B6);

    // 5. EMBED: TÁTICAS DE GUERRA, GEHENNA & O GOLPE FINAL (MAK-TA)
    const embedWarTactics = new EmbedBuilder()
      .setTitle('🏰 TÁTICAS DE GUERRA, GEHENNA & DISPUTA DE LOOT')
      .setDescription(
        'Como as melhores guilds de **Rust 2** operam para garantir as maiores recompensas e o controle do servidor:'
      )
      .addFields(
        {
          name: '1. A Regra do Último Golpe (막타 - Mak-ta / Final Blow)',
          value:
            'Embora o grosso do loot vá para o clã com maior dano acumulado no ranking de contribuição, quem acerta o **golpe fatal (0% HP)** recebe um anúncio global no servidor e o cobiçado **Baú Exclusivo de Finalizador**. Guarde suas habilidades de burst e execuções para os últimos 2% de vida do boss!',
          inline: false
        },
        {
          name: '2. Tática de Parede Humana (Body Blocking / 길막)',
          value:
            'VAMPIR possui **colisão física ativa entre personagens**. Em Gehenna ou entradas de castelos, posicione Bloodstaineds e Akashas formando uma barreira humana intransponível em passagens estreitas. Os inimigos não conseguem passar, enquanto nossos Carnages e Vipers dizimam a retaguarda com segurança.',
          inline: false
        },
        {
          name: '3. A Cripta do Clã & Guardião Cruor',
          value:
            '• **Cripta de Clã:** O Líder aloca os membros com maior Ranking de RP nos nichos sagrados para conceder bônus de Ataque, Defesa e Precisão para **todos os membros da guilda**.\n' +
            '• **Guardião Cruor:** Criatura gárgula evoluída até o Nível 30 que pode ser invocada por 30 segundos durante guerras territoriais para aplicar escudos aos aliados e quebra de defesa em massa aos rivais.',
          inline: false
        },
        {
          name: '4. Presença Física Obrigatória',
          value:
            '⚠️ **Atenção:** Você precisa estar **fisicamente vivo e presente no mapa no exato segundo da morte do chefe**. Se estiver morto na tela de renascimento ou em carregamento de teleporte, o sistema não computa seus drops!',
          inline: false
        }
      )
      .setColor(0xF39C12)
      .setFooter({ text: 'Rust 2 • Conhecimento é Poder. Honre sua Legião.' });

    // Enviar todas as mensagens em sequência
    await channel.send({ embeds: [embedIntro] });
    await channel.send({ embeds: [embedAccuracy] });
    await channel.send({ embeds: [embedMpManagement] });
    await channel.send({ embeds: [embedClasses] });
    await channel.send({ embeds: [embedWarTactics] });

    console.log('[ESTRATÉGIAS] Todos os 5 painéis foram publicados com sucesso!');
  } catch (err) {
    console.error('[ERRO] Falha ao publicar em estratégias:', err);
  } finally {
    client.destroy();
    process.exit(0);
  }
}

publishBuildsAndStrategies();
