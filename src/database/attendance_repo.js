const { query } = require('./db');

async function loadAttendanceState() {
  const state = {
    submissions: {},
    users: {},
    panelMessageId: null,
    checkinBannerMessageId: null,
    activeWindowOverride: null
  };

  // 1. Configs
  const configRes = await query('SELECT key, value FROM attendance_config');
  for (const row of configRes.rows) {
    if (row.key === 'panelMessageId') state.panelMessageId = row.value;
    else if (row.key === 'checkinBannerMessageId') state.checkinBannerMessageId = row.value;
    else if (row.key === 'activeWindowOverride') state.activeWindowOverride = row.value;
  }

  // 2. Submissões
  const subRes = await query('SELECT * FROM attendance_submissions ORDER BY created_at ASC');
  for (const row of subRes.rows) {
    state.submissions[row.id] = {
      id: row.id,
      eventId: row.event_id,
      eventName: row.event_name,
      submitterId: row.submitter_id,
      submitterTag: row.submitter_tag,
      isPilot: !!row.is_pilot,
      pilotUserId: row.pilot_user_id || null,
      ownerUserId: row.owner_user_id,
      ownerUserTag: row.owner_user_tag,
      guildId: row.guild_id,
      guildTag: row.guild_tag,
      guildName: row.guild_name,
      printUrl: row.print_url,
      note: row.note || '',
      status: row.status,
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      validatedBy: row.validated_by || null,
      validatedAt: row.validated_at ? row.validated_at.toISOString() : null,
      rejectionReason: row.rejection_reason || null,
      validationMessageId: row.validation_message_id || null,
      validationChannelId: row.validation_channel_id || null
    };
  }

  // 3. Usuários Pontuados
  const userRes = await query('SELECT * FROM attendance_users');
  for (const row of userRes.rows) {
    state.users[row.user_id] = {
      userId: row.user_id,
      userTag: row.user_tag,
      guildId: row.guild_id,
      guildTag: row.guild_tag,
      totalPresencas: row.total_presencas || 0,
      asTitular: row.as_titular || 0,
      asPilot: row.as_pilot || 0,
      timesPiloting: row.times_piloting || 0,
      lastEvent: row.last_event,
      lastDate: row.last_date ? row.last_date.toISOString() : null
    };
  }

  return state;
}

async function upsertSubmission(s) {
  await query(`
    INSERT INTO attendance_submissions (
      id, event_id, event_name, submitter_id, submitter_tag, is_pilot, pilot_user_id,
      owner_user_id, owner_user_tag, guild_id, guild_tag, guild_name, print_url,
      note, status, created_at, validated_by, validated_at, rejection_reason,
      validation_message_id, validation_channel_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      validated_by = EXCLUDED.validated_by,
      validated_at = EXCLUDED.validated_at,
      rejection_reason = EXCLUDED.rejection_reason,
      validation_message_id = EXCLUDED.validation_message_id,
      validation_channel_id = EXCLUDED.validation_channel_id
  `, [
    s.id,
    s.eventId,
    s.eventName,
    s.submitterId,
    s.submitterTag || '',
    !!s.isPilot,
    s.pilotUserId || null,
    s.ownerUserId,
    s.ownerUserTag || '',
    s.guildId,
    s.guildTag,
    s.guildName || '',
    s.printUrl,
    s.note || '',
    s.status || 'pending',
    s.createdAt ? new Date(s.createdAt) : new Date(),
    s.validatedBy || null,
    s.validatedAt ? new Date(s.validatedAt) : null,
    s.rejectionReason || null,
    s.validationMessageId || null,
    s.validationChannelId || null
  ]);
}

async function upsertAttendanceUser(u) {
  await query(`
    INSERT INTO attendance_users (
      user_id, user_tag, guild_id, guild_tag, total_presencas, as_titular,
      as_pilot, times_piloting, last_event, last_date, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      user_tag = EXCLUDED.user_tag,
      guild_id = EXCLUDED.guild_id,
      guild_tag = EXCLUDED.guild_tag,
      total_presencas = EXCLUDED.total_presencas,
      as_titular = EXCLUDED.as_titular,
      as_pilot = EXCLUDED.as_pilot,
      times_piloting = EXCLUDED.times_piloting,
      last_event = EXCLUDED.last_event,
      last_date = EXCLUDED.last_date,
      updated_at = NOW()
  `, [
    u.userId,
    u.userTag || '',
    u.guildId || '',
    u.guildTag || '',
    u.totalPresencas || 0,
    u.asTitular || 0,
    u.asPilot || 0,
    u.timesPiloting || 0,
    u.lastEvent || '',
    u.lastDate ? new Date(u.lastDate) : null
  ]);
}

async function saveAttendanceConfig(key, value) {
  if (value === null || value === undefined) {
    await query('DELETE FROM attendance_config WHERE key = $1', [key]);
  } else {
    await query(`
      INSERT INTO attendance_config (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [key, JSON.stringify(value)]);
  }
}

module.exports = {
  loadAttendanceState,
  upsertSubmission,
  upsertAttendanceUser,
  saveAttendanceConfig
};
