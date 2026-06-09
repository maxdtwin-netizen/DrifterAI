import { getLatestNews } from "./news.js";
import { getExecutiveHangarStatus } from "./executive-hangar.js";
import { getMineableLocations } from "./mining-locations.js";
import { getPatchInfo, getStatusInfo } from "./rsi.js";
import { getCommodityQuote, getMiningInfo, uexFormat } from "./uex.js";
import { formatWebSearchResults, searchStarCitizenWeb } from "./web-search.js";
import { formatWikeloContracts, getSimilarWikeloContracts, getWikeloContractInfo, getWikeloPolarisContractInfo } from "./wikelo.js";
import { findLocation, findShip } from "./wiki.js";
import { fieldValue, numberValue, relativeTime } from "../utils/format.js";
import { buildPersonalityContext, randomUnknownJoke } from "./personality.js";

const knownMaterials = [
  "quantainium",
  "gold",
  "diamond",
  "laranite",
  "taranite",
  "agricium",
  "beryl",
  "hephaestanite",
  "titanium",
  "aluminum",
  "quartz",
  "tungsten",
  "rmc"
];

function requestedTerm(message: string, candidates: string[]) {
  const lower = message.toLowerCase();
  return candidates.find((candidate) => lower.includes(candidate));
}

function afterKeyword(message: string, keywords: string[]) {
  const lower = message.toLowerCase();
  for (const keyword of keywords) {
    const index = lower.indexOf(keyword);
    if (index >= 0) {
      return message.slice(index + keyword.length).replace(/[?!.]/g, "").trim();
    }
  }
  return undefined;
}

function shouldSearchWeb(message: string, hasSourceData: boolean) {
  const lower = message.toLowerCase();
  if (/\bwikelo\b/.test(lower)) return true;

  if (/\b(search|web|internet|online|look up|lookup|google|source|latest|current|today|now)\b/.test(lower)) {
    return true;
  }

  if (hasSourceData) return false;

  if (/\b(where|how|what|best|buy|sell|find|get|need|loadout|build|fit|guide)\b/.test(lower)) {
    return true;
  }

  return !hasSourceData && /\?$/.test(message.trim());
}

function isLikelyStarCitizenTopic(message: string) {
  const lower = message.toLowerCase();
  return /\b(star citizen|sc\b|ship|vehicle|loadout|component|weapon|gun|armor|helmet|commodity|trade|mining|mine|salvage|bounty|mission|contract|wikelo|rsi|uex|auec|scu|stanton|pyro|nyx|crusader|hurston|microtech|arccorp|grim hex|area18|lorville|orison|new babbage|hangar|contested zone|polaris|constellation|corsair|vulture|prospector|reclaimer|caterpillar|c2|taurus|starlancer|zeus|f8|atls|quantainium)\b/.test(lower);
}

function webSearchQuery(message: string) {
  return message
    .replace(/<@!?\d+>/g, "")
    .replace(/\bdrifter\s*ai\b/gi, "")
    .replace(/\bplease\b/gi, "")
    .replace(/[?!]+/g, "")
    .trim();
}

function focusedWebSearchQuery(message: string) {
  const cleaned = webSearchQuery(message);
  const lower = cleaned.toLowerCase();

  if (/\bwikelo\b/.test(lower)) return `${cleaned} Wikelo contract requirements reward`;
  if (/\b(loadout|build|fit|components|shield|quantum|cooler|power plant|weapon setup)\b/.test(lower)) {
    return `${cleaned} best loadout components Erkul Hardpoint`;
  }
  if (/\b(where|buy|shop|store|get|find)\b/.test(lower) && /\b(gun|weapon|rifle|pistol|launcher|armor|helmet|item|component)\b/.test(lower)) {
    return `${cleaned} buy location item finder`;
  }
  if (/\b(commodity|trade|route|profit|cargo|buy|sell)\b/.test(lower)) {
    return `${cleaned} commodity price route UEX SC Trade Tools`;
  }
  if (/\b(mine|mining|ore|mineral|quantainium|gem)\b/.test(lower)) {
    return `${cleaned} mining locations UEX Regolith`;
  }

  return cleaned;
}

