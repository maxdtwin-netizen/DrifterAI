import type { Client } from "discord.js";
import { getSetting } from "../db.js";
import { getStatusInfo } from "./rsi.js";
import { loadAppConfig } from "../utils/app-config.js";
import { baseEmbed, trimText } from "../utils/format.js";
import { getLatestNews, getLatestPatchNotes } from "./news.js";
import { setSetting } from "../db.js";
import { generateDailyTip, generateWebIntelPost } from "./ai.js";
import { postBotReleaseNotesIfNeeded } from "./bot-release-notes.js";
import { searchStarCitizenWeb, type WebSearchResult } from "./web-search.js";

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

const webIntelChannels: Record<string, { purpose: string; query: string }> = {
  "sc-news": {
    purpose: "latest Star Citizen news",
    query: "latest Star Citizen news RSI comm-link today"
  },
  "ship-talk": {
    purpose: "ship news, ship release, future ship release, ship sale, vehicle updates",
    query: "Star Citizen ship release future ship release vehicle news"
  },
  loadouts: {
    purpose: "new strong ship loadout or useful ship loadout video",
    query: "Star Citizen best ship loadout new meta YouTube Erkul Hardpoint"
  },
  "trade-routes": {
    purpose: "profitable trade routes and cargo hauling opportunities",
    query: "Star Citizen most profitable trade routes UEX SC Trade Tools"
  },
  mining: {
    purpose: "mining tips, mining modules, mining heads, mining gadgets, mining accessories",
    query: "Star Citizen mining tips mining modules gadgets accessories"
  },
  "intel-drops": {
    purpose: "profitable missions, secrets, hidden opportunities, useful discoveries",
    query: "Star Citizen most profitable missions secrets hidden locations money making"
  }
};

async function getTextChannel(client: Client, settingKey: string) {
  const channelId = getSetting(settingKey)?.value;
  if (!channelId) return undefined;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased() && "send" in channel ? channel : undefined;
}

