require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const g = await client.guilds.fetch(process.env.GUILD_ID);
  const channels = await g.channels.fetch();
  const roles = await g.roles.fetch();

  const chAvisos = channels.get('1573133327232274513');
  const chAuditorio = channels.get('1565408234867662931');

  console.log('=== VERIFICAÇÃO DE AVISOS DE GUERRA ===');
  console.log('Canal:', chAvisos.name, 'Posição:', chAvisos.position, 'Parent:', channels.get(chAvisos.parentId)?.name);
  chAvisos.permissionOverwrites.cache.forEach(ow => {
    const roleName = roles.get(ow.id)?.name || ow.id;
    console.log(`  * ${roleName}: ALLOW=[${ow.allow.toArray().join(',')}] | DENY=[${ow.deny.toArray().join(',')}]`);
  });

  console.log('\n=== VERIFICAÇÃO DO AUDITÓRIO ===');
  console.log('Canal:', chAuditorio.name, 'Parent:', channels.get(chAuditorio.parentId)?.name);
  chAuditorio.permissionOverwrites.cache.forEach(ow => {
    const roleName = roles.get(ow.id)?.name || ow.id;
    console.log(`  * ${roleName}: ALLOW=[${ow.allow.toArray().join(',')}] | DENY=[${ow.deny.toArray().join(',')}]`);
  });

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
