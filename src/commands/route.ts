import { SlashCommandBuilder } from "discord.js";
import { autocompleteCommodities, findTradeRoute } from "../services/uex.js";
import { errorMessage } from "../utils/errors.js";
import { baseEmbed, fieldValue, numberValue, relativeTime } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const routeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("route")
    .setDescription("Find a useful community trade route.")
    .addStringOption((option) =>
      option.setName("commodity").setDescription("Commodity name").setRequired(true).setAutocomplete(true)
    )
    .addStringOption((option) =>
      option.setName("start").setDescription("Optional starting location").setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const commodity = interaction.options.getString("commodity", true);
      const start = interaction.options.getString("start") ?? undefined;
      const route = await findTradeRoute(commodity, start);
      const embed = baseEmbed(`Route: ${commodity}`)
        .setDescription("Buy low, sell high, leave before questions.")
        .addFields(
          { name: "Buy", value: `${fieldValue(route.buyLocation)} at ${numberValue(route.buyPrice, " aUEC")}`, inline: false },
          { name: "Sell", value: `${fieldValue(route.sellLocation)} at ${numberValue(route.sellPrice, " aUEC")}`, inline: false },
          { name: "Estimated Profit", value: numberValue(route.profit, " aUEC/SCU"), inline: true },
          { name: "Last Updated", value: relativeTime(route.updatedAt), inline: true }
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
