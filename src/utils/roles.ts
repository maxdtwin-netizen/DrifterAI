import type { ButtonInteraction, Guild, GuildMember, Role } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export const coreRoles = [
  "Visitor",
  "Recruit",
  "Member",
  "Verified",
  "Officer",
  "Contractor",
  "Pirate"
];

export const gameplayRoles = [
  "Miner",
  "Trader",
  "Salvager",
  "Medic",
  "Pilot",
  "FPS",
  "Cargo",
  "Bounty Hunter",
  "Industrial"
];

const roleEmoji: Record<string, string> = {
  Miner: "⛏️",
  Trader: "💱",
  Salvager: "♻️",
  Medic: "➕",
  Pilot: "✈️",
  FPS: "🎯",
  Cargo: "📦",
  "Bounty Hunter": "🎖️",
  Industrial: "🏭"
};

function selectedGameplayRoles(member: GuildMember) {
  return gameplayRoles.filter((roleName) => {
    const role = findRole(member.guild, roleName);
    return role ? member.roles.cache.has(role.id) : false;
  });
}

function selectedRoleText(member: GuildMember) {
  const selected = selectedGameplayRoles(member);
  return selected.length ? selected.join(", ") : "No gameplay roles selected yet.";
}

export const optionalRoles = [
  ...coreRoles,
  ...gameplayRoles,
  "Event Team"
];

export async function ensureRole(guild: Guild, name: string) {
  const existing = guild.roles.cache.find((role) => role.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  return guild.roles.create({ name, reason: "DrifterAI setup" });
}

export function findRole(guild: Guild, name: string) {
  return guild.roles.cache.find((role) => role.name.toLowerCase() === name.toLowerCase());
}

export async function addRoleByName(member: GuildMember, name: string) {
  const role = findRole(member.guild, name) ?? (await ensureRole(member.guild, name));
  await member.roles.add(role);
  return role;
}

export function roleMenuRows() {
  const buttons = gameplayRoles.map((role) =>
    new ButtonBuilder()
      .setCustomId(`role:${role}`)
      .setLabel(role)
      .setEmoji(roleEmoji[role] ?? "✅")
      .setStyle(ButtonStyle.Secondary)
  );

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(index, index + 5)));
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("role:status")
        .setLabel("My Roles")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Primary)
    )
  );

  return rows;
}

export async function handleRoleButton(interaction: ButtonInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: "Use role buttons inside the server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const roleName = interaction.customId.replace("role:", "");
  if (roleName === "status") {
    await interaction.editReply({ content: `Your selected gameplay roles: ${selectedRoleText(interaction.member)}` });
    return;
  }

  if (!gameplayRoles.includes(roleName)) {
    await interaction.editReply({ content: "Unknown role button." });
    return;
  }

  try {
    const role = findRole(interaction.guild, roleName) ?? (await ensureRole(interaction.guild, roleName));
    const member = interaction.member;
    const hasRole = member.roles.cache.has(role.id);

    if (hasRole) {
      await member.roles.remove(role);
      await interaction.editReply({
        content: `Removed ${role.name}.\nYour selected gameplay roles: ${selectedRoleText(member)}`
      });
      return;
    }

    await member.roles.add(role);
    await interaction.editReply({
      content: `Added ${role.name}.\nYour selected gameplay roles: ${selectedRoleText(member)}`
    });
  } catch (error) {
    console.error("Role button failed:", error);
    await interaction.editReply({
      content: "Could not update that role. Check that DrifterAI has Manage Roles and its role is above the role being assigned."
    });
  }
}

export function roleMention(role?: Role) {
  return role ? `<@&${role.id}>` : "Not configured";
}
