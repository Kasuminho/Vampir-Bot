const { Pool } = require('pg');
const { SCHEMA_SQL } = require('./schema');

// Configuração do Pool de Conexões seguindo as boas práticas solicitadas
const poolConfig = {
  host: process.env.DB_HOST || '216.22.27.248',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'user_sSDpr4',
  password: process.env.DB_PASSWORD || 'password_ekcC7Z',
  database: process.env.DB_NAME || 'vampir_bot',
  max: parseInt(process.env.DB_POOL_MAX || '10', 10), // Limite do pool para não sobrecarregar o servidor
  min: 1, // Mantém ao menos 1 conexão viva pronta para responder sem latency
  idleTimeoutMillis: 30000, // Fecha conexões inativas após 30 segundos
  connectionTimeoutMillis: 5000 // Timeout de 5s ao tentar adquirir conexão
};

let pool = null;
let isConnected = false;

function getPool() {
  if (!pool) {
    pool = new Pool(poolConfig);

    pool.on('error', (err) => {
      console.error('[DB POOL] Erro inesperado em cliente ocioso do pool:', err.message);
    });

    pool.on('connect', () => {
      // Cliente conectado ao pool
    });
  }
  return pool;
}

/**
 * Executa uma query utilizando o pool de conexões
 */
async function query(text, params) {
  const p = getPool();
  const start = Date.now();
  try {
    const res = await p.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[DB SLOW QUERY] ${duration}ms: ${text.slice(0, 80)}`);
    }
    return res;
  } catch (err) {
    console.error(`[DB ERROR] Falha na query (${text.slice(0, 80)}):`, err.message);
    throw err;
  }
}

/**
 * Inicializa a estrutura do banco e cria tabelas/índices
 */
async function initDatabase() {
  try {
    console.log(`[DB] Conectando ao PostgreSQL em ${poolConfig.host}:${poolConfig.port}/${poolConfig.database}...`);
    await query('SELECT NOW()');
    console.log('[DB] Conexão com PostgreSQL estabelecida com sucesso!');

    console.log('[DB] Aplicando schema e índices...');
    await query(SCHEMA_SQL);
    console.log('[DB] Tabelas e índices verificados e prontos!');
    isConnected = true;
    return true;
  } catch (err) {
    console.error('[DB] Erro ao inicializar banco de dados:', err.message);
    isConnected = false;
    return false;
  }
}

/**
 * Finaliza o pool de forma graciosa ao encerrar a aplicação
 */
async function closePool() {
  if (pool) {
    await pool.end();
    console.log('[DB] Pool de conexões do PostgreSQL encerrado.');
  }
}

module.exports = {
  getPool,
  query,
  initDatabase,
  closePool,
  isConnected: () => isConnected
};
