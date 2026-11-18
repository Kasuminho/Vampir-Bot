const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');

// Sessões de autenticação curtas para evitar o limite de 512 caracteres dos botões do Discord
const activeSessions = new Map();
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');

const { getServerConfig, getGuilds } = require('../data_manager');

// --- ROLES BASE (VAMPIR - RUST 2) ---
const ROLES = {
  WAR_COMMANDER: '1570146588893122621',  // Comandante de Guerra
  STAFF_ADMIN: '1565129720444485662',     // [🛡️] Staff / Admin
  SHOUT_CALLER: '1566152015795458120',    // [📢] Shout Caller
  GUILD_LEADER: '1565129721606574103',    // [👑] Líder de Guild
  GUILD_OFFICER: '1565895782174040124',   // [🎖️] Oficial de Guild
  VALIDATED_PLAYER: '1565129722961207388' // [⚔️] Player Validado
};

// --- CONFIGURATION ---
const PORT = process.env.OVERLAY_PORT || process.env.PORT || 3000;
const CLIENT_SECRET = process.env.CLIENT_SECRET || process.env.DISCORD_TOKEN || 'vampir-secret-jwt-key';
const TUNNEL_LOG_PATH = process.env.TUNNEL_LOG_PATH || '/shared/tunnel.log';

let currentPublicUrl = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
let ioInstance = null;

// Paleta tática vibrante para distinção rápida no mapa
const TACTICAL_COLORS = [
  '#f1c40f', // OLP - Dourado / Amarelo
  '#e74c3c', // NOM - Vermelho
  '#1abc9c', // NGF - Turquesa / Verde-água
  '#3498db', // KTB - Azul
  '#9b59b6', // AFT - Roxo
  '#e67e22', // CHP - Laranja
  '#e91e63', // FSN - Rosa
  '#2ecc71', // SPF - Verde Esmeralda
  '#00bcd4', // TRANS - Ciano
  '#ff5722', // Laranja Escuro
  '#8e44ad', // Roxo Profundo
  '#16a085'  // Jade
];

function getTacticalGuilds() {
  const registered = getGuilds();
  return registered.map((g, idx) => ({
    id: g.tag,
    tag: g.tag,
    name: `[${g.tag}] ${g.name}`,
    server: g.server || (['CHP', 'SPF', 'TRANS'].includes(g.tag) ? 'Rust 1' : 'Rust 2'),
    color: (g.color && g.color.toLowerCase() !== '#9b59b6') ? g.color : TACTICAL_COLORS[idx % TACTICAL_COLORS.length]
  }));
}

// --- ESTADO INICIAL DA GUERRA ---
let battleState = {
  activeMap: 1, // 1: Geena 2, 2: Geena 1 Inferior
  assignments: {},
  combatModes: {}, // { guildId: 'BOSS' | 'PVP' }
  deadBosses: {}, // { bossId: timestamp }
  callGeral: null, // { bossId, bossName, author }
  serverCalls: {
    rust1: null, // { bossId, bossName, mapId, author, timestamp }
    rust2: null  // { bossId, bossName, mapId, author, timestamp }
  }
};

// Carrega as tags das guildas dinamicamente da base
function initGuildAssignments() {
  const guilds = getGuilds();
  const currentTags = new Set(guilds.map(g => g.tag).filter(Boolean));

  // Remove guildas que saíram da coalizão
  for (const tag of Object.keys(battleState.assignments)) {
    if (!currentTags.has(tag)) {
      delete battleState.assignments[tag];
      delete battleState.combatModes[tag];
    }
  }

  // Registra novas guildas
  for (const tag of currentTags) {
    if (!(tag in battleState.assignments)) {
      battleState.assignments[tag] = null;
    }
  }
}
initGuildAssignments();

function broadcastGuildsUpdate() {
  if (!ioInstance) return;
  initGuildAssignments();
  ioInstance.emit('guilds_updated', {
    guilds: getTacticalGuilds(),
    assignments: battleState.assignments
  });
}

