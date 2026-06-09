import { Client, Events, GatewayIntentBits } from "discord.js";
import { assertRuntimeConfig, config } from "./config.js";
import { getSetting } from "./db.js";
import { commandMap } from "./commands/index.js";
import { errorMessage } from "./utils/errors.js";
import { welcomeNewMember } from "./events/welcome.js";
import { handleRoleButton } from "./utils/roles.js";
import { startScheduledPosts } from "./services/scheduler.js";
import { aiEnvDebugLabel, aiProviderLabel, generateOrgAiReply } from "./services/ai.js";
import { buildResearchContext } from "./services/research.js";
import { getExecutiveHangarStatus } from "./services/executive-hangar.js";

assertRuntimeConfig();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready as ${readyClient.user.tag}. Contracts are open.`);
  console.log(`AI chat provider: ${aiProviderLabel()}`);
  console.log(aiEnvDebugLabel());
  startScheduledPosts(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("role:")) {
      await handleRoleButton(interaction);
    }
    return;
  }

  if (interaction.isAutocomplete()) {
    const command = commandMap.get(interaction.commandName);
    if (!command?.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch {
      await interaction.respond([]);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commandMap.get(interaction.commandName);
  console.log(`Command received: /${interaction.commandName}`);
  if (!command) {
    await interaction.reply({
      content: `Command /${interaction.commandName} is not loaded in this bot process. Redeploy commands and restart me.`,
      ephemeral: true
    });
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Command /${interaction.commandName} failed:`, error);
    const content = errorMessage(error);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content, embeds: [] });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  console.log(`Member joined: ${member.user.tag}`);
  await welcomeNewMember(member);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  const aiChatChannelId = getSetting("aiChatChannelId")?.value;
  const calledByMention = client.user ? message.mentions.users.has(client.user.id) : false;
  const calledByName = /\bdrifter\s*ai\b|\bdai\b/i.test(message.content);
  const isAiChat = Boolean(aiChatChannelId && message.channelId === aiChatChannelId);
  if (!isAiChat && !calledByMention && !calledByName) return;

  if (!config.groqApiKey && !config.geminiApiKey) {
    await message.reply("No AI key is configured, captain. Add `GEMINI_API_KEY` or `GROQ_API_KEY` to `.env` and restart me.");
    return;
  }

  try {
    await message.channel.sendTyping();
    const cleanedMessage = message.content
      .replace(client.user ? new RegExp(`<@!?${client.user.id}>`, "g") : /$^/, "")
      .replace(/\b(?:drifter\s*ai|dai)\b[:,]?\s*/i, "")
      .trim();
    if (/\b(exec|executive)\s+hang(ar|er)s?\b|\bhang(ar|er)\s+(status|timer|open|closed)\b/i.test(cleanedMessage || message.content)) {
      const hangar = await getExecutiveHangarStatus();
      await message.reply(hangar.summary);
      return;
    }
    const researchContext = await buildResearchContext(cleanedMessage || message.content);
    const reply = await generateOrgAiReply(cleanedMessage || message.content, message.member?.displayName ?? message.author.username, researchContext);
    await message.reply(reply);
  } catch (error) {
    console.error("AI chat failed:", error);
    await message.reply("Gemini web search failed or returned no grounded sources. Check Railway logs and make sure `GEMINI_API_KEY` is set.");
  }
});

client.login(config.discordToken).catch((error) => {
  console.error(error);
  process.exit(1);
});
