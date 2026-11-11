const { initDatabase, isConnected } = require('./database/db');
const guildsRepo = require('./database/guilds_repo');
const appsRepo = require('./database/applications_repo');
const configRepo = require('./database/config_repo');

// Cache em memória para latência 0 nas interações do Discord (sem bloqueio de rede nas interações)
let cachedGuilds = [];
let cachedApplications = [];
let cachedServerConfig = null;

/**
 * Inicializa a conexão com o PostgreSQL e carrega todos os dados em memória.
 */
async function initDataManager() {
  const dbOk = await initDatabase();
  if (!dbOk) {
    throw new Error('[DATA] Falha crítica ao conectar no PostgreSQL. Verifique as credenciais da VPS!');
  }

  try {
    const [dbGuilds, dbApps, dbConfig] = await Promise.all([
      guildsRepo.loadAllGuilds(),
      appsRepo.loadAllApplications(),
      configRepo.loadServerConfig()
    ]);

    cachedGuilds = dbGuilds || [];
    cachedApplications = dbApps || [];
    cachedServerConfig = dbConfig || {};

    console.log(`[DATA] PostgreSQL 100% carregado: Guilds=${cachedGuilds.length}, Candidaturas=${cachedApplications.length}`);
  } catch (err) {
    console.error('[DATA] Erro fatal ao consultar PostgreSQL:', err.message);
    throw err;
  }
}

function getServerConfig() {
  return cachedServerConfig;
}

function saveServerConfig(config) {
  cachedServerConfig = config;
  if (isConnected()) {
    configRepo.saveServerConfig(config).catch(err => {
      console.error('[DB] Erro ao persistir server_config no PostgreSQL:', err.message);
    });
  }
}

function getGuilds() {
  return cachedGuilds;
}

function saveGuilds(guilds) {
  cachedGuilds = guilds;
  if (isConnected()) {
    Promise.all(guilds.map(g => guildsRepo.upsertGuild(g))).catch(err => {
      console.error('[DB] Erro ao sincronizar guilds no PostgreSQL:', err.message);
    });
  }
}

function getApplications() {
  return cachedApplications;
}

function saveApplications(apps) {
  cachedApplications = apps;
  if (isConnected()) {
    Promise.all(apps.map(a => appsRepo.upsertApplication(a))).catch(err => {
      console.error('[DB] Erro ao sincronizar candidaturas no PostgreSQL:', err.message);
    });
  }
}

function addGuild(guildData) {
  const guilds = getGuilds();
  guilds.push(guildData);
  saveGuilds(guilds);
  return guildData;
}

function findGuildById(id) {
  return cachedGuilds.find(g => g.id === id);
}

function findGuildsByLeaderId(leaderId) {
  return cachedGuilds.filter(g => g.leaderId === leaderId || (g.officerIds && g.officerIds.includes(leaderId)));
}

function addGuildOfficer(guildId, userId) {
  const guild = cachedGuilds.find(g => g.id === guildId);
  if (guild) {
    guild.officerIds = guild.officerIds || [];
    if (!guild.officerIds.includes(userId)) {
      guild.officerIds.push(userId);
      saveGuilds(cachedGuilds);
    }
  }
  return guild;
}

function removeGuildOfficer(guildId, userId) {
  const guild = cachedGuilds.find(g => g.id === guildId);
  if (guild && guild.officerIds) {
    guild.officerIds = guild.officerIds.filter(id => id !== userId);
    saveGuilds(cachedGuilds);
  }
  return guild;
}

function setGuildLeader(guildId, newLeaderId) {
  const guild = cachedGuilds.find(g => g.id === guildId);
  if (guild) {
    const oldLeaderId = guild.leaderId;
    guild.leaderId = newLeaderId;
    
    if (!guild.officerIds) {
      guild.officerIds = [];
    }

    guild.officerIds = guild.officerIds.filter(id => id !== newLeaderId);

    if (oldLeaderId && oldLeaderId !== newLeaderId && !guild.officerIds.includes(oldLeaderId)) {
      guild.officerIds.push(oldLeaderId);
    }

    saveGuilds(cachedGuilds);
  }
  return guild;
}

function updateGuild(id, updates) {
  const guild = cachedGuilds.find(g => g.id === id);
  if (guild) {
    Object.assign(guild, updates);
    saveGuilds(cachedGuilds);
  }
  return guild;
}

function removeGuild(id) {
  cachedGuilds = cachedGuilds.filter(g => g.id !== id);
  if (isConnected()) {
    guildsRepo.deleteGuild(id).catch(err => {
      console.error('[DB] Erro ao remover guild do PostgreSQL:', err.message);
    });
  }
}

function addApplication(appData) {
  cachedApplications.push(appData);
  if (isConnected()) {
    appsRepo.upsertApplication(appData).catch(err => {
      console.error('[DB] Erro ao inserir candidatura no PostgreSQL:', err.message);
    });
  }
  return appData;
}

function findApplicationById(id) {
  return cachedApplications.find(a => a.id === id);
}

function updateApplicationStatus(id, status, reviewerId) {
  const app = cachedApplications.find(a => a.id === id);
  if (app) {
    app.status = status;
    app.reviewedBy = reviewerId;
    app.reviewedAt = new Date().toISOString();
    if (isConnected()) {
      appsRepo.upsertApplication(app).catch(err => {
        console.error('[DB] Erro ao atualizar status da candidatura no PostgreSQL:', err.message);
      });
    }
  }
  return app;
}

function addGuildCaller(guildId, userId) {
  const guild = cachedGuilds.find(g => g.id === guildId);
  if (guild) {
    guild.callerIds = guild.callerIds || [];
    if (guild.callerIds.includes(userId)) {
      return { success: true, already: true, guild };
    }
    if (guild.callerIds.length >= 2) {
      return { success: false, reason: 'limit_reached', callers: guild.callerIds };
    }
    guild.callerIds.push(userId);
    saveGuilds(cachedGuilds);
    return { success: true, guild };
  }
  return { success: false, reason: 'guild_not_found' };
}

function removeGuildCaller(guildId, userId) {
  const guild = cachedGuilds.find(g => g.id === guildId);
  if (guild && guild.callerIds) {
    if (!guild.callerIds.includes(userId)) {
      return { success: false, reason: 'not_caller' };
    }
    guild.callerIds = guild.callerIds.filter(id => id !== userId);
    saveGuilds(cachedGuilds);
    return { success: true, guild };
  }
  return { success: false, reason: 'not_caller' };
}

function findGuildsByCallerId(userId) {
  return cachedGuilds.filter(g => g.callerIds && g.callerIds.includes(userId));
}

module.exports = {
  initDataManager,
  getServerConfig,
  saveServerConfig,
  getGuilds,
  saveGuilds,
  addGuild,
  findGuildById,
  findGuildsByLeaderId,
  addGuildOfficer,
  removeGuildOfficer,
  setGuildLeader,
  updateGuild,
  removeGuild,
  addGuildCaller,
  removeGuildCaller,
  findGuildsByCallerId,
  getApplications,
  saveApplications,
  addApplication,
  findApplicationById,
  updateApplicationStatus
};
