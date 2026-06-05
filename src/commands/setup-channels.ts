import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type Guild,
  type Role
} from "discord.js";
import { getSetting, setSetting } from "../db.js";
import { baseEmbed } from "../utils/format.js";
import { gameplayRoles, findRole, roleMenuRows } from "../utils/roles.js";
import type { BotCommand } from "./types.js";

type ChannelSpec = {
  name: string;
  type: ChannelType.GuildText | ChannelType.GuildVoice;
};

const channelIntros: Record<string, { title: string; description: string; fields?: { name: string; value: string }[] }> = {
  welcome: {
    title: "Welcome To The Drifters",
    description: "Welcome aboard. Drifters is a small Star Citizen org open to anyone: new pilots, casual players, grinders, fighters, haulers, miners, salvagers, and people still figuring out what they enjoy.",
    fields: [
      { name: "Start Here", value: "Read #rules, pick roles in #role-select, then use `/verify rsi_handle` when you are ready." }
    ]
  },
  rules: {
    title: "Drifters Rules",
    description: "Keep it simple and keep it playable.",
    fields: [
      { name: "1. Respect The Crew", value: "No harassment, hate speech, doxxing, or personal attacks." },
      { name: "2. No Drama Piracy", value: "Piracy gameplay is fine. Griefing orgmates, stream sniping, and ruining events is not." },
      { name: "3. Keep Channels Useful", value: "Use the right channel when possible. Questions are welcome." },
      { name: "4. No Scam Trades", value: "Do not scam org members. Pay agreed splits and rewards." },
      { name: "5. Real Life First", value: "Events are optional. Drop when you need to." }
    ]
  },
  announcements: {
    title: "Announcements",
    description: "Official Drifters updates, server changes, event notices, and important bot messages go here. Keep replies elsewhere unless an officer opens discussion."
  },
  "role-select": {
    title: "Role Select",
    description: "Choose your gameplay roles by pressing the buttons below. Press the same button again to remove that role.",
    fields: [
      { name: "Available Roles", value: gameplayRoles.join(", ") },
      { name: "Why Pick Roles?", value: "Roles help the Drifters quickly find miners, traders, salvagers, medics, pilots, FPS players, cargo runners, bounty hunters, and industrial crew." }
    ]
  },
  "org-info": {
    title: "About The Drifters",
    description: "Drifters is a small, open Star Citizen organization built for useful teamwork without heavy bureaucracy. Join for trade, mining, salvage, contracts, missions, events, learning the game, or just finding people to fly with.",
    fields: [
      { name: "Vibe", value: "Helpful, casual, practical. Mercenary edge is welcome; toxic behavior is not." },
      { name: "How To Join In", value: "Pick roles, verify your RSI handle, add ships with `/fleet add`, and jump into missions or contracts." }
    ]
  },
  "ai-chat": {
    title: "DrifterAI Chatroom",
    description: "Chat with DrifterAI here. It answers as the Drifters org AI and keeps the conversation focused on Star Citizen, org help, ships, missions, contracts, mining, salvage, trading, events, and server guidance.",
    fields: [
      { name: "Good Topics", value: "Ships, loadouts, new-player help, trading, mining, salvage, contracts, missions, events, and Drifters server help." },
      { name: "Boundary", value: "Off-topic questions will be politely redirected back to Star Citizen or Drifters org topics." }
    ]
  },
  "sc-news": {
    title: "Star Citizen News",
    description: "DrifterAI posts official RSI Comm-Link news here. It checks for new posts every hour and avoids reposting the same link."
  },
  "game-status": {
    title: "Game Status",
    description: "DrifterAI posts Star Citizen service status here every hour using the public RSI status page. Use this channel to check maintenance, degraded services, and outages."
  },
  "patch-notes": {
    title: "Patch Notes",
    description: "DrifterAI posts the latest patch-note style Comm-Link item here once per day. Use this channel to discuss patch changes, wipes, known issues, and new features."
  },
  "ship-talk": {
    title: "Ship Talk",
    description: "Discuss ships, upgrades, loaners, pledge choices, in-game buys, fleet planning, and what to bring to org ops."
  },
  loadouts: {
    title: "Loadouts",
    description: "Share ship builds, FPS kits, mining heads, salvage setups, cargo loadouts, components, and weapon choices. Include screenshots or short notes when useful."
  },
  questions: {
    title: "Questions",
    description: "Ask Star Citizen or org questions here. New players are welcome. No shame in asking how to land, refuel, mine, or find a hangar."
  },
  contracts: {
    title: "Contracts",
    description: "Org jobs go here: escorts, hauling, scouting, security, mining support, salvage claims, risky cargo, and paid help.",
    fields: [
      { name: "Create", value: "Use `/contract create` with title, description, reward, role needed, max players, and time." },
      { name: "Join", value: "Use `/contract list`, then `/contract join contract_id`." },
      { name: "Close", value: "Officers/admins can use `/contract close contract_id`." }
    ]
  },
  missions: {
    title: "Missions",
    description: "Planned org missions and events go here: mining, salvage, cargo, bounty, FPS, piracy, escort, and exploration.",
    fields: [
      { name: "Create", value: "Use `/mission create` with title, type, time, description, and max players." },
      { name: "Join", value: "Use `/mission list`, then `/mission join mission_id`." }
    ]
  },
  "event-planning": {
    title: "Event Planning",
    description: "Plan future org nights here. Use it for dates, rally points, ship requirements, voice channel plans, roles, payout splits, and backup plans."
  },
  "looking-for-group": {
    title: "Looking For Group",
    description: "Looking for a crew right now? Post what you are doing, where you are, how many people you need, and whether new players can join."
  },
  "fleet-log": {
    title: "Fleet Log",
    description: "Use `/fleet add ship_name`, `/fleet list`, and `/fleet remove ship_name` to track personal fleets. Post fleet plans and available ships here."
  },
  "intel-drops": {
    title: "Intel Drops",
    description: "Drop useful intel here: risky routes, player activity, wrecks, Jumptown-style activity, market changes, bounty hotspots, or places to avoid."
  },
  "trade-routes": {
    title: "Trade Routes",
    description: "Share trade routes and commodity opportunities. Use `/trade from to commodity`, `/commodity commodity_name`, `/price commodity`, and `/route commodity`."
  },
  mining: {
    title: "Mining",
    description: "Mining planning and payouts. Use `/mining material` for sell intel, and post rock finds, refinery choices, modules, and crew needs."
  },
  salvage: {
    title: "Salvage",
    description: "Salvage claims, wreck locations, RMC/CM planning, Reclaimer/Vulture crew calls, and payout splits go here."
  },
  "cargo-prices": {
    title: "Cargo Prices",
    description: "Commodity price chatter and terminal updates. UEX data is community-driven, so verify in-game before loading expensive cargo."
  }
};

