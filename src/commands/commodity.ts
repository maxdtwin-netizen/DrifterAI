import { SlashCommandBuilder } from "discord.js";
import { autocompleteCommodities, getCommodityQuote, uexFormat } from "../services/uex.js";
import { errorMessage } from "../utils/errors.js";
import { baseEmbed, fieldValue, numberValue, relativeTime } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const commodityCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("commodity")
    .setDescription("Show UEX commodity price/location data.")
    .addStringOption((option) =>
      option.setName("commodity_name").setDescription("Commodity").setRequired(true).setAutocomplete(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const commodity = interaction.options.getString("commodity_name", true);
      const quote = await getCommodityQuote(commodity);
      const embed = baseEmbed(`Commodity: ${commodity}`)
        .setDescription("UEX data is community-driven.")
        .addFields(
          { name: "Best Buy", value: `${fieldValue(uexFormat.location(quote.bestBuy))} - ${numberValue(uexFormat.buyPrice(quote.bestBuy), " aUEC")}`, inline: false },
          { name: "Best Sell", value: `${fieldValue(uexFormat.location(quote.bestSell))} - ${numberValue(uexFormat.sellPrice(quote.bestSell), " aUEC")}`, inline: false },
          { name: "Profit", value: numberValue(quote.profit, " aUEC/SCU"), inline: true },
          { name: "Updated", value: relativeTime(quote.updatedAt), inline: true }
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
