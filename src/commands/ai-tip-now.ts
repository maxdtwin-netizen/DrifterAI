import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { generateDailyTip } from "../services/ai.js";
import { aiTipChannels } from "../services/scheduler.js";
import { errorMessage } from "../utils/errors.js";
import { baseEmbed } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const aiTipNowCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("ai_tip_now")
    .setDescription("Post an AI-generated useful tip in this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!interaction.channel?.isTextBased() || !("send" in interaction.channel)) {
      await interaction.editReply({ content: "This channel cannot receive AI tips." });
      return;
    }

    const channelName = "name" in interaction.channel ? String(interaction.channel.name) : "this-channel";
    const purpose = aiTipChannels[channelName] ?? "General useful Star Citizen organization discussion.";

    try {
      const tip = await generateDailyTip(channelName, purpose);
      await interaction.channel.send({
        embeds: [baseEmbed(`Daily Drifters Tip: #${channelName}`).setDescription(tip)]
      });
      await interaction.editReply({ content: "AI tip posted." });
    } catch (error) {
      await interaction.editReply({ content: errorMessage(error) });
    }
  }
};
