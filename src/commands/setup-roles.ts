import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { baseEmbed } from "../utils/format.js";
import { gameplayRoles, optionalRoles, roleMenuRows, ensureRole } from "../utils/roles.js";
import type { BotCommand } from "./types.js";

export const setupRolesCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup_roles")
    .setDescription("Create role-select menu with gameplay buttons."),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "Use this inside the server.", ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "You need Manage Server to run role setup.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    for (const role of optionalRoles) {
      await ensureRole(interaction.guild, role);
    }

    const embed = baseEmbed("Drifters Role Select")
      .setDescription("Pick the gameplay roles you want by pressing the buttons below. Press the same button again to remove that role.")
      .addFields(
        {
          name: "Roles",
          value: gameplayRoles.join(", "),
          inline: false
        },
        {
          name: "Use This For",
          value: "These roles help people ping the right crew for mining, cargo, salvage, combat, medical support, and events.",
          inline: false
        }
      );

    const roleSelect = interaction.guild.channels.cache.find((channel) => channel.name === "role-select" && channel.isTextBased() && "send" in channel);
    const target = roleSelect && "send" in roleSelect ? roleSelect : interaction.channel;
    await target?.send({ embeds: [embed], components: roleMenuRows() });
    await interaction.editReply({ content: "Role menu posted. Members can click buttons to toggle gameplay roles." });
  }
};
