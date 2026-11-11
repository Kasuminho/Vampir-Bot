const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
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

// --- ESTADO INICIAL DA GUERRA ---
let battleState = {
  activeMap: 1, // 1 ou 2
  assignments: {},
  combatModes: {}, // { guildId: 'BOSS' | 'PVP' }
  deadBosses: {}, // { bossId: timestamp }
  callGeral: null // { bossId, bossName, author }
};

// Carrega as tags das guildas
function initGuildAssignments() {
  const guilds = getGuilds();
  for (const g of guilds) {
    if (g.tag && !(g.tag in battleState.assignments)) {
      battleState.assignments[g.tag] = null;
    }
  }
}
initGuildAssignments();

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

  // 1. Staff / Shout Caller (Call Geral / All-In)
  const isStaff = roleIds.includes(ROLES.STAFF_ADMIN) || member.permissions.has(PermissionFlagsBits.Administrator);
  const isShoutCaller = roleIds.includes(ROLES.SHOUT_CALLER);
  const canCallGeneral = isStaff || isShoutCaller;

  // 2. Identificar a Guilda do Membro e cargos de liderança
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
  const isAllowed = isStaff || isShoutCaller || isValidated || (userGuild !== null);

  return {
    isAllowed,
    canCallGeneral,
    canCallGuild,
    userGuild,
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

  // Gera Token JWT (válido por 8 horas)
  const token = jwt.sign(
    {
      userId: member.id,
      username: member.displayName || member.user.username,
      avatar: member.user.displayAvatarURL(),
      guildId: perm.userGuild ? perm.userGuild.tag : null,
      guildName: perm.userGuild ? perm.userGuild.name : 'Aliança',
      canCallGuild: perm.canCallGuild,
      canCallGeneral: perm.canCallGeneral
    },
    CLIENT_SECRET,
    { expiresIn: '8h' }
  );

  const fullUrl = `${activeUrl}/?token=${token}`;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('📥 Baixar App Windows (.exe)')
      .setStyle(ButtonStyle.Link)
      .setURL('https://github.com/Kasuminho/Vampir-Bot/releases/latest/download/VampirOverlay.exe')
      .setEmoji('💻'),
    new ButtonBuilder()
      .setLabel('🚀 Abrir Overlay no Navegador')
      .setStyle(ButtonStyle.Link)
      .setURL(fullUrl)
      .setEmoji('🌐')
  );

  const embed = new EmbedBuilder()
    .setTitle('⚔️ Acesso Autorizado - Overlay Tático da Aliança')
    .setDescription(
      `Olá **${member.displayName}**!\nSeu acesso seguro foi gerado e é válido por **8 horas**.\n\n` +
      `**💻 Como usar o App Executável no Windows:**\n` +
      `1. Baixe o executável no botão abaixo (não precisa instalar, é só abrir).\n` +
      `2. No App, clique na engrenagem ⚙️ e cole seu Token:\n` +
      `\`\`\`text\n${token}\n\`\`\`\n` +
      `*Ou clique em "Abrir Overlay no Navegador" para usar direto sem baixar nada.*`
    )
    .addFields(
      { name: '🏰 Sua Legião', value: perm.userGuild ? `[${perm.userGuild.tag}] ${perm.userGuild.name}` : 'Membro da Coalizão', inline: true },
      { name: '👑 Permissão de Call', value: perm.canCallGeneral ? '👑 Call Geral (All-In)' : (perm.canCallGuild ? '🛡️ Call da Guilda' : '⚔️ Visualização'), inline: true }
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

  app.use(cors());
  app.use(express.json());

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

    // Sincroniza estado inicial
    socket.emit('init_state', {
      battleState,
      user: socket.user
    });

    // Alternar mapa
    socket.on('switch_map', mapId => {
      if (!socket.user.canCallGeneral) return;
      battleState.activeMap = mapId;
      io.emit('map_switched', { mapId, author: socket.user.username });
    });

    // Call de Guilda
    socket.on('set_guild_call', ({ guildId, bossId }) => {
      const canManage = socket.user.canCallGeneral || (socket.user.canCallGuild && socket.user.guildId === guildId);
      if (!canManage) return socket.emit('error_msg', 'Sem permissão para esta guilda.');

      battleState.assignments[guildId] = bossId;
      io.emit('state_updated', {
        assignments: battleState.assignments,
        combatModes: battleState.combatModes,
        action: `[${guildId}] Call atualizada ➔ Boss ${bossId}`
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
    socket.on('trigger_call_geral', ({ bossId, bossName }) => {
      if (!socket.user.canCallGeneral) return socket.emit('error_msg', 'Apenas Comandantes podem dar Call Geral.');

      Object.keys(battleState.assignments).forEach(g => {
        battleState.assignments[g] = bossId;
      });

      battleState.callGeral = { bossId, bossName, author: socket.user.username };

      io.emit('call_geral_active', {
        callGeral: battleState.callGeral,
        assignments: battleState.assignments
      });
    });

    // Limpar Call Geral
    socket.on('clear_call_geral', () => {
      if (!socket.user.canCallGeneral) return;
      battleState.callGeral = null;
      io.emit('call_geral_cleared');
    });

    // Marcar Boss Morto
    socket.on('mark_boss_dead', ({ bossId, respawnSeconds }) => {
      if (!socket.user.canCallGuild && !socket.user.canCallGeneral) return;

      const respawnTime = Date.now() + (respawnSeconds || 15 * 60 + 31) * 1000;
      battleState.deadBosses[bossId] = respawnTime;

      Object.keys(battleState.assignments).forEach(g => {
        if (battleState.assignments[g] === bossId) battleState.assignments[g] = null;
      });

      io.emit('boss_killed', {
        bossId,
        respawnTime,
        assignments: battleState.assignments
      });
    });

    // Reset Geral
    socket.on('reset_all', () => {
      if (!socket.user.canCallGeneral) return;
      Object.keys(battleState.assignments).forEach(g => battleState.assignments[g] = null);
      battleState.callGeral = null;
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

module.exports = {
  startOverlayService,
  createAuthResponse,
  renderOverlayPanel
};
