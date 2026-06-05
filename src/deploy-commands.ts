import { REST, Routes } from "discord.js";
import { assertRuntimeConfig, config } from "./config.js";
import { commands } from "./commands/index.js";

async function main() {
  assertRuntimeConfig();

  const rest = new REST({ version: "10" }).setToken(config.discordToken);
  const body = commands.map((command) => command.data.toJSON());

  if (config.discordGuildId) {
    await rest.put(
      Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
      { body }
    );
    console.log(`Deployed ${body.length} guild commands.`);
    return;
  }

  await rest.put(Routes.applicationCommands(config.discordClientId), { body });
  console.log(`Deployed ${body.length} global commands.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
