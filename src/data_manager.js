const fs = require('fs');
const path = require('path');
const { initDatabase, isConnected } = require('./database/db');
const guildsRepo = require('./database/guilds_repo');
const appsRepo = require('./database/applications_repo');
const configRepo = require('./database/config_repo');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SEEDS_DIR = path.join(__dirname, 'data_seeds');
const GUILDS_FILE = path.join(DATA_DIR, 'guilds.json');
const APPS_FILE = path.join(DATA_DIR, 'applications.json');
const CONFIG_FILE = path.join(DATA_DIR, 'server_config.json');

// Cache em memória para latência 0 nas interações do Discord
let cachedGuilds = null;
let cachedApplications = null;
let cachedServerConfig = null;

function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Auto-seed: Se a pasta montada na VPS estiver vazia, restaura automaticamente os dados atuais do projeto
  const seedFiles = ['guilds.json', 'server_config.json', 'bosses.json', 'applications.json', 'presencas.json'];
  if (fs.existsSync(SEEDS_DIR)) {
    for (const file of seedFiles) {
      const targetPath = path.join(DATA_DIR, file);
      const seedPath = path.join(SEEDS_DIR, file);
      if (!fs.existsSync(targetPath) && fs.existsSync(seedPath)) {
        console.log(`[SEED] Restaurando ${file} para a pasta de dados persistentes...`);
        fs.copyFileSync(seedPath, targetPath);
      }
    }
  }

  if (!fs.existsSync(GUILDS_FILE)) {
    fs.writeFileSync(GUILDS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(APPS_FILE)) {
    fs.writeFileSync(APPS_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Inicializa a conexão com o PostgreSQL e carrega os dados em memória.
 */
async function initDataManager() {
  ensureFiles();

  // Carrega inicialmente do JSON caso o DB falhe
  try {
    if (fs.existsSync(CONFIG_FILE)) cachedServerConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    if (fs.existsSync(GUILDS_FILE)) cachedGuilds = JSON.parse(fs.readFileSync(GUILDS_FILE, 'utf-8'));
    if (fs.existsSync(APPS_FILE)) cachedApplications = JSON.parse(fs.readFileSync(APPS_FILE, 'utf-8'));
  } catch (err) {
    console.warn('[DATA] Aviso ao ler arquivos JSON locais:', err.message);
  }

  // Conecta ao PostgreSQL
  const dbOk = await initDatabase();
  if (dbOk) {
    try {
      const [dbGuilds, dbApps, dbConfig] = await Promise.all([
        guildsRepo.loadAllGuilds(),
        appsRepo.loadAllApplications(),
        configRepo.loadServerConfig()
      ]);

      if (dbGuilds && dbGuilds.length > 0) {
        cachedGuilds = dbGuilds;
        fs.writeFileSync(GUILDS_FILE, JSON.stringify(cachedGuilds, null, 2));
      } else if (cachedGuilds && cachedGuilds.length > 0) {
        // Se DB estiver vazio mas JSON tiver dados, sobe pro DB
        for (const g of cachedGuilds) await guildsRepo.upsertGuild(g);
      }

      if (dbApps && dbApps.length > 0) {
        cachedApplications = dbApps;
        fs.writeFileSync(APPS_FILE, JSON.stringify(cachedApplications, null, 2));
      } else if (cachedApplications && cachedApplications.length > 0) {
        for (const a of cachedApplications) await appsRepo.upsertApplication(a);
      }

      if (dbConfig) {
        cachedServerConfig = dbConfig;
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(cachedServerConfig, null, 2));
      } else if (cachedServerConfig) {
        await configRepo.saveServerConfig(cachedServerConfig);
      }

      console.log(`[DATA] PostgreSQL sincronizado com sucesso! Guilds=${cachedGuilds?.length || 0}, Candidaturas=${cachedApplications?.length || 0}`);
    } catch (err) {
      console.error('[DATA] Erro ao carregar dados do PostgreSQL:', err.message);
    }
  } else {
    console.warn('[DATA] Operando em modo de fallback local (JSON) até o PostgreSQL restabelecer.');
  }
}

function getServerConfig() {
  if (cachedServerConfig) return cachedServerConfig;
  ensureFiles();
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      cachedServerConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return cachedServerConfig;
    } catch {}
  }
  return null;
}

function saveServerConfig(config) {
  cachedServerConfig = config;
  ensureFiles();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch {}

  // Persiste no PostgreSQL assincronamente
  if (isConnected()) {
    configRepo.saveServerConfig(config).catch(err => {
      console.error('[DB] Erro ao persistir server_config:', err.message);
    });
  }
}

function getGuilds() {
  if (cachedGuilds) return cachedGuilds;
  ensureFiles();
  try {
    cachedGuilds = JSON.parse(fs.readFileSync(GUILDS_FILE, 'utf-8'));
    return cachedGuilds;
  } catch {
    return [];
  }
}