// --- DETECTOR DINÂMICO DE URL DO CLOUDFLARE TUNNEL ---
function readTunnelUrlFromLog() {
  try {
    if (fs.existsSync(TUNNEL_LOG_PATH)) {
      const data = fs.readFileSync(TUNNEL_LOG_PATH, 'utf-8');
      const match = data.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match) {
        if (match[0] !== currentPublicUrl) {
          currentPublicUrl = match[0];
          console.log(`\n======================================================`);
          console.log(`🚀 [CLOUDFLARE TUNNEL ATIVO] Novo link público detectado:`);
          console.log(`👉 ${currentPublicUrl}`);
          console.log(`======================================================\n`);
        }
        return match[0];
      }
    }
  } catch (err) {}
  return currentPublicUrl;
}

function watchTunnelLog() {
  setInterval(readTunnelUrlFromLog, 2000);
  readTunnelUrlFromLog();
}

// --- AVALIADOR DE PERMISSÕES DO MEMBRO ---
function evaluateMemberPermissions(member) {
  const roleIds = member.roles.cache.map(r => r.id);
  const guilds = getGuilds();

  // 1. Comandante de Guerra (Apenas Kasumo e membros com o cargo exclusivo 'Comandante de Guerra')
  const isOwnerOrKasumo = member.id === '273600843251712020' || (member.guild && member.guild.ownerId === member.id);
  const isWarCommander = roleIds.includes(ROLES.WAR_COMMANDER) || isOwnerOrKasumo;
  const canCallGeneral = isWarCommander;

  // 2. Staff e Shout Caller
  const isStaff = roleIds.includes(ROLES.STAFF_ADMIN) || member.permissions.has(PermissionFlagsBits.Administrator);
  const isShoutCaller = roleIds.includes(ROLES.SHOUT_CALLER);

  // 3. Identificar a Guilda do Membro e cargos de liderança
  let userGuild = null;
  let isLeader = roleIds.includes(ROLES.GUILD_LEADER);
  let isOfficer = roleIds.includes(ROLES.GUILD_OFFICER);

  for (const g of guilds) {
    const isMemberOfGuild = roleIds.includes(g.roleId);
    const isDirectLeader = member.id === g.leaderId;
    const isDirectOfficer = Array.isArray(g.officerIds) && g.officerIds.includes(member.id);
    const isDirectCaller = Array.isArray(g.callerIds) && g.callerIds.includes(member.id);

    if (isMemberOfGuild || isDirectLeader || isDirectOfficer || isDirectCaller) {
      userGuild = g;
      if (isDirectLeader) isLeader = true;
      if (isDirectOfficer || isDirectCaller) isOfficer = true;
      break;
    }
  }

  const canCallGuild = isLeader || isOfficer || canCallGeneral;
  const isValidated = roleIds.includes(ROLES.VALIDATED_PLAYER);
  const isAllowed = isWarCommander || isStaff || isShoutCaller || isValidated || (userGuild !== null);

  return {
    isAllowed,
    canCallGeneral,
    canCallGuild,
    userGuild,
    isWarCommander,
    isStaff,
    isLeader,
    isOfficer
  };
}

