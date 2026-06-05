import { SlashCommandBuilder } from "discord.js";
import { getLatestNews, newsSourceUrl } from "../services/news.js";
import { errorMessage } from "../utils/errors.js";
import { baseEmbed, relativeTime, trimText } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const newsCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("news")
    .setDescription("Show latest RSI Comm-Link posts."),
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const items = await getLatestNews(5);
      const embed = baseEmbed("RSI Comm-Link News")
        .setDescription(items.length ? "Latest official Comm-Link posts." : "No news found.")
        .setURL(newsSourceUrl);

      for (const item of items) {
        embed.addFields({
          name: item.title,
          value: `${item.publishedAt ? `${relativeTime(item.publishedAt)}\n` : ""}${trimText(item.description, 180)}\n${item.link}`,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: errorMessage(error) });
    }
  }
};
