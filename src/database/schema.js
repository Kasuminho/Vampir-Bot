/**
 * DDL Schema para criação das tabelas e índices no PostgreSQL
 */
const SCHEMA_SQL = `
-- 1. Guildas da Coalizão
CREATE TABLE IF NOT EXISTS guilds (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  tag VARCHAR(32) NOT NULL UNIQUE,
  leader_id VARCHAR(64) NOT NULL,
  role_id VARCHAR(64) NOT NULL,
  category_id VARCHAR(64),
  approvals_channel_id VARCHAR(64),
  chat_channel_id VARCHAR(64),
  attendance_validation_channel_id VARCHAR(64),
  recruitment_message_id VARCHAR(64),
  description TEXT,
  color VARCHAR(32),
  icon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  officer_ids JSONB DEFAULT '[]'::jsonb,
  caller_ids JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_guilds_tag ON guilds(tag);
CREATE INDEX IF NOT EXISTS idx_guilds_leader_id ON guilds(leader_id);
CREATE INDEX IF NOT EXISTS idx_guilds_role_id ON guilds(role_id);

-- 2. Submissões de Presença de Boss
CREATE TABLE IF NOT EXISTS attendance_submissions (
  id VARCHAR(64) PRIMARY KEY,
  event_id VARCHAR(64) NOT NULL,
  event_name VARCHAR(128) NOT NULL,
  submitter_id VARCHAR(64) NOT NULL,
  submitter_tag VARCHAR(128),
  is_pilot BOOLEAN DEFAULT FALSE,
  pilot_user_id VARCHAR(64),
  owner_user_id VARCHAR(64) NOT NULL,
  owner_user_tag VARCHAR(128),
  guild_id VARCHAR(64) NOT NULL,
  guild_tag VARCHAR(32) NOT NULL,
  guild_name VARCHAR(128),
  print_url TEXT NOT NULL,
  note TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  validated_by VARCHAR(64),
  validated_at TIMESTAMPTZ,
  rejection_reason TEXT,
  validation_message_id VARCHAR(64),
  validation_channel_id VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_att_sub_owner ON attendance_submissions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_att_sub_submitter ON attendance_submissions(submitter_id);
CREATE INDEX IF NOT EXISTS idx_att_sub_guild ON attendance_submissions(guild_id);
CREATE INDEX IF NOT EXISTS idx_att_sub_status ON attendance_submissions(status);
CREATE INDEX IF NOT EXISTS idx_att_sub_event ON attendance_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_att_sub_created ON attendance_submissions(created_at DESC);

-- 3. Saldo de Presenças por Usuário
CREATE TABLE IF NOT EXISTS attendance_users (
  user_id VARCHAR(64) PRIMARY KEY,
  user_tag VARCHAR(128),
  guild_id VARCHAR(64),
  guild_tag VARCHAR(32),
  total_presencas INT DEFAULT 0,
  as_titular INT DEFAULT 0,
  as_pilot INT DEFAULT 0,
  times_piloting INT DEFAULT 0,
  last_event VARCHAR(128),
  last_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_att_users_guild ON attendance_users(guild_id);
CREATE INDEX IF NOT EXISTS idx_att_users_total ON attendance_users(total_presencas DESC);

-- 4. Configurações Dinâmicas de Presença (Painel, Banner, Janela Ativa)
CREATE TABLE IF NOT EXISTS attendance_config (
  key VARCHAR(64) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Candidaturas de Recrutamento
CREATE TABLE IF NOT EXISTS applications (
  id VARCHAR(64) PRIMARY KEY,
  guild_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  user_tag VARCHAR(128),
  nick VARCHAR(128) NOT NULL,
  classe VARCHAR(128) NOT NULL,
  horarios VARCHAR(128),
  sobre TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by VARCHAR(64),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_guild_id ON applications(guild_id);
CREATE INDEX IF NOT EXISTS idx_app_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_app_created ON applications(created_at DESC);

-- 6. Bosses e Timers
CREATE TABLE IF NOT EXISTS boss_data (
  id VARCHAR(64) PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS boss_schedules (
  id VARCHAR(64) PRIMARY KEY,
  category VARCHAR(32) DEFAULT 'general',
  name VARCHAR(128) NOT NULL,
  level INT,
  interval_hours INT,
  window_minutes INT,
  last_killed TIMESTAMPTZ,
  next_spawn TIMESTAMPTZ,
  active BOOLEAN DEFAULT TRUE,
  data JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE boss_schedules ADD COLUMN IF NOT EXISTS category VARCHAR(32) DEFAULT 'general';

CREATE INDEX IF NOT EXISTS idx_boss_next_spawn ON boss_schedules(next_spawn);

-- 7. Configurações Globais do Servidor
CREATE TABLE IF NOT EXISTS server_config (
  id VARCHAR(64) PRIMARY KEY,
  config_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

module.exports = { SCHEMA_SQL };