// --- GERAÇÃO DE RESPOSTA COM LINK SEGURO ---
function createAuthResponse(member) {
  // Força uma leitura em tempo real do túnel
  const activeUrl = readTunnelUrlFromLog();

  const perm = evaluateMemberPermissions(member);
  if (!perm.isAllowed) {
    return {
      success: false,
      message: '❌ **Acesso Negado:** Você precisa ter o cargo de `[⚔️] Player Validado` ou ser membro de uma guilda parceira da Aliança.'
    };
  }

  // Gera Token JWT (válido por 8 horas) sem campos pesados desnecessários
  const token = jwt.sign(
    {
      serverUrl: activeUrl,
      userId: member.id,
      username: member.displayName || member.user.username,
      guildId: perm.userGuild ? perm.userGuild.tag : null,
      guildName: perm.userGuild ? perm.userGuild.name : 'Aliança',
      canCallGuild: perm.canCallGuild,
      canCallGeneral: perm.canCallGeneral
    },
    CLIENT_SECRET,
    { expiresIn: '8h' }
  );

  // Registra sessão curta para URL leve no botão (máx 512 chars no Discord)
  const sessionId = crypto.randomBytes(8).toString('hex');
  activeSessions.set(sessionId, {
    token,
    expiresAt: Date.now() + 8 * 3600 * 1000
  });

  // Limpa sessões antigas
  if (activeSessions.size > 500) {
    const now = Date.now();
    for (const [id, sess] of activeSessions.entries()) {
      if (sess.expiresAt <= now) activeSessions.delete(id);
    }
  }

  const shortUrl = `${activeUrl}/?s=${sessionId}`;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('📥 Baixar App Windows (.exe)')
      .setStyle(ButtonStyle.Link)
      .setURL('https://github.com/Kasuminho/Vampir-Bot/releases/latest/download/VampirOverlay.exe')
      .setEmoji('💻'),
    new ButtonBuilder()
      .setLabel('🚀 Abrir Overlay no Navegador')
      .setStyle(ButtonStyle.Link)
      .setURL(shortUrl)
      .setEmoji('🌐')
  );

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Acesso Autorizado - Overlay Tático da Aliança')
    .setDescription(
      `Olá **${member.displayName}**!\nSeu acesso seguro foi gerado e é válido por **8 horas**.\n\n` +
      `🌐 **Link de Acesso Direto (Navegador):**\n` +
      `${shortUrl}\n\n` +
      `🔑 **Token de Acesso (para o App Windows):**\n` +
      `\`\`\`text\n${token}\n\`\`\`\n` +
      `💡 **No App Windows (.exe):** Abra o app, clique no status **🔴 Desconectado** ou na engrenagem ⚙️ e cole o Token ou o Link acima para conectar!`
    )
    .addFields(
      { name: '🏰 Sua Legião', value: perm.userGuild ? `[${perm.userGuild.tag}] ${perm.userGuild.name}` : 'Membro da Coalizão', inline: true },
      { name: '👑 Permissão de Call', value: perm.canCallGeneral ? '👑 Comandante de Guerra (All-In)' : (perm.canCallGuild ? '🛡️ Call da Guilda' : '⚔️ Visualização'), inline: true }
    )
    .setColor(perm.canCallGeneral ? 0xf1c40f : (perm.canCallGuild ? 0x2ecc71 : 0x3498db))
    .setFooter({ text: 'Vampir Tactical Overlay • Sistema de Coordenação GvG' });

  return {
    success: true,
    embeds: [embed],
    components: [row]
  };
}

// --- RENDERIZAR PAINEL FIXO NO CANAL ---
async function renderOverlayPanel(channel) {
  const embed = new EmbedBuilder()
    .setTitle('🏰 Overlay Tático da Aliança - Vampir / Rust 2')
    .setDescription(
      'Tenha a visão em tempo real de onde cada guilda da aliança está alocada durante as wars e chefes de mundo!\n\n' +
      '• **Líderes de Guilda:** Podem alocar o destino da guilda via teclado numérico (`1 a 6`).\n' +
      '• **Foco em PVP ou Boss:** Alterne com a barra (`/`).\n' +
      '• **Sinalizar Inimigos:** Clique no mapa para alertar a coalizão inteira.\n' +
      '• **Comandantes:** Disparam a Call Geral de emergência (`*`).'
    )
    .setColor(0x9b59b6);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_get_overlay')
      .setLabel('⚔️ Gerar Meu Acesso / Token')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔑'),
    new ButtonBuilder()
      .setLabel('📥 Baixar App Windows (.exe)')
      .setStyle(ButtonStyle.Link)
      .setURL('https://github.com/Kasuminho/Vampir-Bot/releases/latest/download/VampirOverlay.exe')
      .setEmoji('💻')
  );

  await channel.send({ embeds: [embed], components: [row] });
}

