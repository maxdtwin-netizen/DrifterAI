import { config } from "../config.js";
import { cache, ttl } from "../utils/cache.js";
import { NoResultsError } from "../utils/errors.js";
import { fetchJson } from "../utils/http.js";

type UexEnvelope<T> = {
  data?: T;
  status?: string;
  message?: string;
};

type MarketRow = Record<string, unknown>;

const popularCommodities = [
  "Agricium",
  "Aluminum",
  "Beryl",
  "Diamond",
  "Gold",
  "Hephaestanite",
  "Laranite",
  "Quantainium",
  "Quartz",
  "RMC",
  "Taranite",
  "Titanium",
  "Tungsten",
  "Waste"
];

export type CommodityQuote = {
  commodity: string;
  bestBuy?: MarketRow;
  bestSell?: MarketRow;
  profit?: number;
  updatedAt?: unknown;
};

export type RouteInfo = {
  commodity: string;
  buyLocation?: string;
  sellLocation?: string;
  buyPrice?: number;
  sellPrice?: number;
  profit?: number;
  updatedAt?: unknown;
};

export type MiningInfo = {
  material: string;
  sellLocations: MarketRow[];
  bestPrice?: number;
  updatedAt?: unknown;
};

function uexUrl(path: string, params?: Record<string, string>) {
  const url = new URL(`${config.uexBaseUrl}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

function authHeaders() {
  return config.uexApiKey ? { Authorization: `Bearer ${config.uexApiKey}` } : undefined;
}

function rowsFromResponse(response: UexEnvelope<unknown> | unknown): MarketRow[] {
  const payload = typeof response === "object" && response && "data" in response ? (response as UexEnvelope<unknown>).data : response;
  if (Array.isArray(payload)) return payload as MarketRow[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["items", "commodities", "prices", "routes", "terminals"]) {
      if (Array.isArray(record[key])) return record[key] as MarketRow[];
    }
    return [record];
  }
  return [];
}

function text(row: MarketRow | undefined, keys: string[]) {
  if (!row) return undefined;
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return String(value);
  }
  return undefined;
}

function num(row: MarketRow | undefined, keys: string[]) {
  const raw = text(row, keys);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function location(row: MarketRow | undefined) {
  return text(row, [
    "terminal_name",
    "location_name",
    "city_name",
    "outpost_name",
    "space_station_name",
    "planet_name",
    "moon_name"
  ]);
}

function updated(row: MarketRow | undefined) {
  return text(row, ["date_modified", "date_added", "updated_at", "timestamp"]);
}

async function getCommodityRows(commodity: string) {
  const key = `uex:commodity:${commodity.toLowerCase()}`;
  return cache.remember(key, ttl.minutes(10), async () => {
    const candidates = [
      uexUrl("/commodities_prices_all", { commodity_name: commodity }),
      uexUrl("/commodities_prices", { commodity_name: commodity }),
      uexUrl("/commodities", { commodity_name: commodity })
    ];

    for (const url of candidates) {
      try {
        const rows = rowsFromResponse(await fetchJson<UexEnvelope<unknown>>(url, { headers: authHeaders() }));
        const filtered = rows.filter((row) => {
          const name = text(row, ["commodity_name", "name", "code"]);
          return !name || name.toLowerCase().includes(commodity.toLowerCase());
        });
        if (filtered.length > 0) return filtered;
      } catch {
        continue;
      }
    }

    throw new NoResultsError();
  });
}

function buyPrice(row: MarketRow | undefined) {
  return num(row, ["price_buy", "buy_price", "price", "price_avg_buy"]);
}

function sellPrice(row: MarketRow | undefined) {
  return num(row, ["price_sell", "sell_price", "price", "price_avg_sell"]);
}

export async function getCommodityQuote(commodity: string): Promise<CommodityQuote> {
  const rows = await getCommodityRows(commodity);
  const buyRows = rows.filter((row) => buyPrice(row) !== undefined);
  const sellRows = rows.filter((row) => sellPrice(row) !== undefined);

  const bestBuy = buyRows.sort((a, b) => (buyPrice(a) ?? Infinity) - (buyPrice(b) ?? Infinity))[0];
  const bestSell = sellRows.sort((a, b) => (sellPrice(b) ?? -Infinity) - (sellPrice(a) ?? -Infinity))[0];

  if (!bestBuy && !bestSell) throw new NoResultsError();

  const buy = buyPrice(bestBuy);
  const sell = sellPrice(bestSell);

  return {
    commodity,
    bestBuy,
    bestSell,
    profit: buy !== undefined && sell !== undefined ? sell - buy : undefined,
    updatedAt: updated(bestSell) ?? updated(bestBuy)
  };
}

export async function findTradeRoute(commodity: string, start?: string): Promise<RouteInfo> {
  const quote = await getCommodityQuote(commodity);
  const buy = buyPrice(quote.bestBuy);
  const sell = sellPrice(quote.bestSell);

  let buyLocation = location(quote.bestBuy);
  if (start) {
    const startMatch = (await getCommodityRows(commodity)).find((row) =>
      (location(row) ?? "").toLowerCase().includes(start.toLowerCase())
    );
    if (startMatch && buyPrice(startMatch) !== undefined) {
      buyLocation = location(startMatch);
      quote.bestBuy = startMatch;
    }
  }

  return {
    commodity,
    buyLocation,
    sellLocation: location(quote.bestSell),
    buyPrice: buyPrice(quote.bestBuy) ?? buy,
    sellPrice: sell,
    profit:
      (buyPrice(quote.bestBuy) ?? buy) !== undefined && sell !== undefined
        ? sell - (buyPrice(quote.bestBuy) ?? buy ?? 0)
        : undefined,
    updatedAt: quote.updatedAt
  };
}

export async function getMiningInfo(material: string): Promise<MiningInfo> {
  const rows = await getCommodityRows(material);
  const sellLocations = rows
    .filter((row) => sellPrice(row) !== undefined)
    .sort((a, b) => (sellPrice(b) ?? 0) - (sellPrice(a) ?? 0))
    .slice(0, 5);

  if (sellLocations.length === 0) throw new NoResultsError();

  return {
    material,
    sellLocations,
    bestPrice: sellPrice(sellLocations[0]),
    updatedAt: updated(sellLocations[0])
  };
}

export async function autocompleteCommodities(query: string) {
  const fallback = popularCommodities.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  if (query.length < 2) return fallback.slice(0, 25);

  try {
    const rows = rowsFromResponse(
      await fetchJson<UexEnvelope<unknown>>(uexUrl("/commodities", { commodity_name: query }), {
        headers: authHeaders()
      })
    );
    const apiMatches = rows
      .map((row) => text(row, ["name", "commodity_name"]))
      .filter((name): name is string => Boolean(name))
    return Array.from(new Set([...fallback, ...apiMatches])).slice(0, 25);
  } catch {
    return fallback.slice(0, 25);
  }
}

export const uexFormat = {
  location,
  buyPrice,
  sellPrice
};
