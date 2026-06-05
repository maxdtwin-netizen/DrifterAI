import { SlashCommandBuilder } from "discord.js";
import { autocompleteCommodities, findTradeRoute } from "../services/uex.js";
import { errorMessage } from "../utils/errors.js";
import { baseEmbed, fieldValue, numberValue, relativeTime } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const tradeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Check a possible UEX trade run.")
    .addStringOption((option) => option.setName("from").setDescription("Starting location").setRequired(true))
    .addStringOption((option) => option.setName("to").setDescription("Target/sell location").setRequired(true))
    .addStringOption((option) =>
      option.setName("commodity").setDescription("Commodity").setRequired(true).setAutocomplete(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const from = interaction.options.getString("from", true);
      const to = interaction.options.getString("to", true);
      const commodity = interaction.options.getString("commodity", true);
      const route = await findTradeRoute(commodity, from);
      const embed = baseEmbed(`Trade: ${commodity}`)
        .setDescription("UEX data is a lead. Verify terminals in-game.")
        .addFields(
          { name: "From", value: fieldValue(route.buyLocation ?? from), inline: true },
          { name: "To", value: fieldValue(route.sellLocation ?? to), inline: true },
          { name: "Buy", value: numberValue(route.buyPrice, " aUEC"), inline: true },
          { name: "Sell", value: numberValue(route.sellPrice, " aUEC"), inline: true },
          { name: "Profit", value: numberValue(route.profit, " aUEC/SCU"), inline: true },
          { name: "Updated", value: relativeTime(route.updatedAt), inline: true }
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
