require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  const g = await client.guilds.fetch(process.env.GUILD_ID);
  const channels = await g.channels.fetch();

  console.log('Searching for any channel with UseVAD denied:');
  channels.forEach(ch => {
    if (!ch || !ch.permissionOverwrites) return;
    ch.permissionOverwrites.cache.forEach(ow => {
      if (ow.deny.toArray().includes('UseVAD')) {
        console.log(`Channel ${ch.name} (${ch.id}) has UseVAD DENIED on target ${ow.id}`);
      }
    });
  });

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
