require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const ROLE_IDS = {
  everyone: '1565123866488209529',
  validado: '1565129722961207388',
  staff: '1565129720444485662',
  liderRust2: '1565129721606574103',
  oficialRust2: '1565895782174040124',
  liderRust1: '1572768214675361792',
  oficialRust1: '1572768217707974776',
  caller: '1566152015795458120',
  comandante: '1570146588893122621'
};

const AUDITORIO_ID = '1565408234867662931';

client.once('ready', async () => {
  console.log(`[FIX-VAD] Conectado como ${client.user.tag}`);

  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const chAuditorio = await guild.channels.fetch(AUDITORIO_ID);

    console.log(`[FIX-VAD] Canal: ${chAuditorio.name}`);

    await chAuditorio.permissionOverwrites.set([
      // @everyone: Bloqueado
      {
        id: ROLE_IDS.everyone,
        deny: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak
        ]
      },
      // [⚔️] Player Validado: Ouve e conecta, mas NÃO FALA (SEM travar apertar-para-falar!)
      {
        id: ROLE_IDS.validado,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.ReadMessageHistory
        ],
        deny: [
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.RequestToSpeak
        ]
      },
      // [🛡️] Staff / Admin: Fala livre (VAD liberado) + prioridade
      {
        id: ROLE_IDS.staff,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.UseVAD,
          PermissionFlagsBits.PrioritySpeaker,
          PermissionFlagsBits.MuteMembers,
          PermissionFlagsBits.DeafenMembers,
          PermissionFlagsBits.MoveMembers,
          PermissionFlagsBits.ManageChannels
        ]
      },
      // [👑] Líder (Rust 2): Fala livre (VAD liberado) + prioridade
      {
        id: ROLE_IDS.liderRust2,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.UseVAD,
          PermissionFlagsBits.PrioritySpeaker,
          PermissionFlagsBits.MuteMembers
        ]
      },
      // [👑] Líder (Rust 1): Fala livre (VAD liberado) + prioridade
      {
        id: ROLE_IDS.liderRust1,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.UseVAD,
          PermissionFlagsBits.PrioritySpeaker,
          PermissionFlagsBits.MuteMembers
        ]
      },
      // [🎖️] Oficial (Rust 2): Fala livre (VAD liberado) + prioridade
      {
        id: ROLE_IDS.oficialRust2,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.UseVAD,
          PermissionFlagsBits.PrioritySpeaker
        ]
      },
      // [🎖️] Oficial (Rust 1): Fala livre (VAD liberado) + prioridade
      {
        id: ROLE_IDS.oficialRust1,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.UseVAD,
          PermissionFlagsBits.PrioritySpeaker
        ]
      },
      // [📢] Shout Caller: Fala livre (VAD liberado) + prioridade
      {
        id: ROLE_IDS.caller,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.UseVAD,
          PermissionFlagsBits.PrioritySpeaker
        ]
      },
      // Comandante de Guerra: Fala livre (VAD liberado) + prioridade
      {
        id: ROLE_IDS.comandante,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.UseVAD,
          PermissionFlagsBits.PrioritySpeaker
        ]
      }
    ]);

    console.log('[FIX-VAD] SUCESSO: Apertar para falar (Push-to-Talk) removido! Detecção de voz (VAD) 100% liberada para quem tem cargo de fala!');
  } catch (err) {
    console.error('[ERRO]', err);
  } finally {
    setTimeout(() => {
      client.destroy();
      process.exit(0);
    }, 1500);
  }
});

client.login(process.env.DISCORD_TOKEN);
