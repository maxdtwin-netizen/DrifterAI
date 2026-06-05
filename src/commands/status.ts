import { SlashCommandBuilder } from "discord.js";
import { getStatusInfo } from "../services/rsi.js";
import { errorMessage } from "../utils/errors.js";
import { baseEmbed } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const statusCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show Star Citizen status if configured."),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const status = await getStatusInfo();
      const embed = baseEmbed("Star Citizen Status")
        .setDescription(status.summary)
        .addFields({ name: "Status", value: status.status, inline: true });
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: errorMessage(error) });
    }
  }
};