function saveGuilds(guilds) {
  cachedGuilds = guilds;
  ensureFiles();
  try {
    fs.writeFileSync(GUILDS_FILE, JSON.stringify(guilds, null, 2));
  } catch {}

  if (isConnected()) {
    Promise.all(guilds.map(g => guildsRepo.upsertGuild(g))).catch(err => {
      console.error('[DB] Erro ao sincronizar guilds no PostgreSQL:', err.message);
    });
  }
}

function getApplications() {
  if (cachedApplications) return cachedApplications;
  ensureFiles();
  try {
    cachedApplications = JSON.parse(fs.readFileSync(APPS_FILE, 'utf-8'));
    return cachedApplications;
  } catch {
    return [];
  }
}

function saveApplications(apps) {
  cachedApplications = apps;
  ensureFiles();
  try {
    fs.writeFileSync(APPS_FILE, JSON.stringify(apps, null, 2));
  } catch {}

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
  const guilds = getGuilds();
  return guilds.find(g => g.id === id);
}

function findGuildsByLeaderId(leaderId) {
  const guilds = getGuilds();
  return guilds.filter(g => g.leaderId === leaderId || (g.officerIds && g.officerIds.includes(leaderId)));
}

function addGuildOfficer(guildId, userId) {
  const guilds = getGuilds();
  const guild = guilds.find(g => g.id === guildId);
  if (guild) {
    guild.officerIds = guild.officerIds || [];
    if (!guild.officerIds.includes(userId)) {
      guild.officerIds.push(userId);
      saveGuilds(guilds);
    }
  }
  return guild;
}

function removeGuildOfficer(guildId, userId) {
  const guilds = getGuilds();
  const guild = guilds.find(g => g.id === guildId);
  if (guild && guild.officerIds) {
    guild.officerIds = guild.officerIds.filter(id => id !== userId);
    saveGuilds(guilds);
  }
  return guild;
}

function setGuildLeader(guildId, newLeaderId) {
  const guilds = getGuilds();
  const guild = guilds.find(g => g.id === guildId);
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

    saveGuilds(guilds);
  }
  return guild;
}

function updateGuild(id, updates) {
  const guilds = getGuilds();
  const guild = guilds.find(g => g.id === id);
  if (guild) {
    Object.assign(guild, updates);
    saveGuilds(guilds);
  }
  return guild;
}

function removeGuild(id) {
  let guilds = getGuilds();
  guilds = guilds.filter(g => g.id !== id);
  saveGuilds(guilds);
  if (isConnected()) {
    guildsRepo.deleteGuild(id).catch(err => {
      console.error('[DB] Erro ao remover guild do PostgreSQL:', err.message);
    });
  }
}

function addApplication(appData) {
  const apps = getApplications();
  apps.push(appData);
  cachedApplications = apps;
  ensureFiles();
  try {
    fs.writeFileSync(APPS_FILE, JSON.stringify(apps, null, 2));
  } catch {}

  if (isConnected()) {
    appsRepo.upsertApplication(appData).catch(err => {
      console.error('[DB] Erro ao inserir candidatura no PostgreSQL:', err.message);
    });
  }
  return appData;
}

function findApplicationById(id) {
  const apps = getApplications();
  return apps.find(a => a.id === id);
}

function updateApplicationStatus(id, status, reviewerId) {
  const apps = getApplications();
  const app = apps.find(a => a.id === id);
  if (app) {
    app.status = status;
    app.reviewedBy = reviewerId;
    app.reviewedAt = new Date().toISOString();
    saveApplications(apps);
  }
  return app;
}

function addGuildCaller(guildId, userId) {
  const guilds = getGuilds();
  const guild = guilds.find(g => g.id === guildId);
  if (guild) {
    guild.callerIds = guild.callerIds || [];
    if (guild.callerIds.includes(userId)) {
      return { success: true, already: true, guild };
    }
    if (guild.callerIds.length >= 2) {
      return { success: false, reason: 'limit_reached', callers: guild.callerIds };
    }
    guild.callerIds.push(userId);
    saveGuilds(guilds);
    return { success: true, guild };
  }
  return { success: false, reason: 'guild_not_found' };
}

function removeGuildCaller(guildId, userId) {
  const guilds = getGuilds();
  const guild = guilds.find(g => g.id === guildId);
  if (guild && guild.callerIds) {
    if (!guild.callerIds.includes(userId)) {
      return { success: false, reason: 'not_caller' };
    }
    guild.callerIds = guild.callerIds.filter(id => id !== userId);
    saveGuilds(guilds);
    return { success: true, guild };
  }
  return { success: false, reason: 'not_caller' };
}

function findGuildsByCallerId(userId) {
  const guilds = getGuilds();
  return guilds.filter(g => g.callerIds && g.callerIds.includes(userId));
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
