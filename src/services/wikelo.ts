import { cache, ttl } from "../utils/cache.js";
import { fetchJson } from "../utils/http.js";

type WikiParseResponse = {
  parse?: {
    title?: string;
    text?: {
      "*": string;
    };
  };
};

type WikiCategoryResponse = {
  query?: {
    categorymembers?: Array<{
      title?: string;
    }>;
  };
};

export type WikeloContractInfo = {
  title: string;
  mission: string;
  reward: string;
  locations: string[];
  requirements: string[];
  advice: string[];
  sources: string[];
};

const wikeloLocations = ["Kinga", "Dasi", "Selo Station"];

const fallbackContracts: WikeloContractInfo[] = [
  {
    title: "Constellation Taurus Wikelo War Special",
    mission: "Want Taurus ship",
    reward: "Constellation Taurus",
    locations: wikeloLocations,
    requirements: [
      "30x Wikelo Favor",
      "3x Carinite (Pure)",
      "3x Irradiated Valakkar Pearl (Grade AAA)",
      "3x Government Cartography Agency Medal (Pristine)"
    ],
    advice: [
      "This is a Wikelo collection contract, not a normal aUEC purchase.",
      "This recipe is confirmed by community Wikelo trackers and Star Citizen Wiki search snippets, but still verify in-game before farming.",
      "The reward is listed as RSI Constellation Taurus Wikelo War Special in Star Citizen Wiki API mission data."
    ],
    sources: [
      "https://wikelotrades.com/",
      "https://wikelotracker.com/",
      "https://api.star-citizen.wiki/missions/want-taurus-ship",
      "https://starcitizen.tools/Wikelo"
    ]
  },
  {
    title: "Starlancer MAX",
    mission: "More than a Max",
    reward: "Starlancer MAX",
    locations: wikeloLocations,
    requirements: [
      "30x Wikelo Favor",
      "10x Ace Interceptor Helmet",
      "3x Carinite (Pure)",
      "3x Irradiated Valakkar Pearl (Grade AAA)"
    ],
    advice: [
      "Useful as a closest confirmed large cargo-ship recipe if another large Wikelo ship is not found.",
      "Verify the target contract in-game before spending rare items."
    ],
    sources: ["https://starcitizen.tools/Wikelo", "https://wikelotrades.com/"]
  },
  {
    title: "Zeus Mk II CL",
    mission: "Zeus Cargo Special",
    reward: "Zeus Mk II CL",
    locations: wikeloLocations,
    requirements: [
      "20x Wikelo Favor",
      "15x Carinite",
      "10x Ace Interceptor Helmet",
      "2x Carinite (Pure)"
    ],
    advice: [
      "Useful as a smaller confirmed cargo-ship recipe for comparison.",
      "Verify the target contract in-game before spending rare items."
    ],
    sources: ["https://starcitizen.tools/Wikelo", "https://wikelotrades.com/"]
  },
  {
    title: "ATLS GEO \"Snowland\"",
    mission: "ATLS Snowland Color",
    reward: "ATLS GEO \"Snowland\"",
    locations: wikeloLocations,
    requirements: [
      "1x Wikelo Favor",
      "1x Irradiated Valakkar Pearl (Grade AAA)",
      "1x Argo ATLS"
    ],
    advice: [
      "This is a Wikelo collection contract, not a normal aUEC purchase.",
      "Accept it at a Wikelo Emporium and deposit items at that station's freight elevator.",
      "Verify the contract in-game before hauling items because requirements can change by patch."
    ],
    sources: ["https://starcitizen.tools/Wikelo", "https://starcitizen.tools/ATLS_GEO"]
  },
  {
    title: "ATLS GEO \"Orange Line\"",
    mission: "ATLS Orange Line",
    reward: "ATLS GEO \"Orange Line\"",
    locations: wikeloLocations,
    requirements: [
      "1x Wikelo Favor",
      "36x SCU Quantanium",
      "1x Argo ATLS",
      "8x SCU Copper",
      "8x SCU Tungsten",
      "8x SCU Corundum"
    ],
    advice: [
      "This is a Wikelo collection contract, not a normal aUEC purchase.",
      "Treat the Quantanium requirement as the risky part and organize escorts or a dedicated hauler.",
      "Verify the contract in-game before hauling items because requirements can change by patch."
    ],
    sources: ["https://starcitizen.tools/Wikelo", "https://starcitizen.tools/ATLS_GEO"]
  },
  {
    title: "ATLS GEO \"Cool Metal\"",
    mission: "ATLS Cool Metal Color",
    reward: "ATLS GEO \"Cool Metal\"",
    locations: wikeloLocations,
    requirements: [
      "1x Wikelo Favor",
      "1x Carinite (Pure)",
      "1x Argo ATLS"
    ],
    advice: [
      "This is a Wikelo collection contract, not a normal aUEC purchase.",
      "Accept it at a Wikelo Emporium and deposit items at that station's freight elevator.",
      "Verify the contract in-game before hauling items because requirements can change by patch."
    ],
    sources: ["https://starcitizen.tools/Wikelo", "https://starcitizen.tools/ATLS_GEO"]
  }
];

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function cellTexts(rowHtml: string) {
  const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)];
  return cells.map((cell) => stripTags(cell[1])).filter(Boolean);
}

