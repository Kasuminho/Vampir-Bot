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
const { getGuilds } = require('./data_manager');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ]
});

client.once('ready', async () => {
  console.log('[VISUAL] Conectado para aplicar melhorias visuais...');
  const guild = await client.guilds.fetch(process.env.GUILD_ID);
  const configPath = path.join(__dirname, '..', 'data', 'server_config.json');
  let config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const everyoneRole = guild.roles.everyone;
  const roles = await guild.roles.fetch();

  // -------------------------------------------------------------
  // 1. CARGOS SEPARADORES DE SEÇÃO NA LISTA LATERAL
  // -------------------------------------------------------------
  console.log('[CARGOS] Criando cargos separadores estéticos...');

  const getOrCreateRole = async (name, hoist = true) => {
    let r = roles.find(role => role.name === name);
    if (!r) {
      r = await guild.roles.create({
        name,
        hoist,
        color: '#2F3136',
        permissions: [],
        reason: 'Cargo estético separador de seção'
      });
      console.log(`[CARGOS] Criado separador: ${name}`);
    }
    return r;
  };

  const sepStaff = await getOrCreateRole('─── 🛡️ STAFF ───', true);
  const sepLider = await getOrCreateRole('─── 👑 LIDERANÇAS ───', true);
  const sepLegioes = await getOrCreateRole('─── 🏰 LEGIÕES ───', true);
  const sepComunidade = await getOrCreateRole('─── ⚔️ COMUNIDADE ───', true);
  const sepVisitantes = await getOrCreateRole('─── 👁️ VISITANTES ───', true);

  // Atribuir separador ao Dono/Líder
  try {
    const owner = await guild.members.fetch(guild.ownerId);
    if (owner) {
      await owner.roles.add(sepStaff);
      console.log('[CARGOS] Separador Staff atribuído ao dono!');
    }
  } catch (e) {
    console.warn('[AVISO] Falha ao atribuir separador:', e.message);
  }

  // -------------------------------------------------------------
  // 2. CATEGORIA E CANAIS DE ESTATÍSTICAS (SERVER STATS) NO TOPO
  // -------------------------------------------------------------
  console.log('[STATS] Criando contadores de status no topo...');
  let catStats = guild.channels.cache.find(c => c.name.includes('ESTATÍSTICAS'));
  
  if (!catStats) {
    catStats = await guild.channels.create({
      name: '📊 │ STATUS DO SERVIDOR',
      type: ChannelType.GuildCategory,
      position: 0,
      permissionOverwrites: [
        {
          id: everyoneRole.id,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.Connect] // Todos veem, mas ninguém entra
        }
      ]
    });
  }

  const registeredGuilds = getGuilds();
  let validadosCount = 0;
  try {
    const roleVal = await guild.roles.fetch(config.roles.validado);
    if (roleVal) validadosCount = roleVal.members.size;
  } catch {}

  const chStatMembros = await guild.channels.create({
    name: `👥・Membros: ${guild.memberCount}`,
    type: ChannelType.GuildVoice,
    parent: catStats.id,
    userLimit: 0,
    permissionOverwrites: [
      {
        id: everyoneRole.id,
        allow: [PermissionFlagsBits.ViewChannel],
        deny: [PermissionFlagsBits.Connect]
      }
    ]
  });

  const chStatGuilds = await guild.channels.create({
    name: `🏰・Guilds: ${registeredGuilds.length}`,
    type: ChannelType.GuildVoice,
    parent: catStats.id,
    userLimit: 0,
    permissionOverwrites: [
      {
        id: everyoneRole.id,
        allow: [PermissionFlagsBits.ViewChannel],
        deny: [PermissionFlagsBits.Connect]
      }
    ]
  });

  const chStatValidados = await guild.channels.create({
    name: `⚔️・Validados: ${validadosCount}`,
    type: ChannelType.GuildVoice,
    parent: catStats.id,
    userLimit: 0,
    permissionOverwrites: [
      {
        id: everyoneRole.id,
        allow: [PermissionFlagsBits.ViewChannel],
        deny: [PermissionFlagsBits.Connect]
      }
    ]
  });

  config.stats = {
    categoryId: catStats.id,
    membrosChannelId: chStatMembros.id,
    guildsChannelId: chStatGuilds.id,
    validadosChannelId: chStatValidados.id
  };

  // -------------------------------------------------------------
  // 3. PADRONIZAÇÃO VISUAL DOS NOMES DOS CANAIS COM '・'
  // -------------------------------------------------------------
  console.log('[NOMES] Padronizando nomes dos canais...');
  const renameSafe = async (channelId, newName) => {
    try {
      const ch = await guild.channels.fetch(channelId);
      if (ch && ch.name !== newName) {
        await ch.setName(newName);
        console.log(`[NOMES] Renomeado: ${ch.name} -> ${newName}`);
      }
    } catch (e) {
      console.warn(`[AVISO] Falha ao renomear ${channelId}:`, e.message);
    }
  };

  await renameSafe(config.channels.regras, '📌・regras-e-diretrizes');
  await renameSafe(config.channels.recrutamento, '🏰・recrutamento-guilds');
  await renameSafe(config.channels.anuncios, '📢・anúncios');
  await renameSafe(config.channels.boss, '🐉・boss-timers');
  await renameSafe(config.channels.estrategias, '🗺️・builds-e-estratégias');
  await renameSafe(config.channels.geral, '💬・chat-geral');
  await renameSafe(config.channels.vozLobby, '🔊・Lobby Geral');
  await renameSafe(config.channels.chatLideres, '💬・chat-lideranças');
  await renameSafe(config.channels.diplomacia, '⚔️・diplomacia-e-pactos');
  await renameSafe(config.channels.vozLideres, '🔊・Reunião de Líderes');
  await renameSafe(config.channels.gestaoGuilds, '🛠️・gestão-guilds');
  await renameSafe(config.channels.logs, '📊・logs-do-bot');

  // Atualizar canais da guild AlcatraZ
  if (registeredGuilds.length > 0) {
    const alc = registeredGuilds[0];
    if (alc.approvalsChannelId) await renameSafe(alc.approvalsChannelId, '📋・aprovações');
    if (alc.chatChannelId) await renameSafe(alc.chatChannelId, '💬・chat-interno');
  }

  // -------------------------------------------------------------
  // 4. SALAS DE VOZ COM USER LIMITS (DUO, SQUAD, AFK)
  // -------------------------------------------------------------
  console.log('[VOZ] Criando salas de voz táticas (Duo, Squad, AFK)...');
  const catComunidade = await guild.channels.fetch(config.categories.comunidade);

  const chDuo = await guild.channels.create({
    name: '🔊・Duo [2]',
    type: ChannelType.GuildVoice,
    parent: catComunidade.id,
    userLimit: 2
  });

  const chSquad1 = await guild.channels.create({
    name: '🔊・Squad 1 [4]',
    type: ChannelType.GuildVoice,
    parent: catComunidade.id,
    userLimit: 4
  });

  const chSquad2 = await guild.channels.create({
    name: '🔊・Squad 2 [4]',
    type: ChannelType.GuildVoice,
    parent: catComunidade.id,
    userLimit: 4
  });

  const chAFK = await guild.channels.create({
    name: '💤・AFK / Ausente',
    type: ChannelType.GuildVoice,
    parent: catComunidade.id,
    userLimit: 0
  });

  // Configurar canal AFK do servidor com timeout de 15 minutos (900 seg)
  try {
    await guild.setAFKChannel(chAFK);
    await guild.setAFKTimeout(900);
    console.log('[VOZ] Canal AFK oficial do servidor configurado!');
  } catch (err) {
    console.warn('[AVISO] Não foi possível vincular canal AFK nas configs do servidor:', err.message);
  }

  // -------------------------------------------------------------
  // 5. EMBED DE REGRAS REFINADO E DESIGN PROFISSIONAL
  // -------------------------------------------------------------
  console.log('[EMBEDS] Atualizando painel de regras com design moderno...');
  try {
    const chRegras = await guild.channels.fetch(config.channels.regras);
    if (chRegras) {
      // Limpar antigas
      const oldMsgs = await chRegras.messages.fetch({ limit: 10 });
      for (const [, m] of oldMsgs) await m.delete().catch(() => {});

      const embedHeader = new EmbedBuilder()
        .setTitle('🩸 ─── BEM-VINDO À COMUNIDADE VAMPIR ─── 🩸')
        .setDescription(
          '### ⚔️ O Ecossistema de Alianças e Legiões\n\n' +
          'Este servidor foi estruturado com segurança estrita para conectar as guilds mais fortes e organizadas de **Vampir**.\n\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '### 🔒 ACESSO CONTROLADO EM 3 NÍVEIS\n' +
          '• **Nível 1 — Visitante:** Você só enxerga esta área de acolhimento e o catálogo de recrutamento.\n' +
          '• **Nível 2 — Membro de Guild:** Ao ser aprovado por um líder de legião, você ganha acesso aos canais gerais, **World Boss Timers**, táticas e chats abertos.\n' +
          '• **Nível 3 — Líder de Guild:** Acesso exclusivo à Cúpula Diplomática para alinhar guerras territoriais e acordos com a Staff.\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
          '### 📜 CÓDIGO DE CONDUTA & REGRAS\n' +
          '`[ 01 ]` **Respeito Mútuo:** Toxicidade excessiva, discriminação ou ofensas pessoais não serão toleradas.\n' +
          '`[ 02 ]` **Anti-Spying:** Proibido vazar chats estratégicos, posicionamentos de Bosses ou informações internas de clãs parceiros.\n' +
          '`[ 03 ]` **Diplomacia:** Conflitos entre guilds devem ser debatidos no canal específico da Cúpula de Líderes com a Staff presente.\n' +
          '`[ 04 ]` **Uso de Voz:** Respeite o limite das salas táticas (Duo / Squad). Não interrompa chamadas de estratégia.\n' +
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
          '🚀 **COMO INGRESSAR:**\n' +
          'Acesse agora o canal <#' + config.channels.recrutamento + '>, escolha uma das legiões parceiras e preencha sua ficha de inscrição!'
        )
        .setColor(Colors.DarkRed)
        .setFooter({ text: 'Vampir Bot • Segurança e Gestão de Comunidades' })
        .setTimestamp();

      await chRegras.send({ embeds: [embedHeader] });
    }
  } catch (err) {
    console.warn('[AVISO] Falha ao atualizar regras:', err.message);
  }

  // Salvar configuração atualizada
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log('[SUCESSO] Todas as melhorias visuais foram aplicadas!');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
