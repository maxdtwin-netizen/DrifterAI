import { SlashCommandBuilder } from "discord.js";
import { getPatchInfo } from "../services/rsi.js";
import { errorMessage } from "../utils/errors.js";
import { baseEmbed, fieldValue } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const versionCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("version")
    .setDescription("Show current Star Citizen version intel."),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const patch = await getPatchInfo();
      const embed = baseEmbed("Star Citizen Version")
        .setDescription(fieldValue(patch.summary, "No version summary available."))
        .addFields(
          { name: "LIVE", value: fieldValue(patch.live), inline: true },
          { name: "PTU", value: fieldValue(patch.ptu), inline: true }
        );
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: errorMessage(error) });
    }
  }
};
