require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  ChannelType, 
  PermissionFlagsBits, 
  Colors, 
  EmbedBuilder 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ]
});

client.once('ready', async () => {
  console.log(`[BOT] Conectado como ${client.user.tag}`);
  const guildId = process.env.GUILD_ID;
  const guild = await client.guilds.fetch(guildId);

  if (!guild) {
    console.error(`[ERRO] Servidor com ID ${guildId} não encontrado!`);
    process.exit(1);
  }

  console.log(`[SETUP] Iniciando faxina e estruturação do servidor: "${guild.name}"...`);

  // 1. Limpeza de canais existentes
  const channels = await guild.channels.fetch();
  for (const [id, ch] of channels) {
    if (ch) {
      try {
        console.log(`[LIMPEZA] Removendo canal antigo: ${ch.name}`);
        await ch.delete();
      } catch (err) {
        console.warn(`[AVISO] Não foi possível apagar ${ch.name}:`, err.message);
      }
    }
  }

  // 2. Criação dos Cargos Hierárquicos
  console.log('[CARGOS] Criando cargos da hierarquia de 3 níveis...');
  
  // Buscar cargos existentes para não duplicar se rodar novamente
  const roles = await guild.roles.fetch();
  const getOrCreateRole = async (name, options) => {
    let r = roles.find(role => role.name === name);
    if (!r) {
      r = await guild.roles.create({ name, ...options });
      console.log(`[CARGOS] Criado: ${name}`);
    } else {
      console.log(`[CARGOS] Já existente: ${name}`);
    }
    return r;
  };

  const roleStaff = await getOrCreateRole('[🛡️] Staff / Admin', {
    color: Colors.Red,
    hoist: true,
    permissions: [PermissionFlagsBits.Administrator],
    reason: 'Cargo máximo de gestão do servidor'
  });

  const roleLider = await getOrCreateRole('[👑] Líder de Guild', {
    color: Colors.Gold,
    hoist: true,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak
    ],
    reason: 'Cargo de liderança de guild/legião parceira'
  });

  const roleValidado = await getOrCreateRole('[⚔️] Player Validado', {
    color: Colors.Blue,
    hoist: true,
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak
    ],
    reason: 'Player membro de guild validado'
  });

  // Atribuir cargo de Staff ao Dono do servidor
  try {
    const ownerMember = await guild.members.fetch(guild.ownerId);
    if (ownerMember) {
      await ownerMember.roles.add(roleStaff);
      console.log(`[CARGOS] Cargo Staff atribuído ao dono (${ownerMember.user.tag})`);
    }
  } catch (err) {
    console.warn('[AVISO] Não foi possível atribuir cargo ao dono:', err.message);
  }

  const everyoneRole = guild.roles.everyone;

  // 3. Estruturação de Categorias e Canais
  console.log('[CANAIS] Criando categorias e canais protegidos...');

  // --- Categoria 1: RECEPÇÃO & ENTRADA ---
  const catRecepcao = await guild.channels.create({
    name: '🚪 │ RECEPÇÃO & ENTRADA',
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: everyoneRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
        deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
      }
    ]
  });

  const chRegras = await guild.channels.create({
    name: '📌-regras-e-diretrizes',
    type: ChannelType.GuildText,
    parent: catRecepcao.id
  });

  const chRecrutamento = await guild.channels.create({
    name: '🏰-recrutamento-guilds',
    type: ChannelType.GuildText,
    parent: catRecepcao.id
  });

  // --- Categoria 2: COMUNIDADE GERAL ---
  const catComunidade = await guild.channels.create({
    name: '🌐 │ COMUNIDADE GERAL',
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: everyoneRole.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: roleValidado.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AddReactions,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak
        ]
      }
    ]
  });

  const chAnuncios = await guild.channels.create({
    name: '📢-anuncios',
    type: ChannelType.GuildText,
    parent: catComunidade.id,
    permissionOverwrites: [
      {
        id: everyoneRole.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: roleValidado.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
        deny: [PermissionFlagsBits.SendMessages]
      },
      {
        id: roleStaff.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      }
    ]
  });

  const chBoss = await guild.channels.create({
    name: '🐉-boss-timers-e-alertas',
    type: ChannelType.GuildText,
    parent: catComunidade.id
  });

  const chEstrategias = await guild.channels.create({
    name: '🗺️-builds-e-estrategias',
    type: ChannelType.GuildText,
    parent: catComunidade.id
  });

  const chGeral = await guild.channels.create({
    name: '💬-chat-geral',
    type: ChannelType.GuildText,
    parent: catComunidade.id
  });

  const chVozLobby = await guild.channels.create({
    name: '🔊 │ Voz Geral (Lobby)',
    type: ChannelType.GuildVoice,
    parent: catComunidade.id
  });

  // --- Categoria 3: CÚPULA DE LÍDERES ---
  const catLideres = await guild.channels.create({
    name: '👑 │ CÚPULA DE LÍDERES',
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: everyoneRole.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: roleValidado.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: roleLider.id,
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

  const chChatLideres = await guild.channels.create({
    name: '💬-chat-liderancas',
    type: ChannelType.GuildText,
    parent: catLideres.id
  });

  const chDiplomacia = await guild.channels.create({
    name: '⚔️-diplomacia-e-pactos',
    type: ChannelType.GuildText,
    parent: catLideres.id
  });

  const chVozLideres = await guild.channels.create({
    name: '🔊 │ Reunião de Líderes',
    type: ChannelType.GuildVoice,
    parent: catLideres.id
  });

  // --- Categoria 4: ADMINISTRAÇÃO & LOGS ---
  const catAdmin = await guild.channels.create({
    name: '⚙️ │ ADMINISTRAÇÃO & LOGS',
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: everyoneRole.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: roleValidado.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: roleLider.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: roleStaff.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    ]
  });

  const chGestaoGuilds = await guild.channels.create({
    name: '🛠️-gestao-guilds',
    type: ChannelType.GuildText,
    parent: catAdmin.id
  });

  const chLogs = await guild.channels.create({
    name: '📊-logs-do-bot',
    type: ChannelType.GuildText,
    parent: catAdmin.id
  });

  // 4. Salvar Configuração no Disco
  const configData = {
    guildId: guild.id,
    roles: {
      staff: roleStaff.id,
      lider: roleLider.id,
      validado: roleValidado.id
    },
    categories: {
      recepcao: catRecepcao.id,
      comunidade: catComunidade.id,
      lideres: catLideres.id,
      admin: catAdmin.id
    },
    channels: {
      regras: chRegras.id,
      recrutamento: chRecrutamento.id,
      anuncios: chAnuncios.id,
      boss: chBoss.id,
      estrategias: chEstrategias.id,
      geral: chGeral.id,
      vozLobby: chVozLobby.id,
      chatLideres: chChatLideres.id,
      diplomacia: chDiplomacia.id,
      vozLideres: chVozLideres.id,
      gestaoGuilds: chGestaoGuilds.id,
      logs: chLogs.id
    }
  };

  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(path.join(dataDir, 'server_config.json'), JSON.stringify(configData, null, 2));

  // 5. Postar Mensagens Iniciais Estilizadas
  const embedRegras = new EmbedBuilder()
    .setTitle('🩸 BEM-VINDO À COMUNIDADE VAMPIR')
    .setDescription(
      'Este é o servidor oficial de alianças e legiões de **Vampir**.\n\n' +
      '### 🔒 ACESSO CONTROLADO (ZERO-TRUST)\n' +
      'Por motivos de segurança e organização estratégica:\n' +
      '1. **Novos membros** só conseguem visualizar esta área de entrada.\n' +
      '2. Para liberar acesso aos canais gerais, alertas de World Bosses e estratégias, você precisa pertencer a uma **Guild Parceira**.\n\n' +
      '### 📜 DIRETRIZES DA COMUNIDADE\n' +
      '• Respeite as alianças e regras de convivência entre guilds.\n' +
      '• Proibido spy/vazamento de estratégias internas.\n' +
      '• Mantenha o respeito com lideranças e jogadores.\n\n' +
      '➡️ **Próximo passo:** Vá para o canal <#' + chRecrutamento.id + '> e aplique para uma das guilds parceiras!'
    )
    .setColor(Colors.DarkRed)
    .setFooter({ text: 'Vampir Bot • Sistema de Gestão e Segurança' })
    .setTimestamp();

  await chRegras.send({ embeds: [embedRegras] });

  const embedRecrutamentoInfo = new EmbedBuilder()
    .setTitle('🏰 RECRUTAMENTO DE GUILDS & LEGIÕES')
    .setDescription(
      'Abaixo estão listadas todas as **Guilds Parceiras** autorizadas no servidor.\n\n' +
      '**Como funciona o processo de entrada:**\n' +
      '1. Escolha a guild que deseja ingressar e clique no botão **"✉️ Aplicar"**.\n' +
      '2. Preencha a sua ficha (Nick in-game, Classe, Level e Horários).\n' +
      '3. Sua ficha será avaliada diretamente pela liderança da guild.\n' +
      '4. Assim que for aceito, seus cargos serão liberados automaticamente e o servidor inteiro será aberto para você!\n\n' +
      '*Aguarde as lideranças cadastrarem suas guilds abaixo ou chame um administrador se sua guild for parceira.*'
    )
    .setColor(Colors.Purple)
    .setFooter({ text: 'Sistema de Inscrições Integrado' })
    .setTimestamp();

  await chRecrutamento.send({ embeds: [embedRecrutamentoInfo] });

  console.log('[SUCESSO] Servidor completamente estruturado e configurado!');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
