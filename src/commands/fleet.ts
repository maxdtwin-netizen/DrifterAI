import { SlashCommandBuilder } from "discord.js";
import { db, nowIso } from "../db.js";
import { autocompleteShips } from "../services/wiki.js";
import { baseEmbed } from "../utils/format.js";
import type { BotCommand } from "./types.js";

type FleetRow = {
  ship_name: string;
  created_at: string;
};

export const fleetCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("fleet")
    .setDescription("Manage personal fleet records.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a ship to your fleet.")
        .addStringOption((option) =>
          option.setName("ship_name").setDescription("Ship name").setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("Show a member fleet.")
        .addUserOption((option) => option.setName("user").setDescription("Member").setRequired(false))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove a ship from your fleet.")
        .addStringOption((option) =>
          option.setName("ship_name").setDescription("Ship name").setRequired(true).setAutocomplete(true)
        )
    ),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "add") {
      const shipName = interaction.options.getString("ship_name", true).trim();
      db.prepare(`
        INSERT OR IGNORE INTO user_fleet (discord_id, ship_name, created_at)
        VALUES (?, ?, ?)
      `).run(interaction.user.id, shipName, nowIso());

      await interaction.reply({ content: `Added **${shipName}** to your fleet.`, ephemeral: true });
      return;
    }

    if (subcommand === "remove") {
      const shipName = interaction.options.getString("ship_name", true).trim();
      const result = db.prepare("DELETE FROM user_fleet WHERE discord_id = ? AND lower(ship_name) = lower(?)")
        .run(interaction.user.id, shipName);

      await interaction.reply({
        content: result.changes ? `Removed **${shipName}** from your fleet.` : "That ship was not in your fleet.",
        ephemeral: true
      });
      return;
    }

    const user = interaction.options.getUser("user") ?? interaction.user;
    const rows = db.prepare(`
      SELECT ship_name, created_at FROM user_fleet
      WHERE discord_id = ?
      ORDER BY ship_name ASC
    `).all(user.id) as FleetRow[];

    const embed = baseEmbed(`Fleet: ${user.username}`)
      .setDescription(rows.length ? rows.map((row) => `- ${row.ship_name}`).join("\n") : "No ships logged yet.");

    await interaction.reply({ embeds: [embed] });
  },
  async autocomplete(interaction) {
    const names = await autocompleteShips(String(interaction.options.getFocused()));
    await interaction.respond(names.map((name) => ({ name, value: name })));
  }
};
