import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { db, getSetting, setSetting } from "../db.js";
import { getLatestNews } from "../services/news.js";
import { baseEmbed, fieldValue } from "../utils/format.js";
import type { BotCommand } from "./types.js";

const settingChoices = [
  { name: "News Channel", value: "newsChannelId" },
  { name: "Status Channel", value: "statusChannelId" },
  { name: "Contract Channel", value: "contractChannelId" },
  { name: "Verified Role", value: "verifiedRoleId" }
] as const;

export const adminCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("DrifterAI admin tools.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set_news_channel")
        .setDescription("Set this channel as the news channel.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set_status_channel")
        .setDescription("Set this channel as the status channel.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set_contract_channel")
        .setDescription("Set this channel as the contract channel.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set_verified_role")
        .setDescription("Set a custom Verified role.")
        .addRoleOption((option) => option.setName("role").setDescription("Verified role").setRequired(true))
    )
    .addSubcommand((subcommand) => subcommand.setName("post_news_now").setDescription("Post latest RSI news to this channel now."))
    .addSubcommand((subcommand) => subcommand.setName("config").setDescription("Show current admin config."))
    .addSubcommand((subcommand) => subcommand.setName("sync_commands").setDescription("Show command sync instructions.")),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "Use this inside the server.", ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "set_news_channel") {
      setSetting("newsChannelId", interaction.channelId);
      await interaction.reply({ content: "News channel set.", ephemeral: true });
      return;
    }

    if (subcommand === "set_status_channel") {
      setSetting("statusChannelId", interaction.channelId);
      await interaction.reply({ content: "Status channel set.", ephemeral: true });
      return;
    }

    if (subcommand === "set_contract_channel") {
      setSetting("contractChannelId", interaction.channelId);
      await interaction.reply({ content: "Contract channel set.", ephemeral: true });
      return;
    }

    if (subcommand === "set_verified_role") {
      const role = interaction.options.getRole("role", true);
      setSetting("verifiedRoleId", role.id);
      await interaction.reply({ content: `Verified role set to ${role}.`, ephemeral: true });
      return;
    }

    if (subcommand === "post_news_now") {
      await interaction.deferReply({ ephemeral: true });
      const [latest] = await getLatestNews(1);
      if (!latest) {
        await interaction.editReply({ content: "No RSI news found." });
        return;
      }

      if (!interaction.channel?.isTextBased() || !("send" in interaction.channel)) {
        await interaction.editReply({ content: "This channel cannot receive news posts." });
        return;
      }

      const embed = baseEmbed("New RSI Comm-Link")
        .setTitle(latest.title)
        .setURL(latest.link)
        .setDescription(latest.description ?? latest.link);

      await interaction.channel.send({ embeds: [embed] });
      setSetting("newsChannelId", interaction.channelId);
      setSetting("lastNewsLink", latest.link);
      await interaction.editReply({ content: "Posted latest news here and saved this as the news channel." });
      return;
    }

    if (subcommand === "sync_commands") {
      await interaction.reply({
        content: "Run `npm.cmd run deploy-commands`, then restart the bot with `npm.cmd run dev`.",
        ephemeral: true
      });
      return;
    }

    const rows = settingChoices.map((choice) => {
      const value = getSetting(choice.value)?.value;
      return { name: choice.name, value: fieldValue(value), inline: true };
    });

    const counts = {
      verified: (db.prepare("SELECT COUNT(*) as count FROM verified_members").get() as { count: number }).count,
      contracts: (db.prepare("SELECT COUNT(*) as count FROM contracts WHERE status = 'open'").get() as { count: number }).count,
      missions: (db.prepare("SELECT COUNT(*) as count FROM missions WHERE status = 'active'").get() as { count: number }).count
    };

    const embed = baseEmbed("DrifterAI Config")
      .addFields(
        ...rows,
        { name: "Verified Members", value: String(counts.verified), inline: true },
        { name: "Open Contracts", value: String(counts.contracts), inline: true },
        { name: "Active Missions", value: String(counts.missions), inline: true }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
