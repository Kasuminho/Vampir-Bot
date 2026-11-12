const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('criar-guild')
    .setDescription('Cadastra uma nova Guild parceira no servidor (Apenas Staff)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('nome')
        .setDescription('Nome oficial da Guild / Legião')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('tag')
        .setDescription('Tag ou Sigla da Guild (ex: VMP, BLOOD, RUST)')
        .setRequired(true)
    )
    .addUserOption(option =>
      option.setName('lider')
        .setDescription('Membro que será o líder oficial da Guild')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('descricao')
        .setDescription('Breve descrição e foco da Guild (PVP, PVE, Hardcore...)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('cor')
        .setDescription('Cor Hexadecimal do cargo da Guild (Ex: #FF0000, #9B59B6)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('icone_url')
        .setDescription('URL do brasão/imagem da guild')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('painel-recrutamento')
    .setDescription('Atualiza ou publica o painel de recrutamento com todas as guilds cadastradas')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('painel-transferencia')
    .setDescription('Atualiza ou publica a central oficial de transferência de guildas')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('listar-guilds')
    .setDescription('Lista todas as guilds cadastradas no sistema')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('editar-guild')
    .setDescription('Personaliza as configurações da sua Guild (Líder da Guild ou Staff)')
    .addStringOption(option =>
      option.setName('tag')
        .setDescription('Tag atual da Guild (opcional se você lidera apenas uma guild)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('nova_tag')
        .setDescription('Nova Tag/Sigla da Guild (ex: ALC, OLP, NOM, VMP)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('cor')
        .setDescription('Nova cor do clã em Hexadecimal (ex: #FF0000 ou FF0000)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('descricao')
        .setDescription('Nova descrição ou foco da Guild (ex: Foco em PvP e Bosses)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('icone_url')
        .setDescription('Novo link da imagem/brasão do clã')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('guild-staff')
    .setDescription('Gerencia a liderança e oficiais da sua Guild (Líder da Guild ou Staff Geral)')
    .addStringOption(option =>
      option.setName('acao')
        .setDescription('O que você deseja fazer?')
        .setRequired(true)
        .addChoices(
          { name: '➕ Adicionar Oficial / Vice-Líder', value: 'adicionar' },
          { name: '➖ Remover Oficial / Vice-Líder', value: 'remover' },
          { name: '👑 Transferir Liderança Principal', value: 'transferir' },
          { name: '📋 Listar Staff da Guild', value: 'listar' }
        )
    )
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Jogador a ser promovido, removido ou novo líder')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('tag')
        .setDescription('Tag da Guild (ex: ALC, OLP, NOM) — opcional se você lidera apenas uma guild')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('guild-callers')
    .setDescription('Gerencia os Shout Callers da sua Guild para calls de Raid/Boss (Líder da Guild)')
    .addStringOption(option =>
      option.setName('acao')
        .setDescription('O que você deseja fazer?')
        .setRequired(true)
        .addChoices(
          { name: '➕ Nomear Shout Caller (Máx 2)', value: 'adicionar' },
          { name: '➖ Remover Shout Caller', value: 'remover' },
          { name: '📋 Listar Shout Callers', value: 'listar' }
        )
    )
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Jogador a ser nomeado ou removido como Shout Caller')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('tag')
        .setDescription('Tag da Guild (ex: ALC, OLP, NOM) — opcional se você lidera apenas uma guild')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('guild-remover')
    .setDescription('Remove/desliga um jogador da sua Guild (Líderes, Oficiais ou Staff)')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Jogador a ser removido da sua Guild')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('motivo')
        .setDescription('Motivo do desligamento (ex: Inatividade, Saiu do jogo, Descumprimento de regras)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('tag')
        .setDescription('Tag da Guild (ex: OLP, NOM, NGF) — opcional se você lidera apenas uma guild')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('criar-palco')
    .setDescription('Cria um Canal de Palco (Stage) oficial para grandes reuniões e Bosses (Apenas Staff)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('nome')
        .setDescription('Nome do Palco (Padrão: Boss Geena)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('boss-respawn')
    .setDescription('Registra o próximo horário ou tempo de respawn de um Boss de Mapa')
    .addStringOption(option =>
      option.setName('boss')
        .setDescription('Selecione o Boss de Mapa')
        .setRequired(true)
        .addChoices(
          { name: 'Nv. 47 Larva (Passagem do Alvorecer)', value: 'larva' },
          { name: 'Nv. 63 Brachium (Planícies Empaladas)', value: 'brachium' },
          { name: 'Nv. 70 Clamamus (Bosque Umbroso)', value: 'clamamus' },
          { name: 'Nv. 83 Deserti (Vale Estéril)', value: 'deserti' },
          { name: 'Nv. 95 Exesa (Dunas de Alabastro)', value: 'exesa' },
          { name: 'Nv. 107 Usurpator (Ruínas Esquecidas)', value: 'usurpator' }
        )
    )
    .addStringOption(option =>
      option.setName('horario')
        .setDescription('Horário exato (ex: 18:30, 21:46) ou tempo restante (ex: 45m, 1h 30m)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('boss-morto')
    .setDescription('Marca um Boss como MORTO e opcionalmente define o horário de respawn')
    .addStringOption(option =>
      option.setName('boss')
        .setDescription('Selecione o Boss derrotado')
        .setRequired(true)
        .addChoices(
          { name: 'Nv. 47 Larva (Passagem do Alvorecer)', value: 'larva' },
          { name: 'Nv. 63 Brachium (Planícies Empaladas)', value: 'brachium' },
          { name: 'Nv. 70 Clamamus (Bosque Umbroso)', value: 'clamamus' },
          { name: 'Nv. 83 Deserti (Vale Estéril)', value: 'deserti' },
          { name: 'Nv. 95 Exesa (Dunas de Alabastro)', value: 'exesa' },
          { name: 'Nv. 107 Usurpator (Ruínas Esquecidas)', value: 'usurpator' }
        )
    )
    .addStringOption(option =>
      option.setName('respawn')
        .setDescription('Horário exato do respawn (ex: 19:45) ou tempo restante (ex: 2h, 45m)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('boss-vivo')
    .setDescription('Marca um Boss como VIVO / APARECEU NO MAPA')
    .addStringOption(option =>
      option.setName('boss')
        .setDescription('Selecione o Boss que apareceu')
        .setRequired(true)
        .addChoices(
          { name: 'Nv. 47 Larva (Passagem do Alvorecer)', value: 'larva' },
          { name: 'Nv. 63 Brachium (Planícies Empaladas)', value: 'brachium' },
          { name: 'Nv. 70 Clamamus (Bosque Umbroso)', value: 'clamamus' },
          { name: 'Nv. 83 Deserti (Vale Estéril)', value: 'deserti' },
          { name: 'Nv. 95 Exesa (Dunas de Alabastro)', value: 'exesa' },
          { name: 'Nv. 107 Usurpator (Ruínas Esquecidas)', value: 'usurpator' }
        )
    ),

  new SlashCommandBuilder()
    .setName('boss-painel')
    .setDescription('Atualiza ou re-envia o painel fixo de cronograma de Bosses'),

  new SlashCommandBuilder()
    .setName('mover-auditorio')
    .setDescription('Move todos os membros em canais de voz para o Auditório')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .addBooleanOption(option =>
      option.setName('ignorar_afk')
        .setDescription('Ignorar membros na sala de AFK / Ausente? (Padrão: Sim)')
        .setRequired(false)
    )
    .addChannelOption(option =>
      option.setName('destino')
        .setDescription('Canal de voz de destino (Padrão: Auditório Boss Geena)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('presenca')
    .setDescription('Marca sua presença no Boss de Geena enviando o print de comprovação')
    .addAttachmentOption(option =>
      option.setName('print')
        .setDescription('Print da tela do jogo comprovando sua presença (Único campo obrigatório)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('tipo')
        .setDescription('Tipo de presença (Opcional - Padrão: Titular, seu próprio boneco)')
        .setRequired(false)
        .addChoices(
          { name: '🛡️ Titular (Meu próprio boneco)', value: 'titular' },
          { name: '🎮 Piloto (Jogando na conta de outro aliado)', value: 'piloto' }
        )
    )
    .addUserOption(option =>
      option.setName('dono')
        .setDescription('Caso seja Piloto, marque o Dono do Personagem no Discord')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('evento')
        .setDescription('Boss de Geena correspondente (Padrão: Auto-Detectar)')
        .setRequired(false)
        .addChoices(
          { name: '⚔️ Geena 15:00', value: 'geena_15' },
          { name: '⚔️ Geena 19:00', value: 'geena_19' },
          { name: '⚔️ Geena 23:00', value: 'geena_23' },
          { name: '🕒 Auto-Detectar pelo Horário Atual', value: 'auto' }
        )
    )
    .addStringOption(option =>
      option.setName('observacao')
        .setDescription('Observação ou anotação (Ex: Nick do boneco, squad, etc.)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('estender-presenca')
    .setDescription('Estende o tempo da janela de check-in do Boss atual (Staff e Líderes)')
    .addIntegerOption(option =>
      option.setName('minutos')
        .setDescription('Quantidade de minutos a adicionar (Padrão: 30 minutos)')
        .setMinValue(5)
        .setMaxValue(180)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('motivo')
        .setDescription('Motivo da extensão de tempo (opcional)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('presenca-painel')
    .setDescription('Atualiza ou re-envia o painel fixo de ranking de presenças (Staff)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('presenca-dkp-auditorio')
    .setDescription('Registra presença de todos no Auditório e credita DKP em lote (Líderes e Staff)')
    .addStringOption(option =>
      option.setName('evento')
        .setDescription('Selecione o evento de Boss/Raid correspondente')
        .setRequired(false)
        .addChoices(
          { name: '⚔️ Geena 15:00 (+30 DKP)', value: 'geena_15' },
          { name: '⚔️ Geena 19:00 (+20 DKP)', value: 'geena_19' },
          { name: '⚔️ Geena 23:00 (+30 DKP)', value: 'geena_23' },
          { name: '🕒 Auto-Detectar pelo Horário Atual', value: 'auto' }
        )
    )
    .addIntegerOption(option =>
      option.setName('dkp_manual')
        .setDescription('Valor customizado de DKP (opcional, substitui o valor padrão)')
        .setMinValue(1)
        .setMaxValue(500)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('motivo')
        .setDescription('Observação ou anotação do registro (opcional)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('dkp')
    .setDescription('Consulta o saldo pessoal ou de outro membro no sistema de DKP da Coalizão')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Membro a consultar o saldo de DKP (opcional, padrão: você)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('dkp-ranking')
    .setDescription('Exibe os Top jogadores com maior saldo de DKP acumulado na Coalizão'),

  new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Exibe os comandos disponíveis e guia do sistema'),

  new SlashCommandBuilder()
    .setName('overlay')
    .setDescription('Gera seu link seguro e exclusivo de acesso ao Overlay Tático'),

  new SlashCommandBuilder()
    .setName('painel-overlay')
    .setDescription('Envia o botão fixo de acesso ao Overlay no canal atual (Apenas Staff)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('call')
    .setDescription('Aloca uma guilda ou toda a coalizão para um Boss específico')
    .addStringOption(opt =>
      opt.setName('guilda')
        .setDescription('Tag da Guilda (ou TODAS para Call Geral)')
        .setRequired(true)
        .addChoices(
          { name: '👑 TODAS AS GUILDAS (Call Geral)', value: 'ALL' },
          { name: '🏰 [DIN] Dinastia', value: 'DIN' },
          { name: '🏰 [NOM] No Mercy', value: 'NOM' },
          { name: '🏰 [OLP] OLIMPO', value: 'OLP' },
          { name: '🏰 [NGF] NightFall', value: 'NGF' },
          { name: '🏰 [KTB] Kontrabandz', value: 'KTB' },
          { name: '🏰 [AFT] Aftermath', value: 'AFT' },
          { name: '🏰 [CHP] CHAPA1', value: 'CHP' },
          { name: '🏰 [FSN] Fusion', value: 'FSN' },
          { name: '🏰 [SPF] SempreFI', value: 'SPF' }
        )
    )
    .addIntegerOption(opt =>
      opt.setName('boss')
        .setDescription('Número do Boss (1 a 6)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(6)
    )
    .addIntegerOption(opt =>
      opt.setName('mapa')
        .setDescription('Qual mapa / andar (1 ou 2)')
        .setRequired(false)
        .addChoices(
          { name: 'Andar 1 (Mapa 1: 3 Bosses)', value: 1 },
          { name: 'Andar 2 (Mapa 2: 6 Bosses)', value: 2 }
        )
    ),

  new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Controle do Modo Combate / OpSec (oculta canais para membros sem tag)')
    .addStringOption(opt =>
      opt.setName('acao')
        .setDescription('Ação a ser executada')
        .setRequired(true)
        .addChoices(
          { name: '📊 Consultar Status Atual', value: 'status' },
          { name: '🔒 Ativar Modo Combate (Ocultar Canais)', value: 'ativar' },
          { name: '🔓 Desativar Modo Combate (Liberar Canais)', value: 'desativar' }
        )
    )
    .addStringOption(opt =>
      opt.setName('motivo')
        .setDescription('Motivo manual (opcional ao ativar/desativar)')
        .setRequired(false)
    )
];

module.exports = { commands };
