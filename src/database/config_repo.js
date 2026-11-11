const { query } = require('./db');

async function loadServerConfig() {
  const res = await query("SELECT config_json FROM server_config WHERE id = 'primary'");
  if (res.rows.length > 0 && res.rows[0].config_json) {
    return res.rows[0].config_json;
  }
  return null;
}

async function saveServerConfig(config) {
  await query(`
    INSERT INTO server_config (id, config_json, updated_at)
    VALUES ('primary', $1, NOW())
    ON CONFLICT (id) DO UPDATE SET config_json = EXCLUDED.config_json, updated_at = NOW()
  `, [JSON.stringify(config)]);
}

module.exports = {
  loadServerConfig,
  saveServerConfig
};
