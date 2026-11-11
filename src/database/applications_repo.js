const { query } = require('./db');

async function loadAllApplications() {
  const res = await query('SELECT * FROM applications ORDER BY created_at ASC');
  return res.rows.map(row => ({
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    userTag: row.user_tag,
    nick: row.nick,
    classe: row.classe,
    horarios: row.horarios,
    sobre: row.sobre,
    status: row.status,
    createdAt: row.created_at ? row.created_at.toISOString() : new Date().toISOString(),
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null
  }));
}

async function upsertApplication(a) {
  await query(`
    INSERT INTO applications (
      id, guild_id, user_id, user_tag, nick, classe, horarios, sobre,
      status, created_at, reviewed_by, reviewed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      reviewed_by = EXCLUDED.reviewed_by,
      reviewed_at = EXCLUDED.reviewed_at
  `, [
    a.id,
    a.guildId,
    a.userId,
    a.userTag || '',
    a.nick || '',
    a.classe || '',
    a.horarios || '',
    a.sobre || '',
    a.status || 'pending',
    a.createdAt ? new Date(a.createdAt) : new Date(),
    a.reviewedBy || null,
    a.reviewedAt ? new Date(a.reviewedAt) : null
  ]);
}

module.exports = {
  loadAllApplications,
  upsertApplication
};