function parseWikeloContracts(html: string): WikeloContractInfo[] {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const contracts: WikeloContractInfo[] = [];

  for (const row of rows) {
    const cells = cellTexts(row[1]);
    if (cells.length < 3) continue;

    const [mission, itemsNeeded, reward] = cells;
    if (/contract/i.test(mission) && /items/i.test(itemsNeeded)) continue;
    if (!mission || !itemsNeeded || !reward) continue;

    const requirements = itemsNeeded
      .split(/\s{2,}| (?=\d+x |\d+ SCU )/i)
      .map((item) => item.trim())
      .filter((item) => /\d+x|\d+ SCU/i.test(item));

    contracts.push({
      title: reward,
      mission: mission.replace(/^"|"$/g, ""),
      reward,
      locations: wikeloLocations,
      requirements: requirements.length ? requirements : [itemsNeeded],
      advice: [
        "This is a Wikelo collection contract, not a normal aUEC purchase.",
        "Accept it at a Wikelo Emporium and deposit items at that station's freight elevator.",
        "Verify the contract in-game before hauling items because requirements can change by patch."
      ],
      sources: ["https://starcitizen.tools/Wikelo"]
    });
  }

  return contracts;
}

function linesFromHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(p|li|tr|td|th|h2|h3|dt|dd)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => decodeHtml(line))
    .filter(Boolean);
}

function valuesAfterHeading(lines: string[], heading: RegExp, stop: RegExp) {
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return [];

  const values: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (stop.test(line)) break;
    if (/^edit$/i.test(line)) continue;
    values.push(line);
  }

  return values;
}

function contractFromPage(title: string, html: string): WikeloContractInfo | undefined {
  const lines = linesFromHtml(html);
  const requirementLines = valuesAfterHeading(lines, /^Objectives$/i, /^(Rewards|References|Description)$/i);
  const rewardLines = valuesAfterHeading(lines, /^Rewards$/i, /^(References|Description|Objectives)$/i);

  const requirements = requirementLines
    .map((line) => line.replace(/^Bring\s+/i, "").replace(/\s+\.?\s*Me at.*$/i, "").trim())
    .filter((line) => /\d+x|\d+ SCU/i.test(line));

  const rewards = rewardLines
    .filter((line) => !/^one of/i.test(line))
    .filter((line) => !/^edit$/i.test(line))
    .slice(0, 8);

  if (!requirements.length && !rewards.length) return undefined;

  return {
    title,
    mission: title,
    reward: rewards.join(", ") || "See contract rewards",
    locations: wikeloLocations,
    requirements: requirements.length ? requirements : ["See contract objectives on source page"],
    advice: [
      "This is a Wikelo collection contract, not a normal aUEC purchase.",
      "Some Wikelo rewards are random from a pool, so confirm the contract text in-game before farming.",
      "Deposit items at the Wikelo Emporium station freight elevator."
    ],
    sources: [`https://starcitizen.tools/${encodeURIComponent(title.replaceAll(" ", "_"))}`]
  };
}

