import { SlashCommandBuilder } from "discord.js";
import { getOrg } from "../services/rsi.js";
import { errorMessage } from "../utils/errors.js";
import { baseEmbed, fieldValue, trimText } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const orgCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("org")
    .setDescription("Lookup public RSI org info.")
    .addStringOption((option) =>
      option.setName("orgname").setDescription("Organization name or SID").setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const org = await getOrg(interaction.options.getString("orgname", true));
      const embed = baseEmbed(`Org: ${org.name ?? org.sid ?? "Unknown"}`)
        .setDescription(trimText(org.description, 550))
        .addFields(
          { name: "SID", value: fieldValue(org.sid), inline: true },
          { name: "Members", value: fieldValue(org.members), inline: true },
          { name: "Archetype", value: fieldValue(org.archetype), inline: true },
          { name: "Commitment", value: fieldValue(org.commitment), inline: true }
        );
      if (org.url) embed.setURL(org.url);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: errorMessage(error) });
    }
  }
};