const categories: { name: string; channels: ChannelSpec[] }[] = [
  {
    name: "INFO",
    channels: ["welcome", "rules", "announcements", "role-select", "org-info", "ai-chat"].map((name) => ({
      name,
      type: ChannelType.GuildText
    }))
  },
  {
    name: "STAR CITIZEN",
    channels: ["sc-news", "game-status", "patch-notes", "ship-talk", "loadouts", "questions"].map((name) => ({
      name,
      type: ChannelType.GuildText
    }))
  },
  {
    name: "ORG OPERATIONS",
    channels: ["contracts", "missions", "event-planning", "looking-for-group", "fleet-log", "intel-drops"].map((name) => ({
      name,
      type: ChannelType.GuildText
    }))
  },
  {
    name: "ECONOMY",
    channels: ["trade-routes", "mining", "salvage", "cargo-prices"].map((name) => ({
      name,
      type: ChannelType.GuildText
    }))
  },
  {
    name: "VOICE",
    channels: ["Mission Voice 1", "Mission Voice 2", "Mining Crew", "Trading Crew", "FPS Squad"].map((name) => ({
      name,
      type: ChannelType.GuildVoice
    }))
  }
];

function everyoneRole(guild: Guild) {
  return guild.roles.everyone;
}

function verifiedView(role?: Role) {
  return role ? [{ id: role.id, allow: [PermissionFlagsBits.ViewChannel] }] : [];
}

function officerManage(role?: Role) {
  return role
    ? [{
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages
        ]
      }]
    : [];
}

const managedChannelNames = new Set(categories.flatMap((category) => category.channels.map((channel) => channel.name.toLowerCase())));
const managedCategoryNames = new Set(categories.map((category) => category.name.toLowerCase()));

async function makeVisibleToEveryone(channel: unknown, guild: Guild) {
  if (!channel || typeof channel !== "object" || !("permissionOverwrites" in channel)) return;
  const overwrites = (channel as { permissionOverwrites?: { edit: (role: Role, options: { ViewChannel: boolean }) => Promise<unknown> } }).permissionOverwrites;
  if (!overwrites) return;
  await overwrites.edit(everyoneRole(guild), { ViewChannel: true });
}

async function resetManagedChannels(guild: Guild) {
  let deleted = 0;

  const managedChannels = guild.channels.cache.filter((channel) => managedChannelNames.has(channel.name.toLowerCase()));
  for (const channel of managedChannels.values()) {
    await channel.delete("DrifterAI setup_channels reset");
    deleted += 1;
  }

  const managedCategories = guild.channels.cache.filter(
    (channel) => channel.type === ChannelType.GuildCategory && managedCategoryNames.has(channel.name.toLowerCase())
  );
  for (const channel of managedCategories.values()) {
    await channel.delete("DrifterAI setup_channels reset");
    deleted += 1;
  }

  await guild.channels.fetch();
  return deleted;
}

