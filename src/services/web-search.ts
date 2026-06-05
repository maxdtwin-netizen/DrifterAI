import { cache, ttl } from "../utils/cache.js";
import { fetchText } from "../utils/http.js";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const allowedHosts = [
  "robertsspaceindustries.com",
  "status.robertsspaceindustries.com",
  "support.robertsspaceindustries.com",
  "starcitizen.tools",
  "api.star-citizen.wiki",
  "uexcorp.space",
  "uexcorp.uk",
  "erkul.games",
  "sc-trade.tools",
  "scfocus.org",
  "cstone.space",
  "regolith.rocks",
  "contestedzonetimers.com",
  "cztimer.com",
  "wikelotrades.com",
  "expcarry.com",
  "finder.cstone.space",
  "starcitizenhelp.ru",
  "reddit.com",
  "wikelotracker.com",
  "undisputednoobs.com",
  "hardpoint.io",
  "spviewer.eu",
  "subliminal.gg",
  "starcitizen.tools",
  "star-citizen.wiki"
];

const sourceFilter = [
  "site:robertsspaceindustries.com",
  "site:starcitizen.tools",
  "site:uexcorp.space",
  "site:erkul.games",
  "site:sc-trade.tools",
  "site:cstone.space",
  "site:regolith.rocks",
  "site:contestedzonetimers.com",
  "site:cztimer.com",
  "site:wikelotrades.com",
  "site:expcarry.com",
  "site:finder.cstone.space",
  "site:starcitizenhelp.ru",
  "site:reddit.com/r/starcitizen",
  "site:wikelotracker.com",
  "site:undisputednoobs.com/wikelo-tracker",
  "site:hardpoint.io",
  "site:spviewer.eu",
  "site:subliminal.gg"
].join(" OR ");

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function isAllowedSource(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return allowedHosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
  } catch {
    return false;
  }
}

function cleanDuckDuckGoUrl(rawUrl: string) {
  const decoded = decodeHtml(rawUrl);
  try {
    const url = new URL(decoded);
    const destination = url.searchParams.get("uddg");
    if (destination) return destination;
    return decoded;
  } catch {
    return decoded;
  }
}

function parseDuckDuckGoResults(html: string) {
  const results: WebSearchResult[] = [];
  const blocks = html.match(/<div class="result[\s\S]*?<\/div>\s*<\/div>/gi) ?? [];

  for (const block of blocks) {
    const linkMatch = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const url = cleanDuckDuckGoUrl(linkMatch[1]);
    if (!isAllowedSource(url)) continue;

    const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i) ?? block.match(/<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);
    const result = {
      title: stripTags(linkMatch[2]).slice(0, 120),
      url,
      snippet: stripTags(snippetMatch?.[1] ?? "").slice(0, 280)
    };

    if (result.title && !results.some((item) => item.url === result.url)) {
      results.push(result);
    }
  }

  return results.slice(0, 5);
}

function uniqueResults(results: WebSearchResult[]) {
  const seen = new Set<string>();
  const unique: WebSearchResult[] = [];

  for (const result of results) {
    if (seen.has(result.url)) continue;
    seen.add(result.url);
    unique.push(result);
  }

  return unique;
}

function intentQueries(query: string) {
  const lower = query.toLowerCase();
  const queries = [query];

  if (/\b(loadout|build|fit|weapons|components|shield|quantum|cooler|power)\b/.test(lower)) {
    queries.push(`${query} Erkul Hardpoint loadout components`);
  }

  if (/\b(buy|where to buy|shop|store|location|weapon|gun|armor|helmet|rifle|pistol|launcher)\b/.test(lower)) {
    queries.push(`${query} buy location finder cstone item finder`);
  }

  if (/\b(commodity|trade|route|profit|sell|buy price|sell price|cargo)\b/.test(lower)) {
    queries.push(`${query} UEX SC Trade Tools price route`);
  }

  if (/\b(wikelo|favor|contract|recipe|reward)\b/.test(lower)) {
    queries.push(`${query} WikeloTrades WikeloTracker requirements reward`);
  }

  if (/\b(mine|mining|ore|quantainium|rock|mineral|gem)\b/.test(lower)) {
    queries.push(`${query} Regolith UEX mining location`);
  }

  return uniqueResults(queries.map((item) => ({ title: item, url: item, snippet: "" })))
    .map((item) => item.title)
    .slice(0, 3);
}

export async function searchStarCitizenWeb(query: string) {
  const trimmed = query.replace(/\s+/g, " ").trim().slice(0, 180);
  if (!trimmed) return [];

  return cache.remember(`web-search:${trimmed.toLowerCase()}`, ttl.hours(1), async () => {
    const allResults: WebSearchResult[] = [];

    for (const searchQuery of intentQueries(trimmed)) {
      const url = new URL("https://duckduckgo.com/html/");
      url.searchParams.set("q", `Star Citizen ${searchQuery} ${sourceFilter}`);

      const html = await fetchText(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml"
        },
        timeoutMs: 12000
      });

      allResults.push(...parseDuckDuckGoResults(html));
      if (uniqueResults(allResults).length >= 7) break;
    }

    return uniqueResults(allResults).slice(0, 7);
  });
}

export function formatWebSearchResults(results: WebSearchResult[]) {
  if (!results.length) return "";

  return [
    "Public web search results:",
    ...results.map((result, index) => `${index + 1}. ${result.title}\n${result.snippet || "No snippet available."}\nSource: ${result.url}`)
  ].join("\n");
}
