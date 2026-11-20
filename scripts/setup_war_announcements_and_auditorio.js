require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
  Colors,
  PermissionFlagsBits
} = require('discord.js');
const { query } = require('../src/database/db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const ROLE_IDS = {
  everyone: '1565123866488209529',
  validado: '1565129722961207388',
  staff: '1565129720444485662',
  liderRust2: '1565129721606574103',
  oficialRust2: '1565895782174040124',
  liderRust1: '1572768214675361792',
  oficialRust1: '1572768217707974776',
  caller: '1566152015795458120',
  comandante: '1570146588893122621'
};

const WAR_CATEGORY_ID = '1572764884918210671'; // ⚔️ │ FRENTE DE GUERRA GEENA
const AUDITORIO_ID = '1565408234867662931'; // 🎙️・Auditório ┃ Boss Geena

client.once('ready', async () => {
  console.log(`[SETUP] Conectado como ${client.user.tag}`);

  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    console.log(`[SETUP] Servidor: ${guild.name} (${guild.id})`);

    // =========================================================================
    // 1. AJUSTAR PERMISSÕES ESTRITAS DO AUDITÓRIO
    // =========================================================================
    console.log('\n[AUDITÓRIO] Ajustando permissões do Auditório...');
    const chAuditorio = await guild.channels.fetch(AUDITORIO_ID).catch(() => null);

    if (!chAuditorio) {
      console.error('[ERRO] Canal do Auditório não encontrado!');
    } else {
      console.log(`[AUDITÓRIO] Canal encontrado: ${chAuditorio.name}`);

      // 1. @everyone: Bloqueado
      await chAuditorio.permissionOverwrites.set([
        {
          id: ROLE_IDS.everyone,
          deny: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak
          ]
        },
        // 2. [⚔️] Player Validado: Pode ver e conectar, mas NÃO PODE FALAR nem mandar texto
        {
          id: ROLE_IDS.validado,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.ReadMessageHistory
          ],
          deny: [
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.RequestToSpeak
          ]
        },
        // 3. [🛡️] Staff / Admin: Controle total
        {
          id: ROLE_IDS.staff,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.UseVAD,
            PermissionFlagsBits.PrioritySpeaker,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.ManageChannels
          ]
        },
        // 4. [👑] Líder (Rust 2): Fala liberada + Prioridade
        {
          id: ROLE_IDS.liderRust2,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.UseVAD,
            PermissionFlagsBits.PrioritySpeaker,
            PermissionFlagsBits.MuteMembers
          ]
        },
        // 5. [👑] Líder (Rust 1): Fala liberada + Prioridade
        {
          id: ROLE_IDS.liderRust1,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.UseVAD,
            PermissionFlagsBits.PrioritySpeaker,
            PermissionFlagsBits.MuteMembers
          ]
        },
        // 6. [🎖️] Oficial (Rust 2): Fala liberada
        {
          id: ROLE_IDS.oficialRust2,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.UseVAD,
            PermissionFlagsBits.PrioritySpeaker
          ]
        },
        // 7. [🎖️] Oficial (Rust 1): Fala liberada
        {
          id: ROLE_IDS.oficialRust1,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.UseVAD,
            PermissionFlagsBits.PrioritySpeaker
          ]
        },
        // 8. [📢] Shout Caller: Fala liberada + Prioridade de áudio
        {
          id: ROLE_IDS.caller,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.UseVAD,
            PermissionFlagsBits.PrioritySpeaker
          ]
        },
        // 9. Comandante de Guerra: Fala liberada
        {
          id: ROLE_IDS.comandante,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.UseVAD,
            PermissionFlagsBits.PrioritySpeaker
          ]
        }
      ]);

      console.log('[AUDITÓRIO] Permissões estritas aplicadas com sucesso! Membros normais não podem falar.');
    }

    // =========================================================================
    // 2. CRIAR OU AJUSTAR CANAL DE AVISOS NA FRENTE DE GUERRA
    // =========================================================================
    console.log('\n[AVISOS-GUERRA] Verificando canal de avisos em Frente de Guerra...');
    const channels = await guild.channels.fetch();

    let chAvisos = channels.find(c =>
      c && c.parentId === WAR_CATEGORY_ID &&
      (c.name.includes('avisos') || c.name.includes('anuncios-guerra'))
    );

    if (!chAvisos) {
      console.log('[AVISOS-GUERRA] Criando novo canal 📢・avisos-de-guerra...');
      chAvisos = await guild.channels.create({
        name: '📢・avisos-de-guerra',
        type: ChannelType.GuildText,
        parent: WAR_CATEGORY_ID,
        topic: '📢 Central Oficial de Avisos e Estratégias de Guerra da Coalizão (Rust 1 & Rust 2) ┃ Apenas Liderança posta',
        position: 0,
        permissionOverwrites: [
          // @everyone: Oculto
          {
            id: ROLE_IDS.everyone,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          // [⚔️] Player Validado: Apenas Leitura e Reações
          {
            id: ROLE_IDS.validado,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AddReactions
            ],
            deny: [
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.CreatePublicThreads,
              PermissionFlagsBits.CreatePrivateThreads
            ]
          },
          // [🛡️] Staff / Admin: Postagem e Gestão
          {
            id: ROLE_IDS.staff,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.MentionEveryone,
              PermissionFlagsBits.ManageMessages
            ]
          },
          // [👑] Líder (Rust 2): Postagem completa
          {
            id: ROLE_IDS.liderRust2,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.MentionEveryone
            ]
          },
          // [👑] Líder (Rust 1): Postagem completa
          {
            id: ROLE_IDS.liderRust1,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.MentionEveryone
            ]
          },
          // [🎖️] Oficial (Rust 2): Postagem completa
          {
            id: ROLE_IDS.oficialRust2,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.MentionEveryone
            ]
          },
          // [🎖️] Oficial (Rust 1): Postagem completa
          {
            id: ROLE_IDS.oficialRust1,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.MentionEveryone
            ]
          },
          // [📢] Shout Caller: Postagem de alertas/calls
          {
            id: ROLE_IDS.caller,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles
            ]
          },
          // Comandante de Guerra: Postagem de alertas
          {
            id: ROLE_IDS.comandante,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles
            ]
          }
        ]
      });
      console.log(`[AVISOS-GUERRA] Canal criado: ${chAvisos.name} (${chAvisos.id})`);
    } else {
      console.log(`[AVISOS-GUERRA] Canal já existia: ${chAvisos.name} (${chAvisos.id}). Atualizando permissões...`);
      await chAvisos.permissionOverwrites.set([
        {
          id: ROLE_IDS.everyone,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: ROLE_IDS.validado,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AddReactions
          ],
          deny: [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.CreatePublicThreads,
            PermissionFlagsBits.CreatePrivateThreads
          ]
        },
        {
          id: ROLE_IDS.staff,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.MentionEveryone,
            PermissionFlagsBits.ManageMessages
          ]
        },
        {
          id: ROLE_IDS.liderRust2,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.MentionEveryone
          ]
        },
        {
          id: ROLE_IDS.liderRust1,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.MentionEveryone
          ]
        },
        {
          id: ROLE_IDS.oficialRust2,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.MentionEveryone
          ]
        },
        {
          id: ROLE_IDS.oficialRust1,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.MentionEveryone
          ]
        },
        {
          id: ROLE_IDS.caller,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles
          ]
        },
        {
          id: ROLE_IDS.comandante,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles
          ]
        }
      ]);
      await chAvisos.setPosition(0).catch(() => {});
    }

    // Garante que a posição de avisos-de-guerra é a primeira (topo da categoria)
    await chAvisos.setPosition(0).catch(() => {});

    // Posta o comunicado inaugural e fixa se o canal estiver vazio
    const recentMsgs = await chAvisos.messages.fetch({ limit: 5 }).catch(() => null);
    if (!recentMsgs || recentMsgs.size === 0) {
      console.log('[AVISOS-GUERRA] Postando comunicado institucional de abertura...');
      const bannerEmbed = new EmbedBuilder()
        .setTitle('⚔️ FRENTE DE GUERRA GEENA ┃ COMUNICADOS & AVISOS OFICIAIS')
        .setDescription(
          'Bem-vindo à **Central Oficial de Avisos e Estratégias** da Frente de Guerra Geena!\n\n' +
          'Este canal conecta as forças de combate de **Rust 1 e Rust 2** e serve como o mural de comunicados rápidos, convocações e alinhamentos de batalha da Coalizão Vampir.\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
          '### 👑 Regras de Utilização para Lideranças:\n' +
          '• **Apenas Líderes, Oficiais, Comandantes de Guerra e Staff** possuem permissão de escrita neste canal.\n' +
          '• Utilize para convocar membros, definir horários de concentração, alocação de squads e anúncios de emergência.\n' +
          '• Mantenha os comunicados objetivos e focados nas operações de Geena e Bosses mundiais.\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
          '### 🛡️ Regras para Combatentes e Membros:\n' +
          '• Todos os integrantes das legiões parceiras podem **ler e reagir** aos comunicados.\n' +
          '• Ative as notificações deste canal para não perder o chamado das janelas de Geena (**15h, 19h e 23h**).\n' +
          '• Para discussões táticas ou dúvidas, utilize os canais internos da sua guild ou o chat geral comunitário.\n\n' +
          '*⚔️ União, Força e Glória — Coalizão Vampir*'
        )
        .setColor(Colors.DarkRed)
        .setFooter({ text: 'Coalizão Vampir • Frente de Guerra Geena' })
        .setTimestamp();

      const sent = await chAvisos.send({ embeds: [bannerEmbed] });
      await sent.pin().catch(() => {});
    }

    // =========================================================================
    // 3. ATUALIZAR SERVER_CONFIG NO POSTGRESQL
    // =========================================================================
    console.log('\n[CONFIG] Atualizando server_config no PostgreSQL...');
    const res = await query('SELECT config_json FROM server_config WHERE id = $1', ['primary']);
    if (res.rows.length > 0) {
      const cfg = res.rows[0].config_json;
      if (!cfg.channels) cfg.channels = {};
      cfg.channels.avisosGuerra = chAvisos.id;
      cfg.channels.auditorio = AUDITORIO_ID;

      await query('UPDATE server_config SET config_json = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(cfg), 'primary']);
      console.log('[CONFIG] server_config atualizado com sucesso no PostgreSQL!');
    }

    console.log('\n[CONCLUÍDO] Ajustes da Frente de Guerra e do Auditório finalizados com sucesso!');
  } catch (err) {
    console.error('[ERRO] Falha geral no script:', err);
  } finally {
    setTimeout(() => {
      client.destroy();
      process.exit(0);
    }, 1500);
  }
});

client.login(process.env.DISCORD_TOKEN);
