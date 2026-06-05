import { SlashCommandBuilder } from "discord.js";
import { autocompleteLocations, findLocation } from "../services/wiki.js";
import { errorMessage } from "../utils/errors.js";
import { baseEmbed, fieldValue, trimText, validUrl } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const locationCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("location")
    .setDescription("Lookup a public location record.")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("Planet, moon, station, or outpost")
        .setRequired(true)
        .setAutocomplete(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const location = await findLocation(interaction.options.getString("name", true));
      const embed = baseEmbed(`Location: ${location.name}`)
        .setDescription(trimText(location.description, 500))
        .addFields(
          { name: "Type", value: fieldValue(location.type), inline: true },
          { name: "System", value: fieldValue(location.system), inline: true },
          { name: "Parent", value: fieldValue(location.parent), inline: true },
          { name: "Affiliation", value: fieldValue(location.affiliation), inline: true }
        );
      const image = validUrl(location.image);
      if (image) embed.setImage(image);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Location command failed:", error);
      await interaction.editReply({ content: errorMessage(error) });
    }
  },
  async autocomplete(interaction) {
    const names = await autocompleteLocations(String(interaction.options.getFocused()));
    await interaction.respond(names.map((name) => ({ name, value: name })));
  }
};
