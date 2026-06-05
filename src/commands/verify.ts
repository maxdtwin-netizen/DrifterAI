import { SlashCommandBuilder } from "discord.js";
import { db, getSetting, nowIso } from "../db.js";
import { getProfile } from "../services/rsi.js";
import { ApiError } from "../utils/errors.js";
import { baseEmbed } from "../utils/format.js";
import { addRoleByName } from "../utils/roles.js";
import type { BotCommand } from "./types.js";

export const verifyCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Verify your RSI handle and get the Verified role.")
    .addStringOption((option) =>
      option.setName("rsi_handle").setDescription("Your public RSI handle").setRequired(true)
    ),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "Use this inside the server, not in dark space.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const handle = interaction.options.getString("rsi_handle", true).trim();
      let profileChecked = false;
      let apiNote = "RSI profile API key not configured; saved handle without external check.";

      try {
        await getProfile(handle);
        profileChecked = true;
        apiNote = "RSI handle checked through public StarCitizen-API data.";
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
      }

      db.prepare(`
        INSERT INTO verified_members (discord_id, rsi_handle, verified_at)
        VALUES (?, ?, ?)
        ON CONFLICT(discord_id) DO UPDATE SET
          rsi_handle = excluded.rsi_handle,
          verified_at = excluded.verified_at
      `).run(interaction.user.id, handle, nowIso());

      const customVerifiedRole = getSetting("verifiedRoleId")?.value;
      if (customVerifiedRole) {
        await interaction.member.roles.add(customVerifiedRole);
      } else {
        await addRoleByName(interaction.member, "Verified");
      }

      const embed = baseEmbed("Papers Checked")
        .setDescription("You are on the Drifters roster. Keep comms clean and cargo dirty.")
        .addFields({
          name: "RSI Handle",
          value: handle,
          inline: true
        }, {
          name: "API Check",
          value: profileChecked ? "Passed" : apiNote,
          inline: false
        });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Verify command failed:", error);
      await interaction.editReply({
        content: "Could not verify. Check the bot role position and API key setup."
      });
    }
  }
};
