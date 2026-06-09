import { cache, ttl } from "../utils/cache.js";
import { fetchJson, fetchText } from "../utils/http.js";
import { config } from "../config.js";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  source?: "brave" | "tavily" | "duckduckgo";
  publishedAt?: string;
};

type SearchOptions = {
  recentDays?: number;
};

type BraveSearchResponse = {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      page_age?: string;
    }>;
  };
};

type TavilySearchResponse = {
  answer?: string;
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    published_date?: string;
  }>;
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
      snippet: stripTags(snippetMatch?.[1] ?? "").slice(0, 280),
      source: "duckduckgo" as const
    };

    if (result.title && !results.some((item) => item.url === result.url)) {
      results.push(result);
    }
  }

  return results.slice(0, 5);
}

function recentQuery(query: string, options: SearchOptions = {}) {
  if (!options.recentDays) return query;
  const cutoff = new Date(Date.now() - options.recentDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return `${query} after:${cutoff} last ${options.recentDays} days`;
}

async function searchBrave(query: string, options: SearchOptions = {}) {
  if (!config.braveSearchApiKey) return [];

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", `Star Citizen ${recentQuery(query, options)}`);
  url.searchParams.set("count", "7");
  url.searchParams.set("country", "us");
  url.searchParams.set("search_lang", "en");
  if (options.recentDays) url.searchParams.set("freshness", "pm");

  const data = await fetchJson<BraveSearchResponse>(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": config.braveSearchApiKey
    },
    timeoutMs: 12000
  });

  return (data.web?.results ?? [])
    .map((result) => ({
      title: stripTags(result.title ?? "Web result").slice(0, 120),
      url: result.url ?? "",
      snippet: stripTags(result.description ?? "").slice(0, 360),
      source: "brave" as const,
      publishedAt: result.page_age
    }))
    .filter((result) => result.url);
}

async function searchTavily(query: string, options: SearchOptions = {}) {
  if (!config.tavilyApiKey) return [];

  const data = await fetchJson<TavilySearchResponse>("https://api.tavily.com/search", {
    headers: {
      Authorization: `Bearer ${config.tavilyApiKey}`,
      "Content-Type": "application/json"
    },
    timeoutMs: 12000,
    method: "POST",
    body: JSON.stringify({
      api_key: config.tavilyApiKey,
      query: `Star Citizen ${recentQuery(query, options)}`,
      search_depth: "basic",
      max_results: 7,
      topic: "general",
      days: options.recentDays,
      include_answer: true,
      include_raw_content: false
    })
  });

  const results = (data.results ?? []).map((result) => ({
    title: result.title ?? "Web result",
    url: result.url ?? "",
    snippet: (result.content ?? "").slice(0, 360),
    source: "tavily" as const,
    publishedAt: result.published_date
  })).filter((result) => result.url);

  if (data.answer && results[0]) {
    results[0].snippet = `${data.answer}\n${results[0].snippet}`.slice(0, 520);
  }

  return results;
}

async function searchDuckDuckGo(query: string, options: SearchOptions = {}) {
  const allResults: WebSearchResult[] = [];

  for (const searchQuery of intentQueries(query)) {
    const url = new URL("https://duckduckgo.com/html/");
    url.searchParams.set("q", `Star Citizen ${recentQuery(searchQuery, options)} ${sourceFilter}`);

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

export async function searchStarCitizenWeb(query: string, options: SearchOptions = {}) {
  const trimmed = query.replace(/\s+/g, " ").trim().slice(0, 180);
  if (!trimmed) return [];

  const cacheKey = `web-search:${trimmed.toLowerCase()}:${options.recentDays ?? "any"}`;

  return cache.remember(cacheKey, ttl.hours(1), async () => {
    const provider = config.webSearchProvider.toLowerCase();

    if ((provider === "brave" || provider === "auto") && config.braveSearchApiKey) {
      const results = await searchBrave(trimmed, options);
      if (results.length) return uniqueResults(results).slice(0, 7);
    }

    if ((provider === "tavily" || provider === "auto") && config.tavilyApiKey) {
      const results = await searchTavily(trimmed, options);
      if (results.length) return uniqueResults(results).slice(0, 7);
    }

    return searchDuckDuckGo(trimmed, options);
  });
}

export function formatWebSearchResults(results: WebSearchResult[]) {
  if (!results.length) return "";

  return [
    "Public web search results:",
    ...results.map((result, index) => `${index + 1}. ${result.title}${result.source ? ` (${result.source})` : ""}${result.publishedAt ? `\nPublished: ${result.publishedAt}` : ""}\n${result.snippet || "No snippet available."}\nSource: ${result.url}`)
  ].join("\n");
}