async function seedChannelIntro(channel: unknown, force: boolean) {
  if (!channel || typeof channel !== "object" || !("name" in channel) || !("id" in channel)) return false;
  const name = String((channel as { name: string }).name);
  const id = String((channel as { id: string }).id);
  const intro = channelIntros[name.toLowerCase()];
  if (!intro) return false;
  if (!("isTextBased" in channel) || !(channel as { isTextBased: () => boolean }).isTextBased() || !("send" in channel)) return false;

  const settingKey = `introPosted:${id}`;
  if (!force && getSetting(settingKey)?.value === "true") return false;

  const embed = baseEmbed(intro.title).setDescription(intro.description);
  for (const field of intro.fields ?? []) {
    embed.addFields({ name: field.name, value: field.value, inline: false });
  }

  const payload = name.toLowerCase() === "role-select"
    ? { embeds: [embed], components: roleMenuRows() }
    : { embeds: [embed] };

  await (channel as { send: (payload: unknown) => Promise<unknown> }).send(payload);
  setSetting(settingKey, "true");
  return true;
}

export const setupChannelsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup_channels")
    .setDescription("Create practical Drifters org channels.")
    .addBooleanOption((option) =>
      option
        .setName("reset")
        .setDescription("Delete and recreate DrifterAI-managed channels/categories.")
        .setRequired(false)
    ),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "Use this inside the server.", ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: "You need Manage Channels to run setup.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const guild = interaction.guild;
      const visitor = findRole(guild, "Visitor");
      const verified = findRole(guild, "Verified");
      const officer = findRole(guild, "Officer");
      const reset = interaction.options.getBoolean("reset") ?? false;
      let created = 0;
      let deleted = 0;
      let updated = 0;
      let seeded = 0;

      if (reset) {
        deleted = await resetManagedChannels(guild);
      }

      for (const category of categories) {
        let parent = guild.channels.cache.find(
          (channel) => channel.type === ChannelType.GuildCategory && channel.name.toLowerCase() === category.name.toLowerCase()
        );

        if (!parent) {
          parent = await guild.channels.create({
            name: category.name,
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              { id: everyoneRole(guild).id, allow: [PermissionFlagsBits.ViewChannel] },
              ...verifiedView(verified),
              ...officerManage(officer)
            ]
          });
          created += 1;
        } else {
          await makeVisibleToEveryone(parent, guild);
          updated += 1;
        }

        for (const channel of category.channels) {
          const existing = guild.channels.cache.find((item) => item.name.toLowerCase() === channel.name.toLowerCase());
          if (existing) {
            await makeVisibleToEveryone(existing, guild);
            if (await seedChannelIntro(existing, reset)) seeded += 1;
            updated += 1;
            continue;
          }

          const isOfficerArea = ["contracts", "missions", "event-planning"].includes(channel.name);

          const createdChannel = await guild.channels.create({
            name: channel.name,
            type: channel.type,
            parent: parent.id,
            permissionOverwrites: [
              { id: everyoneRole(guild).id, allow: [PermissionFlagsBits.ViewChannel] },
              ...(visitor ? [{ id: visitor.id, allow: [PermissionFlagsBits.ViewChannel] }] : []),
              ...verifiedView(verified),
              ...(isOfficerArea ? officerManage(officer) : [])
            ]
          });
          if (await seedChannelIntro(createdChannel, true)) seeded += 1;
          created += 1;
        }
      }

      const welcome = guild.channels.cache.find((channel) => channel.name === "welcome");
      const contracts = guild.channels.cache.find((channel) => channel.name === "contracts");
      const status = guild.channels.cache.find((channel) => channel.name === "game-status");
      const news = guild.channels.cache.find((channel) => channel.name === "sc-news");
      const patchNotes = guild.channels.cache.find((channel) => channel.name === "patch-notes");
      const aiChat = guild.channels.cache.find((channel) => channel.name === "ai-chat");
      if (welcome) setSetting("welcomeChannelId", welcome.id);
      if (contracts) setSetting("contractChannelId", contracts.id);
      if (status) setSetting("statusChannelId", status.id);
      if (news) setSetting("newsChannelId", news.id);
      if (patchNotes) setSetting("patchNotesChannelId", patchNotes.id);
      if (aiChat) setSetting("aiChatChannelId", aiChat.id);

      const embed = baseEmbed("Channels Ready")
        .setDescription(`Created ${created}, updated ${updated}, deleted ${deleted}, seeded ${seeded} intro messages. All managed channels are visible to everyone.`)
        .addFields(
        { name: "Default Access", value: "All created channels are visible to everyone by default.", inline: false },
        { name: "Verified Access", value: "Verified role can still be used for future private channels.", inline: false },
          { name: "Officer Access", value: "Can manage operation planning spaces if Discord role hierarchy allows it.", inline: false },
          {
            name: "Role Note",
            value: verified ? "Verified role found; private channel permissions were applied." : "Verified role not found yet; run `/setup_roles`, then adjust permissions if needed.",
            inline: false
          }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Setup channels failed:", error);
      const message = error instanceof Error ? error.message : String(error);
      await interaction.editReply({
        content: `Setup failed: ${message.slice(0, 1500)}`
      });
    }
  }
};
