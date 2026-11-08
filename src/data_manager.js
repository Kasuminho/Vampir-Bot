const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const GUILDS_FILE = path.join(DATA_DIR, 'guilds.json');
const APPS_FILE = path.join(DATA_DIR, 'applications.json');
const CONFIG_FILE = path.join(DATA_DIR, 'server_config.json');

function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(GUILDS_FILE)) {
    fs.writeFileSync(GUILDS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(APPS_FILE)) {
    fs.writeFileSync(APPS_FILE, JSON.stringify([], null, 2));
  }
}

function getServerConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  }
  return null;
}

function getGuilds() {
  ensureFiles();
  return JSON.parse(fs.readFileSync(GUILDS_FILE, 'utf-8'));
}

function saveGuilds(guilds) {
  ensureFiles();
  fs.writeFileSync(GUILDS_FILE, JSON.stringify(guilds, null, 2));
}

function getApplications() {
  ensureFiles();
  return JSON.parse(fs.readFileSync(APPS_FILE, 'utf-8'));
}

function saveApplications(apps) {
  ensureFiles();
  fs.writeFileSync(APPS_FILE, JSON.stringify(apps, null, 2));
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

    // Se o novo líder estava como oficial, remove da lista de oficiais
    guild.officerIds = guild.officerIds.filter(id => id !== newLeaderId);

    // O antigo líder torna-se automaticamente Oficial / Vice-Líder para manter poderes de aprovação
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
}

function addApplication(appData) {
  const apps = getApplications();
  apps.push(appData);
  saveApplications(apps);
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
    app.status = status; // 'approved' | 'rejected'
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
  getServerConfig,
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
  addApplication,
  findApplicationById,
  updateApplicationStatus
};
