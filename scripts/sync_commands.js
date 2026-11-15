require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { commands } = require('../src/commands');

async function sync() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  console.log(`[SYNC] Sincronizando ${commands.length} comandos com o Discord...`);
  const res = await rest.put(
    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
    { body: commands }
  );
  console.log(`[SYNC] Sucesso! ${res.length} comandos sincronizados na guilda.`);
}

sync().catch(err => {
  console.error('[SYNC ERRO]', err);
  process.exit(1);
});
