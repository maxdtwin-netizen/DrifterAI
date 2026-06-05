import { SlashCommandBuilder } from "discord.js";
import { getPatchInfo } from "../services/rsi.js";
import { errorMessage } from "../utils/errors.js";
import { baseEmbed, fieldValue } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const patchCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("patch")
    .setDescription("Show latest public live/PTU version intel."),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const patch = await getPatchInfo();
      const embed = baseEmbed("Patch Intel")
        .setDescription(fieldValue(patch.summary, "No patch summary available."))
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