async function getTextChannelWithNameFallback(client: Client, settingKey: string, channelName: string) {
  return (await getTextChannel(client, settingKey)) ?? (await getTextChannelByName(client, channelName));
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

function settingKeyForUrl(prefix: string, url: string) {
  return `${prefix}:${Buffer.from(url).toString("base64url").slice(0, 120)}`;
}

function platformStatusLabel(status: string) {
  if (/operational/i.test(status)) return "OPERATIONAL";
  if (/maintenance/i.test(status)) return "MAINTENANCE";
  if (/degraded|interruption/i.test(status)) return "DEGRADED";
  if (/outage/i.test(status)) return "OUTAGE";
  return status.toUpperCase().slice(0, 80);
}

function platformStatusColor(status: string) {
  if (/operational/i.test(status)) return 0x2ecc71;
  if (/maintenance/i.test(status)) return 0xf1c40f;
  if (/degraded|interruption/i.test(status)) return 0xe67e22;
  if (/outage/i.test(status)) return 0xe74c3c;
  return 0x95a5a6;
}

function parseVisibleDate(value: string) {
  const explicit = Date.parse(value);
  if (!Number.isNaN(explicit)) return explicit;

  const monthDate = value.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},\s+20\d{2}\b/i);
  if (monthDate) {
    const parsed = Date.parse(monthDate[0]);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const isoDate = value.match(/\b20\d{2}-\d{2}-\d{2}\b/);
  if (isoDate) {
    const parsed = Date.parse(isoDate[0]);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return undefined;
}

function isRecentEnough(result: WebSearchResult, recentDays: number) {
  const cutoff = Date.now() - recentDays * 24 * 60 * 60 * 1000;
  const visibleText = `${result.publishedAt ?? ""} ${result.title} ${result.snippet}`;
  const parsedDate = parseVisibleDate(visibleText);
  return parsedDate === undefined || parsedDate >= cutoff;
}

export function startScheduledPosts(client: Client) {
  const appConfig = loadAppConfig();

  setTimeout(() => {
    postBotReleaseNotesIfNeeded(client).catch((error) => {
      console.error("Bot release notes post failed:", error);
    });
  }, 20 * 1000);

  if (appConfig.autoStatus) {
    const postStatus = async () => {
      const channel = await getTextChannelWithNameFallback(client, "statusChannelId", "game-status");
      if (!channel) return;

      try {
        const status = await getStatusInfo();
          const statusSignature = status.status;
          const lastStatusSignature = getSetting("lastStatusSignature")?.value;
          if (lastStatusSignature === statusSignature) return;
          const platformLabel = platformStatusLabel(status.status);

          await channel.send({
          embeds: [
            baseEmbed(`Platform ${platformLabel}`)
              .setColor(platformStatusColor(status.status))
              .setURL("https://status.robertsspaceindustries.com/")
              .setDescription(`Star Citizen platform is **${platformLabel}**.`)
              .addFields({ name: "Official Status", value: status.status })
          ]
        });
        setSetting("lastStatusSignature", statusSignature);
      } catch (error) {
        console.error("Auto status post failed:", error);
      }
    };

    setTimeout(postStatus, 45 * 1000);
    setInterval(postStatus, 60 * 60 * 1000);
  }

  if (appConfig.autoPatchNotes) {
    const postPatchNotes = async () => {
      const channel = await getTextChannelByName(client, "patch-notes");
      if (!channel) return;

      try {
        const [latest] = await getLatestPatchNotes(1);
        if (!latest) return;

        const lastPosted = getSetting("lastScPatchNotesLink")?.value;
        if (lastPosted === latest.link) return;

        const embed = baseEmbed("Star Citizen Patch Notes")
          .setTitle(latest.title)
          .setURL(latest.link)
          .setDescription(trimText(latest.description ?? "New Star Citizen patch notes found.", 700));

        await channel.send({ embeds: [embed] });
        setSetting("lastScPatchNotesLink", latest.link);
      } catch (error) {
        console.error("Auto SC patch notes post failed:", error);
      }
    };

    setTimeout(postPatchNotes, 75 * 1000);
    setInterval(postPatchNotes, 24 * 60 * 60 * 1000);
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

  if (appConfig.autoTradeTips) {
    // TODO: Add UEX daily trade tip once a stable endpoint/key is configured.
    console.log("Auto trade tips enabled, but no trade-tip endpoint is configured yet.");
  }

  if (appConfig.autoWebIntel) {
    const postWebIntel = async () => {
      const day = new Date().toISOString().slice(0, 10);
      const dailySettingKey = `webIntelPosted:${day}`;
      if (getSetting(dailySettingKey)?.value) return;

      for (const [channelName, intel] of shuffled(Object.entries(webIntelChannels))) {
        const channel = await getTextChannelByName(client, channelName);
        if (!channel) continue;

        try {
          const results = await searchStarCitizenWeb(intel.query, { recentDays: 60 });
          const unusedResults = results
            .filter((result) => isRecentEnough(result, 60))
            .filter((result) => !getSetting(settingKeyForUrl("webIntelLink", result.url))?.value);
          const sources = unusedResults.slice(0, 3);
          if (!sources.length) continue;

          const post = await generateWebIntelPost(channelName, intel.purpose, sources);
          await channel.send({
            embeds: [baseEmbed(`Daily Intel: #${channelName}`).setDescription(post)]
          });

          for (const source of sources) {
            setSetting(settingKeyForUrl("webIntelLink", source.url), new Date().toISOString());
          }
          setSetting(dailySettingKey, `${channel.id}:${sources[0].url}`);
          return;
        } catch (error) {
          console.error(`Daily web intel failed for #${channelName}:`, error);
        }
      }
    };

    setTimeout(postWebIntel, 2 * 60 * 1000);
    setInterval(postWebIntel, 60 * 60 * 1000);
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
