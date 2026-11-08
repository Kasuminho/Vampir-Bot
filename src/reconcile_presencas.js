const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getGuilds } = require('./data_manager');
const { renderOrUpdatePresencePanel } = require('./attendance_manager');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('clientReady', async () => {
  console.log('[RECONCILE] Conectado como ' + client.user.tag);
  const guilds = getGuilds();
  const presencasPath = path.join(__dirname, '..', 'data', 'presencas.json');
  let data = { submissions: {}, users: {}, panelMessageId: null, checkinBannerMessageId: null };
  try {
    data = JSON.parse(fs.readFileSync(presencasPath, 'utf8'));
  } catch (e) {}

  if (!data.submissions) data.submissions = {};
  if (!data.users) data.users = {};

  let recoveredCount = 0;

  for (const g of guilds) {
    if (!g.attendanceValidationChannelId) continue;
    const ch = await client.channels.fetch(g.attendanceValidationChannelId).catch(() => null);
    if (!ch) continue;
    const msgs = await ch.messages.fetch({ limit: 50 }).catch(() => null);
    if (!msgs) continue;

    for (const m of msgs.values()) {
      const embed = m.embeds[0];
      if (!embed || !embed.footer?.text) continue;
      const idMatch = embed.footer.text.match(/ID:\s*(att_\d+_\d+)/);
      if (!idMatch) continue;
      const subId = idMatch[1];

      const desc = embed.description || '';
      const isApproved = desc.includes('APROVADO');
      const isRejected = desc.includes('REJEITADO');
      const status = isApproved ? 'approved' : (isRejected ? 'rejected' : 'pending');

      const valByMatch = desc.match(/APROVADO por <@(\d+)>/);
      const valTimeMatch = desc.match(/em <t:(\d+):R>/);
      const submitterMatch = desc.match(/Enviado por:\*\* <@(\d+)> `\(([^)]+)\)`/);
      const ownerMatch = desc.match(/Pontuado \(Dono do Boneco\):\*\* <@(\d+)> `\(([^)]+)\)`/);
      const isPilot = desc.includes('PILOTO');
      const noteMatch = desc.match(/Obs:\*\* \*([^*]+)\*/);
      const subTimeMatch = desc.match(/Submetido em:\*\* <t:(\d+):f>/);

      const submitterId = submitterMatch ? submitterMatch[1] : (ownerMatch ? ownerMatch[1] : 'unknown');
      const submitterTag = submitterMatch ? submitterMatch[2] : (ownerMatch ? ownerMatch[2] : 'unknown');
      const ownerId = ownerMatch ? ownerMatch[1] : submitterId;
      const ownerTag = ownerMatch ? ownerMatch[2] : submitterTag;

      const createdAt = subTimeMatch ? new Date(parseInt(subTimeMatch[1]) * 1000).toISOString() : new Date().toISOString();
      const validatedAt = valTimeMatch ? new Date(parseInt(valTimeMatch[1]) * 1000).toISOString() : (isApproved ? new Date().toISOString() : null);
      const validatedBy = valByMatch ? valByMatch[1] : (isApproved ? g.leaderId : null);

      data.submissions[subId] = {
        id: subId,
        eventId: 'geena_15_2026-11-08',
        eventName: 'Geena 15:00',
        submitterId,
        submitterTag,
        isPilot,
        pilotUserId: isPilot ? submitterId : null,
        ownerUserId: ownerId,
        ownerUserTag: ownerTag,
        guildId: g.id,
        guildTag: g.tag,
        guildName: g.name,
        printUrl: embed.image?.url || '',
        note: noteMatch ? noteMatch[1] : '',
        status,
        createdAt,
        validatedBy,
        validatedAt,
        rejectionReason: isRejected ? 'Recusado pela liderança' : null,
        validationMessageId: m.id,
        validationChannelId: ch.id
      };
      recoveredCount++;
    }
  }

  // Recalculate users
  const users = {};
  for (const s of Object.values(data.submissions)) {
    if (s.status !== 'approved') continue;
    const uId = s.ownerUserId;
    if (!users[uId]) {
      users[uId] = {
        userId: uId,
        userTag: s.ownerUserTag,
        guildId: s.guildId,
        guildTag: s.guildTag,
        totalPresencas: 0,
        asTitular: 0,
        asPilot: 0,
        timesPiloting: 0,
        lastEvent: s.eventName,
        lastDate: s.validatedAt || s.createdAt
      };
    }
    users[uId].totalPresencas++;
    if (s.isPilot) {
      users[uId].asPilot++;
      if (s.pilotUserId) {
        if (!users[s.pilotUserId]) {
          users[s.pilotUserId] = {
            userId: s.pilotUserId,
            userTag: s.submitterTag,
            guildId: s.guildId,
            guildTag: s.guildTag,
            totalPresencas: 0,
            asTitular: 0,
            asPilot: 0,
            timesPiloting: 0,
            lastEvent: s.eventName,
            lastDate: s.validatedAt || s.createdAt
          };
        }
        users[s.pilotUserId].timesPiloting++;
      }
    } else {
      users[uId].asTitular++;
    }
  }

  data.users = users;
  fs.writeFileSync(presencasPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[SUCESSO] Reconciliadas ${recoveredCount} submissões no total.`);
  console.log(`Usuários com presenças aprovadas: ${Object.keys(users).length}`);
  for (const [id, u] of Object.entries(users)) {
    console.log(` - ${u.userTag} ([${u.guildTag}]): ${u.totalPresencas} presença(s)`);
  }

  const dGuild = await client.guilds.fetch(process.env.GUILD_ID);
  await renderOrUpdatePresencePanel(dGuild);
  console.log('[PAINEL] Painel de presenças atualizado com sucesso no Discord!');

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