// --- INICIALIZADOR DO SERVIÇO DE OVERLAY ---
function startOverlayService(client) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });
  ioInstance = io;

  app.use(cors());
  app.use(express.json());

  // Redireciona links de sessão curta diretamente para o overlay com token completo
  app.get('/', (req, res, next) => {
    const s = req.query.s || req.query.session;
    if (s && activeSessions.has(s)) {
      const sess = activeSessions.get(s);
      if (sess.expiresAt > Date.now()) {
        return res.redirect(`/?token=${sess.token}`);
      }
    }
    next();
  });

  app.get('/api/session/:id', (req, res) => {
    const sess = activeSessions.get(req.params.id);
    if (!sess || sess.expiresAt < Date.now()) {
      return res.status(404).json({ error: 'Sessão expirada ou não encontrada' });
    }
    res.json({ token: sess.token });
  });

  // Serve os arquivos do overlay (HTML, imagens do mapa)
  const publicPath = path.join(__dirname, '..', '..', 'public');
  app.use(express.static(publicPath));

  app.get('/api/status', (req, res) => {
    res.json({
      status: 'online',
      publicUrl: currentPublicUrl,
      activeMap: battleState.activeMap,
      connectedClients: io.engine.clientsCount
    });
  });

  // Watch Cloudflare Tunnel logs
  watchTunnelLog();

  // Middleware de Autenticação WebSocket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token não fornecido'));

    jwt.verify(token, CLIENT_SECRET, (err, decoded) => {
      if (err) return next(new Error('Token inválido ou expirado'));
      socket.user = decoded;
      next();
    });
  });

  io.on('connection', socket => {
    console.log(`🔌 [OVERLAY WS] Conectado: ${socket.user.username} (${socket.user.guildId || 'Coalizão'})`);

    // Sincroniza estado inicial com lista dinâmica de guildas e cores táticas
    socket.emit('init_state', {
      battleState,
      guilds: getTacticalGuilds(),
      user: socket.user
    });

    // Alternar mapa
    socket.on('switch_map', mapId => {
      if (!socket.user.canCallGeneral) return;
      battleState.activeMap = mapId;
      io.emit('map_switched', { mapId, author: socket.user.username });
    });

    // Call de Guilda (com suporte a Mapa / Andar)
    socket.on('set_guild_call', ({ guildId, bossId, mapId }) => {
      const canManage = socket.user.canCallGeneral || (socket.user.canCallGuild && socket.user.guildId === guildId);
      if (!canManage) return socket.emit('error_msg', 'Sem permissão para esta guilda.');

      const targetMap = mapId || battleState.activeMap || 1;
      battleState.assignments[guildId] = { bossId, mapId: targetMap };

      io.emit('state_updated', {
        assignments: battleState.assignments,
        combatModes: battleState.combatModes,
        action: `[${guildId}] Call atualizada ➔ Boss ${bossId} (Mapa ${targetMap})`
      });
    });

    // Modo de Combate (BOSS vs PVP)
    socket.on('set_combat_mode', ({ guildId, mode }) => {
      const canManage = socket.user.canCallGeneral || (socket.user.canCallGuild && socket.user.guildId === guildId);
      if (!canManage) return;

      battleState.combatModes[guildId] = mode;
      io.emit('state_updated', {
        assignments: battleState.assignments,
        combatModes: battleState.combatModes,
        action: `[${guildId}] Foco alterado para: ${mode === 'PVP' ? '⚔️ PVP' : '🎯 BOSS'}`
      });
    });

    // Ping Tático no Mapa (Inimigo Detectado)
    socket.on('map_ping', (ping) => {
      io.emit('map_ping', ping);
    });

    // Call Geral / All-In
    socket.on('trigger_call_geral', ({ bossId, bossName, mapId }) => {
      if (!socket.user.canCallGeneral) return socket.emit('error_msg', 'Apenas Comandantes podem dar Call Geral.');

      const targetMap = mapId || battleState.activeMap || 1;
      const bName = bossName || (bossId === 0 ? 'Lorde Enoch' : `Boss ${bossId}`);
      Object.keys(battleState.assignments).forEach(g => {
        battleState.assignments[g] = { bossId, mapId: targetMap };
      });

      battleState.callGeral = { bossId, bossName: bName, mapId: targetMap, author: socket.user.username };
      battleState.serverCalls.rust1 = { server: 'RUST 1', bossId, bossName: bName, mapId: targetMap, author: socket.user.username, timestamp: Date.now() };
      battleState.serverCalls.rust2 = { server: 'RUST 2', bossId, bossName: bName, mapId: targetMap, author: socket.user.username, timestamp: Date.now() };

      io.emit('call_geral_active', {
        callGeral: battleState.callGeral,
        assignments: battleState.assignments
      });
      io.emit('server_call_updated', {
        serverCalls: battleState.serverCalls,
        assignments: battleState.assignments
      });
    });

    // Limpar Call Geral
    socket.on('clear_call_geral', () => {
      if (!socket.user.canCallGeneral) return;
      battleState.callGeral = null;
      io.emit('call_geral_cleared');
    });

    // Call de Servidor (Rust 1 ou Rust 2)
    socket.on('set_server_call', ({ server, bossId, bossName, mapId }) => {
      if (!socket.user.canCallGeneral) return socket.emit('error_msg', 'Apenas Comandantes podem emitir Call de Servidor.');

      const targetMap = mapId || battleState.activeMap || 1;
      const serverKey = server.toLowerCase().includes('1') ? 'rust1' : 'rust2';
      const serverLabel = serverKey === 'rust1' ? 'RUST 1' : 'RUST 2';
      const targetGuilds = serverKey === 'rust1' ? ['CHP', 'SPF', 'TRANS'] : ['OLP', 'NOM', 'NGF', 'KTB', 'AFT', 'FSN'];
      const bName = bossName || (bossId === 0 ? 'Lorde Enoch' : `Boss ${bossId}`);

      battleState.serverCalls[serverKey] = {
        server: serverLabel,
        bossId,
        bossName: bName,
        mapId: targetMap,
        author: socket.user.username,
        timestamp: Date.now()
      };

      // Aloca todas as guildas daquele servidor
      targetGuilds.forEach(gTag => {
        if (gTag in battleState.assignments) {
          battleState.assignments[gTag] = { bossId, mapId: targetMap };
        }
      });

      io.emit('server_call_updated', {
        serverKey,
        call: battleState.serverCalls[serverKey],
        serverCalls: battleState.serverCalls,
        assignments: battleState.assignments
      });

      io.emit('state_updated', {
        assignments: battleState.assignments,
        combatModes: battleState.combatModes,
        action: `🚨 [${serverLabel}] direcionado para ${bossId === 0 ? 'Lorde Enoch' : 'Boss ' + bossId} por ${socket.user.username}`
      });
    });

    // Limpar Call de Servidor
    socket.on('clear_server_call', ({ server }) => {
      if (!socket.user.canCallGeneral) return;
      const serverKey = server.toLowerCase().includes('1') ? 'rust1' : 'rust2';
      const serverLabel = serverKey === 'rust1' ? 'RUST 1' : 'RUST 2';
      battleState.serverCalls[serverKey] = null;

      io.emit('server_call_cleared', {
        serverKey,
        serverCalls: battleState.serverCalls
      });
    });

    // Marcar Boss Morto
    socket.on('mark_boss_dead', ({ bossId, respawnSeconds }) => {
      if (!socket.user.canCallGuild && !socket.user.canCallGeneral) return;

      const respawnTime = Date.now() + (respawnSeconds || 15 * 60 + 31) * 1000;
      battleState.deadBosses[bossId] = respawnTime;

      Object.keys(battleState.assignments).forEach(g => {
        const asg = battleState.assignments[g];
        if (asg && asg.bossId === bossId) battleState.assignments[g] = null;
      });

      io.emit('boss_killed', {
        bossId,
        respawnTime,
        assignments: battleState.assignments
      });
    });

    // Resetar apenas Respawns dos Bosses
    socket.on('reset_respawns', () => {
      if (!socket.user.canCallGeneral && !socket.user.canCallGuild) return;
      battleState.deadBosses = {};
      io.emit('respawns_reset');
      io.emit('state_updated', {
        assignments: battleState.assignments,
        combatModes: battleState.combatModes,
        action: `${socket.user.username} resetou o respawn dos bosses.`
      });
    });

    // Reset Geral
    socket.on('reset_all', () => {
      if (!socket.user.canCallGeneral) return;
      Object.keys(battleState.assignments).forEach(g => battleState.assignments[g] = null);
      battleState.callGeral = null;
      battleState.serverCalls = { rust1: null, rust2: null };
      battleState.deadBosses = {};
      io.emit('state_reset', battleState);
    });

    socket.on('disconnect', () => {
      console.log(`❌ [OVERLAY WS] Desconectado: ${socket.user.username}`);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 [OVERLAY] Servidor Web & WebSocket ativo em 0.0.0.0:${PORT}`);
  });
}

function executeCommandCall({ guildTag, bossId, mapId, author }) {
  const targetMap = mapId || battleState.activeMap || 1;
  const bName = bossId === 0 ? 'Lorde Enoch' : `Boss ${bossId}`;

  if (guildTag === 'ALL') {
    Object.keys(battleState.assignments).forEach(g => {
      battleState.assignments[g] = { bossId, mapId: targetMap };
    });
    battleState.callGeral = { bossId, bossName: bName, mapId: targetMap, author };
    battleState.serverCalls.rust1 = { server: 'RUST 1', bossId, bossName: bName, mapId: targetMap, author, timestamp: Date.now() };
    battleState.serverCalls.rust2 = { server: 'RUST 2', bossId, bossName: bName, mapId: targetMap, author, timestamp: Date.now() };
    if (ioInstance) {
      ioInstance.emit('call_geral_active', {
        callGeral: battleState.callGeral,
        assignments: battleState.assignments
      });
      ioInstance.emit('server_call_updated', {
        serverCalls: battleState.serverCalls,
        assignments: battleState.assignments
      });
    }
    return `🚨 **Call Geral Disparada:** Todas as guildas para ${bossId === 0 ? 'Lorde Enoch' : 'o Boss ' + bossId} (Mapa ${targetMap}) por **${author}**!`;
  }

  if (guildTag === 'RUST1' || guildTag === 'RUST 1') {
    const rust1Guilds = ['CHP', 'SPF', 'TRANS'];
    battleState.serverCalls.rust1 = { server: 'RUST 1', bossId, bossName: bName, mapId: targetMap, author, timestamp: Date.now() };
    rust1Guilds.forEach(g => {
      if (g in battleState.assignments) battleState.assignments[g] = { bossId, mapId: targetMap };
    });
    if (ioInstance) {
      ioInstance.emit('server_call_updated', {
        serverKey: 'rust1',
        call: battleState.serverCalls.rust1,
        serverCalls: battleState.serverCalls,
        assignments: battleState.assignments
      });
      ioInstance.emit('state_updated', {
        assignments: battleState.assignments,
        combatModes: battleState.combatModes,
        action: `🚨 [RUST 1] Convocado para ${bossId === 0 ? 'Lorde Enoch' : 'Boss ' + bossId} por ${author}`
      });
    }
    return `🛡️ **Call RUST 1 Registrada:** Guildas de Rust 1 (\`CHP\`, \`SPF\`, \`TRANS\`) direcionadas para ${bossId === 0 ? 'Lorde Enoch' : 'o Boss ' + bossId} (Mapa ${targetMap})!`;
  }

  if (guildTag === 'RUST2' || guildTag === 'RUST 2') {
    const rust2Guilds = ['OLP', 'NOM', 'NGF', 'KTB', 'AFT', 'FSN'];
    battleState.serverCalls.rust2 = { server: 'RUST 2', bossId, bossName: bName, mapId: targetMap, author, timestamp: Date.now() };
    rust2Guilds.forEach(g => {
      if (g in battleState.assignments) battleState.assignments[g] = { bossId, mapId: targetMap };
    });
    if (ioInstance) {
      ioInstance.emit('server_call_updated', {
        serverKey: 'rust2',
        call: battleState.serverCalls.rust2,
        serverCalls: battleState.serverCalls,
        assignments: battleState.assignments
      });
      ioInstance.emit('state_updated', {
        assignments: battleState.assignments,
        combatModes: battleState.combatModes,
        action: `⚔️ [RUST 2] Convocado para ${bossId === 0 ? 'Lorde Enoch' : 'Boss ' + bossId} por ${author}`
      });
    }
    return `⚔️ **Call RUST 2 Registrada:** Guildas de Rust 2 (\`OLP\`, \`NOM\`, \`NGF\`, \`KTB\`, \`AFT\`, \`FSN\`) direcionadas para ${bossId === 0 ? 'Lorde Enoch' : 'o Boss ' + bossId} (Mapa ${targetMap})!`;
  }

  battleState.assignments[guildTag] = { bossId, mapId: targetMap };
  if (ioInstance) {
    ioInstance.emit('state_updated', {
      assignments: battleState.assignments,
      combatModes: battleState.combatModes,
      action: `[${guildTag}] Call enviada por ${author} ➔ ${bossId === 0 ? 'Lorde Enoch' : 'Boss ' + bossId} (Mapa ${targetMap})`
    });
  }
  return `✅ **Call Registrada:** Guilda \`[${guildTag}]\` direcionada para ${bossId === 0 ? 'Lorde Enoch' : 'o Boss ' + bossId} (Mapa ${targetMap})!`;
}

module.exports = {
  startOverlayService,
  createAuthResponse,
  renderOverlayPanel,
  executeCommandCall,
  evaluateMemberPermissions,
  broadcastGuildsUpdate,
  getTacticalGuilds
};
