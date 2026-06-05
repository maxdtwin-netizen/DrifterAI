import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { setSetting } from "../db.js";
import { baseEmbed } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const setupAiChatCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("setup_ai_chat")
    .setDescription("Create or save the DrifterAI chatroom.")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Existing channel to use instead of creating ai-chat.")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "Use this inside the server.", ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: "You need Manage Channels to set up the AI chatroom.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const selected = interaction.options.getChannel("channel");
    let channel = selected;

    if (!channel) {
      channel =
        interaction.guild.channels.cache.find((item) => item.name === "ai-chat" && item.type === ChannelType.GuildText) ??
        (await interaction.guild.channels.create({
          name: "ai-chat",
          type: ChannelType.GuildText,
          reason: "DrifterAI chatroom setup"
        }));
    }

    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply({ content: "That is not a text channel." });
      return;
    }

    setSetting("aiChatChannelId", channel.id);

    const embed = baseEmbed("DrifterAI Chatroom")
      .setDescription("Talk with DrifterAI here. It answers as the Drifters org AI and keeps conversation focused on Star Citizen and org operations.")
      .addFields(
        { name: "Good Topics", value: "Ships, missions, contracts, mining, salvage, trade, loadouts, events, new-player help, patch discussion.", inline: false },
        { name: "Boundary", value: "Off-topic questions will be redirected back to Star Citizen or Drifters server topics.", inline: false }
      );

    await channel.send({ embeds: [embed] });
    await interaction.editReply({ content: `AI chatroom set to ${channel}.` });
  }
};
