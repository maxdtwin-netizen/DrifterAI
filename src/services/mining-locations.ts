import { cache, ttl } from "../utils/cache.js";
import { fetchText } from "../utils/http.js";

export type MineableLocation = {
  name: string;
  type?: string;
  spawn?: string;
  occurrence?: string;
};

const materialSlugs: Record<string, string> = {
  quantainium: "quantainium-raw",
  quantanium: "quantainium-raw",
  gold: "gold-raw",
  diamond: "diamond-raw",
  laranite: "laranite-raw",
  taranite: "taranite-raw",
  agricium: "agricium-raw",
  beryl: "beryl-raw",
  hephaestanite: "hephaestanite-raw",
  titanium: "titanium-raw",
  aluminum: "aluminum-raw",
  quartz: "quartz-raw",
  tungsten: "tungsten-raw"
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToLines(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/(div|p|tr|li|h2|h3|td|th|a)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map(decodeHtml)
    .filter(Boolean);
}

function parseMineableLocations(html: string) {
  const lines = htmlToLines(html);
  const locations: MineableLocation[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const match = line.match(/^(Stanton[^:]*:\s+.+?)\s+(Planet|Moon|Asteroid|Star)\s+Spawn:\s+([^ ]+%)(?:\s+Occurrence:\s+([^ ]+%))?/i);
    if (!match) continue;

    const name = match[1].trim();
    if (seen.has(name)) continue;
    seen.add(name);

    locations.push({
      name,
      type: match[2],
      spawn: match[3],
      occurrence: match[4]
    });

    if (locations.length >= 12) break;
  }

  return locations;
}

export async function getMineableLocations(material: string) {
  const normalized = material.toLowerCase().replace(/\s+\(raw\)$/i, "").trim();
  const slug = materialSlugs[normalized] ?? `${normalized.replace(/\s+/g, "-")}-raw`;

  return cache.remember(`wiki:mineable-locations:${slug}`, ttl.hours(24), async () => {
    const html = await fetchText(`https://api.star-citizen.wiki/commodities/${encodeURIComponent(slug)}`);
    return parseMineableLocations(html);
  });
}
