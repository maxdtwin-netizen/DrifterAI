import { config } from "../config.js";
import { cache, ttl } from "../utils/cache.js";
import { ApiError, NoResultsError } from "../utils/errors.js";
import { fetchJson, fetchText } from "../utils/http.js";

type ScApiEnvelope<T> = {
  success?: number | boolean;
  message?: string;
  data?: T;
};

type AnyRecord = Record<string, unknown>;

export type OrgInfo = {
  name?: string;
  sid?: string;
  members?: string | number;
  archetype?: string;
  commitment?: string;
  description?: string;
  url?: string;
};

export type ProfileInfo = {
  handle?: string;
  displayName?: string;
  enlisted?: string;
  location?: string;
  fluency?: string;
  org?: string;
  bio?: string;
  url?: string;
};

export type PatchInfo = {
  live?: string;
  ptu?: string;
  summary?: string;
};

export type StatusInfo = {
  status: string;
  summary: string;
};

function requireApiKey() {
  if (!config.starCitizenApiKey) {
    throw new ApiError("STAR_CITIZEN_API_KEY is required for StarCitizen-API endpoints");
  }
}

function scApiUrl(path: string, params?: Record<string, string>) {
  requireApiKey();
  const url = new URL(`${config.starCitizenApiBaseUrl}/${config.starCitizenApiKey}/v1/cache${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

function pick<T = unknown>(source: AnyRecord | undefined, keys: string[]) {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value as T;
  }
  return undefined;
}

function unwrap<T>(envelope: ScApiEnvelope<T>) {
  if (envelope.success === 0 || envelope.success === false) {
    throw new NoResultsError();
  }
  if (!envelope.data) throw new NoResultsError();
  return envelope.data;
}

export async function getOrg(orgName: string): Promise<OrgInfo> {
  return cache.remember(`rsi:org:${orgName.toLowerCase()}`, ttl.hours(24), async () => {
    const data = unwrap<AnyRecord>(
      await fetchJson<ScApiEnvelope<AnyRecord>>(scApiUrl(`/organization/${encodeURIComponent(orgName)}`))
    );
    const headline = pick<AnyRecord>(data, ["headline"]);

    return {
      name: pick<string>(data, ["name"]),
      sid: pick<string>(data, ["sid", "symbol"]),
      members: pick<string | number>(data, ["members", "member_count"]),
      archetype: pick<string>(data, ["archetype"]),
      commitment: pick<string>(data, ["commitment"]),
      description:
        pick<string>(data, ["description"]) ??
        (typeof headline === "object" ? pick<string>(headline, ["plaintext", "html"]) : undefined),
      url: pick<string>(data, ["url"])
    };
  });
}

export async function getProfile(handle: string): Promise<ProfileInfo> {
  return cache.remember(`rsi:profile:${handle.toLowerCase()}`, ttl.hours(24), async () => {
    const data = unwrap<AnyRecord>(
      await fetchJson<ScApiEnvelope<AnyRecord>>(scApiUrl(`/user/${encodeURIComponent(handle)}`))
    );

    const org = pick<AnyRecord>(data, ["organization", "org"]);
    const profile = pick<AnyRecord>(data, ["profile"]) ?? data;
    const page = pick<AnyRecord>(profile, ["page"]);

    return {
      handle: pick<string>(profile, ["handle", "username"]),
      displayName: pick<string>(profile, ["display", "display_name", "displayname", "name"]),
      enlisted: pick<string>(profile, ["enlisted", "enlisted_date"]),
      location: pick<string>(profile, ["location"]),
      fluency: Array.isArray(profile.fluency) ? profile.fluency.join(", ") : pick<string>(profile, ["fluency"]),
      org: typeof org === "object" ? pick<string>(org, ["name", "sid"]) : pick<string>(data, ["org"]),
      bio: pick<string>(profile, ["bio", "description", "badge"]),
      url: pick<string>(profile, ["url"]) ?? (typeof page === "object" ? pick<string>(page, ["url"]) : undefined)
    };
  });
}

export async function getPatchInfo(): Promise<PatchInfo> {
  return cache.remember("rsi:patch", ttl.hours(1), async () => {
    if (!config.starCitizenApiKey) {
      const wiki = await fetchJson<ScApiEnvelope<unknown> | { data?: unknown }>(
        `${config.wikiBaseUrl}/game-versions/default`
      );
      const data = "data" in wiki && wiki.data ? wiki.data : wiki;
      const live =
        typeof data === "string"
          ? data
          : data && typeof data === "object"
            ? pick<string>(data as AnyRecord, ["version", "name", "label", "build"])
            : undefined;

      return {
        live,
        summary: "Public default game version from Star Citizen Wiki API. PTU summary not available from this source."
      };
    }

    const data = unwrap<unknown>(
      await fetchJson<ScApiEnvelope<unknown>>(scApiUrl("/versions", { filter: "latest" }))
    );

    const rows = Array.isArray(data) ? data : [data];
    const live = rows.find((row) => JSON.stringify(row).toLowerCase().includes("live"));
    const ptu = rows.find((row) => JSON.stringify(row).toLowerCase().includes("ptu"));

    const value = (row: unknown) => {
      if (typeof row === "string") return row;
      if (!row || typeof row !== "object") return undefined;
      return pick<string>(row as AnyRecord, ["version", "name", "label", "build"]);
    };

    return {
      live: value(live) ?? value(rows[0]),
      ptu: value(ptu),
      summary: "Version data from public StarCitizen-API cache. Check official patch notes for full intel."
    };
  });
}

export async function getStatusInfo(): Promise<StatusInfo> {
  return cache.remember("rsi:status", ttl.minutes(5), async () => {
    const html = await fetchText("https://status.robertsspaceindustries.com/");
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&amp;/g, "&")
      .replace(/\n{2,}/g, "\n")
      .trim();

    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const status =
      lines.find((line) => /operational|maintenance|degraded|outage|interruption/i.test(line)) ??
      "See official status page";
    const incidentIndex = lines.findIndex((line) => /latest incidents/i.test(line));
    const summary = incidentIndex >= 0
      ? lines.slice(Math.max(0, incidentIndex - 8), incidentIndex + 8).join("\n").slice(0, 900)
      : lines.slice(0, 12).join("\n").slice(0, 900);

    return {
      status,
      summary: `${summary}\n\nhttps://status.robertsspaceindustries.com/`
    };
  });
}
