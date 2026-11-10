const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getGuilds, getServerConfig, saveGuilds } = require('../src/data_manager');
const { updateSingleGuildCard } = require('../src/recruitment_panel');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const JMX_ID = '1177008353927495710';
const IGRIS_ID = '773250841607667773';
const MARCOS_IDS = ['792966913952579585', '437468445823467531'];

client.once('clientReady', async () => {
  console.log('[UPDATE] Conectado como ' + client.user.tag);
  const discordGuild = await client.guilds.fetch(process.env.GUILD_ID);
  const config = getServerConfig();
  const allGuilds = getGuilds();
  const nom = allGuilds.find(x => x.tag === 'NOM');

  if (!nom) {
    console.error('Guild No Mercy não encontrada!');
    process.exit(1);
  }

  // 1. Atualizar JMX
  const jmxMember = await discordGuild.members.fetch(JMX_ID).catch(() => null);
  if (jmxMember) {
    console.log('[JMX] Atualizando cargos...');
    if (config?.roles?.lider) {
      await jmxMember.roles.add(config.roles.lider, 'Promovido a Líder da No Mercy');
    }
    if (config?.roles?.oficial && jmxMember.roles.cache.has(config.roles.oficial)) {
      await jmxMember.roles.remove(config.roles.oficial, 'Promovido a Líder (remove cargo de oficial)');
    }
    console.log('[JMX] Cargos atualizados com sucesso!');
  } else {
    console.warn('[JMX] Membro não encontrado no servidor!');
  }

  // 2. Atualizar Igris (apenas membro)
  const igrisMember = await discordGuild.members.fetch(IGRIS_ID).catch(() => null);
  if (igrisMember) {
    console.log('[IGRIS] Removendo cargo de líder...');
    if (config?.roles?.lider && igrisMember.roles.cache.has(config.roles.lider)) {
      await igrisMember.roles.remove(config.roles.lider, 'Rebaixado para membro da No Mercy');
    }
    if (config?.roles?.oficial && igrisMember.roles.cache.has(config.roles.oficial)) {
      await igrisMember.roles.remove(config.roles.oficial, 'Removido cargo de oficial');
    }
    console.log('[IGRIS] Agora está apenas como membro da No Mercy!');
  } else {
    console.warn('[IGRIS] Membro não encontrado no servidor!');
  }

  // 3. Atualizar Marcos Mattedi (remover cargos)
  for (const mid of MARCOS_IDS) {
    const marcosMember = await discordGuild.members.fetch(mid).catch(() => null);
    if (marcosMember) {
      console.log(`[MARCOS] Encontrado ${marcosMember.user.tag} (${mid}), removendo cargos...`);
      const rolesToRemove = [];
      if (nom.roleId && marcosMember.roles.cache.has(nom.roleId)) rolesToRemove.push(nom.roleId);
      if (config?.roles?.oficial && marcosMember.roles.cache.has(config.roles.oficial)) rolesToRemove.push(config.roles.oficial);
      if (config?.roles?.lider && marcosMember.roles.cache.has(config.roles.lider)) rolesToRemove.push(config.roles.lider);
      if (config?.roles?.validado && marcosMember.roles.cache.has(config.roles.validado)) rolesToRemove.push(config.roles.validado);

      for (const rid of rolesToRemove) {
        await marcosMember.roles.remove(rid, 'Saiu da No Mercy').catch(() => {});
      }
      console.log(`[MARCOS] ${rolesToRemove.length} cargo(s) removido(s) de ${marcosMember.user.tag}`);
    }
  }

  // 4. Permissões de canais privados da No Mercy
  // Canal de aprovações
  if (nom.approvalsChannelId) {
    const chApp = await discordGuild.channels.fetch(nom.approvalsChannelId).catch(() => null);
    if (chApp) {
      // Adiciona JMX
      await chApp.permissionOverwrites.edit(JMX_ID, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      }, { reason: 'Novo Líder da No Mercy' }).catch(() => {});

      // Remove overwrite de Igris
      await chApp.permissionOverwrites.delete(IGRIS_ID, 'Igris não é mais líder').catch(() => {});
      console.log('[CANAIS] Canal de aprovações atualizado!');
    }
  }

  // Canal de validação de presenças de Geena
  if (nom.attendanceValidationChannelId) {
    const chVal = await discordGuild.channels.fetch(nom.attendanceValidationChannelId).catch(() => null);
    if (chVal) {
      // Remove overwrite de Igris
      await chVal.permissionOverwrites.delete(IGRIS_ID, 'Igris não é mais líder').catch(() => {});
      // Garante JMX
      await chVal.permissionOverwrites.edit(JMX_ID, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      }, { reason: 'Novo Líder da No Mercy' }).catch(() => {});
      console.log('[CANAIS] Canal de validação de presenças atualizado!');
    }
  }

  // 5. Atualizar data/guilds.json
  nom.leaderId = JMX_ID;
  nom.officerIds = (nom.officerIds || []).filter(id => !MARCOS_IDS.includes(id) && id !== JMX_ID);
  saveGuilds(allGuilds);
  console.log('[JSON] data/guilds.json atualizado!');
  console.log('Novo líder da No Mercy:', nom.leaderId);
  console.log('Oficiais restantes:', nom.officerIds);

  // 6. Atualizar card de recrutamento no canal #recrutamento-guilds
  try {
    await updateSingleGuildCard(discordGuild, nom);
    console.log('[CARD] Card de recrutamento da No Mercy atualizado com o novo Líder JMX!');
  } catch (err) {
    console.error('[CARD] Erro ao atualizar card de recrutamento:', err.message);
  }

  console.log('[FINALIZADO] Todas as correções na No Mercy foram aplicadas com sucesso!');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
