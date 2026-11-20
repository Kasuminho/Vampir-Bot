require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', async () => {
  const g = await client.guilds.fetch(process.env.GUILD_ID);
  const roles = await g.roles.fetch();
  roles.forEach(r => console.log(r.name + ' -> ' + r.id));
  process.exit(0);
});
client.login(process.env.DISCORD_TOKEN);
