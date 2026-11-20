require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', async () => {
  const g = await client.guilds.fetch(process.env.GUILD_ID);
  const channels = await g.channels.fetch();
  const found = channels.filter(c => c && (c.name.includes('aviso') || c.name.includes('anuncio')));
  console.log('Channels found:');
  found.forEach(c => console.log(c.name + ' (' + c.id + ') in ' + (c.parentId ? channels.get(c.parentId)?.name : 'none')));
  process.exit(0);
});
client.login(process.env.DISCORD_TOKEN);
