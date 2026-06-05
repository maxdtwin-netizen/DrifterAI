import type { GuildBasedChannel, GuildMember } from "discord.js";
import { ChannelType } from "discord.js";
import { getSetting } from "../db.js";
import { baseEmbed } from "../utils/format.js";
import { addRoleByName } from "../utils/roles.js";

function canSendWelcome(channel: GuildBasedChannel | null): boolean {
  if (!channel) return false;
  return channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement;
}

export async function welcomeNewMember(member: GuildMember) {
  try {
    await addRoleByName(member, "Visitor");
  } catch (error) {
    console.error(`Could not assign visitor role to ${member.user.tag}:`, error);
  }

  const welcomeChannelId = getSetting("welcomeChannelId")?.value;
  if (!welcomeChannelId) return;

  const channel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
  if (!canSendWelcome(channel)) return;

  const embed = baseEmbed("New Contract Signed")
    .setDescription(`${member} joined the outfit. Check comms, read the rules, and keep your sidearm handy.`)
    .addFields(
      { name: "First Orders", value: "Run `/verify rsi_handle`, pick roles in role-select, then check `/help`.", inline: false },
      { name: "Status", value: "Visitor role assigned if the bot can manage roles.", inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL());

  if (channel?.isTextBased() && "send" in channel) {
    await channel.send({ embeds: [embed] });
  }
}
