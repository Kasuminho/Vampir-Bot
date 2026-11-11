const { query } = require('./db');

async function loadAllGuilds() {
  const res = await query('SELECT * FROM guilds ORDER BY created_at ASC');
  return res.rows.map(row => {
    if (row.raw_data && typeof row.raw_data === 'object') {
      return {
        ...row.raw_data,
        id: row.id,
        name: row.name,
        tag: row.tag,
        leaderId: row.leader_id,
        roleId: row.role_id,
        categoryId: row.category_id,
        approvalsChannelId: row.approvals_channel_id,
        chatChannelId: row.chat_channel_id,
        attendanceValidationChannelId: row.attendance_validation_channel_id,
        recruitmentMessageId: row.recruitment_message_id,
        description: row.description,
        color: row.color,
        iconUrl: row.icon_url,
        createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
        officerIds: Array.isArray(row.officer_ids) ? row.officer_ids : (row.raw_data?.officerIds || []),
        callerIds: Array.isArray(row.caller_ids) ? row.caller_ids : (row.raw_data?.callerIds || [])
      };
    }
    return {
      id: row.id,
      name: row.name,
      tag: row.tag,
      leaderId: row.leader_id,
      roleId: row.role_id,
      categoryId: row.category_id,
      approvalsChannelId: row.approvals_channel_id,
      chatChannelId: row.chat_channel_id,
      attendanceValidationChannelId: row.attendance_validation_channel_id,
      recruitmentMessageId: row.recruitment_message_id,
      description: row.description,
      color: row.color,
      iconUrl: row.icon_url,
      createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
      officerIds: Array.isArray(row.officer_ids) ? row.officer_ids : [],
      callerIds: Array.isArray(row.caller_ids) ? row.caller_ids : []
    };
  });
}

async function upsertGuild(g) {
  await query(`
    INSERT INTO guilds (
      id, name, tag, leader_id, role_id, category_id, approvals_channel_id,
      chat_channel_id, attendance_validation_channel_id, recruitment_message_id,
      description, color, icon_url, created_at, officer_ids, caller_ids, raw_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      tag = EXCLUDED.tag,
      leader_id = EXCLUDED.leader_id,
      role_id = EXCLUDED.role_id,
      category_id = EXCLUDED.category_id,
      approvals_channel_id = EXCLUDED.approvals_channel_id,
      chat_channel_id = EXCLUDED.chat_channel_id,
      attendance_validation_channel_id = EXCLUDED.attendance_validation_channel_id,
      recruitment_message_id = EXCLUDED.recruitment_message_id,
      description = EXCLUDED.description,
      color = EXCLUDED.color,
      icon_url = EXCLUDED.icon_url,
      officer_ids = EXCLUDED.officer_ids,
      caller_ids = EXCLUDED.caller_ids,
      raw_data = EXCLUDED.raw_data
  `, [
    g.id,
    g.name,
    g.tag,
    g.leaderId,
    g.roleId,
    g.categoryId || null,
    g.approvalsChannelId || null,
    g.chatChannelId || null,
    g.attendanceValidationChannelId || null,
    g.recruitmentMessageId || null,
    g.description || '',
    g.color || '#9B59B6',
    g.iconUrl || null,
    g.createdAt ? new Date(g.createdAt) : new Date(),
    JSON.stringify(g.officerIds || []),
    JSON.stringify(g.callerIds || []),
    JSON.stringify(g)
  ]);
}

async function deleteGuild(id) {
  await query('DELETE FROM guilds WHERE id = $1', [id]);
}

module.exports = {
  loadAllGuilds,
  upsertGuild,
  deleteGuild
};
