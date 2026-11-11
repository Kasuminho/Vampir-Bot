const fs = require('fs');
const path = require('path');
const { initDatabase, query, closePool } = require('../src/database/db');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, '..', 'data');

async function migrate() {
  console.log('=== INICIANDO MIGRAÇÃO DE JSON PARA POSTGRESQL ===');
  const ready = await initDatabase();
  if (!ready) {
    console.error('Abortando migração: banco de dados inacessível.');
    process.exit(1);
  }

  // 1. Guilds
  const guildsFile = path.join(DATA_DIR, 'guilds.json');
  if (fs.existsSync(guildsFile)) {
    const guilds = JSON.parse(fs.readFileSync(guildsFile, 'utf8'));
    console.log(`[MIGRATE] Migrando ${guilds.length} guildas...`);
    for (const g of guilds) {
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
    console.log(`[MIGRATE] Guildas migradas com sucesso!`);
  }

  // 2. Presenças (Submissões, Usuários, Config)
  const presencasFile = path.join(DATA_DIR, 'presencas.json');
  if (fs.existsSync(presencasFile)) {
    const data = JSON.parse(fs.readFileSync(presencasFile, 'utf8'));
    const submissions = Object.values(data.submissions || {});
    console.log(`[MIGRATE] Migrando ${submissions.length} submissões de presenças...`);
    for (const s of submissions) {
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

    const users = Object.values(data.users || {});
    console.log(`[MIGRATE] Migrando ${users.length} usuários pontuados de presenças...`);
    for (const u of users) {
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

    // Config de presenças
    if (data.panelMessageId) {
      await query(`
        INSERT INTO attendance_config (key, value, updated_at)
        VALUES ('panelMessageId', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [JSON.stringify(data.panelMessageId)]);
    }
    if (data.checkinBannerMessageId) {
      await query(`
        INSERT INTO attendance_config (key, value, updated_at)
        VALUES ('checkinBannerMessageId', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [JSON.stringify(data.checkinBannerMessageId)]);
    }
    if (data.activeWindowOverride) {
      await query(`
        INSERT INTO attendance_config (key, value, updated_at)
        VALUES ('activeWindowOverride', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `, [JSON.stringify(data.activeWindowOverride)]);
    }
    console.log(`[MIGRATE] Presenças migradas com sucesso!`);
  }

  // 3. Applications
  const appsFile = path.join(DATA_DIR, 'applications.json');
  if (fs.existsSync(appsFile)) {
    const apps = JSON.parse(fs.readFileSync(appsFile, 'utf8'));
    console.log(`[MIGRATE] Migrando ${apps.length} candidaturas de recrutamento...`);
    for (const a of apps) {
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
    console.log(`[MIGRATE] Candidaturas migradas com sucesso!`);
  }

  // 4. Boss Schedules
  const bossesFile = path.join(DATA_DIR, 'bosses.json');
  if (fs.existsSync(bossesFile)) {
    const bossesData = JSON.parse(fs.readFileSync(bossesFile, 'utf8'));
    console.log(`[MIGRATE] Migrando dados dos bosses...`);
    
    // Salva o payload completo em boss_data
    await query(`
      INSERT INTO boss_data (id, data, updated_at)
      VALUES ('primary', $1, NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `, [JSON.stringify(bossesData)]);

    // Salva cada boss individualmente em boss_schedules
    const allBosses = [];
    if (Array.isArray(bossesData.geena)) {
      bossesData.geena.forEach(b => allBosses.push({ ...b, category: 'geena' }));
    }
    if (Array.isArray(bossesData.mapBosses)) {
      bossesData.mapBosses.forEach(b => allBosses.push({ ...b, category: 'mapBoss' }));
    }

    for (const b of allBosses) {
      const bId = b.id || b.name?.toLowerCase().replace(/\s+/g, '_') || `boss_${Date.now()}`;
      await query(`
        INSERT INTO boss_schedules (
          id, category, name, level, interval_hours, window_minutes, last_killed, next_spawn, active, data, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (id) DO UPDATE SET
          category = EXCLUDED.category,
          last_killed = EXCLUDED.last_killed,
          next_spawn = EXCLUDED.next_spawn,
          active = EXCLUDED.active,
          data = EXCLUDED.data,
          updated_at = NOW()
      `, [
        bId,
        b.category || 'general',
        b.name || bId,
        b.level || 0,
        b.intervalHours || b.cooldownHours || 0,
        b.windowMinutes || 0,
        b.lastKilled ? new Date(b.lastKilled) : null,
        b.nextSpawn ? new Date(b.nextSpawn) : null,
        b.active !== false,
        JSON.stringify(b)
      ]);
    }
    console.log(`[MIGRATE] ${allBosses.length} bosses migrados com sucesso!`);
  }

  // 5. Server Config
  const configFile = path.join(DATA_DIR, 'server_config.json');
  if (fs.existsSync(configFile)) {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    console.log(`[MIGRATE] Migrando configurações do servidor...`);
    await query(`
      INSERT INTO server_config (id, config_json, updated_at)
      VALUES ('primary', $1, NOW())
      ON CONFLICT (id) DO UPDATE SET config_json = EXCLUDED.config_json, updated_at = NOW()
    `, [JSON.stringify(config)]);
    console.log(`[MIGRATE] Configurações migradas com sucesso!`);
  }

  // Verificação final
  const countGuilds = await query('SELECT COUNT(*) FROM guilds');
  const countSubs = await query('SELECT COUNT(*) FROM attendance_submissions');
  const countUsers = await query('SELECT COUNT(*) FROM attendance_users');
  const countApps = await query('SELECT COUNT(*) FROM applications');
  const countBosses = await query('SELECT COUNT(*) FROM boss_schedules');

  console.log('\n=== MIGRAÇÃO CONCLUÍDA COM SUCESSO! ===');
  console.log(`🏰 Guildas no PostgreSQL: ${countGuilds.rows[0].count}`);
  console.log(`📸 Submissões de Presença no PostgreSQL: ${countSubs.rows[0].count}`);
  console.log(`👥 Usuários Pontuados no PostgreSQL: ${countUsers.rows[0].count}`);
  console.log(`📋 Candidaturas no PostgreSQL: ${countApps.rows[0].count}`);
  console.log(`⚔️ Bosses no PostgreSQL: ${countBosses.rows[0].count}`);

  await closePool();
}

migrate().catch(err => {
  console.error('Erro fatal durante a migração:', err);
  process.exit(1);
});
