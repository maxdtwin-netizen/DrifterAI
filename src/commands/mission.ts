import { SlashCommandBuilder } from "discord.js";
import { db, nowIso } from "../db.js";
import { baseEmbed, trimText } from "../utils/format.js";
import type { BotCommand } from "./types.js";

const missionTypes = [
  { name: "Mining", value: "Mining" },
  { name: "Salvage", value: "Salvage" },
  { name: "Cargo", value: "Cargo" },
  { name: "Bounty", value: "Bounty" },
  { name: "FPS", value: "FPS" },
  { name: "Piracy", value: "Piracy" },
  { name: "Escort", value: "Escort" },
  { name: "Exploration", value: "Exploration" }
] as const;

type MissionRow = {
  id: number;
  title: string;
  type: string;
  time: string;
  description: string;
  max_players: number;
};

export const missionCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("mission")
    .setDescription("Create and join org missions.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a mission/event.")
        .addStringOption((option) => option.setName("title").setDescription("Mission title").setRequired(true))
        .addStringOption((option) => option.setName("type").setDescription("Mission type").setRequired(true).addChoices(...missionTypes))
        .addStringOption((option) => option.setName("time").setDescription("When").setRequired(true))
        .addStringOption((option) => option.setName("description").setDescription("Mission details").setRequired(true))
        .addIntegerOption((option) => option.setName("max_players").setDescription("Max players").setMinValue(1).setMaxValue(80).setRequired(true))
    )
    .addSubcommand((subcommand) => subcommand.setName("list").setDescription("List active missions."))
    .addSubcommand((subcommand) =>
      subcommand
        .setName("join")
        .setDescription("Join a mission.")
        .addIntegerOption((option) => option.setName("mission_id").setDescription("Mission ID").setRequired(true))
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "create") {
      const result = db.prepare(`
        INSERT INTO missions (title, type, time, description, max_players, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        interaction.options.getString("title", true),
        interaction.options.getString("type", true),
        interaction.options.getString("time", true),
        interaction.options.getString("description", true),
        interaction.options.getInteger("max_players", true),
        interaction.user.id,
        nowIso()
      );
      const mission = db.prepare("SELECT * FROM missions WHERE id = ?").get(result.lastInsertRowid) as MissionRow;
      const embed = baseEmbed(`Mission #${mission.id}: ${mission.title}`)
        .setDescription(trimText(mission.description, 700))
        .addFields(
          { name: "Type", value: mission.type, inline: true },
          { name: "Time", value: mission.time, inline: true },
          { name: "Max Players", value: String(mission.max_players), inline: true }
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === "list") {
      const rows = db.prepare("SELECT * FROM missions WHERE status = 'active' ORDER BY id DESC LIMIT 10").all() as MissionRow[];
      const embed = baseEmbed("Active Missions")
        .setDescription(rows.length ? rows.map((row) => `#${row.id} **${row.title}** - ${row.type} - ${row.time}`).join("\n") : "No active missions.");
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const id = interaction.options.getInteger("mission_id", true);
    const mission = db.prepare("SELECT * FROM missions WHERE id = ? AND status = 'active'").get(id) as MissionRow | undefined;
    if (!mission) {
      await interaction.reply({ content: "Mission not found.", ephemeral: true });
      return;
    }

    const joined = (db.prepare("SELECT COUNT(*) as count FROM mission_members WHERE mission_id = ?").get(id) as { count: number }).count;
    if (joined >= mission.max_players) {
      await interaction.reply({ content: "Mission is full.", ephemeral: true });
      return;
    }

    db.prepare("INSERT OR IGNORE INTO mission_members (mission_id, discord_id, joined_at) VALUES (?, ?, ?)")
      .run(id, interaction.user.id, nowIso());
    await interaction.reply({ content: `Joined mission #${id}.`, ephemeral: true });
  }
};
