import { SlashCommandBuilder } from "discord.js";
import { autocompleteCommodities, getMiningInfo, uexFormat } from "../services/uex.js";
import { errorMessage } from "../utils/errors.js";
import { baseEmbed, numberValue, relativeTime } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const miningCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("mining")
    .setDescription("Find material sell intel.")
    .addStringOption((option) =>
      option.setName("material").setDescription("Material name").setRequired(true).setAutocomplete(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const material = interaction.options.getString("material", true);
      const info = await getMiningInfo(material);
      const sells = info.sellLocations
        .map((row, index) => `${index + 1}. ${uexFormat.location(row) ?? "Unknown"} - ${numberValue(uexFormat.sellPrice(row), " aUEC")}`)
        .join("\n");

      const embed = baseEmbed(`Mining: ${material}`)
        .setDescription("Bring the rocks. We found the buyers.")
        .addFields(
          { name: "Best Price", value: numberValue(info.bestPrice, " aUEC"), inline: true },
          { name: "Last Updated", value: relativeTime(info.updatedAt), inline: true },
          { name: "Sell Locations", value: sells || "No buyers spotted.", inline: false },
          { name: "Note", value: "Prices shift. Scan in-game before hauling the payday.", inline: false }
        );
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: errorMessage(error) });
    }
  },
  async autocomplete(interaction) {
    const names = await autocompleteCommodities(String(interaction.options.getFocused()));
    await interaction.respond(names.map((name) => ({ name, value: name })));
  }
};
