import { SlashCommandBuilder } from "discord.js";
import { getProfile } from "../services/rsi.js";
import { errorMessage } from "../utils/errors.js";
import { baseEmbed, fieldValue, trimText } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const profileCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Lookup public RSI profile info.")
    .addStringOption((option) =>
      option.setName("handle").setDescription("RSI handle").setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const profile = await getProfile(interaction.options.getString("handle", true));
      const embed = baseEmbed(`Profile: ${profile.handle ?? profile.displayName ?? "Unknown"}`)
        .setDescription(trimText(profile.bio, 500))
        .addFields(
          { name: "Display Name", value: fieldValue(profile.displayName), inline: true },
          { name: "Enlisted", value: fieldValue(profile.enlisted), inline: true },
          { name: "Location", value: fieldValue(profile.location), inline: true },
          { name: "Fluency", value: fieldValue(profile.fluency), inline: true },
          { name: "Org", value: fieldValue(profile.org), inline: true }
        );
      if (profile.url) embed.setURL(profile.url);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: errorMessage(error) });
    }
  }
};
