import { SlashCommandBuilder } from "discord.js";
import { autocompleteCommodities, getCommodityQuote, uexFormat } from "../services/uex.js";
import { errorMessage } from "../utils/errors.js";
import { baseEmbed, fieldValue, numberValue, relativeTime } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const priceCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("price")
    .setDescription("Find community commodity buy/sell intel.")
    .addStringOption((option) =>
      option.setName("commodity").setDescription("Commodity name").setRequired(true).setAutocomplete(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const commodity = interaction.options.getString("commodity", true);
      const quote = await getCommodityQuote(commodity);
      const embed = baseEmbed(`Price: ${commodity}`)
        .setDescription("UEX data is community-driven. Treat it like a lead, not a guarantee.")
        .addFields(
          {
            name: "Best Buy",
            value: `${fieldValue(uexFormat.location(quote.bestBuy))} at ${numberValue(uexFormat.buyPrice(quote.bestBuy), " aUEC")}`,
            inline: false
          },
          {
            name: "Best Sell",
            value: `${fieldValue(uexFormat.location(quote.bestSell))} at ${numberValue(uexFormat.sellPrice(quote.bestSell), " aUEC")}`,
            inline: false
          },
          { name: "Estimated Profit", value: numberValue(quote.profit, " aUEC/SCU"), inline: true },
          { name: "Last Updated", value: relativeTime(quote.updatedAt), inline: true }
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
