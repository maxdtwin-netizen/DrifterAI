import { SlashCommandBuilder } from "discord.js";
import { findShip, autocompleteShips } from "../services/wiki.js";
import { errorMessage } from "../utils/errors.js";
import { baseEmbed, fieldValue, trimText, validUrl } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const shipCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ship")
    .setDescription("Pull ship stats from public intel.")
    .addStringOption((option) =>
      option.setName("name").setDescription("Ship name").setRequired(true).setAutocomplete(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const ship = await findShip(interaction.options.getString("name", true));
      const embed = baseEmbed(`Ship: ${ship.name}`)
        .setDescription(trimText(ship.description, 350))
        .addFields(
          { name: "Manufacturer", value: fieldValue(ship.manufacturer), inline: true },
          { name: "Role", value: fieldValue(ship.role), inline: true },
          { name: "Crew", value: fieldValue(ship.crew), inline: true },
          { name: "Cargo", value: fieldValue(ship.cargo), inline: true },
          { name: "Size", value: fieldValue(ship.size), inline: true },
          { name: "Speed", value: fieldValue(ship.speed), inline: true },
          { name: "Weapons", value: fieldValue(ship.weapons?.slice(0, 8)), inline: false },
          { name: "Components", value: fieldValue(ship.components?.slice(0, 10)), inline: false }
        );

      const image = validUrl(ship.image);
      if (image) embed.setImage(image);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Ship command failed:", error);
      await interaction.editReply({ content: errorMessage(error) });
    }
  },
  async autocomplete(interaction) {
    const query = interaction.options.getFocused();
    const names = await autocompleteShips(String(query));
    await interaction.respond(names.map((name) => ({ name, value: name })));
  }
};
