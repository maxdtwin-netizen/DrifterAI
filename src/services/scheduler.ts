import type { Client } from "discord.js";
import { getSetting } from "../db.js";
import { getStatusInfo } from "./rsi.js";
import { loadAppConfig } from "../utils/app-config.js";
import { baseEmbed, trimText } from "../utils/format.js";
import { getLatestNews, getLatestPatchNotes } from "./news.js";
import { setSetting } from "../db.js";
import { generateDailyTip } from "./ai.js";

const aiTipChannels: Record<string, string> = {
  "ship-talk": "Ship discussion, fleet planning, what to buy, what to bring to operations, and ship questions.",
  loadouts: "Ship builds, FPS kits, mining heads, salvage setups, weapons, components, and practical loadout advice.",
  questions: "Beginner and general Star Citizen questions where members can ask for help.",
  contracts: "Org contracts, paid work, escort jobs, scouting, hauling, and support tasks.",
  missions: "Planned group missions, mining nights, salvage ops, cargo runs, bounty work, FPS, escort, and exploration.",
  "event-planning": "Planning future org events, dates, rally points, roles, ships, and backup plans.",
  "trade-routes": "Trade routes, commodity choices, hauling risk, route planning, and profit checks.",
  mining: "Mining advice, material planning, refinery choices, crew mining, and sell-location discussion.",
  salvage: "Salvage work, wreck finding, Vulture/Reclaimer crew planning, RMC/CM logistics, and payout splits.",
  "cargo-prices": "Commodity price discussion and reminders to verify terminal prices in-game."
};

async function getTextChannel(client: Client, settingKey: string) {
  const channelId = getSetting(settingKey)?.value;
  if (!channelId) return undefined;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased() && "send" in channel ? channel : undefined;
}

async function getTextChannelByName(client: Client, channelName: string) {
  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.find((item) => item.name === channelName);
    if (channel?.isTextBased() && "send" in channel) return channel;
  }
  return undefined;
}

function shuffled<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function startScheduledPosts(client: Client) {
  const appConfig = loadAppConfig();

  if (appConfig.autoStatus) {
    const postStatus = async () => {
      const channel = await getTextChannel(client, "statusChannelId");
      if (!channel) return;

      try {
        const status = await getStatusInfo();
        const statusSignature = JSON.stringify({
          status: status.status,
          summary: status.summary
        });
        const lastStatusSignature = getSetting("lastStatusSignature")?.value;
        if (lastStatusSignature === statusSignature) return;

        await channel.send({
          embeds: [baseEmbed("Star Citizen Status").setURL("https://status.robertsspaceindustries.com/").setDescription(status.summary).addFields({ name: "Status", value: status.status })]
        });
        setSetting("lastStatusSignature", statusSignature);
      } catch (error) {
        console.error("Auto status post failed:", error);
      }
    };

    setTimeout(postStatus, 45 * 1000);
    setInterval(postStatus, 60 * 60 * 1000);
  }

  if (appConfig.autoNews) {
    const postNews = async () => {
      const channel = await getTextChannel(client, "newsChannelId");
      if (!channel) return;

      try {
        const [latest] = await getLatestNews(1);
        if (!latest) return;

        const lastPosted = getSetting("lastNewsLink")?.value;
        if (lastPosted === latest.link) return;

        const embed = baseEmbed("New RSI Comm-Link")
          .setTitle(latest.title)
          .setURL(latest.link)
          .setDescription(trimText(latest.description, 500));

        await channel.send({ embeds: [embed] });
        setSetting("lastNewsLink", latest.link);
      } catch (error) {
        console.error("Auto news post failed:", error);
      }
    };

    setTimeout(postNews, 30 * 1000);
    setInterval(postNews, 60 * 60 * 1000);
  }

  const postPatchNotes = async () => {
    const channel = await getTextChannel(client, "patchNotesChannelId");
    if (!channel) return;

    try {
      const [latest] = await getLatestPatchNotes(1);
      if (!latest) return;

      const lastPosted = getSetting("lastPatchNotesLink")?.value;
      if (lastPosted === latest.link) return;

      const embed = baseEmbed("Latest Patch Notes")
        .setTitle(latest.title)
        .setURL(latest.link)
        .setDescription(trimText(latest.description, 600));

      await channel.send({ embeds: [embed] });
      setSetting("lastPatchNotesLink", latest.link);
    } catch (error) {
      console.error("Auto patch notes post failed:", error);
    }
  };

  if (appConfig.autoNews) {
    setTimeout(postPatchNotes, 60 * 1000);
    setInterval(postPatchNotes, 24 * 60 * 60 * 1000);
  }

  if (appConfig.autoTradeTips) {
    // TODO: Add UEX daily trade tip once a stable endpoint/key is configured.
    console.log("Auto trade tips enabled, but no trade-tip endpoint is configured yet.");
  }

  if (appConfig.autoAiTips) {
    const postAiTips = async () => {
      const day = new Date().toISOString().slice(0, 10);
      const dailySettingKey = `aiTipPosted:${day}`;
      if (getSetting(dailySettingKey)?.value) return;

      for (const [channelName, purpose] of shuffled(Object.entries(aiTipChannels))) {
        const channel = await getTextChannelByName(client, channelName);
        if (!channel) continue;

        try {
          const tip = await generateDailyTip(channelName, purpose);
          await channel.send({
            embeds: [baseEmbed(`Daily Drifters Tip: #${channelName}`).setDescription(tip)]
          });
          setSetting(dailySettingKey, channel.id);
          return;
        } catch (error) {
          console.error(`AI tip failed for #${channelName}:`, error);
        }
      }
    };

    setTimeout(postAiTips, 90 * 1000);
    setInterval(postAiTips, 60 * 60 * 1000);
  }
}

export { aiTipChannels };
