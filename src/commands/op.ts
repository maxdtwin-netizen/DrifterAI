import { SlashCommandBuilder } from "discord.js";
import { baseEmbed, fieldValue, trimText } from "../utils/format.js";
import type { BotCommand } from "./types.js";

const opTypes = [
  { name: "Trade Run", value: "Trade Run" },
  { name: "Mining", value: "Mining" },
  { name: "Salvage", value: "Salvage" },
  { name: "Security", value: "Security" },
  { name: "Bounty", value: "Bounty" },
  { name: "Piracy", value: "Piracy" },
  { name: "Training", value: "Training" }
] as const;

export const opCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("op")
    .setDescription("Post an org operation brief.")
    .addStringOption((option) =>
      option.setName("type").setDescription("Operation type").setRequired(true).addChoices(...opTypes)
    )
    .addStringOption((option) =>
      option.setName("rally").setDescription("Rally point").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("time").setDescription("Start time, like 20:00 UTC or now").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("objective").setDescription("Short objective").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("ships").setDescription("Needed ships or roles").setRequired(false)
    ),
  async execute(interaction) {
    const embed = baseEmbed(`Operation: ${interaction.options.getString("type", true)}`)
      .setDescription(trimText(interaction.options.getString("objective", true), 500))
      .addFields(
        { name: "Rally", value: interaction.options.getString("rally", true), inline: true },
        { name: "Time", value: interaction.options.getString("time", true), inline: true },
        { name: "Ships / Roles", value: fieldValue(interaction.options.getString("ships")), inline: false },
        { name: "Posted By", value: interaction.user.toString(), inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  }
};
