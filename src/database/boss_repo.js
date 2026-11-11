const { query } = require('./db');

async function loadBossData() {
  const res = await query("SELECT data FROM boss_data WHERE id = 'primary'");
  if (res.rows.length > 0 && res.rows[0].data) {
    return res.rows[0].data;
  }
  return null;
}

async function saveBossData(data) {
  await query(`
    INSERT INTO boss_data (id, data, updated_at)
    VALUES ('primary', $1, NOW())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `, [JSON.stringify(data)]);
}

module.exports = {
  loadBossData,
  saveBossData
};
