import { SlashCommandBuilder } from "discord.js";
import { baseEmbed } from "../utils/format.js";
import type { BotCommand } from "./types.js";

export const helpCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show DrifterAI commands."),
  async execute(interaction) {
    const embed = baseEmbed("DrifterAI Command Board")
      .setDescription("Practical tools for the Drifters. Short answers, useful data, no fake intel.")
      .addFields(
        {
          name: "Setup",
          value: "`/setup_channels`, `/setup_roles`, `/setup_ai_chat`, `/setup-check`, `/admin config`, `/ai_tip_now`",
          inline: false
        },
        {
          name: "Members",
          value: "`/verify rsi_handle`, role buttons in role-select",
          inline: false
        },
        {
          name: "Contracts",
          value: "`/contract create`, `/contract list`, `/contract join`, `/contract close`",
          inline: false
        },
        {
          name: "Missions",
          value: "`/mission create`, `/mission list`, `/mission join`",
          inline: false
        },
        {
          name: "Fleet",
          value: "`/fleet add`, `/fleet list`, `/fleet remove`",
          inline: false
        },
        {
          name: "Star Citizen Intel",
          value: "`/news`, `/status`, `/version`, `/profile`, `/org`, `/ship`, `/commodity`, `/trade`, `/location`, `/mining`",
          inline: false
        }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
