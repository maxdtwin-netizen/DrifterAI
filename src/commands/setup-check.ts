import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getSetting } from "../db.js";
import { baseEmbed } from "../utils/format.js";
import { coreRoles, gameplayRoles, findRole } from "../utils/roles.js";
import type { BotCommand } from "./types.js";

function status(value: boolean) {
  return value ? "Ready" : "Missing";
}

export const setupCheckCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup-check")
    .setDescription("Check DrifterAI server setup."),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "Use this inside the server.", ephemeral: true });
      return;
    }

    const me = interaction.guild.members.me;
    const canManageRoles = me?.permissions.has(PermissionFlagsBits.ManageRoles) ?? false;
    const canManageChannels = me?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false;

    const coreLines = coreRoles.map((roleName) => `${roleName}: ${findRole(interaction.guild, roleName) ? "Ready" : "Missing"}`).join("\n");
    const gameplayLines = gameplayRoles.map((roleName) => `${roleName}: ${findRole(interaction.guild, roleName) ? "Ready" : "Missing"}`).join("\n");

    const embed = baseEmbed("Setup Check")
      .setDescription("Run `/setup_channels` and `/setup_roles` if most of this is missing.")
      .addFields(
        { name: "Welcome Channel", value: status(Boolean(getSetting("welcomeChannelId")?.value)), inline: true },
        { name: "Contracts Channel", value: status(Boolean(getSetting("contractChannelId")?.value)), inline: true },
        { name: "Status Channel", value: status(Boolean(getSetting("statusChannelId")?.value)), inline: true },
        { name: "Bot Manage Roles", value: status(canManageRoles), inline: true },
        { name: "Bot Manage Channels", value: status(canManageChannels), inline: true },
        { name: "Core Roles", value: coreLines, inline: false },
        { name: "Gameplay Roles", value: gameplayLines, inline: false }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
