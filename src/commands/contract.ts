import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { db, getSetting, nowIso } from "../db.js";
import { baseEmbed, fieldValue, trimText } from "../utils/format.js";
import type { BotCommand } from "./types.js";

type ContractRow = {
  id: number;
  title: string;
  description: string;
  reward: string;
  role_needed: string;
  max_players: number;
  time: string;
  status: string;
  created_by: string;
};

function contractEmbed(contract: ContractRow, joined = 0) {
  return baseEmbed(`Contract #${contract.id}: ${contract.title}`)
    .setDescription(trimText(contract.description, 700))
    .addFields(
      { name: "Reward", value: contract.reward, inline: true },
      { name: "Role Needed", value: contract.role_needed, inline: true },
      { name: "Crew", value: `${joined}/${contract.max_players}`, inline: true },
      { name: "Time", value: contract.time, inline: true },
      { name: "Status", value: contract.status, inline: true },
      { name: "Created By", value: `<@${contract.created_by}>`, inline: true }
    );
}

async function postContract(interaction: ChatInputCommandInteraction, contract: ContractRow) {
  const channelId = getSetting("contractChannelId")?.value;
  const target = channelId && interaction.guild
    ? await interaction.guild.channels.fetch(channelId).catch(() => null)
    : interaction.channel;
  if (target?.isTextBased() && "send" in target) {
    await target.send({ embeds: [contractEmbed(contract)] });
  }
}

export const contractCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("contract")
    .setDescription("Create and manage org contracts.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create an org contract.")
        .addStringOption((option) => option.setName("title").setDescription("Contract title").setRequired(true))
        .addStringOption((option) => option.setName("description").setDescription("Contract details").setRequired(true))
        .addStringOption((option) => option.setName("reward").setDescription("Reward").setRequired(true))
        .addStringOption((option) => option.setName("role_needed").setDescription("Needed role").setRequired(true))
        .addIntegerOption((option) => option.setName("max_players").setDescription("Max players").setMinValue(1).setMaxValue(50).setRequired(true))
        .addStringOption((option) => option.setName("time").setDescription("When").setRequired(true))
    )
    .addSubcommand((subcommand) => subcommand.setName("list").setDescription("List open contracts."))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("join")
        .setDescription("Join a contract.")
        .addIntegerOption((option) => option.setName("contract_id").setDescription("Contract ID").setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("close")
        .setDescription("Close a contract.")
        .addIntegerOption((option) => option.setName("contract_id").setDescription("Contract ID").setRequired(true))
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      const result = db.prepare(`
        INSERT INTO contracts (title, description, reward, role_needed, max_players, time, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        interaction.options.getString("title", true),
        interaction.options.getString("description", true),
        interaction.options.getString("reward", true),
        interaction.options.getString("role_needed", true),
        interaction.options.getInteger("max_players", true),
        interaction.options.getString("time", true),
        interaction.user.id,
        nowIso()
      );

      const contract = db.prepare("SELECT * FROM contracts WHERE id = ?").get(result.lastInsertRowid) as ContractRow;
      await postContract(interaction, contract);
      await interaction.reply({ content: `Contract #${contract.id} created.`, ephemeral: true });
      return;
    }

    if (subcommand === "list") {
      const rows = db.prepare("SELECT * FROM contracts WHERE status = 'open' ORDER BY id DESC LIMIT 10").all() as ContractRow[];
      const embed = baseEmbed("Open Contracts")
        .setDescription(rows.length ? rows.map((row) => `#${row.id} **${row.title}** - ${row.reward} - ${row.time}`).join("\n") : "No open contracts.");
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === "join") {
      const id = interaction.options.getInteger("contract_id", true);
      const contract = db.prepare("SELECT * FROM contracts WHERE id = ? AND status = 'open'").get(id) as ContractRow | undefined;
      if (!contract) {
        await interaction.reply({ content: "Contract not found or already closed.", ephemeral: true });
        return;
      }

      const joined = (db.prepare("SELECT COUNT(*) as count FROM contract_members WHERE contract_id = ?").get(id) as { count: number }).count;
      if (joined >= contract.max_players) {
        await interaction.reply({ content: "Contract crew is full.", ephemeral: true });
        return;
      }

      db.prepare("INSERT OR IGNORE INTO contract_members (contract_id, discord_id, joined_at) VALUES (?, ?, ?)")
        .run(id, interaction.user.id, nowIso());
      await interaction.reply({ content: `Joined contract #${id}.`, ephemeral: true });
      return;
    }

    const id = interaction.options.getInteger("contract_id", true);
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "Officer/admin clearance required.", ephemeral: true });
      return;
    }

    db.prepare("UPDATE contracts SET status = 'closed' WHERE id = ?").run(id);
    await interaction.reply({ content: `Contract #${id} closed.`, ephemeral: true });
  }
};