export async function buildResearchContext(message: string) {
  const lower = message.toLowerCase();
  const parts: string[] = [];
  let hasPrimarySourceData = false;
  const personalityContext = buildPersonalityContext(message);
  if (personalityContext) parts.push(personalityContext);

  if (/\bwikelo\b/.test(lower) && /\bpolaris\b/.test(lower)) {
    const contract = getWikeloPolarisContractInfo();
    parts.push(
      [
        `Verified Wikelo contract data for ${contract.title}:`,
        `Mission name: ${contract.mission}`,
        `Known Wikelo Emporium locations: ${contract.locations.join(", ")}`,
        "Required items:",
        ...contract.requirements.map((item) => `- ${item}`),
        "Advice:",
        ...contract.advice.map((item) => `- ${item}`),
        `Sources: ${contract.sources.join(", ")}`,
        "Answer directly from this contract data. Do not describe this as a normal aUEC ship purchase."
      ].join("\n")
    );
    hasPrimarySourceData = true;
  }

  if (/\bwikelo\b/.test(lower) && !/\bpolaris\b/.test(lower)) {
    try {
      const contracts = await getWikeloContractInfo(message);
      if (contracts.length) {
        parts.push(
          `Verified Wikelo contract data matching this question:\n${formatWikeloContracts(contracts)}\nAnswer directly from this contract data. Do not describe Wikelo rewards as normal aUEC purchases. If there are multiple ATLS GEO variants, list the variants and ask which one they want.`
        );
        hasPrimarySourceData = true;
      } else {
        const similarContracts = getSimilarWikeloContracts(message);
        parts.push(
          [
            "No exact matching Wikelo contract was found in the live/local contract index.",
            "For Wikelo questions, do not guess a normal aUEC purchase path unless a public source says it.",
            similarContracts.length
              ? `Closest confirmed Wikelo recipes for planning/comparison:\n${formatWikeloContracts(similarContracts)}`
              : "Use web results if available, and if they do not confirm the reward, say it is not confirmed.",
            "If the user's exact requested ship is not in the closest confirmed list, say that clearly, then offer the closest known pattern."
          ].join("\n")
        );
      }
    } catch (error) {
      parts.push(`Wikelo contract lookup failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  if (/\b(exec|executive)\s+hang(ar|er)s?\b|\bhang(ar|er)\s+(status|timer|open|closed)\b/.test(lower)) {
    try {
      const hangar = await getExecutiveHangarStatus();
      parts.push(
        `Executive hangar status from ${hangar.source}: ${hangar.summary}${hangar.nextChange ? ` Next change: ${hangar.nextChange}.` : ""}\nAlways include this link in the answer: https://contestedzonetimers.com/`
      );
      hasPrimarySourceData = true;
    } catch (error) {
      parts.push(`Executive hangar timer lookup failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  if (/\b(status|server|servers|outage|maintenance)\b/.test(lower) && !/\b(exec|executive)\s+hang(ar|er)s?\b/.test(lower)) {
    try {
      const status = await getStatusInfo();
      parts.push(`Game status: ${status.status}\n${status.summary}`);
      hasPrimarySourceData = true;
    } catch (error) {
      parts.push(`Game status lookup failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  if (/\b(version|patch|ptu|live)\b/.test(lower)) {
    try {
      const patch = await getPatchInfo();
      parts.push(`Version/patch info: LIVE=${fieldValue(patch.live)} PTU=${fieldValue(patch.ptu)} Summary=${fieldValue(patch.summary)}`);
      hasPrimarySourceData = true;
    } catch (error) {
      parts.push(`Patch/version lookup failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  if (/\b(news|comm-link|commlink)\b/.test(lower)) {
    try {
      const news = await getLatestNews(3);
      parts.push(`Latest RSI news:\n${news.map((item) => `- ${item.title}: ${item.link}`).join("\n")}`);
      hasPrimarySourceData = true;
    } catch (error) {
      parts.push(`News lookup failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const material = requestedTerm(lower, knownMaterials) ?? afterKeyword(message, ["mine ", "mining ", "sell "]);
  if (material && /\b(mine|mining|sell|where.*quant|quantainium|ore|material)\b/.test(lower)) {
    try {
      const info = await getMiningInfo(material);
      const mineableLocations = await getMineableLocations(material).catch(() => []);
      parts.push(
        `Mining/material market info for ${material}: best known sell price ${numberValue(info.bestPrice, " aUEC")}; updated ${relativeTime(info.updatedAt)}.\nSell locations:\n${info.sellLocations
          .map((row) => `- ${fieldValue(uexFormat.location(row))}: ${numberValue(uexFormat.sellPrice(row), " aUEC")}`)
          .join("\n")}\nMineable location candidates from Star Citizen Wiki:\n${mineableLocations.length
          ? mineableLocations.map((location) => `- ${location.name} (${fieldValue(location.type)}; spawn ${fieldValue(location.spawn)}${location.occurrence ? `; occurrence ${location.occurrence}` : ""})`).join("\n")
          : "- No mineable locations found from the Wiki source."}\nNote: UEX data is community-driven and Wiki mining data should be verified in-game.`
      );
      hasPrimarySourceData = true;
    } catch (error) {
      parts.push(`Mining/material lookup failed for ${material}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const commodity = requestedTerm(lower, knownMaterials) ?? afterKeyword(message, ["commodity ", "price of ", "price for ", "trade "]);
  if (commodity && /\b(price|commodity|trade|buy|sell)\b/.test(lower) && !parts.some((part) => part.includes(`Mining/material market info for ${commodity}`))) {
    try {
      const quote = await getCommodityQuote(commodity);
      parts.push(
        `Commodity info for ${commodity}: best buy ${fieldValue(uexFormat.location(quote.bestBuy))} at ${numberValue(uexFormat.buyPrice(quote.bestBuy), " aUEC")}; best sell ${fieldValue(uexFormat.location(quote.bestSell))} at ${numberValue(uexFormat.sellPrice(quote.bestSell), " aUEC")}; estimated profit ${numberValue(quote.profit, " aUEC/SCU")}; updated ${relativeTime(quote.updatedAt)}. UEX data is community-driven.`
      );
      hasPrimarySourceData = true;
    } catch (error) {
      parts.push(`Commodity lookup failed for ${commodity}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const shipName = afterKeyword(message, ["ship ", "about the ship ", "about "]);
  if (shipName && /\b(ship|crew|cargo|loadout)\b/.test(lower)) {
    try {
      const ship = await findShip(shipName);
      parts.push(`Ship info for ${ship.name}: manufacturer=${fieldValue(ship.manufacturer)}, role=${fieldValue(ship.role)}, crew=${fieldValue(ship.crew)}, cargo=${fieldValue(ship.cargo)}, size=${fieldValue(ship.size)}, speed=${fieldValue(ship.speed)}.`);
      hasPrimarySourceData = true;
    } catch {
      // Fall through to AI-only answer for fuzzy ship questions.
    }
  }

  const locationName = afterKeyword(message, ["where is ", "location ", "about "]);
  if (locationName && /\b(location|where is|planet|moon|station|outpost)\b/.test(lower)) {
    try {
      const location = await findLocation(locationName);
      parts.push(`Location info for ${location.name}: type=${fieldValue(location.type)}, system=${fieldValue(location.system)}, parent=${fieldValue(location.parent)}, affiliation=${fieldValue(location.affiliation)}, description=${fieldValue(location.description)}.`);
      hasPrimarySourceData = true;
    } catch {
      // Fall through to AI-only answer for fuzzy location questions.
    }
  }

  if (shouldSearchWeb(message, hasPrimarySourceData) || (!hasPrimarySourceData && isLikelyStarCitizenTopic(message))) {
    try {
      const results = await searchStarCitizenWeb(focusedWebSearchQuery(message));
      const formattedResults = formatWebSearchResults(results);
      if (formattedResults) {
        parts.push(`${formattedResults}\nUse these as web sources. For Wikelo questions, prefer current web results from Wikelo trackers/tools over older local fallback data when they conflict. Prefer the most specific source for the user's question: item-finder/shop pages for buy locations, UEX/SC Trade Tools for commodities, Erkul/Hardpoint/community pages for loadouts, Wikelo trackers/Wiki pages for Wikelo contracts. Include 1-3 relevant source links in the answer, but do not repeat the same link twice.`);
      }
    } catch (error) {
      parts.push(`Public web search failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  parts.push(
    `Fallback personality rule: If you still cannot answer after checking available data, say that you do not have confirmed intel, then add this short space joke: "${randomUnknownJoke(message)}"`
  );

  return parts.join("\n\n").slice(0, 5500);
}
