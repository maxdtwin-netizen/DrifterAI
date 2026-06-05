import { config } from "../config.js";
import { cache, ttl } from "../utils/cache.js";
import { AmbiguousResultError, NoResultsError } from "../utils/errors.js";
import { fetchJson } from "../utils/http.js";

type WikiEnvelope<T> = {
  data: T;
};

type WikiSearchResult = {
  name?: string;
  title?: string;
  type?: string;
  resource?: string;
  resource_type?: string;
  identifier?: string;
  slug?: string;
  uuid?: string;
  id?: string | number;
  url?: string;
};

export type ShipInfo = {
  name: string;
  manufacturer?: string;
  role?: string;
  crew?: string;
  cargo?: string | number;
  size?: string;
  speed?: string | number;
  weapons?: string[];
  components?: string[];
  image?: string;
  description?: string;
};

export type LocationInfo = {
  name: string;
  type?: string;
  system?: string;
  parent?: string;
  affiliation?: string;
  description?: string;
  image?: string;
};

const knownLocationFallbacks: Record<string, LocationInfo> = {
  "grim hex": {
    name: "Grim HEX",
    type: "Space station",
    system: "Stanton",
    parent: "Yela",
    affiliation: "Outlaw / Nine Tails",
    description:
      "Sealed settlement orbiting Yela. Former mining housing turned outlaw station, with shops, medical, commodity trading, repair, refuel, rearm, and ship services."
  },
  grimhex: {
    name: "Grim HEX",
    type: "Space station",
    system: "Stanton",
    parent: "Yela",
    affiliation: "Outlaw / Nine Tails",
    description:
      "Sealed settlement orbiting Yela. Former mining housing turned outlaw station, with shops, medical, commodity trading, repair, refuel, rearm, and ship services."
  }
};

const popularShips = [
  "Avenger Titan",
  "Caterpillar",
  "C2 Hercules",
  "Corsair",
  "Cutlass Black",
  "Gladius",
  "Hammerhead",
  "Mercury Star Runner",
  "Prospector",
  "Vulture"
];

const knownShipFallbacks: Record<string, ShipInfo> = {
  "avenger titan": {
    name: "Avenger Titan",
    manufacturer: "Aegis Dynamics",
    role: "Light freight / starter combat",
    crew: "1",
    cargo: "8 SCU",
    size: "Small",
    description: "Fast starter hauler with teeth. Good daily driver for solo contracts."
  },
  "c2 hercules": {
    name: "C2 Hercules",
    manufacturer: "Crusader Industries",
    role: "Heavy transport",
    crew: "1-2",
    cargo: "696 SCU",
    size: "Large",
    description: "Heavy cargo lifter. Bring escorts if the cargo is worth stealing."
  },
  corsair: {
    name: "Corsair",
    manufacturer: "Drake Interplanetary",
    role: "Exploration / gunship",
    crew: "1-4",
    cargo: "72 SCU",
    size: "Large",
    description: "Drake explorer with serious forward firepower and suspicious intentions."
  },
  "cutlass black": {
    name: "Cutlass Black",
    manufacturer: "Drake Interplanetary",
    role: "Medium fighter / freight",
    crew: "1-3",
    cargo: "46 SCU",
    size: "Medium",
    description: "Flexible raider workhorse. Cargo, crew, guns, trouble."
  },
  gladius: {
    name: "Gladius",
    manufacturer: "Aegis Dynamics",
    role: "Light fighter",
    crew: "1",
    cargo: "0 SCU",
    size: "Small",
    description: "Agile military light fighter. Simple job: win the merge."
  },
  prospector: {
    name: "Prospector",
    manufacturer: "MISC",
    role: "Mining",
    crew: "1",
    cargo: "32 SCU",
    size: "Small",
    description: "Solo mining ship. Finds rocks, prints money, attracts pirates."
  },
  vulture: {
    name: "Vulture",
    manufacturer: "Drake Interplanetary",
    role: "Salvage",
    crew: "1",
    cargo: "12 SCU",
    size: "Small",
    description: "Solo salvage ship. Turns wrecks into payday."
  }
};

const popularLocations = [
  "Area18",
  "Bajini Point",
  "Everus Harbor",
  "Grim HEX",
  "Hurston",
  "Lorville",
  "MicroTech",
  "New Babbage",
  "Orison",
  "Port Tressler",
  "Seraphim Station",
  "Yela"
];

