const { query } = require('./db');

async function createBanRequest(data) {
  const sql = `
    INSERT INTO ban_requests (
      id, target_user_id, target_user_tag, requested_by_id, requested_by_tag,
      reason, evidence, status, message_id, channel_id, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    RETURNING *
  `;
  const params = [
    data.id,
    data.targetUserId,
    data.targetUserTag,
    data.requestedById,
    data.requestedByTag,
    data.reason,
    data.evidence || null,
    data.status || 'pending',
    data.messageId || null,
    data.channelId || null
  ];
  const res = await query(sql, params);
  return res.rows[0];
}

async function findBanRequestById(id) {
  const res = await query('SELECT * FROM ban_requests WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function updateBanRequest(id, updates) {
  const fields = [];
  const params = [id];
  let idx = 2;

  if (updates.status !== undefined) {
    fields.push(`status = $${idx++}`);
    params.push(updates.status);
  }
  if (updates.confirmedById !== undefined) {
    fields.push(`confirmed_by_id = $${idx++}`);
    params.push(updates.confirmedById);
  }
  if (updates.confirmedByTag !== undefined) {
    fields.push(`confirmed_by_tag = $${idx++}`);
    params.push(updates.confirmedByTag);
  }
  if (updates.messageId !== undefined) {
    fields.push(`message_id = $${idx++}`);
    params.push(updates.messageId);
  }
  if (updates.channelId !== undefined) {
    fields.push(`channel_id = $${idx++}`);
    params.push(updates.channelId);
  }
  if (updates.resolvedAt !== undefined) {
    fields.push(`resolved_at = $${idx++}`);
    params.push(updates.resolvedAt);
  } else if (updates.status === 'approved' || updates.status === 'rejected' || updates.status === 'cancelled') {
    fields.push(`resolved_at = NOW()`);
  }

  if (fields.length === 0) return null;

  const sql = `UPDATE ban_requests SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
  const res = await query(sql, params);
  return res.rows[0] || null;
}

module.exports = {
  createBanRequest,
  findBanRequestById,
  updateBanRequest
};
