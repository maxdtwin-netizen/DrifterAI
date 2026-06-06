import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AttachmentBuilder, type Client } from "discord.js";
import { getSetting, setSetting } from "../db.js";
import { baseEmbed, trimText } from "../utils/format.js";

type PackageInfo = {
  version?: string;
};

async function getTextChannelByName(client: Client, channelName: string) {
  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.find((item) => item.name === channelName);
    if (channel?.isTextBased() && "send" in channel) return channel;
  }
  return undefined;
}

async function getPatchNotesChannel(client: Client) {
  const channelId = getSetting("patchNotesChannelId")?.value;
  if (channelId) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel?.isTextBased() && "send" in channel) return channel;
  }

  return getTextChannelByName(client, "drifterai-patch-notes");
}

function currentBotVersion() {
  const packagePath = join(process.cwd(), "package.json");
  const packageInfo = JSON.parse(readFileSync(packagePath, "utf8")) as PackageInfo;
  return packageInfo.version;
}

function releaseNotesPath(version: string) {
  return join(process.cwd(), "outputs", `DrifterAI-v${version}-patch-notes.md`);
}

function releaseSummary(markdown: string) {
  return markdown
    .replace(/^# .+$/m, "")
    .replace(/^## /gm, "**")
    .replace(/\n/g, "\n")
    .trim();
}

export async function postBotReleaseNotesIfNeeded(client: Client) {
  const version = currentBotVersion();
  if (!version) return;

  const lastPostedVersion = getSetting("lastBotReleaseNotesVersion")?.value;
  if (lastPostedVersion === version) return;

  const notesPath = releaseNotesPath(version);
  if (!existsSync(notesPath)) return;

  const channel = await getPatchNotesChannel(client);
  if (!channel) return;

  const markdown = readFileSync(notesPath, "utf8");
  const embed = baseEmbed(`DrifterAI Update v${version}`)
    .setDescription(trimText(releaseSummary(markdown), 1200))
    .addFields({ name: "Channel", value: "Bot patch notes", inline: true });
  const attachment = new AttachmentBuilder(notesPath, { name: `DrifterAI-v${version}-patch-notes.md` });

  await channel.send({
    embeds: [embed],
    files: [attachment]
  });

  setSetting("patchNotesChannelId", channel.id);
  setSetting("lastBotReleaseNotesVersion", version);
}
