import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { setSetting } from "../db.js";
import { getLatestNews } from "../services/news.js";
import { baseEmbed, trimText } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const postNewsNowCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("post_news_now")
    .setDescription("Post latest RSI news in this channel now.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.channel?.isTextBased() || !("send" in interaction.channel)) {
      await interaction.editReply({ content: "This channel cannot receive news posts." });
      return;
    }

    try {
      const [latest] = await getLatestNews(1);
      if (!latest) {
        await interaction.editReply({ content: "No RSI news found." });
        return;
      }

      const embed = baseEmbed("New RSI Comm-Link")
        .setTitle(latest.title)
        .setURL(latest.link)
        .setDescription(trimText(latest.description, 600));

      await interaction.channel.send({ embeds: [embed] });
      setSetting("newsChannelId", interaction.channelId);
      setSetting("lastNewsLink", latest.link);
      await interaction.editReply({ content: "Posted latest news here and saved this as the news channel." });
    } catch (error) {
      console.error("Post news now failed:", error);
      await interaction.editReply({ content: "Could not fetch/post news. Check the bot terminal for the exact error." });
    }
  }
};
