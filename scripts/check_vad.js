require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const g = await client.guilds.fetch(process.env.GUILD_ID);
  const ch = await g.channels.fetch('1565408234867662931');
  const cat = await g.channels.fetch('1572764884918210671');
  const roles = await g.roles.fetch();

  console.log('=== AUDITORIO OVERWRITES ===');
  ch.permissionOverwrites.cache.forEach(ow => {
    const name = roles.get(ow.id)?.name || ow.id;
    console.log(`[${name}] ALLOW: ${ow.allow.toArray().join(', ')} | DENY: ${ow.deny.toArray().join(', ')}`);
  });

  console.log('\n=== CATEGORY OVERWRITES ===');
  cat.permissionOverwrites.cache.forEach(ow => {
    const name = roles.get(ow.id)?.name || ow.id;
    console.log(`[${name}] ALLOW: ${ow.allow.toArray().join(', ')} | DENY: ${ow.deny.toArray().join(', ')}`);
  });

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
