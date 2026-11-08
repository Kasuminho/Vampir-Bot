const fs = require('fs');
const path = require('path');

const DKP_FILE = path.join(__dirname, '..', 'data', 'dkp.json');

const DEFAULT_EVENTS = {
  geena_15: { name: 'Geena 15:00', dkp: 30 },
  geena_19: { name: 'Geena 19:00', dkp: 20 },
  geena_23: { name: 'Geena 23:00', dkp: 30 }
};

function getDkpData() {
  if (fs.existsSync(DKP_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DKP_FILE, 'utf-8'));
    } catch {}
  }
  return { balances: {}, history: [] };
}

function saveDkpData(data) {
  fs.writeFileSync(DKP_FILE, JSON.stringify(data, null, 2));
}

// Detecta o evento de Geena mais provável com base no horário atual (GMT-3)
function detectGeenaEvent(now = new Date()) {
  const hour = now.getHours();
  // Das 13h às 17h -> Geena 15:00
  if (hour >= 13 && hour < 18) {
    return { key: 'geena_15', name: 'Geena 15:00', dkp: 30 };
  }
  // Das 18h às 21h -> Geena 19:00
  if (hour >= 18 && hour < 22) {
    return { key: 'geena_19', name: 'Geena 19:00', dkp: 20 };
  }
  // Das 22h às 03h -> Geena 23:00
  return { key: 'geena_23', name: 'Geena 23:00', dkp: 30 };
}

async function recordAttendance({ voiceChannel, eventChoice, customDkp, executorUser, note }) {
  if (!voiceChannel) {
    return { success: false, error: 'Canal de voz do Auditório não encontrado.' };
  }

  // Identifica evento e valor de DKP
  let eventName = 'Presença de Boss';
  let dkpAwarded = 30;

  if (eventChoice && DEFAULT_EVENTS[eventChoice]) {
    eventName = DEFAULT_EVENTS[eventChoice].name;
    dkpAwarded = DEFAULT_EVENTS[eventChoice].dkp;
  } else if (!eventChoice || eventChoice === 'auto') {
    const auto = detectGeenaEvent();
    eventName = auto.name;
    dkpAwarded = auto.dkp;
  }

  // Sobrescreve com DKP manual se fornecido
  if (customDkp && !isNaN(customDkp) && customDkp > 0) {
    dkpAwarded = parseInt(customDkp, 10);
  }

  // Filtra membros conectados na sala (desconsiderando bots)
  const connectedMembers = voiceChannel.members.filter(m => !m.user.bot);
  if (connectedMembers.size === 0) {
    return { success: false, error: `Não há jogadores conectados em <#${voiceChannel.id}> no momento!` };
  }

  const dkpData = getDkpData();
  const nowIso = new Date().toISOString();
  const presentMembersList = [];

  for (const [memberId, member] of connectedMembers) {
    const userTag = member.user.tag || member.displayName;
    if (!dkpData.balances[memberId]) {
      dkpData.balances[memberId] = {
        userId: memberId,
        tag: userTag,
        totalDkp: 0,
        eventsAttended: 0,
        lastEvent: null,
        lastDate: null
      };
    }

    const record = dkpData.balances[memberId];
    record.tag = userTag;
    record.totalDkp += dkpAwarded;
    record.eventsAttended = (record.eventsAttended || 0) + 1;
    record.lastEvent = eventName;
    record.lastDate = nowIso;

    presentMembersList.push({
      id: memberId,
      tag: userTag,
      newTotal: record.totalDkp
    });
  }

  const historyEntry = {
    id: `pres_${Date.now()}`,
    event: eventName,
    dkpAwarded: dkpAwarded,
    date: nowIso,
    registeredBy: executorUser.id,
    registeredByName: executorUser.tag || executorUser.username,
    channelId: voiceChannel.id,
    memberCount: presentMembersList.length,
    members: presentMembersList.map(m => ({ id: m.id, tag: m.tag })),
    note: note || null
  };

  dkpData.history.unshift(historyEntry);
  // Mantém os últimos 100 registros de histórico
  if (dkpData.history.length > 100) {
    dkpData.history = dkpData.history.slice(0, 100);
  }

  saveDkpData(dkpData);

  return {
    success: true,
    eventName,
    dkpAwarded,
    totalCount: presentMembersList.length,
    members: presentMembersList,
    historyEntry
  };
}

function getUserDkp(userId) {
  const dkpData = getDkpData();
  return dkpData.balances[userId] || null;
}

function getDkpRanking(limit = 10) {
  const dkpData = getDkpData();
  const list = Object.values(dkpData.balances);
  list.sort((a, b) => b.totalDkp - a.totalDkp);
  return list.slice(0, limit);
}

module.exports = {
  DEFAULT_EVENTS,
  getDkpData,
  saveDkpData,
  detectGeenaEvent,
  recordAttendance,
  getUserDkp,
  getDkpRanking
};