async function fetchWikeloCategoryContracts(query: string) {
  const categoryUrl = new URL("https://starcitizen.tools/api.php");
  categoryUrl.searchParams.set("action", "query");
  categoryUrl.searchParams.set("list", "categorymembers");
  categoryUrl.searchParams.set("cmtitle", "Category:Wikelo contracts");
  categoryUrl.searchParams.set("cmlimit", "75");
  categoryUrl.searchParams.set("format", "json");
  categoryUrl.searchParams.set("formatversion", "2");

  const category = await fetchJson<WikiCategoryResponse>(categoryUrl);
  const titles = (category.query?.categorymembers ?? [])
    .map((member) => member.title)
    .filter((title): title is string => Boolean(title && !title.startsWith("Category:")));

  const queryWords = normalize(query).split(" ").filter((word) => word.length > 2);
  const matchingTitles = titles
    .map((title) => ({
      title,
      score: queryWords.reduce((score, word) => score + (normalize(title).includes(word) ? 1 : 0), 0)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => item.title);

  const contracts: WikeloContractInfo[] = [];
  for (const title of matchingTitles) {
    const pageUrl = new URL("https://starcitizen.tools/api.php");
    pageUrl.searchParams.set("action", "parse");
    pageUrl.searchParams.set("page", title);
    pageUrl.searchParams.set("prop", "text");
    pageUrl.searchParams.set("format", "json");
    pageUrl.searchParams.set("formatversion", "2");

    const page = await fetchJson<WikiParseResponse>(pageUrl);
    const html = page.parse?.text?.["*"] ?? "";
    const contract = contractFromPage(title, html);
    if (contract) contracts.push(contract);
  }

  return contracts;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreContract(contract: WikeloContractInfo, query: string) {
  const haystack = normalize(`${contract.reward} ${contract.title} ${contract.mission}`);
  const words = normalize(query).split(" ").filter((word) => word.length > 2);
  return words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

export async function getWikeloContractInfo(query: string) {
  const contracts = await cache.remember("wikelo:contracts", ttl.hours(6), async () => {
    try {
      const url = new URL("https://starcitizen.tools/api.php");
      url.searchParams.set("action", "parse");
      url.searchParams.set("page", "Wikelo");
      url.searchParams.set("prop", "text");
      url.searchParams.set("format", "json");
      url.searchParams.set("formatversion", "2");
      const data = await fetchJson<WikiParseResponse>(url);
      const html = data.parse?.text?.["*"] ?? "";
      const parsed = parseWikeloContracts(html);
      const categoryContracts = await fetchWikeloCategoryContracts(query).catch(() => []);
      return [...parsed, ...categoryContracts, ...fallbackContracts];
    } catch {
      return fallbackContracts;
    }
  });

  const normalizedQuery = normalize(query);
  if (/\batls\b/.test(normalizedQuery) && /\bgeo\b/.test(normalizedQuery)) {
    const atlsGeoContracts = contracts.filter((contract) => normalize(contract.reward).includes("atls geo"));
    if (atlsGeoContracts.length) return atlsGeoContracts.slice(0, 4);
  }

  return contracts
    .map((contract) => ({ contract, score: scoreContract(contract, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.contract);
}

export function getSimilarWikeloContracts(query: string) {
  const normalizedQuery = normalize(query);
  const wantedCargo = /\b(c2|taurus|starlancer|max|zeus|c1|spirit|cargo|freight|large|ship)\b/.test(normalizedQuery);
  const wantedAtls = /\batls\b/.test(normalizedQuery);

  if (wantedAtls) {
    return fallbackContracts.filter((contract) => normalize(contract.reward).includes("atls"));
  }

  if (wantedCargo) {
    return fallbackContracts.filter((contract) =>
      ["constellation taurus", "starlancer max", "zeus mk ii cl"].some((reward) => normalize(contract.reward).includes(reward))
    );
  }

  return fallbackContracts.slice(0, 4);
}

export function formatWikeloContracts(contracts: WikeloContractInfo[]) {
  return contracts
    .map((contract) => [
      `Reward: ${contract.reward}`,
      `Mission: ${contract.mission}`,
      `Known Wikelo Emporium locations: ${contract.locations.join(", ")}`,
      "Required items:",
      ...contract.requirements.map((item) => `- ${item}`),
      "Advice:",
      ...contract.advice.map((item) => `- ${item}`),
      `Sources: ${contract.sources.join(", ")}`
    ].join("\n"))
    .join("\n\n");
}

export function getWikeloPolarisContractInfo() {
  return {
    title: "Polaris Wikelo Special",
    mission: "Now make Polaris. Short Time Deal.",
    reward: "Polaris",
    locations: wikeloLocations,
    requirements: [
      "50x Wikelo Favor",
      "20x Carinite",
      "20x Irradiated Valakkar Fang (Apex)",
      "20x MG Scrip",
      "15x Polaris Bit",
      "15x ASD Secure Drive",
      "15x Ace Interceptor Helmet",
      "15x Irradiated Valakkar Pearl (Grade AAA)",
      "15x UEE 6th Platoon Medal (Pristine)",
      "15x Carinite (Pure)",
      "10x DCHS-05 Orbital Positioning Comp-Board",
      "1x RCMBNT-PWL-1",
      "1x RCMBNT-PWL-2",
      "1x RCMBNT-PWL-3",
      "1x RCMBNT-RGL-1",
      "1x RCMBNT-RGL-2",
      "1x RCMBNT-RGL-3",
      "1x RCMBNT-XTL-1",
      "1x RCMBNT-XTL-2",
      "1x RCMBNT-XTL-3"
    ],
    advice: [
      "Treat this as an org-level collection project, not a solo shopping trip.",
      "Contract requirements are deposited at the Wikelo Emporium location freight elevator.",
      "Verify the list in-game before final turn-in because Wikelo contracts can change by patch.",
      "Deposit in smaller batches where possible instead of risking the whole haul at once."
    ],
    sources: [
      "https://wikelotrades.com/",
      "https://starcitizen.tools/Polaris_Bit",
      "https://starcitizen.tools/Wikelo"
    ]
  };
}