function wikiUrl(path: string, params?: Record<string, string>) {
  const url = new URL(`${config.wikiBaseUrl}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

function pick<T = unknown>(source: Record<string, unknown>, keys: string[]): T | undefined {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value as T;
  }
  return undefined;
}

function asArrayNames(value: unknown): string[] {
  if (!value) return [];
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item) {
        const record = item as Record<string, unknown>;
        return pick<string>(record, ["name", "type", "class", "item_name"]);
      }
      return undefined;
    })
    .filter((item): item is string => Boolean(item));
}

function imageUrl(data: Record<string, unknown>) {
  const direct = pick<string>(data, ["image", "thumbnail", "media"]);
  if (typeof direct === "string") return direct;

  const images = pick<unknown[]>(data, ["images", "photos"]);
  const first = Array.isArray(images) ? images[0] : undefined;
  if (typeof first === "string") return first;
  if (first && typeof first === "object") {
    return pick<string>(first as Record<string, unknown>, ["url", "source", "thumbnail"]);
  }

  return undefined;
}

function rowsFromWiki<T>(response: WikiEnvelope<T[] | Record<string, unknown>> | T[] | Record<string, unknown>): T[] {
  const payload =
    typeof response === "object" && response && "data" in response
      ? (response as WikiEnvelope<T[] | Record<string, unknown>>).data
      : response;

  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["results", "items", "resources", "data"]) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
  }

  return [];
}

async function searchResource(query: string, wantedTypes: string[]) {
  const response = await fetchJson<WikiEnvelope<WikiSearchResult[] | Record<string, unknown>>>(
    wikiUrl(`/search/${encodeURIComponent(query)}`)
  );

  const allResults = rowsFromWiki<WikiSearchResult>(response);
  const results = allResults.filter((result) => {
    const type = (result.type ?? result.resource_type ?? result.resource ?? "").toLowerCase();
    return wantedTypes.some((wanted) => type.includes(wanted));
  });

  const searchableResults = results.length > 0 ? results : allResults;
  if (searchableResults.length === 0) throw new NoResultsError();

  const exact = searchableResults.find((result) => {
    const name = (result.name ?? result.title ?? "").toLowerCase();
    return name === query.toLowerCase();
  });
  if (exact) return exact;

  if (results.length === 0 && allResults.length > 0) {
    return allResults[0];
  }

  if (searchableResults.length > 1) {
    throw new AmbiguousResultError(searchableResults.map((result) => result.name ?? result.title ?? "Unknown"));
  }

  return searchableResults[0];
}

async function getVehicleBySlug(slug: string) {
  return fetchJson<WikiEnvelope<Record<string, unknown>>>(
    wikiUrl(`/vehicles/${encodeURIComponent(slug)}`, { include: "ports,components,manufacturer" })
  );
}

async function searchVehiclesByName(name: string) {
  const variants = Array.from(
    new Set([
      name,
      name.replace(/\s+/g, "_"),
      name.replace(/\s+/g, "-"),
      name.replace(/\s+/g, "")
    ])
  );

  for (const variant of variants) {
    const response = await fetchJson<WikiEnvelope<Record<string, unknown>[] | Record<string, unknown>>>(
      wikiUrl("/vehicles", { "filter[name]": variant, include: "ports,components,manufacturer" })
    );
    const rows = rowsFromWiki<Record<string, unknown>>(response);
    if (rows.length > 0) return rows;
  }

  return [];
}

async function getLocationBySlug(slug: string) {
  return fetchJson<WikiEnvelope<Record<string, unknown>>>(
    wikiUrl(`/locations/${encodeURIComponent(slug)}`, { include: "parent,children" })
  );
}

async function searchLocationsByName(name: string) {
  const variants = Array.from(
    new Set([
      name,
      name.replace(/\s+/g, "_"),
      name.replace(/\s+/g, ""),
      name.replace(/hex/i, "HEX")
    ])
  );

  for (const variant of variants) {
    const response = await fetchJson<WikiEnvelope<Record<string, unknown>[] | Record<string, unknown>>>(
      wikiUrl("/locations", { "filter[name]": variant })
    );
    const rows = rowsFromWiki<Record<string, unknown>>(response);
    if (rows.length > 0) return rows;
  }

  return [];
}

export async function findShip(name: string): Promise<ShipInfo> {
  return cache.remember(`wiki:ship:${name.toLowerCase()}`, ttl.hours(24), async () => {
    const fallback = knownShipFallbacks[name.toLowerCase().replace(/\s+/g, " ").trim()];
    if (fallback) return fallback;

    let data: Record<string, unknown>;

    try {
      const result = await searchResource(name, ["vehicle", "ship"]);
      const slug = String(result.identifier ?? result.slug ?? result.uuid ?? result.id ?? result.name ?? name)
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/_/g, "-");
      data = (await getVehicleBySlug(slug)).data;
    } catch (error) {
      if (!(error instanceof NoResultsError)) throw error;

      const rows = await searchVehiclesByName(name);
      if (rows.length === 0) throw error;

      const exact = rows.find((row) => {
        const rowName = (pick<string>(row, ["name", "title"]) ?? "").toLowerCase();
        return rowName === name.toLowerCase();
      });
      data = exact ?? rows[0];
    }

    const manufacturer = pick<Record<string, unknown> | string>(data, ["manufacturer"]);
    const manufacturerName =
      typeof manufacturer === "object" ? pick<string>(manufacturer, ["name"]) : manufacturer;

    return {
      name: pick<string>(data, ["name", "title"]) ?? name,
      manufacturer: manufacturerName,
      role: pick<string>(data, ["role", "focus", "career", "type"]),
      crew: pick<string>(data, ["crew", "crew_min", "min_crew", "max_crew"]),
      cargo: pick<string | number>(data, ["cargo", "cargo_capacity", "scu"]),
      size: pick<string>(data, ["size", "vehicle_size", "classification"]),
      speed: pick<string | number>(data, ["speed", "max_speed", "scm_speed"]),
      weapons: asArrayNames(pick(data, ["weapons", "hardpoints"])),
      components: asArrayNames(pick(data, ["components", "ports"])).slice(0, 12),
      image: imageUrl(data),
      description: pick<string>(data, ["description", "excerpt", "short_description"])
    };
  });
}

export async function findLocation(name: string): Promise<LocationInfo> {
  return cache.remember(`wiki:location:${name.toLowerCase()}`, ttl.hours(24), async () => {
    const fallback = knownLocationFallbacks[name.toLowerCase().replace(/\s+/g, " ").trim()];
    if (fallback) return fallback;

    let data: Record<string, unknown>;

    try {
      const result = await searchResource(name, ["location", "starmap", "station", "settlement"]);
      const slug = String(result.identifier ?? result.slug ?? result.uuid ?? result.id ?? result.name ?? name)
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/_/g, "-");
      data = (await getLocationBySlug(slug)).data;
    } catch (error) {
      if (!(error instanceof NoResultsError)) throw error;

      const rows = await searchLocationsByName(name);
      if (rows.length === 0) throw error;

      const exact = rows.find((row) => {
        const rowName = (pick<string>(row, ["name", "title"]) ?? "").toLowerCase();
        return rowName === name.toLowerCase();
      });
      data = exact ?? rows[0];
    }

    const parent = pick<Record<string, unknown> | string>(data, ["parent"]);
    const parentName = typeof parent === "object" ? pick<string>(parent, ["name"]) : parent;

    return {
      name: pick<string>(data, ["name", "title"]) ?? name,
      type: pick<string>(data, ["type", "location_type", "classification"]),
      system: pick<string>(data, ["system", "star_system"]),
      parent: parentName,
      affiliation: pick<string>(data, ["affiliation", "faction"]),
      description: pick<string>(data, ["description", "excerpt", "short_description"]),
      image: imageUrl(data)
    };
  });
}

export async function autocompleteShips(query: string) {
  const fallback = popularShips.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  if (query.length < 2) return fallback.slice(0, 25);

  try {
    const response = await fetchJson<WikiEnvelope<WikiSearchResult[] | Record<string, unknown>>>(
      wikiUrl(`/search/${encodeURIComponent(query)}`)
    );
    const apiMatches = rowsFromWiki<WikiSearchResult>(response)
      .filter((item) => {
        const type = (item.type ?? item.resource_type ?? item.resource ?? "").toLowerCase();
        return ["ship", "vehicle"].some((wanted) => type.includes(wanted));
      })
      .map((item) => item.name ?? item.title)
      .filter((name): name is string => Boolean(name))
    return Array.from(new Set([...fallback, ...apiMatches])).slice(0, 25);
  } catch {
    return fallback.slice(0, 25);
  }
}

export async function autocompleteLocations(query: string) {
  const popularMatches = popularLocations.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  const knownMatches = Object.values(knownLocationFallbacks)
    .map((location) => location.name)
    .filter((name, index, names) => names.indexOf(name) === index)
    .filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  const fallback = Array.from(new Set([...popularMatches, ...knownMatches]));

  if (query.length < 2) return fallback.slice(0, 25);

  try {
    const response = await fetchJson<WikiEnvelope<WikiSearchResult[] | Record<string, unknown>>>(
      wikiUrl(`/search/${encodeURIComponent(query)}`)
    );
    const apiMatches = rowsFromWiki<WikiSearchResult>(response)
      .filter((item) => {
        const type = (item.type ?? item.resource_type ?? item.resource ?? "").toLowerCase();
        return ["location", "starmap", "station", "settlement"].some((wanted) => type.includes(wanted));
      })
      .map((item) => item.name ?? item.title)
      .filter((name): name is string => Boolean(name));

    return Array.from(new Set([...fallback, ...apiMatches])).slice(0, 25);
  } catch {
    return fallback.slice(0, 25);
  }
}
